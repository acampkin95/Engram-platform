import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#03020A",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial glow behind logo */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(242,169,59,0.08) 0%, rgba(155,125,224,0.04) 40%, transparent 70%)",
        }}
      />

      {/* Logo mark */}
      <svg
        width="96"
        height="96"
        viewBox="0 0 48 48"
        fill="none"
        style={{ marginBottom: 32 }}
        role="img"
        aria-label="ENGRAM logo"
      >
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

      {/* Brand name */}
      <div
        style={{
          fontSize: 80,
          fontWeight: 800,
          color: "#F0EEF8",
          letterSpacing: "0.15em",
          marginBottom: 16,
          lineHeight: 1,
        }}
      >
        ENGRAM
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 24,
          color: "#A09BB8",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 48,
        }}
      >
        Multi-Layer AI Memory System
      </div>

      {/* Tier pills */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        {[
          { label: "Tier 1 · Project", color: "#F2A93B" },
          { label: "Tier 2 · General", color: "#9B7DE0" },
          { label: "Tier 3 · Global", color: "#2EC4C4" },
        ].map(({ label, color }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 20px",
              borderRadius: 999,
              border: `1px solid ${color}33`,
              background: `${color}14`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
              }}
            />
            <span style={{ color, fontSize: 16, letterSpacing: "0.05em" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Bottom separator line */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: "50%",
          transform: "translateX(-50%)",
          width: 240,
          height: 1,
          background: "linear-gradient(90deg, transparent, #F2A93B44, transparent)",
        }}
      />
    </div>,
    { ...size }
  );
}
