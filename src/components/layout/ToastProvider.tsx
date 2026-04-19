'use client';

import { Toaster } from '@/components/ui/sonner';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      visibleToasts={5}
    />
  );
}
