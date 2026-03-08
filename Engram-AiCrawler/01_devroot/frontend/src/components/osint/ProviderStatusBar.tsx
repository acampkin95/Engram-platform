import { memo } from 'react';
import { motion } from 'framer-motion';
import { FaWifi, FaKey, FaClock, FaRotate } from 'react-icons/fa6';
import { LuWifiOff } from 'react-icons/lu';
import { useReducedMotion } from '../../lib/motion';
import { useProviderStatus } from '../../hooks/useOsintServices';

interface ProviderStatusBarProps {
  className?: string;
  compact?: boolean;
}

function StatusDot({ available }: { available: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${available ? 'bg-plasma animate-pulse' : 'bg-neon-r/50'}`} />
  );
}

export const ProviderStatusBar = memo(function ProviderStatusBar({ className = '', compact = false }: ProviderStatusBarProps) {
  const { providerStatus, refresh } = useProviderStatus();
  const prefersReduced = useReducedMotion();

  if (!providerStatus) return null;

  const providers = providerStatus.providers;
  const onlineCount = providers.filter((p) => p.available).length;
  const allOnline = onlineCount === providers.length;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="flex items-center gap-1.5 text-[11px] text-text-mute">
          {allOnline ? (
            <FaWifi size={12} className="text-plasma" />
          ) : (
            <LuWifiOff size={12} className="text-volt" />
          )}
          {onlineCount}/{providers.length} providers
        </span>
        <button
          onClick={refresh}
          className="p-0.5 text-text-mute hover:text-cyan transition-colors"
          aria-label="Refresh provider status"
        >
          <FaRotate size={11} />
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={prefersReduced ? undefined : { opacity: 0, y: 4 }}
      animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
      className={`p-3 bg-surface border border-border rounded ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-text-mute uppercase tracking-wider flex items-center gap-1.5">
          {allOnline ? (
            <FaWifi size={12} className="text-plasma" />
          ) : (
            <LuWifiOff size={12} className="text-volt" />
          )}
          OSINT Providers
        </h3>
        <button
          onClick={refresh}
          className="p-1 text-text-mute hover:text-cyan transition-colors rounded"
          aria-label="Refresh provider status"
        >
          <FaRotate size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {providers.map((provider) => (
          <div
            key={provider.name}
            title={provider.name}
            className={`p-2 rounded border transition-colors ${
              provider.available
                ? 'border-plasma/20 bg-plasma/5 shadow-[0_0_8px_rgba(15,187,170,0.15)]'
                : 'border-border bg-abyss/30'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <StatusDot available={provider.available} />
              <span className="text-xs font-medium text-text truncate capitalize">
                {provider.name.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {provider.has_api_key ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] text-plasma">
                  <FaKey size={8} />API
                </span>
              ) : (
                <span className="text-[9px] text-text-mute">Free tier</span>
              )}
              <span className="inline-flex items-center gap-0.5 text-[9px] text-text-mute">
                <FaClock size={8} />
                {provider.cache_ttl_seconds >= 3600
                  ? `${Math.round(provider.cache_ttl_seconds / 3600)}h`
                  : `${Math.round(provider.cache_ttl_seconds / 60)}m`}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-text-mute">
        <span className="flex items-center gap-1">
          <StatusDot available={true} /> Online
        </span>
        <span className="flex items-center gap-1">
          <StatusDot available={false} /> Offline
        </span>
        <span className="flex items-center gap-1">
          <FaKey size={9} /> API key configured
        </span>
      </div>
    </motion.div>
  );
});
