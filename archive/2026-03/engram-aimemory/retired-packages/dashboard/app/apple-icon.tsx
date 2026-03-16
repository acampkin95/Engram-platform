import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#03020A",
        borderRadius: 36,
      }}
    >
      <svg
        width="140"
        height="140"
        viewBox="0 0 48 48"
        fill="none"
        role="img"
        aria-label="ENGRAM logo"
      >
        {/* Strata layers — Engram logo */}
        <rect x="6" y="10" width="36" height="4" rx="2" fill="#F2A93B" opacity="1" />
        <rect x="10" y="17" width="28" height="4" rx="2" fill="#9B7DE0" opacity="0.9" />
        <rect x="14" y="24" width="20" height="4" rx="2" fill="#2EC4C4" opacity="0.8" />
        <rect x="18" y="31" width="12" height="4" rx="2" fill="#7C5CBF" opacity="0.6" />
        <rect x="22" y="38" width="4" height="4" rx="2" fill="#B87B20" opacity="0.4" />
        <line
          x1="24"
          y1="6"
          x2="24"
          y2="45"
          stroke="#F2A93B"
          strokeWidth="1"
          strokeOpacity="0.35"
        />
      </svg>
    </div>,
    { ...size }
  );
}
