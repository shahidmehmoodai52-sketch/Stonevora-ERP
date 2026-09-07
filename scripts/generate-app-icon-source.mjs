#!/usr/bin/env node
// Renders a single 1024x1024 source icon (same "S" wordmark/palette as
// app/icon.tsx and app/apple-icon.tsx -- one visual identity, not a second
// one invented for the desktop app) via next/og's ImageResponse, the exact
// renderer Next already uses for those two files and for
// app/opengraph-image.tsx. `tauri icon` then derives every platform's
// actual icon set from this one source (see package.json's
// generate:tauri-icon script).

import { ImageResponse } from "next/og.js";
import { writeFile } from "node:fs/promises";

const size = 1024;

const response = new ImageResponse(
  {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#09090b",
        color: "#fafafa",
        fontFamily: "sans-serif",
        fontSize: 600,
        fontWeight: 600,
      },
      children: "S",
    },
  },
  { width: size, height: size }
);

const buffer = Buffer.from(await response.arrayBuffer());
const outPath = new URL("../src-tauri/app-icon-source.png", import.meta.url);
await writeFile(outPath, buffer);
console.log(`Wrote ${size}x${size} source icon to ${outPath.pathname}`);
