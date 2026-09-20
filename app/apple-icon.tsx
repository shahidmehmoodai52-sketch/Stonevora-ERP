import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Same brand mark as icon.tsx, proportioned for iOS's 180x180 home-screen
// icon convention (iOS applies its own corner mask, so this stays a plain
// square rather than duplicating the rounding icon.tsx does for favicons).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#f59e0b",
            fontFamily: "sans-serif",
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          S
        </div>
        <div
          style={{
            display: "flex",
            width: 42,
            height: 5,
            marginTop: 6,
            background: "#f59e0b",
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
