import { useState } from'react';
import { ChevronDown, ChevronRight } from'lucide-react';
import { useCrawlConfig } from'../../hooks/useCrawlConfig';
import type { ViewportPreset, UserAgentPreset } from'../../hooks/useCrawlConfig';
import ToggleSwitch from'../settings/ToggleSwitch';
import FormInput, { FormSelect } from'../settings/FormInput';

const VIEWPORT_PRESETS: { value: ViewportPreset; label: string; width: number; height: number }[] = [
 { value:'desktop', label:'Desktop 1920×1080', width: 1920, height: 1080 },
 { value:'tablet', label:'Tablet 768×1024', width: 768, height: 1024 },
 { value:'mobile', label:'Mobile 375×667', width: 375, height: 667 },
 { value:'custom', label:'Custom', width: 1280, height: 800 },
];

const USER_AGENT_PRESETS: { value: UserAgentPreset; label: string }[] = [
 { value:'chrome_desktop', label:'Chrome Desktop' },
 { value:'firefox_desktop', label:'Firefox Desktop' },
 { value:'safari_mac', label:'Safari macOS' },
 { value:'chrome_mobile', label:'Chrome Mobile' },
 { value:'custom', label:'Custom…' },
];

export default function BrowserConfigPanel() {
 const [open, setOpen] = useState(false);
 const { crawlConfig, errors, updateConfig } = useCrawlConfig();
 const { browser } = crawlConfig;

 function handleViewportPreset(preset: ViewportPreset) {
 updateConfig('browser','viewportPreset', preset);
 const found = VIEWPORT_PRESETS.find((p) => p.value === preset);
 if (found && preset !=='custom') {
 updateConfig('browser','viewportWidth', found.width);
 updateConfig('browser','viewportHeight', found.height);
 }
 }

 return (
 <div className="border border-border bg-surface overflow-hidden">
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-text hover:bg-raised transition-colors"
 >
 <span>Advanced Browser Settings</span>
 {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
 </button>

 {open && (
 <div className="px-5 pb-5 flex flex-col gap-5 border-t border-border pt-4">
 <ToggleSwitch
 checked={browser.headless}
 onChange={(v) => updateConfig('browser','headless', v)}
 label="Headless mode"
 description="Run browser without a visible window (recommended)"
 />

 <FormSelect
 label="Viewport"
 value={browser.viewportPreset}
 onChange={(e) => handleViewportPreset(e.target.value as ViewportPreset)}
 >
 {VIEWPORT_PRESETS.map((p) => (
 <option key={p.value} value={p.value}>{p.label}</option>
 ))}
 </FormSelect>

 {browser.viewportPreset ==='custom' && (
 <div className="grid grid-cols-2 gap-3">
 <FormInput
 label="Width (px)"
 type="number"
 value={browser.viewportWidth}
 onChange={(e) => updateConfig('browser','viewportWidth', Number(e.target.value))}
 min={100}
 max={3840}
 />
 <FormInput
 label="Height (px)"
 type="number"
 value={browser.viewportHeight}
 onChange={(e) => updateConfig('browser','viewportHeight', Number(e.target.value))}
 min={100}
 max={2160}
 />
 </div>
 )}

 <FormInput
 label="Proxy URL"
 type="url"
 value={browser.proxyUrl}
 onChange={(e) => updateConfig('browser','proxyUrl', e.target.value)}
 placeholder="https://proxy.example.com:8080"
 error={errors.proxyUrl}
 description="Optional HTTP/HTTPS proxy"
 />

 <FormSelect
 label="User Agent"
 value={browser.userAgentPreset}
 onChange={(e) => updateConfig('browser','userAgentPreset', e.target.value as UserAgentPreset)}
 >
 {USER_AGENT_PRESETS.map((ua) => (
 <option key={ua.value} value={ua.value}>{ua.label}</option>
 ))}
 </FormSelect>

 {browser.userAgentPreset ==='custom' && (
 <div className="flex flex-col gap-1.5">
 <label htmlFor="browser-custom-ua" className="text-sm font-medium text-text">Custom User Agent</label>
 <textarea
 id="browser-custom-ua"
 value={browser.customUserAgent}
 onChange={(e) => updateConfig('browser','customUserAgent', e.target.value)}
 rows={3}
 placeholder="Mozilla/5.0 ..."
  className="w-full border border-border px-3 py-2 text-xs font-mono resize-y
  bg-void text-text placeholder-text-mute
  focus:outline-none focus:border-cyan"
 />
 </div>
 )}

 <ToggleSwitch
 checked={browser.textMode}
 onChange={(v) => updateConfig('browser','textMode', v)}
 label="Text mode"
 description="Disable image loading for faster crawls"
 />

 <ToggleSwitch
 checked={browser.lightMode}
 onChange={(v) => updateConfig('browser','lightMode', v)}
 label="Light mode"
 description="Reduce background browser features"
 />
 </div>
 )}
 </div>
 );
}
