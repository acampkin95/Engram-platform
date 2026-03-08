import { useEffect, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Alert,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../components/ui';
import { darkwebApi } from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'full' | 'marketplace' | 'breach' | 'crypto';

interface ServiceStatus {
  status: string;
  simulation_mode?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DarkwebPage() {
  const [activeTab, setActiveTab] = useState<TabId>('full');
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Full Scan state
  const [fullEntityName, setFullEntityName] = useState('');
  const [fullEmails, setFullEmails] = useState('');
  const [fullUsernames, setFullUsernames] = useState('');
  const [fullSimMode, setFullSimMode] = useState(true);
  const [fullLoading, setFullLoading] = useState(false);
  const [fullResult, setFullResult] = useState<unknown>(null);
  const [fullError, setFullError] = useState<string | null>(null);

  // Marketplace state
  const [mktEntityName, setMktEntityName] = useState('');
  const [mktTerms, setMktTerms] = useState('');
  const [mktMaxSites, setMktMaxSites] = useState(10);
  const [mktLoading, setMktLoading] = useState(false);
  const [mktResult, setMktResult] = useState<unknown>(null);
  const [mktError, setMktError] = useState<string | null>(null);

  // Breach Scan state
  const [breachEmails, setBreachEmails] = useState('');
  const [breachUsernames, setBreachUsernames] = useState('');
  const [breachPastes, setBreachPastes] = useState(false);
  const [breachLoading, setBreachLoading] = useState(false);
  const [breachResult, setBreachResult] = useState<unknown>(null);
  const [breachError, setBreachError] = useState<string | null>(null);

  // Crypto Trace state
  const [cryptoAddresses, setCryptoAddresses] = useState('');
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cryptoResult, setCryptoResult] = useState<unknown>(null);
  const [cryptoError, setCryptoError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch service status on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const fetchStatus = async () => {
      setStatusLoading(true);
      try {
        const res = await darkwebApi.status();
        setServiceStatus(res.data as ServiceStatus);
      } catch {
        setServiceStatus(null);
      } finally {
        setStatusLoading(false);
      }
    };
    void fetchStatus();
  }, []);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleFullScan = async () => {
    if (!fullEntityName.trim()) {
      setFullError('Entity name is required');
      return;
    }
    setFullLoading(true);
    setFullError(null);
    setFullResult(null);
    try {
      const payload: Record<string, unknown> = {
        entity_name: fullEntityName.trim(),
        simulation_mode: fullSimMode,
      };
      if (fullEmails.trim()) {
        payload.emails = fullEmails.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (fullUsernames.trim()) {
        payload.usernames = fullUsernames.split(',').map((s) => s.trim()).filter(Boolean);
      }
      const res = await darkwebApi.fullScan(payload);
      setFullResult(res.data);
    } catch (err) {
      setFullError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setFullLoading(false);
    }
  };

  const handleMarketplaceScan = async () => {
    if (!mktEntityName.trim()) {
      setMktError('Entity name is required');
      return;
    }
    setMktLoading(true);
    setMktError(null);
    setMktResult(null);
    try {
      const payload: Record<string, unknown> = {
        entity_name: mktEntityName.trim(),
        max_sites: mktMaxSites,
      };
      if (mktTerms.trim()) {
        payload.additional_terms = mktTerms.split(',').map((s) => s.trim()).filter(Boolean);
      }
      const res = await darkwebApi.marketplaceScan(payload);
      setMktResult(res.data);
    } catch (err) {
      setMktError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setMktLoading(false);
    }
  };

  const handleBreachScan = async () => {
    setBreachLoading(true);
    setBreachError(null);
    setBreachResult(null);
    try {
      const payload: Record<string, unknown> = {
        check_pastes: breachPastes,
      };
      if (breachEmails.trim()) {
        payload.emails = breachEmails.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (breachUsernames.trim()) {
        payload.usernames = breachUsernames.split(',').map((s) => s.trim()).filter(Boolean);
      }
      const res = await darkwebApi.breachScan(payload);
      setBreachResult(res.data);
    } catch (err) {
      setBreachError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setBreachLoading(false);
    }
  };

  const handleCryptoTrace = async () => {
    if (!cryptoAddresses.trim()) {
      setCryptoError('At least one address is required');
      return;
    }
    setCryptoLoading(true);
    setCryptoError(null);
    setCryptoResult(null);
    try {
      const payload: Record<string, unknown> = {
        addresses: cryptoAddresses.split(',').map((s) => s.trim()).filter(Boolean),
      };
      const res = await darkwebApi.cryptoTrace(payload);
      setCryptoResult(res.data);
    } catch (err) {
      setCryptoError(err instanceof Error ? err.message : 'Trace failed');
    } finally {
      setCryptoLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const ResultBlock = ({ data }: { data: unknown }) =>
    data ? (
      <div className="mt-4">
        <p className="text-xs font-semibold text-text-dim uppercase tracking-wider mb-2">
          Results
        </p>
        <pre className="bg-void border border-border p-4 text-xs text-text-dim overflow-auto max-h-96 whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    ) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Eye size={24} className="text-cyan" />
            Dark Web Intelligence
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="warning">Simulation Mode</Badge>
            {statusLoading ? (
              <Loader2 size={14} className="animate-spin text-text-mute" />
            ) : serviceStatus ? (
              <Badge variant={serviceStatus.status === 'online' ? 'success' : 'ghost'} dot>
                {String(serviceStatus.status ?? 'unknown')}
              </Badge>
            ) : (
              <Badge variant="ghost">Status unavailable</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="full">Full Scan</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="breach">Breach Scan</TabsTrigger>
          <TabsTrigger value="crypto">Crypto Trace</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* Full Scan                                                           */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="full">
          <Card className="p-6 mt-4">
            <h2 className="text-base font-semibold text-text mb-4">Full Dark Web Scan</h2>
            <div className="space-y-4">
              {fullError && <Alert variant="danger">{fullError}</Alert>}

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Entity Name <span className="text-neon-r">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Person or organisation name"
                  value={fullEntityName}
                  onChange={(e) => setFullEntityName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Emails <span className="text-text-mute text-xs">(comma-separated)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
                  rows={2}
                  placeholder="email1@example.com, email2@example.com"
                  value={fullEmails}
                  onChange={(e) => setFullEmails(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Usernames <span className="text-text-mute text-xs">(comma-separated)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
                  rows={2}
                  placeholder="user1, user2"
                  value={fullUsernames}
                  onChange={(e) => setFullUsernames(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="full-sim-mode"
                  type="checkbox"
                  checked={fullSimMode}
                  onChange={(e) => setFullSimMode(e.target.checked)}
                  className="accent-cyan"
                />
                <label htmlFor="full-sim-mode" className="text-sm text-text">
                  Simulation mode
                </label>
              </div>

              <Button
                variant="primary"
                onClick={() => void handleFullScan()}
                loading={fullLoading}
                leftIcon={fullLoading ? <Loader2 size={14} className="animate-spin" /> : undefined}
              >
                Run Full Scan
              </Button>
            </div>
            <ResultBlock data={fullResult} />
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Marketplace                                                         */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="marketplace">
          <Card className="p-6 mt-4">
            <h2 className="text-base font-semibold text-text mb-4">Marketplace Scan</h2>
            <div className="space-y-4">
              {mktError && <Alert variant="danger">{mktError}</Alert>}

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Entity Name <span className="text-neon-r">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Entity to search for"
                  value={mktEntityName}
                  onChange={(e) => setMktEntityName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Additional Terms <span className="text-text-mute text-xs">(comma-separated)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
                  rows={2}
                  placeholder="term1, term2"
                  value={mktTerms}
                  onChange={(e) => setMktTerms(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Max Sites
                </label>
                <Input
                  type="number"
                  value={String(mktMaxSites)}
                  onChange={(e) => setMktMaxSites(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>

              <Button
                variant="primary"
                onClick={() => void handleMarketplaceScan()}
                loading={mktLoading}
                leftIcon={mktLoading ? <Loader2 size={14} className="animate-spin" /> : undefined}
              >
                Run Marketplace Scan
              </Button>
            </div>
            <ResultBlock data={mktResult} />
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Breach Scan                                                         */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="breach">
          <Card className="p-6 mt-4">
            <h2 className="text-base font-semibold text-text mb-4">Breach Scan</h2>
            <div className="space-y-4">
              {breachError && <Alert variant="danger">{breachError}</Alert>}

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Emails <span className="text-text-mute text-xs">(comma-separated)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
                  rows={2}
                  placeholder="email1@example.com, email2@example.com"
                  value={breachEmails}
                  onChange={(e) => setBreachEmails(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Usernames <span className="text-text-mute text-xs">(comma-separated)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
                  rows={2}
                  placeholder="user1, user2"
                  value={breachUsernames}
                  onChange={(e) => setBreachUsernames(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="breach-pastes"
                  type="checkbox"
                  checked={breachPastes}
                  onChange={(e) => setBreachPastes(e.target.checked)}
                  className="accent-cyan"
                />
                <label htmlFor="breach-pastes" className="text-sm text-text">
                  Check paste sites
                </label>
              </div>

              <Button
                variant="primary"
                onClick={() => void handleBreachScan()}
                loading={breachLoading}
                leftIcon={breachLoading ? <Loader2 size={14} className="animate-spin" /> : undefined}
              >
                Run Breach Scan
              </Button>
            </div>
            <ResultBlock data={breachResult} />
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Crypto Trace                                                        */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="crypto">
          <Card className="p-6 mt-4">
            <h2 className="text-base font-semibold text-text mb-4">Crypto Trace</h2>
            <div className="space-y-4">
              {cryptoError && <Alert variant="danger">{cryptoError}</Alert>}

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Addresses <span className="text-neon-r">*</span>{' '}
                  <span className="text-text-mute text-xs">(comma-separated)</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 bg-surface border border-border text-text text-sm focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
                  rows={3}
                  placeholder="1A1zP1..., 0xAb1..."
                  value={cryptoAddresses}
                  onChange={(e) => setCryptoAddresses(e.target.value)}
                />
              </div>

              <Button
                variant="primary"
                onClick={() => void handleCryptoTrace()}
                loading={cryptoLoading}
                leftIcon={cryptoLoading ? <Loader2 size={14} className="animate-spin" /> : undefined}
              >
                Trace Addresses
              </Button>
            </div>
            <ResultBlock data={cryptoResult} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
