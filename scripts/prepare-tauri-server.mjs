#!/usr/bin/env node
// Assembles the Next.js standalone server build into src-tauri/resources/server/,
// the layout the Tauri desktop shell bundles and runs locally. Next's own
// "standalone" output (.next/standalone/server.js + a minimal node_modules)
// deliberately excludes static assets -- Next's own docs require manually
// copying .next/static and public/ alongside it, which is exactly what this
// script does, matching Next's documented standalone-deployment layout
// (see: output: "standalone" in next.config.ts).
//
// Run after `next build` (see package.json's build:desktop script), before
// `tauri build` (see src-tauri/tauri.conf.json's beforeBuildCommand).

import { existsSync, rmSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const standaloneDir = path.join(root, ".next", "standalone");
const targetDir = path.join(root, "src-tauri", "resources", "server");

if (!existsSync(standaloneDir)) {
  console.error(
    `${standaloneDir} does not exist -- run "next build" (with output: "standalone" in next.config.ts) before this script.`
  );
  process.exit(1);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

cpSync(standaloneDir, targetDir, { recursive: true });
cpSync(path.join(root, ".next", "static"), path.join(targetDir, ".next", "static"), { recursive: true });
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(targetDir, "public"), { recursive: true });
}

console.log(`Assembled Tauri server resources at ${targetDir}`);
