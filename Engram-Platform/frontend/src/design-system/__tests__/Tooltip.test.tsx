import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../components/Tooltip';

describe('Tooltip', () => {
  it('renders trigger children', () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('renders with different sides', () => {
    const { container } = render(
      <Tooltip content="Bottom tip" side="bottom">
        <span>Target</span>
      </Tooltip>,
    );
    expect(container).toBeInTheDocument();
  });

  it('applies custom className to trigger wrapper', () => {
    const { container } = render(
      <Tooltip content="Tip" className="my-tooltip">
        <span>Target</span>
      </Tooltip>,
    );
    // className is on the outer wrapper span with inline-flex
    const wrapperSpan = container.querySelector('span.my-tooltip');
    expect(wrapperSpan).toBeInTheDocument();
  });

  it('accepts custom delay duration', () => {
    const { container } = render(
      <Tooltip content="Slow tip" delayDuration={500}>
        <span>Target</span>
      </Tooltip>,
    );
    expect(container).toBeInTheDocument();
  });
});

describe('Tooltip primitive exports', () => {
  it('exports TooltipProvider', () => {
    expect(TooltipProvider).toBeDefined();
  });

  it('exports TooltipRoot', () => {
    expect(TooltipRoot).toBeDefined();
  });

  it('exports TooltipTrigger', () => {
    expect(TooltipTrigger).toBeDefined();
  });

  it('exports TooltipContent', () => {
    expect(TooltipContent).toBeDefined();
  });
});
