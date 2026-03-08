import type { SystemSection } from './index';
import { sectionColors } from './index';

interface EngramLogoProps {
  size?: number;
  section?: SystemSection;
  className?: string;
}

/**
 * Engram strata logo — 5 memory layers, progressively narrower.
 * The section prop tints the primary bar to match the active system section.
 */
export function EngramLogo({ size = 32, section, className }: EngramLogoProps) {
  const primaryColor = section ? sectionColors[section].accent : '#F2A93B';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Strata bars — 5 memory layers, progressively narrower */}
      <rect x="6" y="10" width="36" height="4" rx="2" fill={primaryColor} opacity="1" />
      <rect x="10" y="17" width="28" height="4" rx="2" fill="#9B7DE0" opacity="0.9" />
      <rect x="14" y="24" width="20" height="4" rx="2" fill="#2EC4C4" opacity="0.8" />
      <rect x="18" y="31" width="12" height="4" rx="2" fill="#7C5CBF" opacity="0.6" />
      <rect x="22" y="38" width="4" height="4" rx="2" fill="#B87B20" opacity="0.4" />
      {/* Vertical retrieval connector */}
      <line
        x1="24"
        y1="6"
        x2="24"
        y2="45"
        stroke={primaryColor}
        strokeWidth="1"
        strokeOpacity="0.35"
      />
    </svg>
  );
}
