'use client';

/**
 * DevRoleSwitcher — visible only in development.
 *
 * Renders a sticky bottom-right bar with role + employee presets. Clicking one
 * navigates to `?role=X&employee=Y`, which the server page reads to override
 * the home-surface projection. No auth change — only the home dispatch is
 * affected. Every action the user takes still routes through the real session.
 *
 * Preset employees map to the mock-data hierarchy so each role sees real
 * signals light up:
 *   admin   → emp-001 Sarah Chen (CPO, HR team, no manager)
 *   manager → emp-005 Alex Thompson (Staff Eng, manages emp-006/007/010/022)
 *   employee → emp-008 Priya Sharma (SWE, has pending leave lr-001)
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';

interface Preset {
  label: string;
  role: string;
  employee: string;
  name: string;
}

const PRESETS: Preset[] = [
  { label: 'Employee', role: 'employee', employee: 'emp-008', name: 'Priya Sharma' },
  { label: 'Manager', role: 'manager', employee: 'emp-005', name: 'Alex Thompson' },
  { label: 'HR Admin', role: 'admin', employee: 'emp-001', name: 'Sarah Chen' },
];

export default function DevRoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeRole = searchParams.get('role');
  const activeEmployee = searchParams.get('employee');

  const switchTo = useCallback(
    (preset: Preset) => {
      const params = new URLSearchParams();
      params.set('role', preset.role);
      params.set('employee', preset.employee);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname],
  );

  const clear = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur text-xs">
      <span className="font-medium text-slate-500 mr-1">View as:</span>
      {PRESETS.map((p) => {
        const isActive = activeRole === p.role && activeEmployee === p.employee;
        return (
          <button
            key={p.role}
            onClick={() => switchTo(p)}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              isActive
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        );
      })}
      {activeRole && (
        <>
          <span className="mx-1 text-slate-300">|</span>
          <span className="text-slate-500">
            {PRESETS.find((p) => p.employee === activeEmployee)?.name ?? activeEmployee}
          </span>
          <button
            onClick={clear}
            className="ml-1 rounded px-1.5 py-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            x
          </button>
        </>
      )}
    </div>
  );
}
