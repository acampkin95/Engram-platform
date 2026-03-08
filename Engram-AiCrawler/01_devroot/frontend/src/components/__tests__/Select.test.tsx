import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Select } from '@/components/ui/Select'

const sampleOptions = [
  { value: 'option1', label: 'Option 1' },
  { value: 'option2', label: 'Option 2' },
  { value: 'option3', label: 'Option 3' },
]

describe('Select', () => {
  it('renders options from options prop', () => {
    render(<Select options={sampleOptions} />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
    expect(screen.getByText('Option 3')).toBeInTheDocument()
  })

  it('shows label when label prop is provided', () => {
    render(<Select label="Category" options={sampleOptions} />)
    expect(screen.getByText('Category')).toBeInTheDocument()
  })

  it('label is linked to select element via htmlFor', () => {
    render(<Select label="Category" options={sampleOptions} />)
    expect(screen.getByLabelText('Category')).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    render(<Select error="Please select an option" options={sampleOptions} />)
    expect(screen.getByText('Please select an option')).toBeInTheDocument()
  })

  it('shows helper text when helperText prop is set', () => {
    render(<Select helperText="Pick one of the options" options={sampleOptions} />)
    expect(screen.getByText('Pick one of the options')).toBeInTheDocument()
  })

  it('does not show helper text when error is also set', () => {
    render(
      <Select
        error="Required!"
        helperText="Pick one of the options"
        options={sampleOptions}
      />
    )
    expect(screen.queryByText('Pick one of the options')).not.toBeInTheDocument()
    expect(screen.getByText('Required!')).toBeInTheDocument()
  })

  it('handles onChange when selection changes', () => {
    const onChange = vi.fn()
    render(<Select options={sampleOptions} onChange={onChange} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'option2' } })
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('applies error border styling when error prop is set', () => {
    render(<Select error="Error!" options={sampleOptions} />)
    const select = screen.getByRole('combobox')
    expect(select.className).toContain('border-neon-r')
  })

  it('applies normal border styling without error', () => {
    render(<Select options={sampleOptions} />)
    const select = screen.getByRole('combobox')
    expect(select.className).toContain('border-border')
  })

  it('renders correct number of option elements', () => {
    render(<Select options={sampleOptions} />)
    const select = screen.getByRole('combobox')
    expect(select.querySelectorAll('option')).toHaveLength(3)
  })
})
