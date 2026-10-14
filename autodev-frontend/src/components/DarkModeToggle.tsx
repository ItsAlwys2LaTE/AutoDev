import React, { useEffect, useState, useCallback } from 'react';
import { SpecularButton } from './SpecularButton';

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
        : true;
    } catch {
      return true;
    }
  });

  const isDark = controlledDark !== undefined ? controlledDark : internalDark;

  // Synchronize DOM root class, localStorage, and theme listeners
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('autodev:theme-change', { detail: { isDark: dark } })
      );
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
        onToggle?.(dark);
      };
    }

    // Sync across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'autodev_dark_mode' && e.newValue !== null) {
        const nextDark = e.newValue === '1';
        setInternalDark(nextDark);
        applyTheme(nextDark);
        onToggle?.(nextDark);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [applyTheme, handleToggle, isDark, controlledDark, onToggle]);

  return (
    <SpecularButton
      id="darkModeToggle"
      type="button"
      onClick={handleToggle}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle dark/light mode"
      size="sm"
      radius={999}
      tint={isDark ? '#ffffff' : '#783ae1'}
      tintOpacity={isDark ? 0.04 : 0.08}
      blur={20}
      lineColor={isDark ? '#ffffff' : '#783ae1'}
      baseColor={isDark ? '#000000' : '#94a3b8'}
      textColor={isDark ? '#ffffff' : '#0f172a'}
      intensity={1.3}
      shineSize={16}
      shineFade={40}
      thickness={1.5}
      speed={0.4}
      followMouse={true}
      proximity={200}
      autoAnimate={true}
      className={`!px-0 !py-0 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer !border-transparent transition-all duration-300 ${
        isDark
          ? 'shadow-[0_8px_28px_rgba(0,0,0,0.3)]'
          : 'shadow-[0_8px_24px_rgba(120,58,225,0.16)]'
      } ${className}`}
    >
      {/* Sun icon (shown in dark mode) */}
      <svg
        id="iconSun"
        style={{ color: '#ffffff' }}
        className={`${
          isDark ? 'opacity-100 rotate-0 scale-100' : 'hidden opacity-0 -rotate-90 scale-75'
        } w-5 h-5 transition-all duration-300 ease-out`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
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
        style={{ color: '#0f172a' }}
        className={`${
          !isDark ? 'opacity-100 rotate-0 scale-100' : 'hidden opacity-0 rotate-90 scale-75'
        } w-5 h-5 transition-all duration-300 ease-out`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
      </svg>
    </SpecularButton>
  );
};

export default DarkModeToggle;
