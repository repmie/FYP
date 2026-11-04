import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell, PageHeader } from '@/components/Shell';
import { Card, Loading, ErrorState, EmptyState, AqiChip } from '@/components/common';
import { StationSelect } from '@/components/controls';
import { AqiChart } from '@/components/AqiChart';
import { getForecast, STATIONS } from '@/lib/api';
import { pointsWindowText, fmtKLTime } from '@/lib/time';
import { aqiCategory } from '@/lib/aqi';
import { ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';

function Summary({ label, value, sub }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-[28px] font-semibold tnum mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

const klHour = (t) => parseInt(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', hour12: false }).format(new Date(t)), 10);

export default function ForecastPage() {
  const [station, setStation] = useState(STATIONS[0].id);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['forecast', station], queryFn: () => getForecast(station) });

  const confRows = ['High', 'Medium', 'Low'].map((c) => {
    const hs = (data?.points || []).filter((p) => p.confidence === c).map((p) => p.hourAhead);
    return { c, text: hs.length ? `Hours ${Math.min(...hs)}–${Math.max(...hs)}` : null };
  }).filter((r) => r.text);
  const confColor = { High: 'text-green-700', Medium: 'text-amber-600', Low: 'text-red-600' };

  let commuteAqi = null;
  if (data?.points?.length) {
    const inCommute = data.points.filter((p) => { const h = klHour(p.time); return h >= 7 && h <= 9; });
    if (inCommute.length) commuteAqi = Math.round(inCommute.reduce((s, p) => s + p.aqi, 0) / inCommute.length);
  }

  const sm = data?.summary;
  const tomorrowLabel = data?.points?.find((p) => klHour(p.time) === 0)?.label;

  return (
    <Shell>
      <PageHeader
        title="24-hour forecast"
        purpose="How clean the air is expected to be at this station over the next day, hour by hour."
        meta={pointsWindowText(data?.points)}
        action={<StationSelect value={station} onChange={setStation} />}
        testid="forecast-header"
      />

      {isLoading ? (
        <Card className="p-6"><Loading /></Card>
      ) : isError ? (
        <Card className="p-6"><ErrorState onRetry={refetch} /></Card>
      ) : data.status === 'limited' || !data.points.length ? (
        <Card className="p-6"><EmptyState title="Not enough recent data to forecast" message={data.reason || "This station does not yet have 24 continuous recent hours of readings, so we do not show a forecast chart."} /></Card>
      ) : (
        <div className="space-y-6">
          {data.warning && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3" data-testid="forecast-warning">
              <AlertTriangle size={20} strokeWidth={1.5} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Early warning</p>
                <p className="text-sm text-foreground">{data.warning.message}</p>
              </div>
            </div>
          )}

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-[20px] font-semibold">Hourly AQI (PM2.5)</h2>
              <AqiChip category={aqiCategory(sm.avgAqi)} />
            </div>
            <AqiChart points={data.points} height={320} nowLabel={data.points[0].label} tomorrowLabel={tomorrowLabel} />
            <p className="text-xs text-muted-foreground mt-3">
              {data.methodMessage || 'The shaded band shows the range the AQI could fall in. It widens further ahead because forecasts are less certain the further out they go — we only use past sensor readings to predict.'}
            </p>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="forecast-summary">
            <Summary label="Average next 24 h" value={sm.avgAqi} sub={aqiCategory(sm.avgAqi)} />
            <Summary label="Peak AQI" value={sm.peakAqi} sub={`at ${fmtKLTime(new Date(sm.peakTime))}`} />
            <Summary label="Cleanest 3-hour window" value={`${fmtKLTime(new Date(sm.bestWindow.start))}`} sub={`until ${fmtKLTime(new Date(sm.bestWindow.end))}`} />
            <Summary label="7–9 AM commute" value={commuteAqi ?? '—'} sub={commuteAqi ? aqiCategory(commuteAqi) : 'outside window'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-[16px] font-semibold mb-3">Confidence by hour</h3>
              <ul className="space-y-2 text-sm">
                {confRows.map((r) => (
                  <li key={r.c} className="flex justify-between" data-testid={`confidence-${r.c.toLowerCase()}`}><span>{r.text}</span><span className={`font-medium ${confColor[r.c]}`}>{r.c}</span></li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3">{data.forecastMethod === 'persistence' ? 'Fallback forecasts use the latest PM2.5 reading and are marked low confidence.' : "Based on this station's past forecast errors at each hour ahead. Forecasts further ahead are less certain because the model only uses past sensor readings."}</p>
            </Card>
            <Card className="p-6" data-testid="why-changing">
              <h3 className="text-[16px] font-semibold mb-3">Why is it changing?</h3>
              <ul className="space-y-2">
                {data.drivers.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {d.effect === 'rising' ? <ArrowUp size={16} strokeWidth={1.5} className="text-red-500" /> : <ArrowDown size={16} strokeWidth={1.5} className="text-green-600" />}
                    <span>{d.feature} — <span className="text-muted-foreground">{d.effect === 'rising' ? 'pushing AQI up' : 'pulling AQI down'}</span></span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </Shell>
  );
}