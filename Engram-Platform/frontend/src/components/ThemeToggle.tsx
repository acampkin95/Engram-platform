'use client';
import { useTheme } from 'next-themes';
import { memo, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export const ThemeToggle = memo(function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="w-8 h-8" />;

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent transition-colors"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
});

ThemeToggle.displayName = 'ThemeToggle';
