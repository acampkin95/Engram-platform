import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import ChatContent from './ChatContent';

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

test('renders ChatContent without crashing', async () => {
  render(<ChatContent />);

  await screen.findByText('RAG Chat');
});
