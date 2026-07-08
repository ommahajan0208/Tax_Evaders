import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'hybrid'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('sebi-theme')
    return (saved as Theme) || 'dark'
  })

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('sebi-theme', newTheme)
  }

  useEffect(() => {
    const root = window.document.documentElement
    // In our case, hybrid is dark sidebar + dark header, but light workspace area.
    // For Tailwind class matching:
    if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
