use std::sync::Mutex;
use tauri::{Manager, RunEvent, Url};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

// The desktop shell for genuine offline operation, not a browser shortcut:
// in a release build this app never loads a remote URL at all. It spawns a
// bundled Node.js sidecar running the app's own `next build --output
// standalone` server (assembled by scripts/prepare-tauri-server.mjs into
// src-tauri/resources/server, bundled as a Tauri resource) on a fixed local
// port, waits for it to actually accept connections, then points the
// already-created (but not yet visible) main window at that local URL and
// shows it. The window is only ever shown once real content is ready, so
// there is no flash of an empty/default page.
//
// In dev (`tauri dev`), none of this runs -- the window is shown
// immediately and Tauri's own devUrl mechanism (configured in
// tauri.conf.json, pointing at `next dev`) resolves the window's content
// exactly as tauri init's own default flow already does.
const LOCAL_SERVER_PORT: u16 = 17423;

// Tauri does not kill a spawned sidecar automatically when the app quits --
// a real gotcha confirmed by launching this app for real (under Xvfb) and
// watching `next-server` survive as an orphan after the window closed.
// Held here so the ExitRequested handler in run() below can kill it.
struct ServerSidecar(Mutex<Option<CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(ServerSidecar(Mutex::new(None)))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let window = app
        .get_webview_window("main")
        .expect("the \"main\" window must be declared in tauri.conf.json");

      if cfg!(debug_assertions) {
        // devUrl already resolved the window's content; nothing to spawn.
        window.show().expect("failed to show the dev window");
      } else {
        start_bundled_server_and_navigate(app.handle().clone(), window);
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
      if let Some(child) = app_handle.state::<ServerSidecar>().0.lock().unwrap().take() {
        let _ = child.kill();
      }
    }
  });
}

fn start_bundled_server_and_navigate(app: tauri::AppHandle, window: tauri::WebviewWindow) {
  let resource_dir = app
    .path()
    .resource_dir()
    .expect("failed to resolve the app's resource directory")
    .join("server");

  let (mut rx, child) = app
    .shell()
    .sidecar("node")
    .expect("the \"node\" sidecar binary must be bundled (see scripts/prepare-tauri-node-sidecar.mjs)")
    .args(["server.js"])
    .current_dir(resource_dir)
    .env("PORT", LOCAL_SERVER_PORT.to_string())
    .env("HOSTNAME", "127.0.0.1")
    .spawn()
    .expect("failed to spawn the bundled Next.js server sidecar");

  *app.state::<ServerSidecar>().0.lock().unwrap() = Some(child);

  // Surface the sidecar's own stdout/stderr into this app's log output --
  // invaluable (and the only signal available) if the bundled server fails
  // to start on a real machine this session can never click through.
  tauri::async_runtime::spawn(async move {
    use tauri_plugin_shell::process::CommandEvent;
    while let Some(event) = rx.recv().await {
      match event {
        CommandEvent::Stdout(line) => log::info!("[server] {}", String::from_utf8_lossy(&line)),
        CommandEvent::Stderr(line) => log::warn!("[server] {}", String::from_utf8_lossy(&line)),
        CommandEvent::Error(err) => log::error!("[server] sidecar error: {err}"),
        CommandEvent::Terminated(payload) => {
          log::warn!("[server] sidecar exited: {:?}", payload.code);
        }
        _ => {}
      }
    }
  });

  tauri::async_runtime::spawn(async move {
    let ready = wait_for_local_server(LOCAL_SERVER_PORT, std::time::Duration::from_secs(20)).await;
    if !ready {
      log::error!(
        "Bundled server on 127.0.0.1:{LOCAL_SERVER_PORT} did not become ready in time; showing the window anyway so the user isn't stuck on a blank screen."
      );
    } else {
      let url = Url::parse(&format!("http://127.0.0.1:{LOCAL_SERVER_PORT}")).expect("valid local URL");
      if let Err(err) = window.navigate(url) {
        log::error!("Failed to navigate the main window to the local server: {err}");
      }
    }
    let _ = window.show();
  });
}

async fn wait_for_local_server(port: u16, timeout: std::time::Duration) -> bool {
  let deadline = tokio::time::Instant::now() + timeout;
  loop {
    if tokio::net::TcpStream::connect(("127.0.0.1", port)).await.is_ok() {
      return true;
    }
    if tokio::time::Instant::now() >= deadline {
      return false;
    }
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
  }
}
