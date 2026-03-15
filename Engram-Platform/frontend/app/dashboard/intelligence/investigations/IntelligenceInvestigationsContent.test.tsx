import { render, screen } from '@testing-library/react';
import { test, vi } from 'vitest';
import IntelligenceInvestigationsContent from './IntelligenceInvestigationsContent';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('swr', () => ({
  default: vi.fn(() => ({
    data: { data: { investigations: [] } },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  })),
}));

vi.mock('@/src/lib/crawler-client', () => ({
  crawlerClient: { getInvestigations: vi.fn() },
}));

test('renders IntelligenceInvestigationsContent without crashing', async () => {
  render(<IntelligenceInvestigationsContent />);

  await screen.findByText('Investigations');
});
