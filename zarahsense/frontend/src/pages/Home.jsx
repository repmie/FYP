import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, Loading, ErrorState, AqiChip } from '@/components/common';
import { MapView } from '@/components/MapView';
import { StationPanel } from '@/components/StationPanel';
import { getStations, getCurrent, getForecast, STATIONS } from '@/lib/api';
import { pointsWindowText } from '@/lib/time';
import { aqiCategory } from '@/lib/aqi';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

const klHour = (time) => parseInt(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuala_Lumpur',
  hour: '2-digit',
  hour12: false,
}).format(new Date(time)), 10);

export default function Home() {
  const [selectedId, setSelectedId] = useState(STATIONS[0].id);
  const [hour, setHour] = useState(0);
  const [show3d, setShow3d] = useState(false);
  const [showHeat, setShowHeat] = useState(false);

  const stationsQ = useQuery({ queryKey: ['stations'], queryFn: getStations });
  const currentsQ = useQuery({
    queryKey: ['all-current'],
    queryFn: async () => {
      const arr = await Promise.all(STATIONS.map((s) => getCurrent(s.id)));
      return Object.fromEntries(STATIONS.map((s, i) => [s.id, arr[i]]));
    },
  });
  const forecastsQ = useQuery({
    queryKey: ['all-forecast'],
    queryFn: async () => {
      const arr = await Promise.all(STATIONS.map((s) => getForecast(s.id)));
      return Object.fromEntries(STATIONS.map((s, i) => [s.id, arr[i]]));
    },
  });

  const loading = stationsQ.isLoading || currentsQ.isLoading || forecastsQ.isLoading;
  const error = stationsQ.isError || currentsQ.isError || forecastsQ.isError;

  const aqiByStation = useMemo(() => {
    if (!currentsQ.data || !forecastsQ.data) return {};
    const out = {};
    for (const s of STATIONS) {
      if (hour === 0) out[s.id] = currentsQ.data[s.id]?.aqi;
      else out[s.id] = forecastsQ.data[s.id]?.points?.[hour - 1]?.aqi;
    }
    return out;
  }, [currentsQ.data, forecastsQ.data, hour]);

  const hourLabel = useMemo(() => {
    if (hour === 0) return 'Now';
    const pts = forecastsQ.data?.[selectedId]?.points?.length
      ? forecastsQ.data[selectedId].points
      : Object.values(forecastsQ.data || {}).find((f) => f.points?.length)?.points;
    return pts?.[hour - 1]?.label || '';
  }, [hour, forecastsQ.data, selectedId]);

  if (error) {
    return (
      <Card className="p-6"><ErrorState message="Could not load air quality data." onRetry={() => { stationsQ.refetch(); currentsQ.refetch(); forecastsQ.refetch(); }} /></Card>
    );
  }

  const selStation = stationsQ.data?.find((s) => s.id === selectedId);
  const selectedForecast = forecastsQ.data?.[selectedId];
  const forecastPoints = selectedForecast?.points || [];
  const confidenceRows = ['High', 'Medium', 'Low'].map((confidence) => {
    const hours = forecastPoints.filter((point) => point.confidence === confidence).map((point) => point.hourAhead);
    return {
      confidence,
      hours: hours.length ? `Hours ${Math.min(...hours)}–${Math.max(...hours)}` : null,
    };
  }).filter((row) => row.hours);
  const commutePoints = forecastPoints.filter((point) => {
    const hourOfDay = klHour(point.time);
    return hourOfDay >= 7 && hourOfDay <= 9;
  });
  const commuteAqi = commutePoints.length
    ? Math.round(commutePoints.reduce((total, point) => total + point.aqi, 0) / commutePoints.length)
    : null;

  return (
    <div className="space-y-8" data-testid="home-page">
      <div className="zs-fade">
        <h1 className="text-[28px] sm:text-[40px] font-semibold tracking-tight leading-tight">Klang Valley air quality, right now and next 24 hours</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-3xl">
          Latest sensor readings and an hourly forecast for five stations. AQI (PM2.5) is the US EPA Air Quality Index, calculated from fine-dust (PM2.5) readings only.
        </p>
        <p className="text-sm font-medium text-primary mt-2 tnum" data-testid="home-window-text">{pointsWindowText(forecastsQ.data?.[selectedId]?.points) || 'No forecast for this station: too little recent data'}</p>
      </div>

      {loading ? (
        <Card className="p-6"><Loading label="Loading stations and forecasts…" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-3">
              <Card className="p-2" style={{ minHeight: 560 }}>
                <div className="h-[460px] lg:h-[496px]">
                  <MapView stations={stationsQ.data} aqiByStation={aqiByStation} selectedId={selectedId} onSelect={setSelectedId} show3d={show3d} showHeat={showHeat} />
                </div>
                <div className="flex items-center gap-6 px-3 py-2">
                  <label className="flex items-center gap-2 text-sm" data-testid="toggle-heat">
                    <Switch checked={showHeat} onCheckedChange={setShowHeat} /> Heat layer
                  </label>
                  <label className="flex items-center gap-2 text-sm" data-testid="toggle-3d">
                    <Switch checked={show3d} onCheckedChange={setShow3d} /> 3D buildings view
                  </label>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Forecast time</span>
                  <span className="text-sm text-primary font-medium tnum" data-testid="slider-hour-label">{hour === 0 ? 'Now' : `+${hour} h${hourLabel ? ` · ${hourLabel}` : ''}`}</span>
                </div>
                <Slider value={[hour]} onValueChange={(v) => setHour(v[0])} min={0} max={24} step={1} data-testid="forecast-slider" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>Now</span><span>+24 h</span></div>
              </Card>
            </div>
            <div className="lg:col-span-5">
              <StationPanel station={selStation} current={currentsQ.data[selectedId]} forecast={forecastsQ.data[selectedId]} />
            </div>
          </div>

          {forecastPoints.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="forecast-insights">
              <Card className="p-6">
                <h2 className="text-[20px] font-semibold mb-4">Forecast confidence & commute</h2>
                <div className="rounded-lg border border-border p-3 mb-4">
                  <p className="text-xs text-muted-foreground">7–9 AM commute average</p>
                  <p className="text-[20px] font-semibold tnum mt-1">{commuteAqi ?? '—'}</p>
                  {commuteAqi != null && <p className="text-xs text-muted-foreground">{aqiCategory(commuteAqi)} · AQI (PM2.5)</p>}
                </div>
                <h3 className="text-sm font-medium mb-2">Confidence by hour</h3>
                {confidenceRows.length ? (
                  <ul className="space-y-2 text-sm">
                    {confidenceRows.map((row) => (
                      <li key={row.confidence} className="flex justify-between" data-testid={`confidence-${row.confidence.toLowerCase()}`}>
                        <span>{row.hours}</span>
                        <span className={`font-medium ${row.confidence === 'High' ? 'text-green-700' : row.confidence === 'Medium' ? 'text-amber-600' : 'text-red-600'}`}>{row.confidence}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Confidence details are unavailable for this forecast.</p>
                )}
              </Card>
              <Card className="p-6" data-testid="why-changing">
                <h2 className="text-[20px] font-semibold mb-4">Why is it changing?</h2>
                {selectedForecast?.drivers?.length ? (
                  <ul className="space-y-3">
                    {selectedForecast.drivers.map((driver, index) => (
                      <li key={`${driver.feature}-${index}`} className="flex items-center gap-2 text-sm">
                        {driver.effect === 'rising'
                          ? <ArrowUp size={16} strokeWidth={1.5} className="text-red-500" />
                          : <ArrowDown size={16} strokeWidth={1.5} className="text-green-600" />}
                        <span>{driver.feature} — <span className="text-muted-foreground">{driver.effect === 'rising' ? 'pushing AQI up' : 'pulling AQI down'}</span></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No model driver details are available for this forecast.</p>
                )}
              </Card>
            </div>
          )}

          <div>
            <h2 className="text-[20px] font-semibold mb-4">All stations</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4" data-testid="station-cards">
              {STATIONS.map((s) => {
                const cur = currentsQ.data[s.id];
                const fc = forecastsQ.data[s.id];
                const limited = !fc?.points?.length;
                const tomorrow = fc?.points?.[23]?.aqi;
                const trend = !limited && tomorrow != null ? tomorrow - cur.aqi : 0;
                const cat = cur.category;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    data-testid={`station-card-${s.id}`}
                    className={`text-left bg-card border rounded-xl card-shadow p-4 transition-colors ${selectedId === s.id ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:bg-secondary/40'}`}
                  >
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <div className="flex items-end gap-2 mt-2">
                      <span className="text-[28px] font-semibold tnum leading-none" data-testid={`station-card-aqi-${s.id}`}>{cur.aqi}</span>
                      <span className="text-xs text-muted-foreground pb-1">AQI (PM2.5)</span>
                    </div>
                    <div className="mt-2"><AqiChip category={cat} /></div>
                    {limited ? (
                      <p className="text-xs text-muted-foreground mt-3" data-testid={`station-card-limited-${s.id}`}>No forecast yet: too little recent data.</p>
                    ) : (
                      <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground tnum">
                        {fc.forecastMethod === 'persistence' ? (
                          <>Fallback estimate (not ML): <span className="font-medium text-foreground">{tomorrow}</span></>
                        ) : (
                          <>
                            {trend > 2 ? <ArrowUp size={14} strokeWidth={1.5} className="text-red-500" /> : trend < -2 ? <ArrowDown size={14} strokeWidth={1.5} className="text-green-600" /> : <Minus size={14} strokeWidth={1.5} />}
                            Tomorrow same hour: <span className="font-medium text-foreground">{tomorrow}</span>
                          </>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="p-6">
            <h2 className="text-[20px] font-semibold mb-2">What does AQI mean?</h2>
            <p className="text-sm text-muted-foreground max-w-3xl">
              The Air Quality Index (AQI) turns a pollution reading into a single number from 0 to 500. Lower is cleaner. Here we calculate it from PM2.5 — tiny dust particles small enough to enter your lungs. Each colour band has a plain-language health message, so you can decide at a glance whether it is a good time to be outside.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}