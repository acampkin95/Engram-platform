import { useState, useId } from 'react';
import {
  Shield,
  Info,
  AlertTriangle,
  Loader2,
  Globe,
} from 'lucide-react';
import { useToast } from '../Toast';
import SettingsSection from './SettingsSection';
import ToggleSwitch from './ToggleSwitch';
import { Badge } from '../ui';

import {
  USER_AGENT_PRESET_KEYS,
  USER_AGENT_PRESET_LABELS,
  USER_AGENT_PRESETS,
  type UserAgentPreset,
} from '../../lib/userAgentPresets';
import {
  testProxyConnection,
  validateProxyUrl,
  sanitiseProxyUrl,
  type ProxyTestResult,
} from '../../lib/proxyTest';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserAgentMode ='default' |'rotate' |'custom';

export interface NetworkPrivacySettings {
 proxy_url: string;
 user_agent_mode: UserAgentMode;
 custom_user_agent: string;
 dns_over_https: boolean;
}

export interface OPSECSettingsProps {
 settings: NetworkPrivacySettings;
 onChange: (patch: Partial<NetworkPrivacySettings>) => void;
 disabled?: boolean;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoCallout({ children }: { children: React.ReactNode }) {
 return (
 <p className="flex items-start gap-1.5 text-xs text-cyan">
 <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
 <span>{children}</span>
 </p>
 );
}

function OpsecWarning({ children }: { children: React.ReactNode }) {
 return (
 <div
 role="note"
 className="flex items-start gap-2 border border-volt/30 bg-volt/10 px-4 py-3
"
 >
 <AlertTriangle
 className="mt-0.5 h-4 w-4 flex-shrink-0 text-volt"
 aria-hidden="true"
 />
 <div className="text-xs text-volt">{children}</div>
 </div>
 );
}

function ProxyStatusBadge({ result }: { result: ProxyTestResult | null }) {
  if (!result) return null;
  return result.success ? (
    <Badge variant="success" dot>
      Connected{result.ip ? ` — ${result.ip}` : ''}
    </Badge>
  ) : (
    <Badge variant="danger" dot>
      Failed
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OPSECSettings({
 settings,
 onChange,
 disabled = false,
}: OPSECSettingsProps) {
 const toast = useToast();
 const radioGroupId = useId();

 // Local proxy URL state (not committed to parent until blur/test)
 const [proxyInput, setProxyInput] = useState(settings.proxy_url);
 const [proxyError, setProxyError] = useState<string | null>(null);
 const [isTesting, setIsTesting] = useState(false);
 const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);

 // ── Proxy handlers ──────────────────────────────────────────────────────────

 function handleProxyChange(value: string) {
 setProxyInput(value);
 setTestResult(null); // stale result no longer meaningful
 // Clear error as user types (re-validate on blur)
 if (proxyError) setProxyError(null);
 }

 function handleProxyBlur() {
 if (!proxyInput.trim()) {
 setProxyError(null);
 onChange({ proxy_url:'' });
 return;
 }
 const err = validateProxyUrl(proxyInput);
 setProxyError(err);
 if (!err) {
 onChange({ proxy_url: proxyInput });
 }
 }

 async function handleTestProxy() {
 const err = validateProxyUrl(proxyInput);
 if (err) {
 setProxyError(err);
 return;
 }

 setIsTesting(true);
 setTestResult(null);

 try {
 const result = await testProxyConnection(proxyInput);
 setTestResult(result);

 if (result.success) {
 const displayUrl = sanitiseProxyUrl(proxyInput);
 toast.success(
 result.ip
 ? `Proxy connected. External IP: ${result.ip}`
 : `Proxy connected via ${displayUrl}`
 );
 } else {
 toast.warning(`Proxy test failed: ${result.message}`);
 }
 } finally {
 setIsTesting(false);
 }
 }

 // ── UA mode handlers ────────────────────────────────────────────────────────

 function handleModeChange(mode: UserAgentMode) {
 onChange({ user_agent_mode: mode });
 if (mode !=='custom') {
 // Keep custom_user_agent intact so it isn't lost if user switches back
 }
 }

 function handlePresetClick(preset: UserAgentPreset) {
 onChange({
 user_agent_mode:'custom',
 custom_user_agent: USER_AGENT_PRESETS[preset],
 });
 toast.info(`Applied preset: ${USER_AGENT_PRESET_LABELS[preset]}`);
 }

 // ── Render ──────────────────────────────────────────────────────────────────

 return (
 <div className="flex flex-col gap-6">
 {/* ── Section header ── */}
 <div className="flex items-center gap-2">
 <Shield className="h-5 w-5 text-cyan" aria-hidden="true" />
 <h2 className="text-lg font-semibold text-text">
 Network &amp; Privacy (OPSEC)
 </h2>
 </div>

 {/* ══════════════════════════════════════════════════════════════════════
 PROXY CONFIGURATION
 ══════════════════════════════════════════════════════════════════════ */}
 <SettingsSection
 title="Proxy Configuration"
 description="Route crawler traffic through a proxy to mask your origin IP."
 >
 {/* Proxy URL input */}
 <div className="flex flex-col gap-1.5">
 <label
 htmlFor="proxy-url"
 className={`text-sm font-medium ${
 disabled
 ?'text-text-mute'
 :'text-text'
 }`}
 >
 Proxy URL
 </label>
 <input
 id="proxy-url"
 type="text"
 autoComplete="off"
 spellCheck={false}
 disabled={disabled}
 placeholder="http://user:pass@proxy.example.com:8080"
 value={proxyInput}
 onChange={(e) => handleProxyChange(e.target.value)}
 onBlur={handleProxyBlur}
 aria-invalid={!!proxyError}
 aria-describedby={proxyError ?'proxy-url-error' :'proxy-url-hint'}
 className={`w-full border px-3 py-2 font-mono text-sm transition-colors
 ${
 proxyError
 ?'border-neon-r focus:border-neon-r focus:ring-neon-r'
 :'border-border focus:border-cyan focus:ring-cyan'
 }
 bg-surface
 text-text
 placeholder-text-mute
 focus:outline-none focus:ring-2 focus:ring-opacity-50
 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-void `}
 />

 {proxyError ? (
 <p id="proxy-url-error" role="alert" className="text-xs text-neon-r">
 {proxyError}
 </p>
 ) : (
 <p id="proxy-url-hint">
 <InfoCallout>
 Supports HTTP, HTTPS, and SOCKS5 proxies. Credentials in the URL are never logged.
 </InfoCallout>
 </p>
 )}
 </div>

 {/* Test connection row */}
 <div className="flex items-center gap-3">
 <button
 type="button"
 disabled={disabled || isTesting || !proxyInput.trim()}
 onClick={handleTestProxy}
 className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-2 text-sm font-medium
 text-text transition-colors
 hover:bg-void focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2
 disabled:cursor-not-allowed disabled:opacity-50

"
 >
 {isTesting ? (
 <>
 <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
 Testing…
 </>
 ) : (
 <>
 <Globe className="h-4 w-4" aria-hidden="true" />
 Test Proxy Connection
 </>
 )}
 </button>

 <ProxyStatusBadge result={testResult} />
 </div>
 </SettingsSection>

 {/* ══════════════════════════════════════════════════════════════════════
 USER AGENT CONFIGURATION
 ══════════════════════════════════════════════════════════════════════ */}
 <SettingsSection
 title="User Agent Configuration"
 description="Control how the crawler identifies itself to target servers."
 >
 {/* Mode radio group */}
 <fieldset disabled={disabled} className="flex flex-col gap-2">
 <legend
 id={`${radioGroupId}-legend`}
 className="text-sm font-medium text-text"
 >
 Mode
 </legend>

 <div
 role="radiogroup"
 aria-labelledby={`${radioGroupId}-legend`}
 className="flex flex-wrap gap-4 pt-1"
 >
 {(
 [
 { value:'default', label:'Default', desc:"Crawl4AI's built-in UA" },
 { value:'rotate', label:'Rotate', desc:'Randomly cycle through common UAs' },
 { value:'custom', label:'Custom', desc:'Specify a UA string below' },
 ] as { value: UserAgentMode; label: string; desc: string }[]
 ).map(({ value, label, desc }) => {
 const inputId = `${radioGroupId}-ua-${value}`;
 return (
 <label
 key={value}
 htmlFor={inputId}
 className={`flex cursor-pointer items-center gap-2 border px-4 py-2.5 text-sm
 transition-colors
 ${
 settings.user_agent_mode === value
 ?'border-cyan bg-cyan/10 text-cyan'
 :'border-border bg-surface text-text hover:border-border hover:bg-void'
 }
 ${disabled ?'cursor-not-allowed opacity-50' :''}`}
 title={desc}
 >
 <input
 type="radio"
 id={inputId}
 name={`${radioGroupId}-ua-mode`}
 value={value}
 checked={settings.user_agent_mode === value}
 onChange={() => handleModeChange(value)}
 disabled={disabled}
 className="sr-only"
 />
 {/* Custom radio indicator */}
 <span
 aria-hidden="true"
 className={`h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${
 settings.user_agent_mode === value
 ?'border-cyan bg-cyan'
 :'border-border-hi bg-transparent'
 }`}
 />
 {label}
 </label>
 );
 })}
 </div>
 </fieldset>

 {/* Custom UA textarea — only visible in custom mode */}
 {settings.user_agent_mode ==='custom' && (
 <div className="flex flex-col gap-2">
 <div className="flex flex-col gap-1.5">
 <label
 htmlFor="custom-ua"
 className={`text-sm font-medium ${
 disabled
 ?'text-text-mute'
 :'text-text'
 }`}
 >
 Custom User Agent
 </label>
 <textarea
 id="custom-ua"
 rows={2}
 disabled={disabled}
 placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)…"
 value={settings.custom_user_agent}
 onChange={(e) => onChange({ custom_user_agent: e.target.value })}
 spellCheck={false}
 className="w-full resize-y border border-border bg-surface px-3 py-2 font-mono text-sm
 text-text placeholder-text-mute transition-colors
 focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-opacity-50
 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-void

"
 />
 </div>

 {/* Preset buttons */}
 <div className="flex flex-col gap-1.5">
 <span className="text-xs font-medium text-text-dim">
 Common presets:
 </span>
 <div className="flex flex-wrap gap-2">
 {USER_AGENT_PRESET_KEYS.map((preset) => (
 <button
 key={preset}
 type="button"
 disabled={disabled}
 onClick={() => handlePresetClick(preset)}
 title={USER_AGENT_PRESETS[preset]}
 className="border border-border bg-surface px-3 py-1 text-xs font-medium text-text-dim
 transition-colors hover:border-cyan hover:bg-cyan/10 hover:text-cyan
 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-1
 disabled:cursor-not-allowed disabled:opacity-50


"
 >
 {USER_AGENT_PRESET_LABELS[preset]}
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Rotate mode info */}
 {settings.user_agent_mode ==='rotate' && (
 <InfoCallout>
 The crawler will randomly select a different user agent for each request from a pool of
 common desktop and mobile browsers.
 </InfoCallout>
 )}
 </SettingsSection>

 {/* ══════════════════════════════════════════════════════════════════════
 ADDITIONAL PRIVACY
 ══════════════════════════════════════════════════════════════════════ */}
 <SettingsSection
 title="Additional Privacy"
 description="Extra measures to reduce information leakage."
 >
 <ToggleSwitch
 checked={settings.dns_over_https}
 onChange={(checked) => onChange({ dns_over_https: checked })}
 disabled={disabled}
 label="DNS over HTTPS"
 description="Routes DNS queries through an encrypted HTTPS connection, preventing DNS leaks that could reveal your browsing targets."
 />
 <InfoCallout>
 When enabled, DNS queries are sent to a privacy-respecting DoH resolver instead of your
 system DNS. This prevents ISPs and network observers from seeing which domains are being
 crawled.
 </InfoCallout>
 </SettingsSection>

 {/* ══════════════════════════════════════════════════════════════════════
 OPSEC REMINDER
 ══════════════════════════════════════════════════════════════════════ */}
 <OpsecWarning>
 <strong className="block mb-1">OPSEC Reminder</strong>
 <ul className="list-disc list-inside space-y-0.5">
 <li>Always verify your proxy is working before starting sensitive operations.</li>
 <li>
 Test for DNS leaks (
 <span className="font-mono">dnsleaktest.com</span>) and WebRTC leaks after enabling
 the proxy.
 </li>
 <li>Rotating UAs reduces fingerprinting but does not anonymise traffic by itself.</li>
 <li>Combine with a VPN or Tor for stronger anonymity guarantees.</li>
 </ul>
 </OpsecWarning>
 </div>
 );
}
