'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('hss-theme', theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('hss-theme') as Theme | null;
    const initial = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Đổi chế độ sáng tối">
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
  );
}
