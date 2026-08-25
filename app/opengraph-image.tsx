import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 96,
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 32, color: "#a1a1aa", letterSpacing: 2 }}>
          ERP FOR MARBLE, GRANITE, STONE &amp; TILE
        </div>
        <div style={{ fontSize: 96, fontWeight: 600, marginTop: 24 }}>Stonevora</div>
        <div style={{ fontSize: 32, color: "#d4d4d8", marginTop: 24, maxWidth: 900 }}>
          Trading, factory production, fabrication, tile manufacturing,
          distribution and showrooms — on one platform.
        </div>
      </div>
    ),
    { ...size }
  );
}
