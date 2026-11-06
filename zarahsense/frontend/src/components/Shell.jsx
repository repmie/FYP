import { useQuery } from '@tanstack/react-query';
import { Nav } from '@/components/Nav';
import { Chatbot } from '@/components/Chatbot';
import { IS_MOCK, getStations } from '@/lib/api';

export function Shell({ children }) {
  const { data } = useQuery({ queryKey: ['stations'], queryFn: getStations });
  const latest = data?.length ? data.map((s) => s.lastReadingAt).sort().at(-1) : null;
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Nav latestReadingAt={latest} />
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-8">{children}</main>
      <footer className="border-t border-border bg-card">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>ZarahSense — Klang Valley air quality forecast. Academic prototype, not official health advice.</span>
          {IS_MOCK && (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-border text-foreground" data-testid="demo-data-tag">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Demo data
            </span>
          )}
        </div>
      </footer>
      <Chatbot />
    </div>
  );
}

export function PageHeader({ title, purpose, meta, action, testid }) {
  return (
    <div className="mb-8 zs-fade" data-testid={testid}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] sm:text-[40px] font-semibold tracking-tight leading-tight">{title}</h1>
          {purpose && <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-3xl">{purpose}</p>}
          {meta && <p className="text-sm font-medium text-primary mt-2 tnum">{meta}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}