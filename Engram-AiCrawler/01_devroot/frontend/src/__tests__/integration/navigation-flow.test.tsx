/**
 * Integration tests: Multi-page navigation flow
 *
 * Tests that clicking nav links changes the active route and that
 * different routes render the expected page content.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link, useLocation } from 'react-router-dom'

// ── Minimal test components ──────────────────────────────────────────────────

/** Displays the current pathname so tests can assert on it. */
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

/** Simple nav bar for integration testing without the full Navigation component. */
function TestNavBar() {
  return (
    <nav>
      <Link to="/" data-testid="nav-dashboard">Dashboard</Link>
      <Link to="/osint" data-testid="nav-osint">OSINT</Link>
      <Link to="/settings" data-testid="nav-settings">Settings</Link>
      <Link to="/graph" data-testid="nav-graph">Graph</Link>
    </nav>
  )
}

/** Full test router wiring nav bar + routes together. */
function TestApp({ initialPath = '/' }: { initialPath?: string }) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <TestNavBar />
      <LocationDisplay />
      <Routes>
        <Route path="/" element={<main data-testid="page-dashboard">Dashboard Page</main>} />
        <Route path="/osint" element={<main data-testid="page-osint">OSINT Page</main>} />
        <Route path="/settings" element={<main data-testid="page-settings">Settings Page</main>} />
        <Route path="/graph" element={<main data-testid="page-graph">Graph Page</main>} />
        <Route path="/crawl/new" element={<main data-testid="page-crawl-new">New Crawl Page</main>} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Navigation Flow Integration', () => {
  it('initial "/" route renders Dashboard page', () => {
    render(<TestApp initialPath="/" />)
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/')
  })

  it('"/osint" route renders OSINT page', () => {
    render(<TestApp initialPath="/osint" />)
    expect(screen.getByTestId('page-osint')).toBeInTheDocument()
    expect(screen.getByText('OSINT Page')).toBeInTheDocument()
  })

  it('"/settings" route renders Settings page', () => {
    render(<TestApp initialPath="/settings" />)
    expect(screen.getByTestId('page-settings')).toBeInTheDocument()
    expect(screen.getByText('Settings Page')).toBeInTheDocument()
  })

  it('"/graph" route renders Graph page', () => {
    render(<TestApp initialPath="/graph" />)
    expect(screen.getByTestId('page-graph')).toBeInTheDocument()
    expect(screen.getByText('Graph Page')).toBeInTheDocument()
  })

  it('clicking OSINT link changes route and renders OSINT page', () => {
    render(<TestApp initialPath="/" />)
    // Starts on Dashboard
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('nav-osint'))

    // Should now show OSINT page
    expect(screen.getByTestId('page-osint')).toBeInTheDocument()
    expect(screen.queryByTestId('page-dashboard')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/osint')
  })

  it('clicking Settings link changes route and renders Settings page', () => {
    render(<TestApp initialPath="/" />)
    fireEvent.click(screen.getByTestId('nav-settings'))
    expect(screen.getByTestId('page-settings')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/settings')
  })

  it('clicking Graph link changes route and renders Graph page', () => {
    render(<TestApp initialPath="/osint" />)
    fireEvent.click(screen.getByTestId('nav-graph'))
    expect(screen.getByTestId('page-graph')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/graph')
  })

  it('navigating Dashboard → OSINT → Settings follows correct route history', () => {
    render(<TestApp initialPath="/" />)

    fireEvent.click(screen.getByTestId('nav-osint'))
    expect(screen.getByTestId('location')).toHaveTextContent('/osint')

    fireEvent.click(screen.getByTestId('nav-settings'))
    expect(screen.getByTestId('location')).toHaveTextContent('/settings')
    expect(screen.getByTestId('page-settings')).toBeInTheDocument()
  })
})
