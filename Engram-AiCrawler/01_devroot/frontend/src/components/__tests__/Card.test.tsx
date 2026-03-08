import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card><p>Card content</p></Card>)
    expect(screen.getByText('Card content')).toBeInTheDocument()
  })

  describe('variants', () => {
    it('renders default variant with bg-surface and border-border classes', () => {
      const { container } = render(<Card variant="default">Default</Card>)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('bg-surface')
      expect(card.className).toContain('border-border')
    })

    it('renders bordered variant with border-border-hi class', () => {
      const { container } = render(<Card variant="bordered">Bordered</Card>)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('border-border-hi')
    })

    it('renders elevated variant with shadow-lg class', () => {
      const { container } = render(<Card variant="elevated">Elevated</Card>)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('shadow-lg')
    })

    it('renders interactive variant with cursor-pointer class', () => {
      const { container } = render(<Card variant="interactive">Interactive</Card>)
      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('cursor-pointer')
    })
  })

  it('renders CardHeader sub-component', () => {
    render(
      <Card>
        <CardHeader>Header Content</CardHeader>
      </Card>
    )
    expect(screen.getByText('Header Content')).toBeInTheDocument()
  })

  it('renders CardBody sub-component', () => {
    render(
      <Card>
        <CardBody>Body Content</CardBody>
      </Card>
    )
    expect(screen.getByText('Body Content')).toBeInTheDocument()
  })

  it('renders CardFooter sub-component', () => {
    render(
      <Card>
        <CardFooter>Footer Content</CardFooter>
      </Card>
    )
    expect(screen.getByText('Footer Content')).toBeInTheDocument()
  })

  it('renders all sub-components together', () => {
    render(
      <Card>
        <CardHeader>The Header</CardHeader>
        <CardBody>The Body</CardBody>
        <CardFooter>The Footer</CardFooter>
      </Card>
    )
    expect(screen.getByText('The Header')).toBeInTheDocument()
    expect(screen.getByText('The Body')).toBeInTheDocument()
    expect(screen.getByText('The Footer')).toBeInTheDocument()
  })

  it('CardHeader has border-b class', () => {
    const { container } = render(<CardHeader>Header</CardHeader>)
    const header = container.firstChild as HTMLElement
    expect(header.className).toContain('border-b')
  })

  it('CardFooter has border-t class', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>)
    const footer = container.firstChild as HTMLElement
    expect(footer.className).toContain('border-t')
  })

  it('applies custom className to Card', () => {
    const { container } = render(<Card className="my-custom-class">Content</Card>)
    const card = container.firstChild as HTMLElement
    expect(card.className).toContain('my-custom-class')
  })
})
