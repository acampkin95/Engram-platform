import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OfflineBanner from '@/components/OfflineBanner'

// Mock the useOnlineStatus hook so we can control online/offline state in tests
const mockUseOnlineStatus = vi.fn()

vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}))

describe('OfflineBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows banner when offline (useOnlineStatus returns false)', () => {
    mockUseOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  it('hides banner when online (useOnlineStatus returns true)', () => {
    mockUseOnlineStatus.mockReturnValue(true)
    render(<OfflineBanner />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dismiss button hides the banner', () => {
    mockUseOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)

    // Banner is visible initially
    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Click the dismiss button
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    // Banner should be hidden after dismissal
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows reconnecting message when offline', () => {
    mockUseOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument()
  })

  it('banner has alert role for accessibility', () => {
    mockUseOnlineStatus.mockReturnValue(false)
    render(<OfflineBanner />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
  })
})
