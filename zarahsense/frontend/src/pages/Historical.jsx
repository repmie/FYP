import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Shell, PageHeader } from '@/components/Shell';
import { AqiChip, Card, ErrorState, Loading } from '@/components/common';
import { PillSelect, StationSelect } from '@/components/controls';
import { getHistory, getStations, STATIONS } from '@/lib/api';
import { aqiCategory, categoryColor } from '@/lib/aqi';
import { AQI_BANDS, COLORS } from '@/lib/tokens';

const PERIODS = [1, 3, 6, 12];
const periodOptions = PERIODS.map((months) => ({ value: months, label: `${months} month${months > 1 ? 's' : ''}` }));

function formatDate(date) {
  return new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
}

function HistoryTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg card-shadow px-3 py-2 text-xs">
      <p className="font-medium tnum">{formatDate(point.date)}</p>
      <p className="mt-1 tnum">Daily average AQI: <strong>{point.aqi}</strong> · {aqiCategory(point.aqi)}</p>
      <p className="text-muted-foreground tnum">PM2.5 {point.pm25} µg/m³ · {point.readings} hourly readings</p>
    </div>
  );
}

function PatternTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg card-shadow px-3 py-2 text-xs">
      <p className="font-medium">{label}</p>
      <p className="mt-1 tnum">Average AQI: <strong>{Math.round(payload[0].value)}</strong>{unit}</p>
    </div>
  );
}

function Stat({ label, value, detail, category }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 mt-2">
        <p className="text-[28px] leading-none font-semibold tnum" style={category ? { color: categoryColor(category) } : undefined}>{value}</p>
        {category && <AqiChip category={category} className="text-xs px-2 py-0.5" withDot={false} />}
      </div>
      {detail && <p className="text-xs text-muted-foreground mt-2">{detail}</p>}
    </Card>
  );
}

export default function Historical() {
  const [station, setStation] = useState(STATIONS[0].id);
  const [months, setMonths] = useState(1);
  const stationsQ = useQuery({ queryKey: ['stations'], queryFn: getStations });
  const stationInfo = stationsQ.data?.find((item) => item.id === station);
  const availablePeriods = stationInfo?.historyPeriods || [];
  const historyQ = useQuery({
    queryKey: ['history', station, months],
    queryFn: () => getHistory(station, months),
    enabled: Boolean(stationInfo && availablePeriods.includes(months)),
  });

  const daily = useMemo(() => {
    const points = historyQ.data?.daily || [];
    return points.map((point, index) => {
      const recent = points.slice(Math.max(0, index - 6), index + 1);
      return {
        ...point,
        rollingAqi: Math.round(recent.reduce((sum, item) => sum + item.aqi, 0) / recent.length),
      };
    });
  }, [historyQ.data?.daily]);

  const weekdayPeak = historyQ.data?.weekday?.filter((item) => item.aqi != null).reduce((best, item) => !best || item.aqi > best.aqi ? item : best, null);
  const hourPeak = historyQ.data?.hourly?.filter((item) => item.aqi != null).reduce((best, item) => !best || item.aqi > best.aqi ? item : best, null);
  const summary = historyQ.data?.summary;
  const comparison = historyQ.data?.comparison;

  const changeDetail = comparison
    ? `Previous period average: ${comparison.averageAqi} AQI · ${comparison.days} days`
    : 'No complete earlier period is available for comparison';

  return (
    <Shell>
      <PageHeader
        title="Historical AQI & patterns"
        purpose="Compare recent months of daily PM2.5-based AQI and spot recurring weekday and time-of-day patterns."
        action={<StationSelect value={station} onChange={(value) => { setStation(value); setMonths(1); }} testid="history-station-select" />}
        testid="history-header"
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Look back</p>
          <p className="text-xs text-muted-foreground mt-1">Longer ranges depend on each station's saved data coverage.</p>
        </div>
        <PillSelect
          value={months}
          onChange={setMonths}
          options={periodOptions.map((option) => ({
            ...option,
            disabled: !availablePeriods.includes(option.value),
            label: availablePeriods.includes(option.value) ? option.label : `${option.label} unavailable`,
          }))}
          testid="history-period-select"
        />
      </div>

      {stationsQ.isLoading ? (
        <Card className="p-6"><Loading label="Loading station history coverage…" /></Card>
      ) : stationsQ.isError ? (
        <Card className="p-6"><ErrorState message="Could not load station coverage." onRetry={stationsQ.refetch} /></Card>
      ) : historyQ.isLoading ? (
        <Card className="p-6"><Loading label="Loading historical readings…" /></Card>
      ) : historyQ.isError ? (
        <Card className="p-6"><ErrorState message="Could not load historical readings." onRetry={historyQ.refetch} /></Card>
      ) : !historyQ.data ? (
        <Card className="p-6"><p className="text-sm text-muted-foreground">No history is available for this station and period.</p></Card>
      ) : (
        <div className="space-y-6" data-testid="history-results">
          <p className="text-xs text-muted-foreground tnum" data-testid="history-coverage">
            {historyQ.data.source} · {formatDate(historyQ.data.from)}–{formatDate(historyQ.data.to)} · {summary.readings.toLocaleString()} hourly readings
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Stat label={`Average AQI · ${months} month${months > 1 ? 's' : ''}`} value={summary.averageAqi} category={aqiCategory(summary.averageAqi)} detail={`${summary.days} days with readings`} />
            <Stat label="Good-air days" value={`${summary.goodDayPercent}%`} detail={`${summary.goodDays} of ${summary.days} daily averages were Good`} />
            <Stat label="AQI change vs prior period" value={comparison ? `${comparison.changeAqi > 0 ? '+' : ''}${comparison.changeAqi}` : '—'} detail={changeDetail} />
            <Stat
              label="Change across this period"
              value={summary.trendChangeAqi == null ? '—' : `${summary.trendChangeAqi > 0 ? '+' : ''}${summary.trendChangeAqi}`}
              detail="AQI difference: second half vs first half"
            />
          </div>

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold">Daily AQI trend</h2>
                <p className="text-xs text-muted-foreground mt-1">Daily average AQI and a trailing 7-reading-day average. Lower is cleaner.</p>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-blue-700" /> Daily AQI</span>
                <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 bg-slate-500" /> 7-day average</span>
              </div>
            </div>
            <div className="h-[300px]" data-testid="history-daily-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                  {AQI_BANDS.filter((band) => band.from < 200).map((band) => (
                    <ReferenceArea key={band.name} y1={band.from} y2={band.to} fill={band.color} fillOpacity={0.05} stroke="none" ifOverflow="hidden" />
                  ))}
                  <CartesianGrid stroke={COLORS.gridLine} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickLine={false} axisLine={{ stroke: COLORS.border }} minTickGap={24} tickFormatter={(value) => value.slice(5)} />
                  <YAxis domain={[0, (max) => Math.max(100, Math.ceil(max / 50) * 50)]} tick={{ fontSize: 11, fill: COLORS.textSecondary }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<HistoryTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="aqi" name="Daily AQI" stroke={COLORS.accent} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="rollingAqi" name="7-day average" stroke="#64748B" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Which days tend to be worse?</h2>
              <p className="text-xs text-muted-foreground mt-1">Average hourly AQI grouped by weekday.</p>
              <div className="h-[230px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyQ.data.weekday} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke={COLORS.gridLine} vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: COLORS.textSecondary }} tickLine={false} axisLine={{ stroke: COLORS.border }} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.textSecondary }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<PatternTooltip />} />
                    <Bar dataKey="aqi" name="Average AQI" fill={COLORS.accent} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {weekdayPeak && <p className="text-xs text-muted-foreground mt-2">Highest weekday average: <strong className="text-foreground">{weekdayPeak.day}</strong> ({Math.round(weekdayPeak.aqi)} AQI).</p>}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-semibold">When is AQI usually higher?</h2>
              <p className="text-xs text-muted-foreground mt-1">Average hourly AQI by hour of day (local time).</p>
              <div className="h-[230px] mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyQ.data.hourly} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid stroke={COLORS.gridLine} vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: COLORS.textSecondary }} tickLine={false} axisLine={{ stroke: COLORS.border }} tickFormatter={(value) => `${value}:00`} minTickGap={12} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.textSecondary }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip content={<PatternTooltip />} labelFormatter={(value) => `${value}:00`} />
                    <Bar dataKey="aqi" name="Average AQI" fill="#0F766E" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {hourPeak && <p className="text-xs text-muted-foreground mt-2">Highest hourly average: <strong className="text-foreground">{String(hourPeak.hour).padStart(2, '0')}:00</strong> ({Math.round(hourPeak.aqi)} AQI).</p>}
            </Card>
          </div>

          <Card className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Best and worst daily averages</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Cleanest day</p>
                <p className="text-sm font-medium mt-1 tnum">{formatDate(summary.cleanestDay.date)} · AQI {summary.cleanestDay.aqi} ({aqiCategory(summary.cleanestDay.aqi)})</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">Highest AQI day</p>
                <p className="text-sm font-medium mt-1 tnum">{formatDate(summary.peakDay.date)} · AQI {summary.peakDay.aqi} ({aqiCategory(summary.peakDay.aqi)})</p>
              </div>
            </div>
            {comparison && <p className="text-xs text-muted-foreground mt-4">Previous-period average was {comparison.averageAqi} AQI ({comparison.days} days with readings). {comparison.changeAqi < 0 ? 'The selected period was cleaner on average.' : comparison.changeAqi > 0 ? 'The selected period had higher AQI on average.' : 'The averages were unchanged.'}</p>}
            {!comparison && <p className="text-xs text-muted-foreground mt-4">An earlier full {months}-month comparison period is outside this station's saved data coverage.</p>}
            <p className="text-xs text-muted-foreground mt-2">A daily category is based on that day's average PM2.5-derived AQI; it may differ from individual hourly readings. Missing hours and days are not filled or estimated.</p>
          </Card>
        </div>
      )}
    </Shell>
  );
}
