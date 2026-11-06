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
  const comparison = data?.comparison;

  return (
    <Shell>
      <PageHeader
        title="Accuracy & method"
        purpose="See how well the forecast performs and how ZarahSense turns sensor readings into an air-quality forecast."
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
            <p className="text-xs text-muted-foreground mb-4 tnum" data-testid="accuracy-sample-note">
              {comparison
                ? `Compared on ${data.comparisonN.toLocaleString()} held-out forecasts where all three predictions are available.`
                : `The model was tested on ${data.n.toLocaleString()} held-out forecasts.`}
            </p>
            <table className="w-full text-sm" data-testid="accuracy-table">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 font-medium">Metric</th><th className="py-2 font-medium">Model</th>
                  <th className="py-2 font-medium">Repeat last hour</th><th className="py-2 font-medium">Same hour yesterday</th>
                  <th className="py-2 font-medium">Beats baselines?</th>
                </tr>
              </thead>
              <tbody className="tnum">
                <tr className="border-b border-border"><td className="py-2.5">R²</td><td>{comparison?.model.r2 ?? '—'}</td><td>{comparison?.persistence.r2 ?? '—'}</td><td>{comparison?.yesterday.r2 ?? '—'}</td><td></td></tr>
                <tr className="border-b border-border">
                  <td className="py-2.5">RMSE (AQI)</td><td>{comparison?.model.rmse ?? '—'}</td><td>{comparison?.persistence.rmse ?? '—'}</td><td>{comparison?.yesterday.rmse ?? '—'}</td>
                  <td>{data.beatsPersistence && data.beatsYesterday ? <span className="inline-flex items-center gap-1 text-green-700"><Check size={16} strokeWidth={1.5} /> Yes</span> : <span className="inline-flex items-center gap-1 text-red-600"><X size={16} strokeWidth={1.5} /> Not both</span>}</td>
                </tr>
                <tr className="border-b border-border"><td className="py-2.5">MAE (AQI)</td><td>{comparison?.model.mae ?? '—'}</td><td>{comparison?.persistence.mae ?? '—'}</td><td>{comparison?.yesterday.mae ?? '—'}</td><td></td></tr>
                <tr><td className="py-2.5">Right AQI category</td><td>{comparison ? `${comparison.model.classHit}%` : '—'}</td><td>{comparison ? `${comparison.persistence.classHit}%` : '—'}</td><td>{comparison ? `${comparison.yesterday.classHit}%` : '—'}</td><td></td></tr>
              </tbody>
            </table>
            {!comparison && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4" data-testid="comparison-unavailable">
                Baseline metrics are not in the saved report yet. Run the accuracy evaluation to populate them.
              </p>
            )}
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

      <section className="mt-8" data-testid="method-section">
        <h2 className="text-[24px] font-semibold mb-4">How the forecast works</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[
              { title: 'Data source', description: 'Hourly OpenAQ readings (PM1, PM2.5, humidity, temperature and PM0.3 particle count) from low-cost sensors at five Klang Valley stations.' },
              { title: 'Cleaning', description: 'Impossible values are removed, extreme non-dust values are clipped, and gaps of up to 6 hours are filled with a KNN imputer. Longer gaps are left empty. Stations without 24 continuous recent hours are marked limited and are not forecast.' },
              { title: 'Model', description: 'A Random Forest (200 trees) reads the last 24 hours of all five readings plus time of day and month, and predicts next-hour PM2.5. It repeats this hour by hour to reach 24 hours. The shaded range comes from its past errors at each hour ahead.' },
              { title: 'AQI conversion', description: 'Every PM2.5 value is converted to the US EPA AQI (0–500) using the official 2024 breakpoints. The current AQI uses the EPA NowCast method.' },
              { title: 'Limits', description: 'Forecasts use only past sensor readings, so they get less certain further ahead. They do not account for sudden events such as new fires or weather fronts.' },
            ].map((step, index) => (
              <Card key={step.title} className="p-5 flex gap-4" data-testid={`method-step-${index}`}>
                <span className="w-8 h-8 shrink-0 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center tnum">{index + 1}</span>
                <div>
                  <h3 className="text-[16px] font-semibold">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="text-[16px] font-semibold mb-2">AQI is from PM2.5 only</h3>
              <p className="text-sm text-muted-foreground">These stations measure fine dust (PM2.5) but not gases such as ozone or nitrogen dioxide. Every AQI here is labelled AQI (PM2.5) and reflects fine-dust pollution only.</p>
            </Card>
            <Card className="p-5 border-amber-200 bg-amber-50">
              <h3 className="text-[16px] font-semibold mb-2">Disclaimer</h3>
              <p className="text-sm text-foreground">This is an academic prototype built for a final-year university project. It is not official health advice. For health decisions, follow guidance from the Department of Environment Malaysia and your doctor.</p>
            </Card>
            <Card className="p-5">
              <h3 className="text-[16px] font-semibold mb-2">About the data dates</h3>
              <p className="text-sm text-muted-foreground">Forecasts start from each station's latest reading in the dataset, not from the current clock time. The dates shown on every page are the real reading dates.</p>
            </Card>
          </div>
        </div>
      </section>
    </Shell>
  );
}