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
        <div style={{ display: "flex", fontSize: 32, color: "#f59e0b", letterSpacing: 2, fontWeight: 600 }}>
          ERP FOR MARBLE, GRANITE, STONE &amp; TILE
        </div>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 700, marginTop: 24 }}>Stonevora</div>
        <div style={{ display: "flex", width: 160, height: 10, marginTop: 20, background: "#f59e0b", borderRadius: 5 }} />
        <div style={{ display: "flex", fontSize: 32, color: "#d4d4d8", marginTop: 32, maxWidth: 900 }}>
          Trading, factory production, fabrication, tile manufacturing,
          distribution and showrooms — on one platform.
        </div>
      </div>
    ),
    { ...size }
  );
}
