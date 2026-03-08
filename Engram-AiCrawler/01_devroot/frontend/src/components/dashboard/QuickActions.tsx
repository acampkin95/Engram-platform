import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  CalendarClock,
} from 'lucide-react';
import { FaSpider, FaMagnifyingGlass, FaCircleNodes } from 'react-icons/fa6';
import { api } from '../../lib/api';

interface ActionCard {
  icon: React.ElementType;
  label: string;
  description: string;
  to: string;
  color: string;
  bg: string;
  border: string;
}

export function QuickActions() {
  const [hasCrawls, setHasCrawls] = useState(false);
  const [hasInvestigations, setHasInvestigations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [crawlRes, scanRes] = await Promise.allSettled([
          api.get<Record<string, unknown>[]>('/crawl/list?limit=3'),
          api.get<{ scans: Record<string, unknown>[] }>('/osint/scan/list'),
        ]);
        if (cancelled) return;
        if (crawlRes.status === 'fulfilled') {
          const crawls = crawlRes.value.data;
          setHasCrawls(Array.isArray(crawls) && crawls.length > 0);
        }
        if (scanRes.status === 'fulfilled') {
          setHasInvestigations((scanRes.value.data.scans?.length ?? 0) > 0);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const baseActions: ActionCard[] = [
    {
      icon: FaSpider,
      label: 'New Crawl',
      description: 'Start crawling a URL',
      to: '/crawl/new',
      color: 'text-cyan',
      bg: 'bg-cyan/10 group-hover:bg-cyan/20',
      border: 'hover:border-cyan/30',
    },
    {
      icon: CalendarClock,
      label: 'Check Schedules',
      description: 'Manage crawl schedules',
      to: '/scheduler',
      color: 'text-fuchsia',
      bg: 'bg-fuchsia/10 group-hover:bg-fuchsia/20',
      border: 'hover:border-fuchsia/30',
    },
    {
      icon: FaCircleNodes,
      label: 'Network Analysis',
      description: 'Explore knowledge graphs',
      to: '/graph',
      color: 'text-volt',
      bg: 'bg-volt/10 group-hover:bg-volt/20',
      border: 'hover:border-volt/30',
    },
  ];

  const conditionalActions: ActionCard[] = [];

  if (hasCrawls) {
    conditionalActions.push({
      icon: FileText,
      label: 'View Latest Results',
      description: 'Browse recent crawl data',
      to: '/crawl/history',
      color: 'text-plasma',
      bg: 'bg-plasma/10 group-hover:bg-plasma/20',
      border: 'hover:border-plasma/30',
    });
  }

  if (hasInvestigations) {
    conditionalActions.push({
      icon: FaMagnifyingGlass,
      label: 'Open Investigation',
      description: 'Continue OSINT research',
      to: '/investigations',
      color: 'text-fuchsia',
      bg: 'bg-fuchsia/10 group-hover:bg-fuchsia/20',
      border: 'hover:border-fuchsia/30',
    });
  }

  const actions = [baseActions[0], ...conditionalActions, ...baseActions.slice(1)];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex flex-col gap-3 p-5 bg-void border border-border">
            <div className="w-11 h-11 bg-abyss/50" />
              <div className="h-3.5 w-24 bg-abyss/50" />
              <div className="h-3 w-36 bg-abyss/30" />
            </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
      {actions.map((action) => (
        <Link
          key={action.label}
          to={action.to}
          className={`group flex flex-col gap-3 p-5 bg-void hover:bg-raised border border-transparent ${action.border} transition-all duration-200`}
        >
          <div className={`p-3 w-fit ${action.bg} transition-colors`}>
            <action.icon className={`w-5 h-5 ${action.color}`} />
          </div>
          <div>
            <p className="font-medium text-sm text-text group-hover:text-text">
              {action.label}
            </p>
            <p className="text-xs text-text-dim mt-0.5">{action.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
