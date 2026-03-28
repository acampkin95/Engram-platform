import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntelligenceLayerToggle } from '../IntelligenceLayerToggle';

const mockSetIntelligenceLayer = vi.fn();

vi.mock('@/src/stores/canvasStore', () => ({
  useIntelligenceStore: vi.fn(() => ({
    intelligenceLayer: 'processed',
    setIntelligenceLayer: mockSetIntelligenceLayer,
  })),
}));

describe('IntelligenceLayerToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all three layers', () => {
    render(<IntelligenceLayerToggle />);
    expect(screen.getByText('RAW')).toBeInTheDocument();
    expect(screen.getByText('PROCESSED')).toBeInTheDocument();
    expect(screen.getByText('AGENT')).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(<IntelligenceLayerToggle className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should show Intelligence Layer label', () => {
    render(<IntelligenceLayerToggle />);
    expect(screen.getByText('Intelligence Layer')).toBeInTheDocument();
  });

  it('should call setIntelligenceLayer when layer clicked', () => {
    render(<IntelligenceLayerToggle />);
    fireEvent.click(screen.getByText('RAW'));
    expect(mockSetIntelligenceLayer).toHaveBeenCalledWith('raw');
  });

  it('should show descriptions in non-compact mode', () => {
    render(<IntelligenceLayerToggle />);
    expect(screen.getByText('Unprocessed source data')).toBeInTheDocument();
    expect(screen.getByText('Filtered & analyzed')).toBeInTheDocument();
    expect(screen.getByText('AI-derived insights')).toBeInTheDocument();
  });

  it('should hide descriptions in compact mode', () => {
    render(<IntelligenceLayerToggle compact />);
    expect(screen.queryByText('Unprocessed source data')).not.toBeInTheDocument();
  });

  it('should show standard view indicator for processed layer', () => {
    render(<IntelligenceLayerToggle />);
    expect(screen.getByText('● Standard view')).toBeInTheDocument();
  });
});
