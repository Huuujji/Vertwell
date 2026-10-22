import type { ReactNode } from 'react';

export default function InfoDisclosure({ label, children }: { label: string; children: ReactNode }) {
  return <details className="info-disclosure"><summary aria-label={label} title={label}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.1" /></svg><span className="sr-only">{label}</span></summary><div className="info-content">{children}</div></details>;
}
