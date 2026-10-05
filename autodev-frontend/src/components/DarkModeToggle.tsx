import React, { useEffect, useState, useCallback } from 'react';

export interface DarkModeToggleProps {
  className?: string;
  isDark?: boolean;
  onToggle?: (isDark: boolean) => void;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  className = '',
  isDark: controlledDark,
  onToggle,
}) => {
  // Resolve initial state from localStorage or system preference
  const [internalDark, setInternalDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('autodev_dark_mode');
      if (saved !== null) {
        return saved === '1';
      }
      return typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
    } catch {
      return false;
    }
  });

  const isDark = controlledDark !== undefined ? controlledDark : internalDark;

  // Synchronize DOM root class and localStorage
  const applyTheme = useCallback((dark: boolean) => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (dark) {
      html.classList.add('dark');
      html.classList.remove('light');
      try {
        localStorage.setItem('autodev_dark_mode', '1');
      } catch (e) {
        console.warn('[DarkModeToggle] Failed to write to localStorage:', e);
      }
    } else {
      html.classList.remove('dark');
      html.classList.add('light');
      try {
        localStorage.setItem('autodev_dark_mode', '0');
      } catch (e) {
        console.warn('[DarkModeToggle] Failed to write to localStorage:', e);
      }
    }
  }, []);

  const handleToggle = useCallback(() => {
    const next = !isDark;
    if (controlledDark === undefined) {
      setInternalDark(next);
    }
    applyTheme(next);
    onToggle?.(next);
  }, [isDark, controlledDark, applyTheme, onToggle]);

  // Initial sync & legacy window bridges
  useEffect(() => {
    applyTheme(isDark);

    if (typeof window !== 'undefined') {
      (window as any).toggleDarkMode = handleToggle;
      (window as any).__reactToggleDarkMode = handleToggle;
      (window as any).applyDarkMode = (dark: boolean) => {
        if (controlledDark === undefined) {
          setInternalDark(dark);
        }
        applyTheme(dark);
      };
    }

    // Sync across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'autodev_dark_mode' && e.newValue !== null) {
        const nextDark = e.newValue === '1';
        setInternalDark(nextDark);
        applyTheme(nextDark);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [applyTheme, handleToggle, isDark, controlledDark]);

  return (
    <button
      id="darkModeToggle"
      onClick={handleToggle}
      title="Toggle dark/light mode"
      type="button"
      aria-label="Toggle dark/light mode"
      className={`w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 ${
        isDark ? 'bg-slate-800' : 'bg-white'
      } shadow-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors duration-150 focus:outline-none ${className}`}
    >
      {/* Sun icon (shown in dark mode) */}
      <svg
        id="iconSun"
        className={`${isDark ? '' : 'hidden'} w-5 h-5 text-amber-400`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      {/* Moon icon (shown in light mode) */}
      <svg
        id="iconMoon"
        className={`${!isDark ? '' : 'hidden'} w-5 h-5`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </button>
  );
};

export default DarkModeToggle;
