import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '../components/Tabs';
import { Tabs, TabsContent } from '../components/Tabs';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, layoutId, initial, transition, ...props }: Record<string, unknown>) => (
      <div {...props}>{children as React.ReactNode}</div>
    ),
  },
  LazyMotion: ({ children }: Record<string, unknown>) => children,
  domAnimation: {},
}));

const sampleTabs: Tab[] = [
  { id: 'tab1', label: 'First' },
  { id: 'tab2', label: 'Second' },
  { id: 'tab3', label: 'Third' },
];

describe('Tabs', () => {
  it('renders all tab labels', () => {
    render(<Tabs tabs={sampleTabs} activeId="tab1" onChange={() => {}} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('calls onChange when a tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Tabs tabs={sampleTabs} activeId="tab1" onChange={onChange} />);

    await user.click(screen.getByText('Second'));
    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  it('renders solid variant by default', () => {
    const { container } = render(<Tabs tabs={sampleTabs} activeId="tab1" onChange={() => {}} />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders underline variant', () => {
    const { container } = render(
      <Tabs tabs={sampleTabs} activeId="tab1" onChange={() => {}} variant="underline" />,
    );
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders tabs with icons', () => {
    function TestIcon({ className }: { className?: string }) {
      return <svg className={className} data-testid="tab-icon" />;
    }
    const tabsWithIcons: Tab[] = [{ id: 'tab1', label: 'First', icon: TestIcon }];

    render(<Tabs tabs={tabsWithIcons} activeId="tab1" onChange={() => {}} />);
    expect(screen.getByTestId('tab-icon')).toBeInTheDocument();
  });

  it('renders tabs with icons in underline variant', () => {
    function TestIcon({ className }: { className?: string }) {
      return <svg className={className} data-testid="tab-icon-ul" />;
    }
    const tabsWithIcons: Tab[] = [{ id: 'tab1', label: 'First', icon: TestIcon }];

    render(<Tabs tabs={tabsWithIcons} activeId="tab1" onChange={() => {}} variant="underline" />);
    expect(screen.getByTestId('tab-icon-ul')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Tabs tabs={sampleTabs} activeId="tab1" onChange={() => {}} className="my-tabs" />,
    );
    // The class is applied to the TabsList element
    const list = container.querySelector('[role="tablist"]');
    expect(list?.className).toContain('my-tabs');
  });
});

describe('TabsContent export', () => {
  it('is defined', () => {
    expect(TabsContent).toBeDefined();
  });
});
