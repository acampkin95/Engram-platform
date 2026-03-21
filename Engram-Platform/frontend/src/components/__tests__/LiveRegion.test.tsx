import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveRegionProvider, useLiveRegion } from '../LiveRegion';

// Test component that uses the live region hook
function TestComponent() {
  const { announce } = useLiveRegion();

  return (
    <div>
      <button onClick={() => announce('Polite announcement')}>Announce Polite</button>
      <button onClick={() => announce('Assertive announcement', 'assertive')}>
        Announce Assertive
      </button>
      <button onClick={() => announce('Custom assertive', 'assertive')}>
        Custom Assertive
      </button>
    </div>
  );
}

describe('LiveRegion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('LiveRegionProvider rendering', () => {
    it('renders children', () => {
      render(
        <LiveRegionProvider>
          <div>Test content</div>
        </LiveRegionProvider>,
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('renders polite live region with aria-live attribute', () => {
      render(
        <LiveRegionProvider>
          <div>Test content</div>
        </LiveRegionProvider>,
      );

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toBeInTheDocument();
      expect(politeRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('renders assertive live region with aria-live attribute', () => {
      render(
        <LiveRegionProvider>
          <div>Test content</div>
        </LiveRegionProvider>,
      );

      const assertiveRegion = document.querySelector('[aria-live="assertive"]');
      expect(assertiveRegion).toBeInTheDocument();
      expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('marks assertive region with alert role', () => {
      render(
        <LiveRegionProvider>
          <div>Test content</div>
        </LiveRegionProvider>,
      );

      const alertRegion = document.querySelector('[role="alert"]');
      expect(alertRegion).toBeInTheDocument();
      expect(alertRegion).toHaveAttribute('aria-live', 'assertive');
    });

    it('renders live regions with sr-only class for visual hiding', () => {
      render(
        <LiveRegionProvider>
          <div>Test content</div>
        </LiveRegionProvider>,
      );

      const politeRegion = document.querySelector('[aria-live="polite"]');
      const assertiveRegion = document.querySelector('[aria-live="assertive"]');

      expect(politeRegion).toHaveClass('sr-only');
      expect(assertiveRegion).toHaveClass('sr-only');
    });
  });

  describe('useLiveRegion hook', () => {
    it('provides announce function', () => {
      const { container } = render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      expect(screen.getByText('Announce Polite')).toBeInTheDocument();
    });
  });

  describe('polite announcements', () => {
    it('announces polite message in aria-live="polite" region', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Polite'));

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveTextContent('Polite announcement');
    });

    it('defaults to polite priority when not specified', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Polite'));

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveTextContent('Polite announcement');
    });

    it('clears polite message after 1 second', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Polite'));

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveTextContent('Polite announcement');

      await waitFor(
        () => {
          expect(politeRegion).toHaveTextContent('');
        },
        { timeout: 2000 },
      );
    });

    it('allows multiple polite announcements', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      const politeButton = screen.getByText('Announce Polite');

      await user.click(politeButton);
      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveTextContent('Polite announcement');

      await waitFor(
        () => {
          expect(politeRegion).toHaveTextContent('');
        },
        { timeout: 2000 },
      );

      await user.click(politeButton);
      expect(politeRegion).toHaveTextContent('Polite announcement');
    });
  });

  describe('assertive announcements', () => {
    it('announces assertive message in aria-live="assertive" region', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Assertive'));

      const assertiveRegion = document.querySelector('[aria-live="assertive"]');
      expect(assertiveRegion).toHaveTextContent('Assertive announcement');
    });

    it('clears assertive message after 1 second', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Assertive'));

      const assertiveRegion = document.querySelector('[aria-live="assertive"]');
      expect(assertiveRegion).toHaveTextContent('Assertive announcement');

      await waitFor(
        () => {
          expect(assertiveRegion).toHaveTextContent('');
        },
        { timeout: 2000 },
      );
    });

    it('marks assertive region with alert role for screen readers', () => {
      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      const alertRegion = document.querySelector('[role="alert"]');
      expect(alertRegion).toHaveAttribute('aria-live', 'assertive');
    });

    it('allows multiple assertive announcements', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      const assertiveButton = screen.getByText('Announce Assertive');

      await user.click(assertiveButton);
      const assertiveRegion = document.querySelector('[aria-live="assertive"]');
      expect(assertiveRegion).toHaveTextContent('Assertive announcement');

      await waitFor(
        () => {
          expect(assertiveRegion).toHaveTextContent('');
        },
        { timeout: 2000 },
      );

      await user.click(assertiveButton);
      expect(assertiveRegion).toHaveTextContent('Assertive announcement');
    });
  });

  describe('announcement separation', () => {
    it('keeps polite and assertive messages in separate regions', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Polite'));
      await user.click(screen.getByText('Announce Assertive'));

      const politeRegion = document.querySelector('[aria-live="polite"]');
      const assertiveRegion = document.querySelector('[aria-live="assertive"]');

      expect(politeRegion).toHaveTextContent('Polite announcement');
      expect(assertiveRegion).toHaveTextContent('Assertive announcement');
    });

    it('does not cross contaminate messages between regions', async () => {
      const user = userEvent.setup();

      render(
        <LiveRegionProvider>
          <TestComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Polite'));

      const assertiveRegion = document.querySelector('[aria-live="assertive"]');
      expect(assertiveRegion).toHaveTextContent('');
    });
  });

  describe('aria attributes', () => {
    it('sets aria-atomic="true" for polite announcements', () => {
      render(
        <LiveRegionProvider>
          <div>Test</div>
        </LiveRegionProvider>,
      );

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveAttribute('aria-atomic', 'true');
    });

    it('sets aria-atomic="true" for assertive announcements', () => {
      render(
        <LiveRegionProvider>
          <div>Test</div>
        </LiveRegionProvider>,
      );

      const assertiveRegion = document.querySelector('[aria-live="assertive"]');
      expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('empty announcements', () => {
    it('handles empty string announcements', async () => {
      const user = userEvent.setup();

      function TestEmptyComponent() {
        const { announce } = useLiveRegion();

        return <button onClick={() => announce('')}>Announce Empty</button>;
      }

      render(
        <LiveRegionProvider>
          <TestEmptyComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Empty'));

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveTextContent('');
    });
  });

  describe('special characters and formatting', () => {
    it('preserves special characters in announcements', async () => {
      const user = userEvent.setup();

      function TestSpecialComponent() {
        const { announce } = useLiveRegion();

        return (
          <button onClick={() => announce('Error: "Special" & <characters>')}>
            Announce Special
          </button>
        );
      }

      render(
        <LiveRegionProvider>
          <TestSpecialComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Special'));

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveTextContent('Error: "Special" & <characters>');
    });

    it('handles long announcements', async () => {
      const user = userEvent.setup();

      const longMessage = 'A'.repeat(500);

      function TestLongComponent() {
        const { announce } = useLiveRegion();

        return <button onClick={() => announce(longMessage)}>Announce Long</button>;
      }

      render(
        <LiveRegionProvider>
          <TestLongComponent />
        </LiveRegionProvider>,
      );

      await user.click(screen.getByText('Announce Long'));

      const politeRegion = document.querySelector('[aria-live="polite"]');
      expect(politeRegion).toHaveTextContent(longMessage);
    });
  });
});
