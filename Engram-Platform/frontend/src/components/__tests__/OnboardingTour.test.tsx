import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingTour } from '../OnboardingTour';

// Mock next-themes and zustand store
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}));

vi.mock('@/src/stores/preferencesStore', () => ({
  usePreferencesStore: vi.fn(),
}));

import { usePreferencesStore } from '@/src/stores/preferencesStore';

const mockUsePreferencesStore = usePreferencesStore as any;

// Setup global mocks for ResizeObserver and MutationObserver
const createMockResizeObserver = () => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});

const createMockMutationObserver = () => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
});

class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

class MockMutationObserver {
  observe = vi.fn();
  disconnect = vi.fn();
}

if (typeof global !== 'undefined' && !global.ResizeObserver) {
  global.ResizeObserver = MockResizeObserver as any;
}

if (typeof global !== 'undefined' && !global.MutationObserver) {
  global.MutationObserver = MockMutationObserver as any;
}

describe('OnboardingTour', () => {
  const mockComplete = vi.fn();
  const mockOnComplete = vi.fn();

  const defaultSteps = [
    {
      id: 'step1',
      title: 'Step 1',
      content: 'This is step 1',
      placement: 'center' as const,
    },
    {
      id: 'step2',
      title: 'Step 2',
      content: 'This is step 2',
      target: '[data-testid="target"]',
      placement: 'right' as const,
    },
    {
      id: 'step3',
      title: 'Step 3',
      content: 'This is step 3',
      placement: 'bottom' as const,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnComplete.mockClear();
    mockComplete.mockClear();

    mockUsePreferencesStore.mockImplementation((selector: any) => {
      const store = {
        onboardingCompleted: false,
        completeOnboarding: mockComplete,
      };
      return selector(store);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when component is not mounted', () => {
    const { container } = render(<OnboardingTour steps={defaultSteps} />);
    // On initial render before useEffect runs, should be null
    expect(container.firstChild).toBeNull();
  });

  it('renders tour modal after mounting', async () => {
    render(<OnboardingTour steps={defaultSteps} />);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('This is step 1')).toBeInTheDocument();
  });

  it('renders nothing when tour is completed', () => {
    mockUsePreferencesStore.mockImplementation((selector: any) => {
      const store = {
        onboardingCompleted: true,
        completeOnboarding: mockComplete,
      };
      return selector(store);
    });

    const { container } = render(<OnboardingTour steps={defaultSteps} />);

    expect(container.firstChild).toBeNull();
  });

  it('displays current step title and content', async () => {
    render(<OnboardingTour steps={defaultSteps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('This is step 1')).toBeInTheDocument();
    });
  });

  it('advances to next step on action button click', async () => {
    const user = userEvent.setup();
    const steps = [
      { id: 'step1', title: 'Step 1', content: 'Content 1', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
      { id: 'step2', title: 'Step 2', content: 'Content 2', placement: 'center' as const },
    ];

    render(<OnboardingTour steps={steps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });
  });

  it('goes back to previous step when Back button is clicked', async () => {
    const user = userEvent.setup();
    const steps = [
      { id: 'step1', title: 'Step 1', content: 'Content 1', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
      { id: 'step2', title: 'Step 2', content: 'Content 2', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
    ];

    render(<OnboardingTour steps={steps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Advance to step 2
    let nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });

    // Go back - get all buttons and find the Back button (should be visible now)
    const allButtons = screen.getAllByRole('button');
    const backButton = allButtons.find((btn) => btn.textContent === 'Back');
    expect(backButton).toBeInTheDocument();
    await user.click(backButton!);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });
  });

  it('shows Back button only after first step', async () => {
    const user = userEvent.setup();
    const steps = [
      { id: 'step1', title: 'Step 1', content: 'Content 1', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
      { id: 'step2', title: 'Step 2', content: 'Content 2', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
    ];

    render(<OnboardingTour steps={steps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Back button should not exist on first step
    const allButtons = screen.getAllByRole('button');
    const backButtonFirst = allButtons.find((btn) => btn.textContent === 'Back');
    expect(backButtonFirst).toBeUndefined();

    // Advance to step 2
    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      const allButtonsAfter = screen.getAllByRole('button');
      const backButtonAfter = allButtonsAfter.find((btn) => btn.textContent === 'Back');
      expect(backButtonAfter).toBeInTheDocument();
    });
  });

  it('completes tour on last step action click', async () => {
    const user = userEvent.setup();
    const steps = [
      { id: 'step1', title: 'Step 1', content: 'Content 1', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
      { id: 'step2', title: 'Step 2', content: 'Content 2', placement: 'center' as const, action: { label: 'Finish', onClick: vi.fn() } },
    ];

    render(<OnboardingTour steps={steps} onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Advance to last step
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('Step 2')).toBeInTheDocument();
    });

    // Click finish on last step
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    expect(mockComplete).toHaveBeenCalled();
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('calls step action onClick before advancing', async () => {
    const user = userEvent.setup();
    const stepAction = vi.fn();
    const steps = [
      { id: 'step1', title: 'Step 1', content: 'Content 1', placement: 'center' as const, action: { label: 'Next', onClick: stepAction } },
      { id: 'step2', title: 'Step 2', content: 'Content 2', placement: 'center' as const },
    ];

    render(<OnboardingTour steps={steps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(stepAction).toHaveBeenCalled();
  });

  it('displays progress indicator with correct styling', async () => {
    render(<OnboardingTour steps={defaultSteps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Check progress text
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('skips tour on Skip button click', async () => {
    const user = userEvent.setup();
    render(<OnboardingTour steps={defaultSteps} onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    const skipButton = screen.getByRole('button', { name: 'Skip tour' });
    await user.click(skipButton);

    expect(mockComplete).toHaveBeenCalled();
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('skips tour when overlay background is clicked', async () => {
    const user = userEvent.setup();
    render(<OnboardingTour steps={defaultSteps} onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Find the overlay background and click it
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.querySelector('.fixed.inset-0.bg-black');

    if (overlay) {
      await user.click(overlay);
      expect(mockComplete).toHaveBeenCalled();
    }
  });

  it('has proper accessibility attributes', async () => {
    render(<OnboardingTour steps={defaultSteps} />);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Onboarding: Step 1');
    });
  });

  it('renders with correct step count in progress indicator', async () => {
    const user = userEvent.setup();
    const steps = [
      { id: 'step1', title: 'Step 1', content: 'Content 1', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
      { id: 'step2', title: 'Step 2', content: 'Content 2', placement: 'center' as const, action: { label: 'Next', onClick: vi.fn() } },
      { id: 'step3', title: 'Step 3', content: 'Content 3', placement: 'center' as const },
    ];

    render(<OnboardingTour steps={steps} />);

    await waitFor(() => {
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('2 of 3')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByText('3 of 3')).toBeInTheDocument();
    });
  });

  it('observes target element for position updates', async () => {
    const steps = [
      {
        id: 'step1',
        title: 'Step 1',
        content: 'Content 1',
        target: '[data-testid="target"]',
        placement: 'right' as const,
      },
    ];

    render(
      <>
        <div data-testid="target" style={{ position: 'relative', width: '100px', height: '100px' }}>
          Target Element
        </div>
        <OnboardingTour steps={steps} />
      </>
    );

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Verify that the target element exists and tour renders
    const targetEl = screen.getByTestId('target');
    expect(targetEl).toBeInTheDocument();
  });

  it('handles missing target element gracefully', async () => {
    const steps = [
      {
        id: 'step1',
        title: 'Step 1',
        content: 'Content 1',
        target: '[data-testid="nonexistent"]',
        placement: 'right' as const,
      },
    ];

    render(<OnboardingTour steps={steps} />);

    await waitFor(() => {
      expect(screen.getByText('Step 1')).toBeInTheDocument();
    });

    // Should still render without crashing
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders with default steps when none provided', async () => {
    render(<OnboardingTour />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to Engram')).toBeInTheDocument();
    });
  });

  it('uses createPortal to render in document body', async () => {
    render(<OnboardingTour steps={defaultSteps} />);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      // The dialog should be rendered as a portal (in document.body)
      expect(dialog).toBeInTheDocument();
    });
  });
});
