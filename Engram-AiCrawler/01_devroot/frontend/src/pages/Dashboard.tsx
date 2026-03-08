import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Database,
  Network,
  Image,
  RefreshCw,
  Shield,
  Zap,
  AlertCircle,
} from 'lucide-react';
import OSINTDashboard from './OSINTDashboard';
import DataManagement from './DataManagement';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { Button, Card, CardBody, CardHeader } from '../components/ui';
import {
  StatCardGrid,
  StatCardData,
  QuickActions,
  RecentActivity,

} from '../components/dashboard';
import { PerformanceMetricsCard, ActivityHeatmap, TimelineActivityChart, PlatformDistributionChart, ThreatLevelGauge } from '../components/charts';
import { ProviderStatusBar } from '../components/osint/ProviderStatusBar';

type DashboardTab = 'overview' | 'osint' | 'data';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
}

function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-3 p-4 bg-neon-r/10 border border-neon-r/30 text-neon-r"
    >
      <AlertCircle className="w-5 h-5 flex-shrink-0" />
      <p className="flex-1 text-sm">{message}</p>
      <Button
        variant="danger"
        size="sm"
        leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        onClick={onRetry}
      >
        Retry
      </Button>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const { stats, loading, error, refresh } = useDashboardStats();

  const statCards: StatCardData[] = [
    {
      label: 'Active Crawls',
      value: stats ? formatNumber(stats.crawls.active) : '—',
      sub: stats ? `${formatNumber(stats.crawls.total)} total` : undefined,
      icon: Activity,
      color: 'text-plasma',
      bg: 'bg-plasma/10',
    },
    {
      label: 'Data Sets',
      value: stats ? formatNumber(stats.data_sets.total) : '—',
      sub: stats ? formatBytes(stats.data_sets.total_size_bytes) : undefined,
      icon: Database,
      color: 'text-cyan',
      bg: 'bg-cyan/10',
    },
    {
      label: 'Collections',
      value: stats ? formatNumber(stats.storage.collections) : '—',
      sub: stats ? `${formatNumber(stats.storage.total_documents)} docs` : undefined,
      icon: Network,
      color: 'text-cyan',
      bg: 'bg-cyan/10',
    },
    {
      label: 'Investigations',
      value: stats ? formatNumber(stats.investigations.total) : '—',
      sub: stats ? `${formatNumber(stats.investigations.active)} active` : undefined,
      icon: Image,
      color: 'text-fuchsia',
      bg: 'bg-fuchsia/10',
    },
  ];

  return (
    <div className="min-h-screen bg-void text-text font-sans transition-colors duration-300">
      <div className="border-b border-border bg-surface/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan to-cyan-dim">
                Crawl4AI Command Center
              </h1>
              <p className="text-sm text-text-dim mt-1">
                Advanced OSINT &amp; Data Aggregation Platform
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={refresh}
                disabled={loading}
                aria-label="Refresh stats"
              >
                <RefreshCw
                  className={`w-5 h-5 text-text-dim ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
              <Button variant="ghost" size="sm" aria-label="Security">
                <Shield className="w-5 h-5 text-text-dim" />
              </Button>
              <Button variant="ghost" size="sm" aria-label="Performance">
                <Zap className="w-5 h-5 text-volt" />
              </Button>
            </div>
          </div>

          <nav className="flex space-x-6 relative overflow-x-auto">
            {(['overview', 'osint', 'data'] as DashboardTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-medium transition-all relative capitalize whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-cyan'
                    : 'text-text-dim hover:text-text'
                }`}
              >
                {tab === 'osint' ? 'OSINT Operations' : tab === 'data' ? 'Data Management' : 'Overview'}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan rounded-t-full" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -4, transition: { duration: 0.15 } } }}
            >
              <OverviewTab
                stats={stats}
                loading={loading}
                error={error}
                refresh={refresh}
                statCards={statCards}
              />
            </motion.div>
          )}
          {activeTab === 'osint' && (
            <motion.div
              key="osint"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -4, transition: { duration: 0.15 } } }}
            >
              <OSINTDashboard />
            </motion.div>
          )}
          {activeTab === 'data' && (
            <motion.div
              key="data"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -4, transition: { duration: 0.15 } } }}
            >
              <DataManagement />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

interface OverviewTabProps {
  stats: ReturnType<typeof useDashboardStats>['stats'];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
  statCards: StatCardData[];
}

function OverviewTab({ stats, loading, error, refresh, statCards }: OverviewTabProps) {
  return (
    <div className="space-y-8">
      {error && (
        <ErrorBanner
          message={`Could not load stats: ${error.message}`}
          onRetry={refresh}
        />
      )}

      <StatCardGrid cards={statCards} loading={loading && !stats} />

      <ProviderStatusBar className="mt-4" />

      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Completed', value: formatNumber(stats.crawls.completed), color: 'text-plasma' },
            { label: 'Active', value: formatNumber(stats.crawls.active), color: 'text-cyan' },
            { label: 'Failed', value: formatNumber(stats.crawls.failed), color: 'text-neon-r' },
          ].map((item) => (
            <Card key={item.label}>
              <CardBody className="px-5 py-4 flex items-center gap-4">
                <span className={`text-2xl font-bold font-display ${item.color}`}>
                  {item.value}
                </span>
                <span className="text-sm text-text-dim font-medium">
                  {item.label} crawls
                </span>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <TimelineActivityChart />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceMetricsCard />
        <ActivityHeatmap />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlatformDistributionChart />
        <ThreatLevelGauge />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-xl font-display font-semibold flex items-center gap-2">
              <Zap className="w-5 h-5 text-volt" /> Quick Actions
            </h2>
          </CardHeader>
          <CardBody>
            <QuickActions />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-display font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan" /> Recent Activity
            </h2>
          </CardHeader>
          <CardBody>
            <RecentActivity />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
