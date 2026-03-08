import { describe, it, expect, beforeEach, afterEach } from'vitest'
import { render, screen, fireEvent } from'@testing-library/react'
import { ThemeProvider, useTheme } from'@/context/ThemeContext'

function TestComponent() {
 const { theme, toggleTheme } = useTheme()
 return (
 <div>
 <span data-testid="theme">{theme}</span>
 <button type="button" onClick={toggleTheme}>Toggle</button>
 </div>
 )
}

describe('ThemeContext', () => {
 beforeEach(() => {
 localStorage.clear()
 document.documentElement.classList.remove('dark')
 })

 afterEach(() => {
 localStorage.clear()
 document.documentElement.classList.remove('dark')
 })

 it('provides default theme', () => {
 render(
 <ThemeProvider>
 <TestComponent />
 </ThemeProvider>
 )
 expect(screen.getByTestId('theme')).toHaveTextContent('dark')
 })

  it('provides toggleTheme as no-op (dark-only theme)', () => {
  render(
  <ThemeProvider>
  <TestComponent />
  </ThemeProvider>
  )
  const toggleButton = screen.getByText('Toggle')
  fireEvent.click(toggleButton)
  expect(screen.getByTestId('theme')).toHaveTextContent('dark')
  })

  it('applies dark class to document', () => {
  render(
  <ThemeProvider>
  <TestComponent />
  </ThemeProvider>
  )
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('always applies dark class regardless of localStorage', () => {
  localStorage.setItem('theme','light')
  render(
  <ThemeProvider>
  <TestComponent />
  </ThemeProvider>
  )
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

 it('throws error when used outside provider', () => {
 expect(() => {
 render(<TestComponent />)
 }).toThrow('useTheme must be used within a ThemeProvider')
 })
})
