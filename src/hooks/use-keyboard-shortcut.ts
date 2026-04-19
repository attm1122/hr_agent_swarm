'use client';

import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
  preventDefault?: boolean;
}

/**
 * Register keyboard shortcuts globally.
 *
 * Usage:
 *   useKeyboardShortcuts([
 *     { key: 'k', meta: true, handler: () => setOpen(true) },
 *     { key: 'Escape', handler: () => setOpen(false) },
 *   ]);
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl === undefined || e.ctrlKey === shortcut.ctrl;
        const metaMatch = shortcut.meta === undefined || e.metaKey === shortcut.meta;
        const shiftMatch = shortcut.shift === undefined || e.shiftKey === shortcut.shift;
        const altMatch = shortcut.alt === undefined || e.altKey === shortcut.alt;

        if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.handler(e);
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
