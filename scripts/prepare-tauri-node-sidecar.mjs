#!/usr/bin/env node
// Copies a Node.js runtime binary into src-tauri/binaries/, named per
// Tauri's sidecar convention (<name>-<target-triple>[.exe]), so the desktop
// shell can spawn it to run the bundled standalone Next.js server.
//
// This copies whatever `node` is on the build machine's PATH -- correct and
// sufficient for building on the exact platform this session targets
// (verified here: x86_64-unknown-linux-gnu), but NOT how a real release
// pipeline should do this for other platforms: a proper release build
// should instead download the official prebuilt Node.js binary for each
// target triple (nodejs.org/dist) so the bundled runtime doesn't vary with
// whatever happens to be installed on the machine that ran `tauri build`.
// Documented here rather than built, since this session can only build and
// verify for one platform.

import { existsSync, mkdirSync, copyFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const binariesDir = path.join(root, "src-tauri", "binaries");

const targetTriple = execSync("rustc -vV").toString().match(/^host: (.+)$/m)?.[1];
if (!targetTriple) {
  console.error("Could not determine the current Rust target triple (is rustc installed?)");
  process.exit(1);
}

const nodePath = execSync("which node").toString().trim();
if (!nodePath || !existsSync(nodePath)) {
  console.error("Could not locate a `node` binary on PATH.");
  process.exit(1);
}

mkdirSync(binariesDir, { recursive: true });
const dest = path.join(binariesDir, `node-${targetTriple}${process.platform === "win32" ? ".exe" : ""}`);
copyFileSync(nodePath, dest);
chmodSync(dest, 0o755);

console.log(`Copied ${nodePath} -> ${dest}`);
