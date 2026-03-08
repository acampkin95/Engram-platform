import { useState, useCallback } from 'react';
import { useToast } from '../components/Toast';

export interface CrawlHistory {
  id: string;
  user_id: string;
  url: string;
  extraction_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  markdown?: string;
  extracted_content?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export function useCrawlHistory(_userId?: string) {
  const [history, setHistory] = useState<CrawlHistory[]>([]);
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  const toast = useToast();

  const fetchHistory = useCallback(async () => {
    // Stub: no-op until backend API integration is added
  }, []);

  const addCrawl = async (_crawl: Omit<CrawlHistory, 'id' | 'created_at'>): Promise<CrawlHistory | null> => {
    try {
      // Stub: no-op until backend API integration is added
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add crawl';
      toast.error(message);
      throw err;
    }
  };

  const updateCrawl = async (id: string, updates: Partial<CrawlHistory>): Promise<CrawlHistory | null> => {
    try {
      setHistory((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update crawl';
      toast.error(message);
      throw err;
    }
  };

  const deleteCrawl = async (id: string): Promise<void> => {
    try {
      setHistory((prev) => prev.filter((item) => item.id !== id));
      toast.success('Crawl deleted successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete crawl';
      toast.error(message);
      throw err;
    }
  };

  return {
    history,
    loading,
    error,
    fetchHistory,
    addCrawl,
    updateCrawl,
    deleteCrawl,
  };
}
