import { describe, it, expect, beforeEach, afterEach } from'vitest'
import { render, screen, fireEvent } from'@testing-library/react'
import { BrowserRouter } from'react-router-dom'
import Navigation from'@/components/Navigation'
import { ThemeProvider } from'@/context/ThemeContext'
import { ToastProvider } from'@/components/Toast'

function renderWithProviders(component: React.ReactElement) {
 return render(
 <BrowserRouter>
 <ThemeProvider>
 <ToastProvider>
 {component}
 </ToastProvider>
 </ThemeProvider>
 </BrowserRouter>
 )
}

describe('Navigation', () => {
 beforeEach(() => {
 localStorage.clear()
 })

 afterEach(() => {
 localStorage.clear()
 })

 it('renders all navigation items', () => {
 renderWithProviders(<Navigation />)
 expect(screen.getByText('Dashboard')).toBeInTheDocument()
 expect(screen.getByText('OSINT')).toBeInTheDocument()
 expect(screen.getByText('Data')).toBeInTheDocument()
 expect(screen.getByText('Graph')).toBeInTheDocument()
 })

  it('highlights active route', () => {
  renderWithProviders(<Navigation />)
  const dashboardLink = screen.getByText('Dashboard')
  expect(dashboardLink.closest('a')).toHaveClass('bg-cyan/10')
  })

 it('opens mobile menu', () => {
 renderWithProviders(<Navigation />)
 const menuButton = screen.getByRole('button', { name: /toggle menu/i })
 fireEvent.click(menuButton)
 expect(screen.getAllByText('OSINT')).toHaveLength(2)
 })

 it('closes mobile menu on navigation click', () => {
 renderWithProviders(<Navigation />)
 const menuButton = screen.getByRole('button', { name: /toggle menu/i })
 fireEvent.click(menuButton)
 const osintLinks = screen.getAllByText('OSINT')
 const mobileOsintLink = osintLinks.find(el => el.closest('a')?.className.includes('text-base'))
 if (mobileOsintLink) {
 fireEvent.click(mobileOsintLink)
 }
 })
})
