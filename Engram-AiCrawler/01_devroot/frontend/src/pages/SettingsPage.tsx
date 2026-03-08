import { useEffect, useState, useRef, useCallback, useMemo } from'react';
import {
  Settings,
  Globe,
  Link,
  Bell,
  Shield,
  Save,
  RotateCcw,
  CheckCircle,
  Loader2,
  AlertCircle,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { useSettingsStore } from'../stores/settingsStore';
import { useToast } from'../components/Toast';
import { Button, Card } from '../components/ui';
import SettingsSection from'../components/settings/SettingsSection';
import ToggleSwitch from'../components/settings/ToggleSwitch';
import FormInput, { FormSelect } from'../components/settings/FormInput';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------
type TabId ='general' |'crawls' |'connections' |'notifications' |'privacy' |'osint';

interface Tab {
 id: TabId;
 label: string;
 Icon: LucideIcon;
}

const TABS: Tab[] = [
 { id:'general', label:'General', Icon: Settings },
 { id:'crawls', label:'Crawl Defaults', Icon: Globe },
 { id:'connections', label:'Connections', Icon: Link },
 { id:'notifications', label:'Notifications', Icon: Bell },
 { id:'osint', label:'OSINT Providers', Icon: Eye },
 { id:'privacy', label:'Network & Privacy', Icon: Shield },
];

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function SettingsSkeleton() {
 return (
 <div className="animate-pulse flex flex-col gap-6 pt-4">
 {[...Array(4)].map((_, i) => (
 <div key={i} className="flex flex-col gap-3">
 <div className="h-4 bg-surface w-1/4" />
 <div className="h-9 bg-surface w-full" />
 </div>
 ))}
 </div>
 );
}

// ---------------------------------------------------------------------------
// General Tab
// ---------------------------------------------------------------------------
function GeneralTab() {
 const { settings, updateSettings, isLoading } = useSettingsStore();

 return (
 <div className="flex flex-col gap-8">
  <SettingsSection
 title="Language"
 description="Choose your preferred display language."
 >
 <FormSelect
 label="Display Language"
 value={settings.language}
 onChange={(e) => updateSettings({ language: e.target.value })}
 disabled={isLoading}
 >
 <option value="en">English</option>
 <option value="es" disabled>Español (coming soon)</option>
 <option value="fr" disabled>Français (coming soon)</option>
 <option value="de" disabled>Deutsch (coming soon)</option>
 <option value="zh" disabled>中文 (coming soon)</option>
 </FormSelect>
 </SettingsSection>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Crawl Defaults Tab
// ---------------------------------------------------------------------------
function CrawlDefaultsTab() {
 const { settings, updateSettings, isLoading } = useSettingsStore();
 const crawl = settings.crawl_defaults;

 const update = useCallback(
 (partial: Partial<typeof crawl>) => {
 updateSettings({ crawl_defaults: { ...crawl, ...partial } });
 },
 [crawl, updateSettings]
 );

 return (
 <div className="flex flex-col gap-8">
 <SettingsSection
 title="Extraction"
 description="Default extraction strategy for new crawl jobs."
 >
 <FormSelect
 label="Extraction Type"
 value={crawl.extraction_type}
 onChange={(e) =>
 update({ extraction_type: e.target.value as typeof crawl.extraction_type })
 }
 disabled={isLoading}
 >
 <option value="css">CSS / JSON</option>
 <option value="llm">LLM (AI-powered)</option>
 <option value="regex">Regex</option>
 <option value="cosine">Cosine Similarity</option>
 </FormSelect>

 <FormInput
 label="Word Count Threshold"
 type="number"
 value={crawl.word_count_threshold}
 min={10}
 max={1000}
 step={10}
 onChange={(e) =>
 update({ word_count_threshold: parseInt(e.target.value, 10) || 50 })
 }
 disabled={isLoading}
 description="Minimum word count for a block to be included in results (10–1000)."
 />

 <FormInput
 label="Wait For Selector"
 type="text"
 value={crawl.wait_for}
 placeholder=".content-loaded"
 onChange={(e) => update({ wait_for: e.target.value })}
 disabled={isLoading}
 description="CSS selector to wait for before extracting content (optional)."
 />
 </SettingsSection>

 <SettingsSection
 title="Output"
 description="Control what additional files are generated per crawl."
 >
 <ToggleSwitch
 label="Capture Screenshot"
 description="Save a PNG screenshot for each crawled page."
 checked={crawl.screenshot}
 onChange={(v) => update({ screenshot: v })}
 disabled={isLoading}
 />
 <ToggleSwitch
 label="Generate PDF"
 description="Save a PDF export for each crawled page."
 checked={crawl.pdf}
 onChange={(v) => update({ pdf: v })}
 disabled={isLoading}
 />
 </SettingsSection>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Connections Tab
// ---------------------------------------------------------------------------
function ConnectionsTab() {
 const { settings, updateSettings, isLoading } = useSettingsStore();
 const connections = settings.connections;
 const [testingConnection, setTestingConnection] = useState(false);
 const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
 const toast = useToast();

 const update = useCallback(
 (partial: Partial<typeof connections>) => {
 updateSettings({ connections: { ...connections, ...partial } });
 },
 [connections, updateSettings]
 );

 const testLmStudio = useCallback(async () => {
 setTestingConnection(true);
 setTestResult(null);
 try {
 const response = await fetch('/api/settings/test-connection', { method:'POST' });
 const data: { success: boolean; message: string } = await response.json();
 setTestResult(data);
 if (data.success) {
 toast.success(data.message ||'Connection successful!');
 } else {
 toast.error(data.message ||'Connection failed.');
 }
 } catch {
 const msg ='Failed to reach the test endpoint. Check your network.';
 setTestResult({ success: false, message: msg });
 toast.error(msg);
 } finally {
 setTestingConnection(false);
 }
 }, [toast]);

 return (
 <div className="flex flex-col gap-8">
 <SettingsSection
 title="LM Studio"
 description="Local language model server for LLM-powered extraction."
 >
 <FormInput
 label="LM Studio URL"
 type="url"
 value={connections.lm_studio_url}
 placeholder="http://localhost:1234"
 onChange={(e) => update({ lm_studio_url: e.target.value })}
 disabled={isLoading}
 />

 <div className="flex items-center gap-3">
  <Button
  variant="primary"
  onClick={testLmStudio}
  disabled={isLoading}
  loading={testingConnection}
  leftIcon={<CheckCircle size={16} />}
  >
  {testingConnection ?'Testing…' :'Test Connection'}
  </Button>

 {testResult && (
 <span
 className={`flex items-center gap-1.5 text-sm ${
 testResult.success
 ?'text-plasma'
 :'text-neon-r'
 }`}
 >
 {testResult.success ? (
 <CheckCircle size={16} />
 ) : (
 <AlertCircle size={16} />
 )}
 {testResult.message}
 </span>
 )}
 </div>
 </SettingsSection>

 <SettingsSection
 title="Redis"
 description="Cache backend for crawl results and job queuing."
 >
 <FormInput
 label="Redis URL"
 type="url"
 value={connections.redis_url}
 placeholder="redis://localhost:6379"
 onChange={(e) => update({ redis_url: e.target.value })}
 disabled={isLoading}
 />
 </SettingsSection>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Notifications Tab
// ---------------------------------------------------------------------------
function NotificationsTab() {
 const { settings, updateSettings, isLoading } = useSettingsStore();
 const notif = settings.notifications;

 const update = useCallback(
 (partial: Partial<typeof notif>) => {
 updateSettings({ notifications: { ...notif, ...partial } });
 },
 [notif, updateSettings]
 );

 return (
 <div className="flex flex-col gap-8">
 <SettingsSection
 title="Browser Notifications"
 description="Control which events trigger a notification."
 >
 <ToggleSwitch
 label="Crawl Complete"
 description="Notify when a crawl job finishes successfully."
 checked={notif.crawl_complete}
 onChange={(v) => update({ crawl_complete: v })}
 disabled={isLoading}
 />
 <ToggleSwitch
 label="Crawl Error"
 description="Notify when a crawl job encounters an error."
 checked={notif.crawl_error}
 onChange={(v) => update({ crawl_error: v })}
 disabled={isLoading}
 />
 <ToggleSwitch
 label="Scan Complete"
 description="Notify when a site scan (deep crawl) finishes."
 checked={notif.scan_complete}
 onChange={(v) => update({ scan_complete: v })}
 disabled={isLoading}
 />
 </SettingsSection>
 </div>
 );
}

// ---------------------------------------------------------------------------
// OSINT Providers Tab
// ---------------------------------------------------------------------------
function OsintTab() {
 const { settings, updateSettings, isLoading } = useSettingsStore();
 const osint = useMemo(() => settings.osint || {}, [settings.osint]);

 const update = useCallback(
 (partial: Partial<typeof osint>) => {
 updateSettings({ osint: { ...osint, ...partial } });
 },
 [osint, updateSettings]
 );

 return (
 <div className="flex flex-col gap-8">
 <SettingsSection
 title="OSINT Provider API Keys"
 description="Configure API keys for enhanced OSINT capabilities. Leave blank to use free/fallback endpoints."
 >
 <FormInput
 label="Shodan API Key"
 type="password"
 placeholder="Enter Shodan API key"
 value={osint.osint_shodan_key ?? ''}
 onChange={(e) => update({ osint_shodan_key: e.target.value })}
 disabled={isLoading}
 />
 <FormInput
 label="VirusTotal API Key"
 type="password"
 placeholder="Enter VirusTotal API key"
 value={osint.osint_virustotal_key ?? ''}
 onChange={(e) => update({ osint_virustotal_key: e.target.value })}
 disabled={isLoading}
 />
 <FormInput
 label="Hunter.io API Key"
 type="password"
 placeholder="Enter Hunter.io API key"
 value={osint.osint_hunter_key ?? ''}
 onChange={(e) => update({ osint_hunter_key: e.target.value })}
 disabled={isLoading}
 />
 <FormInput
 label="HIBP API Key"
 type="password"
 placeholder="Enter Have I Been Pwned API key"
 value={osint.osint_hibp_key ?? ''}
 onChange={(e) => update({ osint_hibp_key: e.target.value })}
 disabled={isLoading}
 />
 <FormInput
 label="WHOIS API Key"
 type="password"
 placeholder="Enter WHOIS API key (optional)"
 value={osint.osint_whois_key ?? ''}
 onChange={(e) => update({ osint_whois_key: e.target.value })}
 disabled={isLoading}
 />
 </SettingsSection>

 <SettingsSection
 title="OSINT Defaults"
 description="Default settings for OSINT scan operations."
 >
 <ToggleSwitch
 label="Enable WHOIS/DNS lookups"
 description="Automatically run WHOIS and DNS lookups during scans"
 checked={osint.osint_enable_whois ?? true}
 onChange={(v) => update({ osint_enable_whois: v })}
 disabled={isLoading}
 />
 <ToggleSwitch
 label="Enable Threat Intelligence"
 description="Check IPs and domains against Shodan and VirusTotal"
 checked={osint.osint_enable_threat ?? true}
 onChange={(v) => update({ osint_enable_threat: v })}
 disabled={isLoading}
 />
 <ToggleSwitch
 label="Enable Email OSINT"
 description="Check emails for breaches and verify identities"
 checked={osint.osint_enable_email ?? true}
 onChange={(v) => update({ osint_enable_email: v })}
 disabled={isLoading}
 />
 </SettingsSection>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Network & Privacy Tab
// ---------------------------------------------------------------------------
function PrivacyTab() {
 const { settings, updateSettings, isLoading } = useSettingsStore();
 const net = settings.network_privacy;

 const update = useCallback(
 (partial: Partial<typeof net>) => {
 updateSettings({ network_privacy: { ...net, ...partial } });
 },
 [net, updateSettings]
 );

 return (
 <div className="flex flex-col gap-8">
 <SettingsSection
 title="Proxy"
 description="Route crawl traffic through a proxy server."
 >
 <FormInput
 label="Proxy URL"
 type="url"
 value={net.proxy_url}
 placeholder="http://proxy.example.com:8080"
 onChange={(e) => update({ proxy_url: e.target.value })}
 disabled={isLoading}
 description="Leave blank to disable proxy. Supports http, https, socks5."
 />
 </SettingsSection>

 <SettingsSection
 title="User Agent"
 description="Control how Crawl4AI identifies itself to web servers."
 >
 <FormSelect
 label="User Agent Mode"
 value={net.user_agent_mode}
 onChange={(e) =>
 update({ user_agent_mode: e.target.value as typeof net.user_agent_mode })
 }
 disabled={isLoading}
 >
 <option value="default">Default (Crawl4AI)</option>
 <option value="rotate">Rotate (random realistic agents)</option>
 <option value="custom">Custom</option>
 </FormSelect>

 {net.user_agent_mode ==='custom' && (
 <FormInput
 label="Custom User Agent"
 type="text"
 value={net.custom_user_agent}
 placeholder="Mozilla/5.0 ..."
 onChange={(e) => update({ custom_user_agent: e.target.value })}
 disabled={isLoading}
 required
 description="Full user-agent string to send with every request."
 />
 )}
 </SettingsSection>

 <SettingsSection
 title="DNS"
 description="Enhance privacy and bypass DNS-based filtering."
 >
 <ToggleSwitch
 label="DNS over HTTPS"
 description="Encrypt DNS queries to prevent interception and censorship."
 checked={net.dns_over_https}
 onChange={(v) => update({ dns_over_https: v })}
 disabled={isLoading}
 />
 </SettingsSection>
 </div>
 );
}

// ---------------------------------------------------------------------------
// Main SettingsPage
// ---------------------------------------------------------------------------
const TAB_CONTENT: Record<TabId, React.FC> = {
 general: GeneralTab,
 crawls: CrawlDefaultsTab,
 connections: ConnectionsTab,
 notifications: NotificationsTab,
 osint: OsintTab,
 privacy: PrivacyTab,
};

export default function SettingsPage() {
 const [activeTab, setActiveTab] = useState<TabId>('general');
 const { isLoading, isSaving, error, hasUnsavedChanges, fetchSettings, saveSettings, resetToDefaults, clearError } =
 useSettingsStore();
 const toast = useToast();
 const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Fetch settings from backend on mount
 useEffect(() => {
 fetchSettings();
 }, [fetchSettings]);

 // Debounced auto-save (500 ms) whenever there are unsaved changes
 useEffect(() => {
 if (!hasUnsavedChanges) return;

 if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
 autoSaveTimer.current = setTimeout(async () => {
 try {
 await saveSettings();
 // Silent success for auto-save
 } catch {
 // error is already stored in the store; shown in UI
 }
 }, 500);

 return () => {
 if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
 };
 }, [hasUnsavedChanges, saveSettings]);

 // Show error toast when store error changes
 useEffect(() => {
 if (error) {
 toast.error(error);
 clearError();
 }
 }, [error, toast, clearError]);

 const handleManualSave = useCallback(async () => {
 try {
 await saveSettings();
 toast.success('Settings saved!');
 } catch {
 // error handled by store + useEffect above
 }
 }, [saveSettings, toast]);

 const handleReset = useCallback(() => {
 resetToDefaults();
 toast.info('Settings reset to defaults. They will auto-save shortly.');
 }, [resetToDefaults, toast]);

 const ActiveContent = TAB_CONTENT[activeTab];

 return (
 <div className="min-h-screen bg-void py-8 px-4 sm:px-6 lg:px-8">
 <div className="max-w-4xl mx-auto">
 {/* Page Header */}
 <div className="mb-8 flex items-start justify-between">
 <div>
 <h1 className="text-2xl font-bold text-text flex items-center gap-2">
 <Settings className="text-cyan" size={24} />
 Settings
 </h1>
 <p className="mt-1 text-sm text-text-dim">
 Configure your Crawl4AI preferences and defaults.
 </p>
 </div>

 <div className="flex items-center gap-3">
 {hasUnsavedChanges && (
 <span className="text-xs text-volt font-medium animate-pulse">
 Unsaved changes…
 </span>
 )}
 {isSaving && (
 <span className="flex items-center gap-1.5 text-xs text-text-dim">
 <Loader2 size={14} className="animate-spin" />
 Saving…
 </span>
 )}

  <Button
  variant="secondary"
  onClick={handleReset}
  leftIcon={<RotateCcw size={15} />}
  >
  Reset
  </Button>

  <Button
  variant="primary"
  onClick={handleManualSave}
  disabled={!hasUnsavedChanges}
  loading={isSaving}
  leftIcon={<Save size={15} />}
  >
  Save
  </Button>
 </div>
 </div>

  {/* Main card */}
  <Card>
 {/* Tabs */}
 <div className="border-b border-border overflow-x-auto">
 <nav className="flex min-w-max" aria-label="Settings sections">
  {TABS.map(({ id, label, Icon }) => (
  <button
  key={id}
  id={`tab-${id}`}
  type="button"
  onClick={() => setActiveTab(id)}
  aria-selected={activeTab === id}
  aria-controls="settings-tabpanel"
  role="tab"
  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
  ${activeTab === id
  ?'border-cyan text-cyan'
  :'border-transparent text-text-dim hover:text-text hover:border-border'
  }`}
  >
  <Icon size={16} />
  {label}
  </button>
  ))}
  </nav>
  </div>

  {/* Content */}
  <div id="settings-tabpanel" className="p-6 sm:p-8" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
 {isLoading ? (
 <SettingsSkeleton />
 ) : (
 <ActiveContent />
  )}
  </div>
  </Card>
  </div>
  </div>
  );
}
