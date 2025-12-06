"use client";

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';

const navItems: Array<{ href: Route; label: string; icon: string }> = [
  { href: '/patient' as Route, label: 'Patient', icon: '🩺' },
  { href: '/capture' as Route, label: 'Capture', icon: '📷' },
  { href: '/dashboard' as Route, label: 'Dashboard', icon: '📊' },
  { href: '/alerts' as Route, label: 'Alerts', icon: '⚠️' },
  { href: '/ward-analytics' as Route, label: 'Ward', icon: '🏥' }
];

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BottomNav() {
  const pathname = usePathname();
  const { data } = useSWR(pathname ? '/api/alerts?unacknowledged=true' : null, fetcher, {
    refreshInterval: 30_000
  });
  const hasCritical = Boolean((data?.alerts || []).find((alert: any) => !alert.acknowledged && alert.severity === 'critical'));

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur border-t border-white/60 px-4 py-2">
      <div className="max-w-md mx-auto flex items-center justify-between text-xs text-slate-500">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-full ${
                isActive ? 'text-medical font-semibold bg-skyglass/60' : 'text-slate-500'
              }`}
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              <span className="leading-none">{item.label}</span>
              {item.href === '/alerts' && hasCritical ? (
                <span className="mt-1 h-2 w-2 rounded-full bg-risk-red" aria-label="Critical alerts pending" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
