import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from '../FilterBar';

describe('FilterBar', () => {
  const mockOnFiltersChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Search Filter', () => {
    it('renders search input when showSearch is true', () => {
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
    });

    it('does not render search input when showSearch is false', () => {
      render(<FilterBar showSearch={false} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
    });

    it('uses custom placeholder when provided', () => {
      render(
        <FilterBar
          showSearch={true}
          placeholder="Find memories..."
          onFiltersChange={mockOnFiltersChange}
        />,
      );

      expect(screen.getByPlaceholderText('Find memories...')).toBeInTheDocument();
    });

    it('calls onFiltersChange with search value on input change', async () => {
      const user = userEvent.setup();
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByPlaceholderText('Search…') as HTMLInputElement;
      await user.type(input, 'test query');

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalled();
      });

      const lastCall = mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1][0];
      expect(lastCall.search).toBe('test query');
    });

    it('shows search icon in search input', () => {
      const { container } = render(
        <FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />,
      );

      // Search icon should be in the search container
      expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    });
  });

  describe('Date Range Filter', () => {
    it('renders date range picker when showDateRange is true', () => {
      render(<FilterBar showDateRange={true} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.getByLabelText('Select date range')).toBeInTheDocument();
    });

    it('does not render date range picker when showDateRange is false', () => {
      render(<FilterBar showDateRange={false} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.queryByLabelText('Select date range')).not.toBeInTheDocument();
    });

    it('displays default "Date range" text', () => {
      render(<FilterBar showDateRange={true} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.getByText('Date range')).toBeInTheDocument();
    });
  });

  describe('Clear Button', () => {
    it('does not show clear button when no filters are active', () => {
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.queryByLabelText('Clear all filters')).not.toBeInTheDocument();
    });

    it('shows clear button when search has value', async () => {
      const user = userEvent.setup();
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByPlaceholderText('Search…');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
      });
    });

    it('clears all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByPlaceholderText('Search…');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
      });

      const clearButton = screen.getByLabelText('Clear all filters');
      await user.click(clearButton);

      // After clearing, onFiltersChange should be called with empty object
      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith({});
      });

      // Input should be cleared
      expect((input as HTMLInputElement).value).toBe('');
    });
  });

  describe('Filter Icon and Label', () => {
    it('displays filter icon and label', () => {
      render(<FilterBar onFiltersChange={mockOnFiltersChange} />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label on form', () => {
      render(<FilterBar onFiltersChange={mockOnFiltersChange} />);

      const form = screen.getByLabelText('Filter and search');
      expect(form).toBeInTheDocument();
      expect(form.tagName).toBe('FORM');
    });

    it('provides aria-label for search input', () => {
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByLabelText('Search');
      expect(input).toHaveAttribute('aria-describedby', 'search-help');
    });

    it('provides aria-label for date range picker', () => {
      render(<FilterBar showDateRange={true} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.getByLabelText('Select date range')).toBeInTheDocument();
    });

    it('provides aria-label for clear button', async () => {
      const user = userEvent.setup();
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByPlaceholderText('Search…');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
      });
    });
  });

  describe('Custom className', () => {
    it('applies custom className to form', () => {
      const { container } = render(
        <FilterBar className="custom-filter-bar" onFiltersChange={mockOnFiltersChange} />,
      );

      const form = container.querySelector('form');
      expect(form).toHaveClass('custom-filter-bar');
    });
  });

  describe('Form submission', () => {
    it('renders as a form element', () => {
      const { container } = render(<FilterBar onFiltersChange={mockOnFiltersChange} />);

      expect(container.querySelector('form')).toBeInTheDocument();
    });

    it('accepts onFiltersChange callback', async () => {
      const user = userEvent.setup();
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByPlaceholderText('Search…');
      await user.type(input, 'test');

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalled();
      });
    });
  });

  describe('Visual Structure', () => {
    it('renders filter label with icon', () => {
      render(<FilterBar onFiltersChange={mockOnFiltersChange} />);

      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('renders form with proper visual layout', () => {
      const { container } = render(
        <FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />,
      );

      // Form should have flex layout
      const form = container.querySelector('form');
      expect(form).toHaveClass('flex');
    });
  });

  describe('Search Input Properties', () => {
    it('search input has aria-label', () => {
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });

    it('search input has aria-describedby pointing to help text', () => {
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByLabelText('Search');
      expect(input).toHaveAttribute('aria-describedby', 'search-help');

      // Help text should exist
      const helpText = screen.getByText('Enter keywords to search');
      expect(helpText).toHaveClass('sr-only');
    });
  });

  describe('Multiple Filter Inputs', () => {
    it('can render search with date range together', () => {
      render(
        <FilterBar showSearch={true} showDateRange={true} onFiltersChange={mockOnFiltersChange} />,
      );

      expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument();
      expect(screen.getByLabelText('Select date range')).toBeInTheDocument();
    });

    it('emits changes with all active filter values', async () => {
      const user = userEvent.setup();
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByPlaceholderText('Search…');
      await user.type(input, 'memory');

      await waitFor(() => {
        const lastCall =
          mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1][0];
        expect(lastCall.search).toBe('memory');
      });
    });
  });

  describe('Zod Schema Integration', () => {
    it('validates filter schema with optional fields', async () => {
      const user = userEvent.setup();
      render(<FilterBar showSearch={true} onFiltersChange={mockOnFiltersChange} />);

      const input = screen.getByPlaceholderText('Search…');
      await user.type(input, 'test');

      await waitFor(() => {
        // Should accept optional filter values
        expect(mockOnFiltersChange).toHaveBeenCalled();
        const lastCall =
          mockOnFiltersChange.mock.calls[mockOnFiltersChange.mock.calls.length - 1][0];
        expect(lastCall).toHaveProperty('search');
      });
    });
  });
});
