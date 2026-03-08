import React from 'react';
import { ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import {
  FaXTwitter,
  FaLinkedinIn,
  FaGithub,
  FaInstagram,
  FaFacebook,
  FaReddit,
  FaTiktok,
  FaMastodon,
  FaDiscord,
  FaTelegram,
} from 'react-icons/fa6';

interface AliasCardProps {
  alias: {
    platform: string;
    username: string;
    url: string;
    confidence: number;
    profile_image?: string;
    bio?: string;
  };
}

interface PlatformConfig {
  icon: React.ReactNode;
  borderColor: string;
}

const platformConfigs: Record<string, PlatformConfig> = {
  twitter: {
    icon: <FaXTwitter className="w-5 h-5 text-text" />,
    borderColor: 'border-t-text/40',
  },
  x: {
    icon: <FaXTwitter className="w-5 h-5 text-text" />,
    borderColor: 'border-t-text/40',
  },
  linkedin: {
    icon: <FaLinkedinIn className="w-5 h-5 text-cyan" />,
    borderColor: 'border-t-cyan/60',
  },
  github: {
    icon: <FaGithub className="w-5 h-5 text-text-mute" />,
    borderColor: 'border-t-text-mute/40',
  },
  instagram: {
    icon: <FaInstagram className="w-5 h-5 text-fuchsia" />,
    borderColor: 'border-t-fuchsia/60',
  },
  facebook: {
    icon: <FaFacebook className="w-5 h-5 text-cyan" />,
    borderColor: 'border-t-cyan/60',
  },
  reddit: {
    icon: <FaReddit className="w-5 h-5 text-[#FF4500]" />,
    borderColor: 'border-t-[#FF4500]/60',
  },
  tiktok: {
    icon: <FaTiktok className="w-5 h-5 text-text" />,
    borderColor: 'border-t-text/40',
  },
  mastodon: {
    icon: <FaMastodon className="w-5 h-5 text-fuchsia" />,
    borderColor: 'border-t-fuchsia/60',
  },
  discord: {
    icon: <FaDiscord className="w-5 h-5 text-[#5865F2]" />,
    borderColor: 'border-t-[#5865F2]/60',
  },
  telegram: {
    icon: <FaTelegram className="w-5 h-5 text-cyan" />,
    borderColor: 'border-t-cyan/60',
  },
};

const fallbackConfig: PlatformConfig = {
  icon: <CheckCircle className="w-5 h-5 text-text-mute" />,
  borderColor: 'border-t-border',
};

export default function AliasCard({ alias }: AliasCardProps) {
  const config = platformConfigs[alias.platform.toLowerCase()] ?? fallbackConfig;
  const icon = config.icon;
  const borderColor = config.borderColor;

  const confidenceColor =
    alias.confidence >= 0.8
      ? 'text-plasma bg-plasma/10 border border-plasma/20'
      : alias.confidence >= 0.5
        ? 'text-volt bg-volt/10 border border-volt/20'
        : 'text-neon-r bg-neon-r/10 border border-neon-r/20';

  const confidenceIcon =
    alias.confidence >= 0.8 ? (
      <CheckCircle className="w-3.5 h-3.5" />
    ) : (
      <AlertCircle className="w-3.5 h-3.5" />
    );

  return (
    <div
      className={`bg-surface p-5 border border-border border-t-2 ${borderColor} hover:border-cyan/30 hover:border-t-2 transition-all duration-300 hover:shadow-cyan/5 group`}
    >
      <div className="flex items-start gap-5">
        <div className="relative shrink-0">
          {alias.profile_image ? (
            <img
              src={alias.profile_image}
              alt={`${alias.username} profile`}
              className="w-16 h-16 object-cover ring-2 ring-border group-hover:ring-cyan/20 transition-all"
            />
          ) : (
            <div className="w-16 h-16 bg-void flex items-center justify-center ring-2 ring-border group-hover:ring-cyan/20 transition-all">
              {icon}
            </div>
          )}
          <div
            className="absolute -bottom-2 -right-2 p-1 bg-surface border border-border"
            title={alias.platform}
          >
            {icon}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-display font-semibold text-lg text-text group-hover:text-cyan transition-colors">
              @{alias.username}
            </h3>
            <span
              className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-semibold ${confidenceColor}`}
            >
              {confidenceIcon}
              {(alias.confidence * 100).toFixed(0)}%
            </span>
          </div>

          <p className="text-sm text-text-dim mb-2 capitalize font-medium">{alias.platform}</p>

          {alias.bio && (
            <p className="text-sm text-text-dim line-clamp-2 leading-relaxed">{alias.bio}</p>
          )}
        </div>

        <a
          href={alias.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 bg-void hover:bg-cyan hover:text-text transition-all duration-300 text-text-mute"
          title="Open profile"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
