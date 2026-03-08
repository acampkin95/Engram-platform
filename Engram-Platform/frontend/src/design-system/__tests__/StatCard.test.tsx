import { render, screen } from '@testing-library/react';
import { StatCard } from '@/src/design-system/components/StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Users" value={1234} />);
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('has data-testid="stat-card" on root element', () => {
    const { container } = render(<StatCard label="Test" value={100} />);
    const statCard = container.querySelector('[data-testid="stat-card"]');
    expect(statCard).toBeInTheDocument();
  });

  it('renders TrendingUp icon when trend is positive', () => {
    const { container } = render(
      <StatCard label="Growth" value={500} trend={15} trendLabel="increase" />,
    );
    const trendingUp = container.querySelector('svg');
    expect(trendingUp).toBeInTheDocument();
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it('renders TrendingDown icon when trend is negative', () => {
    const { container } = render(
      <StatCard label="Decline" value={300} trend={-10} trendLabel="decrease" />,
    );
    const trendingDown = container.querySelector('svg');
    expect(trendingDown).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('does not render trend when trend is undefined', () => {
    render(<StatCard label="No Trend" value={200} />);
    const trendText = screen.queryByText(/%/);
    expect(trendText).not.toBeInTheDocument();
  });

  it('renders all accent variants without throwing', () => {
    const accents = ['amber', 'purple', 'teal'] as const;
    for (const accent of accents) {
      const { unmount } = render(<StatCard label={accent} value={100} accent={accent} />);
      expect(screen.getByText(accent)).toBeInTheDocument();
      unmount();
    }
  });
});
