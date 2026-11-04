import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shell, PageHeader } from '@/components/Shell';
import { Card, Loading, ErrorState } from '@/components/common';
import { StationSelect, PillSelect } from '@/components/controls';
import { AqiChart } from '@/components/AqiChart';
import { getAccuracy, STATIONS } from '@/lib/api';
import { fmtKLDateTime } from '@/lib/time';
import { Check, X } from 'lucide-react';

const HORIZONS = [1, 3, 6, 12, 24];

export default function Accuracy() {
  const [station, setStation] = useState(STATIONS[0].id);
  const [horizon, setHorizon] = useState(1);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['accuracy', station, horizon], queryFn: () => getAccuracy(station, horizon) });

  const series = (data?.series || []).map((s) => ({ ...s, label: fmtKLDateTime(new Date(s.time)).replace(',', ''), aqi: s.forecast }));

  return (
    <Shell>
      <PageHeader
        title="Forecast accuracy"
        purpose="An honest look at how well the model predicts, compared with simple baselines. Weak results are shown, not hidden."
        action={<StationSelect value={station} onChange={setStation} includeLimited={false} />}
        testid="accuracy-header"
      />

      <div className="mb-6"><PillSelect value={horizon} onChange={setHorizon} options={HORIZONS.map((h) => ({ value: h, label: `${h} h` }))} testid="horizon-select" /></div>

      {isLoading ? <Card className="p-6"><Loading /></Card> : isError ? <Card className="p-6"><ErrorState onRetry={refetch} /></Card> : data.status !== 'ok' ? (
        <Card className="p-6" data-testid="accuracy-limited"><p className="text-sm text-muted-foreground">Not enough test data at this station to measure accuracy.</p></Card>
      ) : (
        <div className="space-y-6">
          <Card className="p-6 overflow-x-auto">
            <h2 className="text-[20px] font-semibold mb-1">Metrics at {horizon}-hour horizon</h2>
            <p className="text-xs text-muted-foreground mb-4 tnum" data-testid="accuracy-sample-note">Tested on the last 20% of this station's data, which the model never saw in training ({data.n.toLocaleString()} forecasts).</p>
            <table className="w-full text-sm" data-testid="accuracy-table">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 font-medium">Metric</th><th className="py-2 font-medium">Model</th>
                  <th className="py-2 font-medium">Repeat last hour</th><th className="py-2 font-medium">Same hour yesterday</th>
                  <th className="py-2 font-medium">Beats baselines?</th>
                </tr>
              </thead>
              <tbody className="tnum">
                <tr className="border-b border-border"><td className="py-2.5">R²</td><td>{data.r2}</td><td className="text-muted-foreground">—</td><td className="text-muted-foreground">—</td><td></td></tr>
                <tr className="border-b border-border">
                  <td className="py-2.5">RMSE (AQI)</td><td>{data.rmse}</td><td>{data.baselines.persistence}</td><td>{data.baselines.yesterday ?? '—'}</td>
                  <td>{data.beatsPersistence && data.beatsYesterday ? <span className="inline-flex items-center gap-1 text-green-700"><Check size={16} strokeWidth={1.5} /> Yes</span> : <span className="inline-flex items-center gap-1 text-red-600"><X size={16} strokeWidth={1.5} /> Not both</span>}</td>
                </tr>
                <tr className="border-b border-border"><td className="py-2.5">MAE (AQI)</td><td>{data.mae}</td><td className="text-muted-foreground">—</td><td className="text-muted-foreground">—</td><td></td></tr>
                <tr><td className="py-2.5">Right AQI category</td><td>{data.classHit}%</td><td className="text-muted-foreground">—</td><td className="text-muted-foreground">—</td><td></td></tr>
              </tbody>
            </table>
            {!(data.beatsPersistence && data.beatsYesterday) && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4" data-testid="baseline-note">
                At this horizon the model does not clearly beat both simple baselines. We report this openly rather than hide it.
              </p>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-[20px] font-semibold mb-4">Forecast vs actual — last 7 days of the test period</h2>
            <AqiChart points={series} height={300} actualKey="actual" showBand />
            <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-2"><span className="w-4 h-[2px] bg-primary" /> Forecast</span>
              <span className="inline-flex items-center gap-2"><span className="w-4 border-t-2 border-dashed border-foreground" /> Actual</span>
            </div>
          </Card>

          <Card className="p-6" data-testid="how-to-read">
            <h2 className="text-[20px] font-semibold mb-3">How to read this</h2>
            <ul className="space-y-2 text-sm text-foreground">
              <li><span className="font-medium">R²</span> — how much of the ups and downs the model explains, from 0 (none) to 1 (perfect).</li>
              <li><span className="font-medium">RMSE</span> — the typical size of the error in AQI points, giving extra weight to big misses. Lower is better.</li>
              <li><span className="font-medium">MAE</span> — the average error in AQI points, treating all misses equally. Lower is better.</li>
            </ul>
          </Card>
        </div>
      )}
    </Shell>
  );
}