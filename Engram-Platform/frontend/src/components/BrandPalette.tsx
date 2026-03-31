'use client';

import { useState } from 'react';

// ─── Brand colour definitions ──────────────────────────────────────────────────

export interface BrandColor {
  name: string;
  hex: string;
  role: string;
  group: 'primary' | 'neutral' | 'semantic';
}

export const BRAND_COLORS: BrandColor[] = [
  { name: 'Amber', hex: '#F2A93B', role: 'Primary', group: 'primary' },
  { name: 'Violet', hex: '#7C5CBF', role: 'Accent', group: 'primary' },
  { name: 'Teal', hex: '#2EC4C4', role: 'Memory', group: 'primary' },
  { name: 'Purple', hex: '#9B7DE0', role: 'Crawler', group: 'primary' },
  { name: 'Deep Void', hex: '#03020A', role: 'Background', group: 'neutral' },
  { name: 'Panel', hex: '#0d0d1a', role: 'Surface', group: 'neutral' },
  { name: 'Text Primary', hex: '#f0eef8', role: 'Foreground', group: 'neutral' },
  { name: 'Text Secondary', hex: '#a09bb8', role: 'Secondary', group: 'neutral' },
  { name: 'Text Muted', hex: '#8580a0', role: 'Muted', group: 'neutral' },
  { name: 'Error', hex: '#FF6B6B', role: 'Destructive', group: 'semantic' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

interface BrandPaletteProps {
  className?: string;
}

export function BrandPalette({ className }: BrandPaletteProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const handleCopy = (hex: string) => {
    void navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 2000);
    });
  };

  return (
    <ul className={className} aria-label="Brand color palette">
      {BRAND_COLORS.map((color) => {
        const copied = copiedHex === color.hex;
        return (
          <li key={color.hex} className="list-none">
            <button
              type="button"
              onClick={() => handleCopy(color.hex)}
              aria-label={`Copy ${color.name} color ${color.hex}`}
              title={copied ? 'Copied!' : `Click to copy ${color.hex}`}
              className="flex items-center gap-3 w-full rounded-lg p-2 transition-colors hover:bg-white/[0.04]"
            >
              <div
                className="w-8 h-8 rounded-md flex-shrink-0 border border-white/10"
                style={{ backgroundColor: color.hex }}
                aria-hidden="true"
                data-color={color.hex}
                data-testid={`color-swatch-${color.name.toLowerCase().replace(/\s+/g, '-')}`}
              />
              <div className="text-left flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#f0eef8] truncate">{color.name}</p>
                <p className="text-[10px] font-mono text-[#8580a0] truncate">{color.role}</p>
              </div>
              <span
                className="text-[10px] font-mono text-[#a09bb8] flex-shrink-0"
                aria-live="polite"
              >
                {copied ? 'Copied!' : color.hex}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
