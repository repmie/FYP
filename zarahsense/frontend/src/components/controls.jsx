import { useQuery } from '@tanstack/react-query';
import { getStations, STATIONS } from '@/lib/api';

export function StationSelect({ value, onChange, includeLimited = true, testid = 'station-select' }) {
  const { data: liveStations } = useQuery({ queryKey: ['stations'], queryFn: getStations });
  const stations = liveStations || STATIONS;
  const list = includeLimited ? stations : stations.filter((s) => s.status !== 'limited');
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-[220px] rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
      data-testid={testid}
    >
      {list.map((s) => (
        <option key={s.id} value={s.id} data-testid={`${testid}-${s.id}`}>
          {s.name}{s.status === 'limited' ? ' (limited)' : ''}
        </option>
      ))}
    </select>
  );
}

export function PillSelect({ value, onChange, options, testid }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-secondary" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          data-testid={`${testid}-${o.value}`}
          className={`h-8 px-3 rounded-md text-sm font-medium transition-colors ${value === o.value ? 'bg-card text-primary card-shadow' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}