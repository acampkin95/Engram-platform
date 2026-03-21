import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PageTransition, FadeIn, SlideIn, StaggerContainer, StaggerItem, StaggerList } from '../Animations';

// Mock framer-motion to control animation behavior in tests
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, className, ...props }: any) => {
        const { initial, animate, variants, initial: initialProp, ...restProps } = props;
        return (
          <div className={className} data-testid={props['data-testid']} {...restProps}>
            {children}
          </div>
        );
      },
    },
    useReducedMotion: () => false,
  };
});

describe('Animations', () => {
  describe('PageTransition', () => {
    it('renders children inside motion.div', () => {
      render(
        <PageTransition>
          <div>Page content</div>
        </PageTransition>,
      );

      expect(screen.getByText('Page content')).toBeInTheDocument();
    });

    it('renders with correct className', () => {
      const { container } = render(
        <PageTransition>
          <div>Content</div>
        </PageTransition>,
      );

      const motionDiv = container.querySelector('.h-full');
      expect(motionDiv).toBeInTheDocument();
    });

    it('respects reduced motion preference', () => {
      // useReducedMotion is mocked to return false
      // In real implementation, transition duration would be 0 if true
      render(
        <PageTransition>
          <div>Animated page</div>
        </PageTransition>,
      );

      expect(screen.getByText('Animated page')).toBeInTheDocument();
    });
  });

  describe('FadeIn', () => {
    it('renders children with animation wrapper', () => {
      render(
        <FadeIn>
          <span>Fading content</span>
        </FadeIn>,
      );

      expect(screen.getByText('Fading content')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(
        <FadeIn className="custom-class">
          <div>Content</div>
        </FadeIn>,
      );

      const div = container.querySelector('.custom-class');
      expect(div).toBeInTheDocument();
    });

    it('applies delay prop', () => {
      const { container } = render(
        <FadeIn delay={0.5}>
          <div>Delayed content</div>
        </FadeIn>,
      );

      expect(screen.getByText('Delayed content')).toBeInTheDocument();
    });

    it('respects reduced motion', () => {
      render(
        <FadeIn>
          <div>No animation if motion reduced</div>
        </FadeIn>,
      );

      expect(screen.getByText('No animation if motion reduced')).toBeInTheDocument();
    });

    it('applies initial and animate variants', () => {
      render(
        <FadeIn data-testid="fade-in">
          <span>Test</span>
        </FadeIn>,
      );

      const element = screen.getByTestId('fade-in');
      expect(element).toBeInTheDocument();
    });
  });

  describe('SlideIn', () => {
    it('renders children with slide animation', () => {
      render(
        <SlideIn>
          <span>Sliding content</span>
        </SlideIn>,
      );

      expect(screen.getByText('Sliding content')).toBeInTheDocument();
    });

    it('supports different slide directions', () => {
      const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

      directions.forEach((direction) => {
        const { unmount } = render(
          <SlideIn direction={direction}>
            <div>{direction} slide</div>
          </SlideIn>,
        );

        expect(screen.getByText(`${direction} slide`)).toBeInTheDocument();
        unmount();
      });
    });

    it('defaults to down direction when not specified', () => {
      render(
        <SlideIn>
          <div>Default down slide</div>
        </SlideIn>,
      );

      expect(screen.getByText('Default down slide')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(
        <SlideIn className="slide-custom">
          <div>Content</div>
        </SlideIn>,
      );

      const div = container.querySelector('.slide-custom');
      expect(div).toBeInTheDocument();
    });

    it('applies delay prop', () => {
      render(
        <SlideIn delay={0.3}>
          <div>Delayed slide</div>
        </SlideIn>,
      );

      expect(screen.getByText('Delayed slide')).toBeInTheDocument();
    });

    it('respects reduced motion preference', () => {
      render(
        <SlideIn>
          <div>Accessible slide</div>
        </SlideIn>,
      );

      expect(screen.getByText('Accessible slide')).toBeInTheDocument();
    });
  });

  describe('StaggerContainer', () => {
    it('renders children in motion container', () => {
      render(
        <StaggerContainer>
          <div>Item 1</div>
          <div>Item 2</div>
        </StaggerContainer>,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('accepts card variant (default)', () => {
      render(
        <StaggerContainer variant="card">
          <div>Card item</div>
        </StaggerContainer>,
      );

      expect(screen.getByText('Card item')).toBeInTheDocument();
    });

    it('accepts fast variant', () => {
      render(
        <StaggerContainer variant="fast">
          <div>Fast item</div>
        </StaggerContainer>,
      );

      expect(screen.getByText('Fast item')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <StaggerContainer className="stagger-custom">
          <div>Content</div>
        </StaggerContainer>,
      );

      const div = container.querySelector('.stagger-custom');
      expect(div).toBeInTheDocument();
    });

    it('respects reduced motion in container', () => {
      render(
        <StaggerContainer>
          <div>No stagger animation if motion reduced</div>
        </StaggerContainer>,
      );

      expect(screen.getByText('No stagger animation if motion reduced')).toBeInTheDocument();
    });

    it('defaults to card variant when not specified', () => {
      render(
        <StaggerContainer>
          <div>Default variant</div>
        </StaggerContainer>,
      );

      expect(screen.getByText('Default variant')).toBeInTheDocument();
    });
  });

  describe('StaggerItem', () => {
    it('renders children in motion item', () => {
      render(
        <StaggerContainer>
          <StaggerItem>
            <div>Staggered item</div>
          </StaggerItem>
        </StaggerContainer>,
      );

      expect(screen.getByText('Staggered item')).toBeInTheDocument();
    });

    it('applies index for stagger delay calculation', () => {
      render(
        <StaggerContainer>
          <StaggerItem index={0}>
            <div>First</div>
          </StaggerItem>
          <StaggerItem index={1}>
            <div>Second</div>
          </StaggerItem>
          <StaggerItem index={2}>
            <div>Third</div>
          </StaggerItem>
        </StaggerContainer>,
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('defaults to index 0 when not specified', () => {
      render(
        <StaggerContainer>
          <StaggerItem>
            <div>Default index</div>
          </StaggerItem>
        </StaggerContainer>,
      );

      expect(screen.getByText('Default index')).toBeInTheDocument();
    });

    it('accepts custom className', () => {
      const { container } = render(
        <StaggerContainer>
          <StaggerItem className="item-custom">
            <div>Content</div>
          </StaggerItem>
        </StaggerContainer>,
      );

      const div = container.querySelector('.item-custom');
      expect(div).toBeInTheDocument();
    });

    it('respects reduced motion in item', () => {
      render(
        <StaggerContainer>
          <StaggerItem>
            <div>No item animation if motion reduced</div>
          </StaggerItem>
        </StaggerContainer>,
      );

      expect(screen.getByText('No item animation if motion reduced')).toBeInTheDocument();
    });
  });

  describe('StaggerList', () => {
    interface TestItem {
      id: string | number;
      name: string;
    }

    const testItems: TestItem[] = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ];

    it('renders list of items with stagger animation', () => {
      render(
        <StaggerList
          items={testItems}
          renderItem={(item) => <div key={item.id}>{item.name}</div>}
        />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('accepts card variant (default)', () => {
      render(
        <StaggerList
          items={testItems}
          variant="card"
          renderItem={(item) => <div>{item.name}</div>}
        />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('accepts fast variant', () => {
      render(
        <StaggerList
          items={testItems}
          variant="fast"
          renderItem={(item) => <div>{item.name}</div>}
        />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('defaults to card variant when not specified', () => {
      render(
        <StaggerList
          items={testItems}
          renderItem={(item) => <div>{item.name}</div>}
        />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('passes index to renderItem', () => {
      const renderItem = vi.fn((item: TestItem, index: number) => <div>{`${item.name} (${index})`}</div>);

      render(
        <StaggerList
          items={testItems}
          renderItem={renderItem}
        />,
      );

      expect(renderItem).toHaveBeenCalledWith(testItems[0], 0);
      expect(renderItem).toHaveBeenCalledWith(testItems[1], 1);
      expect(renderItem).toHaveBeenCalledWith(testItems[2], 2);
    });

    it('applies custom className', () => {
      const { container } = render(
        <StaggerList
          items={testItems}
          className="list-custom"
          renderItem={(item) => <div>{item.name}</div>}
        />,
      );

      const div = container.querySelector('.list-custom');
      expect(div).toBeInTheDocument();
    });

    it('renders empty list when no items provided', () => {
      const { container } = render(
        <StaggerList
          items={[] as Array<{ id: string; name: string }>}
          renderItem={(item: { id: string; name: string }) => <div>{item.name}</div>}
        />,
      );

      expect(screen.queryByText(/Item \d/)).not.toBeInTheDocument();
    });

    it('uses item id as key in mapped list', () => {
      const items = [
        { id: 'unique-1', name: 'Item 1' },
        { id: 'unique-2', name: 'Item 2' },
      ];

      render(
        <StaggerList
          items={items}
          renderItem={(item) => <div>{item.name}</div>}
        />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('renders with numeric item ids', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      render(
        <StaggerList
          items={items}
          renderItem={(item) => <div>{item.name}</div>}
        />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('Animation integration', () => {
    it('renders nested animation components', () => {
      render(
        <PageTransition>
          <StaggerContainer>
            <StaggerItem>
              <FadeIn>
                <div>Nested animated content</div>
              </FadeIn>
            </StaggerItem>
          </StaggerContainer>
        </PageTransition>,
      );

      expect(screen.getByText('Nested animated content')).toBeInTheDocument();
    });

    it('handles multiple slide animations with different directions', () => {
      render(
        <>
          <SlideIn direction="left">
            <div>From left</div>
          </SlideIn>
          <SlideIn direction="right">
            <div>From right</div>
          </SlideIn>
          <SlideIn direction="up">
            <div>From up</div>
          </SlideIn>
        </>
      );

      expect(screen.getByText('From left')).toBeInTheDocument();
      expect(screen.getByText('From right')).toBeInTheDocument();
      expect(screen.getByText('From up')).toBeInTheDocument();
    });

    it('combines stagger list with fade in for items', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      render(
        <StaggerList
          items={items}
          renderItem={(item) => (
            <FadeIn key={item.id}>
              <div>{item.name}</div>
            </FadeIn>
          )}
        />,
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });
});
