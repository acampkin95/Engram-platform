import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />)
    expect(screen.getByText('Email')).toBeInTheDocument()
    // label htmlFor should link to the input
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders an input element by default', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('shows helper text when helperText prop is set', () => {
    render(<Input helperText="Enter your email address" />)
    expect(screen.getByText('Enter your email address')).toBeInTheDocument()
  })

  it('does not show helper text when error prop is also set', () => {
    render(<Input error="Required!" helperText="Enter something" />)
    expect(screen.queryByText('Enter something')).not.toBeInTheDocument()
    expect(screen.getByText('Required!')).toBeInTheDocument()
  })

  it('renders left icon when provided', () => {
    render(<Input leftIcon={<span data-testid="left-icon">@</span>} />)
    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
  })

  it('renders right icon when provided', () => {
    render(<Input rightIcon={<span data-testid="right-icon">✓</span>} />)
    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
  })

  it('handles onChange events', () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('applies error border styling when error prop is set', () => {
    render(<Input error="Error!" />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('border-neon-r')
  })

  it('applies normal border styling without error', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input.className).toContain('border-border')
  })

  it('passes through placeholder prop', () => {
    render(<Input placeholder="Enter URL" />)
    expect(screen.getByPlaceholderText('Enter URL')).toBeInTheDocument()
  })

  it('passes through value and name props', () => {
    render(<Input name="username" defaultValue="testuser" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('name', 'username')
    expect(input).toHaveValue('testuser')
  })
})
