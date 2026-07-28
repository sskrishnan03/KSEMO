import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeMode = 'dark' | 'light' | 'system';
type Theme = 'dark' | 'light';
type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextValue {
  theme: ThemeMode;
  fontSize: FontSize;
  setTheme: (t: ThemeMode) => void;
  setFontSize: (s: FontSize) => void;
  resolvedTheme: Theme;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  fontSize: 'medium',
  setTheme: () => {},
  setFontSize: () => {},
  resolvedTheme: 'dark',
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getStoredValue<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'dark' | 'light' | 'system'>(() => getStoredValue('ksemo_theme_mode', 'dark'));
  const [fontSize, setFontSize] = useState<FontSize>(() => getStoredValue('ksemo_font_size', 'medium'));

  const resolvedTheme: Theme = mode === 'system' ? getSystemTheme() : mode;

  useEffect(() => {
    localStorage.setItem('ksemo_theme_mode', JSON.stringify(mode));
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('ksemo_font_size', JSON.stringify(fontSize));
  }, [fontSize]);

  // Listen for storage changes from Settings page
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'ksemo_theme_mode' && e.newValue) {
        try { setMode(JSON.parse(e.newValue)); } catch {}
      }
      if (e.key === 'ksemo_font_size' && e.newValue) {
        try { setFontSize(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => {
      document.documentElement.setAttribute('data-theme', getSystemTheme());
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Apply theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolvedTheme === 'dark' ? '#121212' : '#ffffff');
    }
  }, [resolvedTheme]);

  const setTheme = (t: 'dark' | 'light' | 'system') => setMode(t);

  return (
    <ThemeContext.Provider value={{ theme: mode, fontSize, setTheme, setFontSize, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
