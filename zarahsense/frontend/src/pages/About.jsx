import { Shell, PageHeader } from '@/components/Shell';
import { Card } from '@/components/common';

const STEPS = [
  { t: 'Data source', d: 'Hourly OpenAQ readings (PM1, PM2.5, humidity, temperature and PM0.3 particle count) from low-cost sensors at five Klang Valley stations.' },
  { t: 'Cleaning', d: 'Impossible values are removed, extreme non-dust values are clipped, and gaps of up to 6 hours are filled with a KNN imputer. Longer gaps are left empty. Stations without 24 continuous recent hours are marked "limited" and are not forecast.' },
  { t: 'Model', d: 'A Random Forest (200 trees) reads the last 24 hours of all five readings plus time of day and month, and predicts next-hour PM2.5. It repeats this hour by hour to reach 24 hours. The shaded range comes from its past errors at each hour ahead.' },
  { t: 'AQI conversion', d: 'Every PM2.5 value is converted to the US EPA AQI (0–500) using the official 2024 breakpoints. The current AQI uses the EPA NowCast method.' },
  { t: 'Limits', d: 'Forecasts use only past sensor readings, so they get less certain further ahead. They do not account for sudden events such as new fires or weather fronts.' },
];

export default function About() {
  return (
    <Shell>
      <PageHeader title="About & method" purpose="How ZarahSense turns sensor readings into an air quality forecast, in plain language." testid="about-header" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {STEPS.map((s, i) => (
            <Card key={i} className="p-5 flex gap-4" data-testid={`method-step-${i}`}>
              <span className="w-8 h-8 shrink-0 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center tnum">{i + 1}</span>
              <div>
                <h3 className="text-[16px] font-semibold">{s.t}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.d}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-[16px] font-semibold mb-2">AQI is from PM2.5 only</h3>
            <p className="text-sm text-muted-foreground">These stations measure fine dust (PM2.5) but not gases such as ozone or nitrogen dioxide. So every AQI here is labelled "AQI (PM2.5)" and reflects fine-dust pollution only.</p>
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
    </Shell>
  );
}