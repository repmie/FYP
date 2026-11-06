import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fmtKLTime, fmtKLDateTime } from '@/lib/time';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/what-if', label: 'What-if & Risk' },
  { to: '/accuracy', label: 'Accuracy & Method' },
  { to: '/correlation', label: 'Correlation Lab' },
  { to: '/data', label: 'Data & Files' },
];

export function Nav({ latestReadingAt }) {
  const [now, setNow] = useState(new Date());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-16 bg-card border-b border-border" data-testid="top-nav">
      <div className="max-w-[1280px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <NavLink to="/" className="flex items-center gap-2 shrink-0" data-testid="wordmark">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-[16px] font-semibold tracking-tight">ZarahSense</span>
          </NavLink>
          <nav className="hidden lg:flex items-center gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                data-testid={`nav-link-${l.label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'text-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="text-sm font-medium tnum" data-testid="malaysia-time">{fmtKLTime(now)} <span className="text-muted-foreground font-normal">MYT</span></span>
          <span className="text-xs text-muted-foreground" data-testid="data-updated">{latestReadingAt ? `Latest reading ${fmtKLDateTime(new Date(latestReadingAt))}` : 'Loading data…'}</span>
        </div>
        <button className="lg:hidden h-10 px-3 rounded-lg border border-border text-sm" onClick={() => setOpen((v) => !v)} data-testid="mobile-menu-toggle">
          Menu
        </button>
      </div>
      {open && (
        <div className="lg:hidden bg-card border-b border-border px-4 py-2" data-testid="mobile-menu">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `block px-3 py-2 rounded-md text-sm font-medium ${isActive ? 'text-primary bg-primary/5' : 'text-foreground'}`}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}