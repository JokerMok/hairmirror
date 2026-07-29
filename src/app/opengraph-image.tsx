import { ImageResponse } from "next/og";

export const alt = "HairMirror AI hairstyle preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 78px",
        background: "#f4f1e9",
        color: "#17352d",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, fontWeight: 700 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: 18, background: "#14745f", color: "white", fontSize: 38 }}>✂</div>
        HairMirror
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ color: "#14745f", fontSize: 24, fontWeight: 700, letterSpacing: 2 }}>AI HAIRSTYLE PREVIEW</div>
        <div style={{ maxWidth: 960, fontSize: 76, fontWeight: 700, lineHeight: 1.03, letterSpacing: -3 }}>See your next haircut before the first snip.</div>
        <div style={{ fontSize: 28, color: "#596963" }}>Upload one photo. Compare three hairstyle directions.</div>
      </div>
    </div>,
    size,
  );
}
