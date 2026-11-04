import { AqiChip, Card } from '@/components/common';
import { AqiChart } from '@/components/AqiChart';
import { aqiCategory, categoryColor, healthMessage } from '@/lib/aqi';
import { fmtKLTime, fmtKLDateTime } from '@/lib/time';
import { AlertTriangle } from 'lucide-react';

function BigAqi({ aqi, stale }) {
  const cat = aqiCategory(aqi);
  return (
    <div className="flex items-end gap-3">
      <span className={`text-[56px] leading-none font-semibold tnum ${stale ? 'text-muted-foreground/50' : ''}`} style={{ color: stale ? undefined : categoryColor(cat) === '#FFFF00' ? '#111827' : undefined }} data-testid="station-aqi-value">
        {aqi}
      </span>
      <span className="pb-2 text-sm text-muted-foreground">AQI (PM2.5)</span>
    </div>
  );
}

export function StationPanel({ station, current, forecast }) {
  if (!station || !current) return null;
  const cat = current.category;
  const stale = (Date.now() - new Date(current.time).getTime()) > 3 * 3600000;
  const warning = forecast?.warning;
  const sm = forecast?.summary;
  const peakHour = sm ? fmtKLTime(new Date(sm.peakTime)) : null;
  const bestWin = sm ? `${fmtKLTime(new Date(sm.bestWindow.start))}–${fmtKLTime(new Date(sm.bestWindow.end))}` : null;

  return (
    <Card className="p-6 h-full flex flex-col zs-fade" data-testid="station-panel">
      {warning && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5" data-testid="station-warning-banner">
          <AlertTriangle size={18} strokeWidth={1.5} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-foreground">{warning.message}</p>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[20px] font-semibold leading-tight">{station.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 tnum">
            Latest reading {fmtKLDateTime(new Date(current.time))}{stale ? ' · old data' : ''} · {current.source || 'Dataset'}
            {current.openAqLocation ? ` · ${current.openAqLocation}` : ''}
          </p>
        </div>
        <AqiChip category={cat} />
      </div>

      <div className="mt-4">
        <BigAqi aqi={current.aqi} stale={false} />
        <p className="text-sm text-muted-foreground mt-1 tnum">PM2.5 {current.pm25} µg/m³ (NowCast {current.nowcastPm25})</p>
        {current.sourceMessage && <p className="text-xs text-amber-600 mt-1">{current.sourceMessage}</p>}
        {forecast?.methodMessage && <p className="text-xs text-amber-600 mt-1">{forecast.methodMessage}</p>}
        {stale && <p className="text-xs text-amber-600 mt-1">Latest reading is over 3 hours old; newer measurements may not be available yet.</p>}
        <p className="text-sm text-foreground mt-3">{healthMessage(cat)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="rounded-lg border border-border p-3" data-testid="tile-now">
          <p className="text-xs text-muted-foreground">Now</p>
          <p className="text-[20px] font-semibold tnum mt-1">{current.aqi}</p>
          <p className="text-xs text-muted-foreground">{cat}</p>
        </div>
        <div className="rounded-lg border border-border p-3" data-testid="tile-next24">
          <p className="text-xs text-muted-foreground">Next 24 hours</p>
          {sm ? (
            <div className="mt-1 space-y-0.5">
              <p className="text-sm tnum">Avg <span className="font-semibold">{sm.avgAqi}</span> · Peak <span className="font-semibold">{sm.peakAqi}</span> at {peakHour}</p>
              <p className="text-xs text-muted-foreground tnum">Cleanest: {bestWin}</p>
            </div>
          ) : <p className="text-xs text-muted-foreground mt-1">Not enough data</p>}
        </div>
      </div>

      <div className="mt-5 flex-1 min-h-[180px]">
        {forecast?.status === 'limited' || !forecast?.points?.length ? (
          <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg p-4" data-testid="panel-limited-chart">
            {forecast?.reason || 'Not enough recent data to forecast for this station.'}
          </div>
        ) : (
          <AqiChart points={forecast.points} height={200} nowLabel={forecast.points[0].label} />
        )}
      </div>
    </Card>
  );
}