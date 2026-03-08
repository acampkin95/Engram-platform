import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
    expect(button).toHaveAttribute('type', 'button')
  })

  describe('variants', () => {
    it('renders primary variant', () => {
      render(<Button variant="primary">Primary</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-cyan')
    })

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('bg-surface')
    })

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('border-cyan')
    })

    it('renders danger variant', () => {
      render(<Button variant="danger">Danger</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('text-neon-r')
    })

    it('renders link variant', () => {
      render(<Button variant="link">Link</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('underline-offset-4')
    })
  })

  describe('sizes', () => {
    it('renders sm size', () => {
      render(<Button size="sm">Small</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('px-3')
    })

    it('renders md size', () => {
      render(<Button size="md">Medium</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('px-5')
    })

    it('renders lg size', () => {
      render(<Button size="lg">Large</Button>)
      const button = screen.getByRole('button')
      expect(button.className).toContain('px-7')
    })
  })

  it('shows loading spinner when loading=true', () => {
    const { container } = render(<Button loading>Loading</Button>)
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('disables button when loading=true', () => {
    render(<Button loading>Loading</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables button when disabled=true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders leftIcon when not loading', () => {
    render(
      <Button leftIcon={<span data-testid="left-icon">L</span>}>With Icon</Button>
    )
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders rightIcon when not loading', () => {
    render(
      <Button rightIcon={<span data-testid="right-icon">R</span>}>With Icon</Button>
    )
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('hides leftIcon when loading=true', () => {
    render(
      <Button loading leftIcon={<span data-testid="left-icon">L</span>}>
        Loading
      </Button>
    )
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument()
  })

  it('hides rightIcon when loading=true', () => {
    render(
      <Button loading rightIcon={<span data-testid="right-icon">R</span>}>
        Loading
      </Button>
    )
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument()
  })

  it('forwards onClick handler', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
