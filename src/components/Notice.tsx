import type { ReactNode } from 'react';
export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return <div className={`notice notice-${tone}`} role="note">{children}</div>;
}
