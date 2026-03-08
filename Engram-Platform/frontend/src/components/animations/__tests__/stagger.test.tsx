import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let reduceMotion = false;

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="motion-div" className={className}>
        {children}
      </div>
    ),
  },
  useReducedMotion: () => reduceMotion,
}));

import {
  cardContainerVariants,
  containerVariants,
  fastContainerVariants,
  itemVariants,
  StaggerContainer,
  StaggerItem,
  StaggerList,
} from '../stagger';

describe('stagger animation helpers', () => {
  beforeEach(() => {
    reduceMotion = false;
  });

  it('exports expected variant timing values', () => {
    expect(containerVariants.show).toBeDefined();
    expect(fastContainerVariants.show).toBeDefined();
    expect(cardContainerVariants.show).toBeDefined();
    expect(itemVariants.hidden).toEqual({ opacity: 0, y: 20 });
  });

  it('renders stagger container and item with motion wrappers', () => {
    render(
      <StaggerContainer className="container" variant="fast">
        <StaggerItem className="item" variant="card">
          Card Item
        </StaggerItem>
      </StaggerContainer>,
    );

    expect(screen.getAllByTestId('motion-div')).toHaveLength(2);
    expect(screen.getByText('Card Item')).toBeInTheDocument();
  });

  it('renders static wrappers when reduced motion is enabled', () => {
    reduceMotion = true;

    render(
      <StaggerContainer className="static-container">
        <StaggerItem className="static-item">Static item</StaggerItem>
      </StaggerContainer>,
    );

    expect(screen.queryByTestId('motion-div')).not.toBeInTheDocument();
    expect(screen.getByText('Static item')).toBeInTheDocument();
  });

  it('renders list items through StaggerList', () => {
    render(
      <StaggerList
        items={['alpha', 'beta']}
        renderItem={(item) => <span>{item}</span>}
        variant="default"
      />,
    );

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });
});
