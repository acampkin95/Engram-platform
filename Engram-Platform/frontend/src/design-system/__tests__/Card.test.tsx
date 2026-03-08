import { render, screen } from '@testing-library/react';
import { Card } from '@/src/design-system/components/Card';

describe('Card', () => {
  it('renders children in the middle section', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders header section when header prop is provided', () => {
    render(<Card header="Card Header">Content</Card>);
    expect(screen.getByText('Card Header')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders footer section when footer prop is provided', () => {
    render(<Card footer="Card Footer">Content</Card>);
    expect(screen.getByText('Card Footer')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders header and footer together with children', () => {
    render(
      <Card header="Header" footer="Footer">
        Middle content
      </Card>,
    );
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Middle content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('renders without header or footer when neither prop is provided', () => {
    const { container } = render(<Card>Only children</Card>);
    // Root div + content div = 2 total (no header/footer divs)
    const divs = container.querySelectorAll('div');
    expect(divs.length).toBe(2);
    expect(screen.getByText('Only children')).toBeInTheDocument();
  });
});
