import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// Brand mark: an amber monogram + accent bar on the app's dark surface —
// distinct from generic SaaS blue, and thematically tied to polished
// stone/quarry material. Kept simple (no fine detail) so it still reads
// correctly once the OS scales it down to a 16px favicon.
export default function Icon() {
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
          borderRadius: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#f59e0b",
            fontFamily: "sans-serif",
            fontSize: 280,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          S
        </div>
        <div
          style={{
            display: "flex",
            width: 120,
            height: 12,
            marginTop: 12,
            background: "#f59e0b",
            borderRadius: 6,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
