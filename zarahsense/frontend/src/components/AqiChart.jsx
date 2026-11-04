import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import { AQI_BANDS, COLORS } from '@/lib/tokens';
import { aqiCategory, categoryColor } from '@/lib/aqi';
import { fmtKLTime } from '@/lib/time';

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const cat = aqiCategory(p.aqi);
  return (
    <div className="bg-card border border-border rounded-lg card-shadow px-3 py-2 text-xs" data-testid="chart-tooltip">
      <div className="font-medium text-foreground tnum">{p.label || fmtKLTime(new Date(p.time))}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ backgroundColor: categoryColor(cat) }} />
        <span className="tnum font-semibold">AQI (PM2.5) {p.aqi}</span>
      </div>
      {p.pm25 != null && <div className="text-muted-foreground tnum">PM2.5 {p.pm25} µg/m³</div>}
      {p.actual != null && <div className="text-foreground tnum">Actual {Math.round(p.actual)}</div>}
      {p.lo != null && <div className="text-muted-foreground tnum">Range {Math.round(p.lo)}–{Math.round(p.hi)}</div>}
      {p.confidence && <div className="text-muted-foreground">Confidence: {p.confidence}</div>}
    </div>
  );
}

export function AqiChart({ points, height = 260, nowLabel, tomorrowLabel, showBand = true, actualKey }) {
  const maxAqi = Math.min(500, Math.ceil((Math.max(100, ...points.map((p) => p.hi ?? p.aqi)) + 20) / 30) * 30);
  return (
    <div style={{ height }} data-testid="aqi-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          {AQI_BANDS.filter((b) => b.from < maxAqi).map((b) => (
            <ReferenceArea key={b.name} y1={b.from} y2={Math.min(b.to, maxAqi)} fill={b.color} fillOpacity={0.06} stroke="none" ifOverflow="hidden" />
          ))}
          <CartesianGrid stroke={COLORS.gridLine} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickLine={false} axisLine={{ stroke: COLORS.border }} minTickGap={24} />
          <YAxis domain={[0, maxAqi]} tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<ChartTooltip />} />
          {showBand && <Area type="monotone" dataKey="hi" stroke="none" fill={COLORS.accent} fillOpacity={0.12} isAnimationActive={false} />}
          {showBand && <Area type="monotone" dataKey="lo" stroke="none" fill="#FFFFFF" fillOpacity={1} isAnimationActive={false} />}
          <Line type="monotone" dataKey="aqi" stroke={COLORS.accent} strokeWidth={2} dot={false} isAnimationActive={false} name="AQI (PM2.5)" />
          {actualKey && <Line type="monotone" dataKey={actualKey} stroke="#111827" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} name="Actual" />}
          {nowLabel != null && <ReferenceLine x={nowLabel} stroke={COLORS.accent} strokeDasharray="3 3" label={{ value: 'Now', position: 'insideTopLeft', fontSize: 11, fill: COLORS.accent }} />}
          {tomorrowLabel != null && <ReferenceLine x={tomorrowLabel} stroke={COLORS.textSecondary} strokeDasharray="2 4" label={{ value: 'Tomorrow', position: 'insideTopRight', fontSize: 11, fill: COLORS.textSecondary }} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}