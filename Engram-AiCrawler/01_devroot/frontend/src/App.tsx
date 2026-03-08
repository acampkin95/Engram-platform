import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ClerkProvider } from "./components/ClerkProvider";
import { CommandPalette } from "./components/CommandPalette";
import { ErrorBoundary } from "./components/ErrorBoundary";
import ShortcutsHelp from "./components/ShortcutsHelp";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { isOnboardingComplete } from './components/onboarding/storage';
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./context/ThemeContext";
import {
  type Shortcut,
  useKeyboardShortcuts,
} from "./hooks/useKeyboardShortcuts";
import Layout from "./layouts/Dashboard";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const OSINTDashboard = lazy(() => import("./pages/OSINTDashboard"));
const DataManagement = lazy(() => import("./pages/DataManagement"));
const StoragePage = lazy(() => import("./pages/StoragePage"));
const KnowledgeGraphPage = lazy(() => import("./pages/KnowledgeGraphPage"));
const InvestigationListPage = lazy(() => import("./pages/InvestigationListPage"));
const InvestigationDetailPage = lazy(() => import("./pages/InvestigationDetailPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CrawlConfigPage = lazy(() => import("./pages/CrawlConfigPage"));
const CrawlHistoryPage = lazy(() => import("./pages/CrawlHistoryPage"));
const ActiveCrawlsPage = lazy(() => import("./pages/ActiveCrawlsPage"));
const CrawlMonitoringPage = lazy(() => import("./pages/CrawlMonitoringPage"));
const ResultViewerPage = lazy(() => import("./pages/ResultViewerPage"));
const SchedulerPage = lazy(() => import("./pages/SchedulerPage"));
const ExtractionBuilderPage = lazy(() => import("./pages/ExtractionBuilderPage"));
const RAGPipelinePage = lazy(() => import("./pages/RAGPipelinePage"));
const PerformancePage = lazy(() => import("./pages/PerformancePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

const CasesPage = lazy(() => import("./pages/CasesPage"));
const DarkwebPage = lazy(() => import("./pages/DarkwebPage"));
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-cyan" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/osint" element={<OSINTDashboard />} />
          <Route path="/data" element={<DataManagement />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/graph" element={<KnowledgeGraphPage />} />
          <Route path="/investigations" element={<InvestigationListPage />} />
          <Route path="/investigations/:id" element={<InvestigationDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/crawl/new" element={<CrawlConfigPage />} />
          <Route path="/crawl/history" element={<CrawlHistoryPage />} />
          <Route path="/crawl/active" element={<ActiveCrawlsPage />} />
          <Route path="/crawl/:crawlId/monitor" element={<CrawlMonitoringPage />} />
          <Route path="/crawl/:crawlId/results" element={<ResultViewerPage />} />
          <Route path="/scheduler" element={<SchedulerPage />} />
          <Route path="/extraction-builder" element={<ExtractionBuilderPage />} />
<Route path="/rag" element={<RAGPipelinePage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/darkweb" element={<DarkwebPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function GlobalShortcuts() {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts = useMemo<Shortcut[]>(
    () => [
      { key: "n", action: () => navigate("/crawl/new"), description: "New Crawl", category: "navigation" },
      { key: "h", action: () => navigate("/crawl/history"), description: "Crawl History", category: "navigation" },
      { key: "o", action: () => navigate("/osint"), description: "OSINT Dashboard", category: "navigation" },
      { key: "g", action: () => navigate("/graph"), description: "Knowledge Graph", category: "navigation" },
      { key: "e", action: () => navigate("/extraction-builder"), description: "Extraction Builder", category: "navigation" },
      { key: "r", action: () => navigate("/rag"), description: "RAG Pipeline", category: "navigation" },
      { key: "s", action: () => navigate("/scheduler"), description: "Scheduler", category: "navigation" },
      { key: "d", action: () => navigate("/storage"), description: "Storage", category: "navigation" },
      { key: ",", action: () => navigate("/settings"), description: "Settings", category: "navigation" },
      { key: "?", action: () => setShowHelp(true), description: "Shortcuts Help", category: "system" },
    ],
    [navigate],
  );

  useKeyboardShortcuts(shortcuts, !showHelp);

  if (!showHelp) return null;
  return (
    <ShortcutsHelp
      shortcuts={shortcuts}
      onClose={() => setShowHelp(false)}
    />
  );
}

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!isOnboardingComplete()) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleOnboardingClose = () => {
    setShowOnboarding(false);
  };

  return (
    <ErrorBoundary>
      <ClerkProvider>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
              <GlobalShortcuts />
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <AnimatedRoutes />
                </Suspense>
              </Layout>
              <CommandPalette />
              <OnboardingWizard
                isOpen={showOnboarding}
                onClose={handleOnboardingClose}
                onComplete={handleOnboardingComplete}
              />
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

export default App;
