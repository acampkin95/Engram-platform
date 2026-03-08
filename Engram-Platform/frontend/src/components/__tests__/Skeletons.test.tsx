import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SkeletonAnalytics,
  SkeletonCard,
  SkeletonDashboardHome,
  SkeletonDataTable,
  SkeletonFilterBar,
  SkeletonStatCard,
  SkeletonText,
} from '../Skeletons';

describe('SkeletonText', () => {
  it('renders default 3 lines', () => {
    const { container } = render(<SkeletonText />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it('renders custom number of lines', () => {
    const { container } = render(<SkeletonText lines={5} />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(5);
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonText className="my-skeleton" />);
    expect(container.firstElementChild?.className).toContain('my-skeleton');
  });
});

describe('SkeletonStatCard', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<SkeletonStatCard />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonStatCard className="my-card" />);
    expect(container.firstElementChild?.className).toContain('my-card');
  });
});

describe('SkeletonCard', () => {
  it('renders card structure', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonCard className="my-card" />);
    expect(container.firstElementChild?.className).toContain('my-card');
  });
});

describe('SkeletonDataTable', () => {
  it('renders default 5 rows', () => {
    const { container } = render(<SkeletonDataTable />);
    // Each row has multiple skeleton elements
    const rows = container.querySelectorAll('.divide-y > div');
    expect(rows.length).toBe(5);
  });

  it('renders custom number of rows', () => {
    const { container } = render(<SkeletonDataTable rows={3} />);
    const rows = container.querySelectorAll('.divide-y > div');
    expect(rows.length).toBe(3);
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonDataTable className="my-table" />);
    expect(container.firstElementChild?.className).toContain('my-table');
  });
});

describe('SkeletonDashboardHome', () => {
  it('renders without errors', () => {
    const { container } = render(<SkeletonDashboardHome />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders stat cards', () => {
    const { container } = render(<SkeletonDashboardHome />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(5);
  });
});

describe('SkeletonAnalytics', () => {
  it('renders without errors', () => {
    const { container } = render(<SkeletonAnalytics />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('renders multiple skeleton elements', () => {
    const { container } = render(<SkeletonAnalytics />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(10);
  });
});

describe('SkeletonFilterBar', () => {
  it('renders without errors', () => {
    const { container } = render(<SkeletonFilterBar />);
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<SkeletonFilterBar className="my-filter" />);
    expect(container.firstElementChild?.className).toContain('my-filter');
  });
});
