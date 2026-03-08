import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import InvestigationsContent from './InvestigationsContent';

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
  crawlerClient: {
    getInvestigations: vi.fn(),
    createInvestigation: vi.fn(),
  },
}));

test('renders InvestigationsContent without crashing', async () => {
  render(<InvestigationsContent />);

  await waitFor(() => {
    expect(screen.getByText('Investigations')).toBeInTheDocument();
    expect(screen.getByText('New Investigation')).toBeInTheDocument();
  });
});
