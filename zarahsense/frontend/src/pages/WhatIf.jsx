import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Shell, PageHeader } from '@/components/Shell';
import { Card, Loading, ErrorState, AqiChip, ButtonSecondary } from '@/components/common';
import { StationSelect, PillSelect } from '@/components/controls';
import { Slider } from '@/components/ui/slider';
import { postWhatIf, getForecast, getCurrent, WHATIF_RANGES, WHATIF_PRESETS, STATIONS } from '@/lib/api';
import { aqiCategory } from '@/lib/aqi';
import { COLORS } from '@/lib/tokens';

const PROFILES = [
  { value: 'adult', label: 'Healthy adult', f: 1 },
  { value: 'child', label: 'Child', f: 1.4 },
  { value: 'older', label: 'Older adult', f: 1.4 },
  { value: 'pregnant', label: 'Pregnant', f: 1.3 },
  { value: 'condition', label: 'Asthma / heart', f: 1.7 },
];
const ACTIVITIES = [
  { value: 'resting', label: 'Resting', f: 0.7 },
  { value: 'walking', label: 'Walking', f: 1 },
  { value: 'exercise', label: 'Exercise outdoors', f: 1.5 },
];
const MASKS = [
  { value: 'none', label: 'No mask', f: 1 },
  { value: 'surgical', label: 'Surgical', f: 0.7 },
  { value: 'n95', label: 'N95', f: 0.35 },
];

export default function WhatIf() {
  const [station, setStationId] = useState(STATIONS[0].id);
  const [vals, setVals] = useState(null);
  const [dv, setDv] = useState(null);
  const currentQ = useQuery({ queryKey: ['current', station], queryFn: () => getCurrent(station) });
  const real = currentQ.data ? { pm25: currentQ.data.pm25, pm1: currentQ.data.pm1, rh: currentQ.data.rh, temp: currentQ.data.temp, particles: currentQ.data.particles } : null;
  const defaults = () => real;
  useEffect(() => { if (real && !vals) setVals(real); }, [real, vals]);
  const setStation = (id) => { setStationId(id); setVals(null); setDv(null); };
  const [profile, setProfile] = useState('adult');
  const [activity, setActivity] = useState('walking');
  const [mask, setMask] = useState('none');
  const [hours, setHours] = useState(2);

  useEffect(() => { const t = setTimeout(() => setDv(vals), 300); return () => clearTimeout(t); }, [vals]);
  const realQ = useQuery({ queryKey: ['forecast', station], queryFn: () => getForecast(station) });
  const whatIfQ = useQuery({
    queryKey: ['whatif', station, dv], queryFn: () => postWhatIf(station, dv), enabled: !!dv,
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey?.[1] === station ? prev : undefined),
  });

  const realAqi = realQ.data?.summary?.peakAqi;
  const wiAqi = whatIfQ.data?.summary?.peakAqi;
  const delta = realAqi != null && wiAqi != null ? wiAqi - realAqi : 0;

  const risk = useMemo(() => {
    if (wiAqi == null) return 0;
    const base = Math.min(100, (wiAqi / 300) * 100);
    const pf = PROFILES.find((p) => p.value === profile).f;
    const af = ACTIVITIES.find((a) => a.value === activity).f;
    const mf = MASKS.find((m) => m.value === mask).f;
    const hf = 0.6 + (hours / 8) * 0.8;
    return Math.max(0, Math.min(100, Math.round(base * pf * af * mf * (hf / 1.2))));
  }, [wiAqi, profile, activity, mask, hours]);

  const riskAdvice = risk < 25 ? 'Low exposure for this plan. Going outside is reasonable.'
    : risk < 55 ? 'Moderate exposure. Consider shorter time outdoors or an N95 mask.'
    : risk < 80 ? 'High exposure. Reduce intense activity and wear an N95 mask if you go out.'
    : 'Very high exposure. Stay indoors if you can.';

  const driverBars = (whatIfQ.data?.drivers || []).map((d) => ({ name: d.feature.length > 22 ? d.feature.slice(0, 20) + '…' : d.feature, v: d.effect === 'rising' ? 1 : -1 }));

  return (
    <Shell>
      <PageHeader
        title="What-if & personal risk"
        purpose="Change the latest readings to see how the forecast and your personal exposure would respond."
        action={<StationSelect value={station} onChange={setStation} includeLimited={false} />}
        testid="whatif-header"
      />

      {realQ.isError || whatIfQ.isError ? (
        <Card className="p-6"><ErrorState onRetry={() => { realQ.refetch(); whatIfQ.refetch(); }} /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-6" data-testid="whatif-step1">
            <p className="text-xs font-medium text-primary">STEP 1</p>
            <h2 className="text-[20px] font-semibold mt-1 mb-1">Change the readings</h2>
            <p className="text-xs text-muted-foreground mb-4">Starts from this station's latest real readings. Changing them replaces the latest hour; the 23 hours before it stay as measured.</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {Object.keys(WHATIF_PRESETS).map((p) => (
                <ButtonSecondary key={p} className="h-8 px-3" onClick={() => setVals({ ...defaults(), ...WHATIF_PRESETS[p] })} data-testid={`preset-${p.replace(/\s+/g, '-').toLowerCase()}`}>{p}</ButtonSecondary>
              ))}
            </div>
            {!vals ? <Loading /> : <div className="space-y-5">
              {Object.entries(WHATIF_RANGES).map(([k, r]) => (
                <div key={k}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span>{r.label}</span>
                    <span className="tnum font-medium">{vals[k]} {r.unit}</span>
                  </div>
                  <Slider value={[vals[k]]} min={r.min} max={r.max} step={r.step} onValueChange={(v) => setVals({ ...vals, [k]: v[0] })} data-testid={`slider-${k}`} />
                  <div className="flex justify-between text-[11px] text-muted-foreground mt-1 tnum"><span>{r.min}</span><span>{r.max}</span></div>
                </div>
              ))}
            </div>}
            <ButtonSecondary className="mt-5 w-full" onClick={() => setVals(defaults())} data-testid="reset-readings">Reset to real readings</ButtonSecondary>
          </Card>

          <Card className="p-6" data-testid="whatif-step2">
            <p className="text-xs font-medium text-primary">STEP 2</p>
            <h2 className="text-[20px] font-semibold mt-1 mb-4">See the impact</h2>
            {realQ.isLoading || !whatIfQ.data ? <Loading /> : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Real forecast (peak)</p>
                    <p className="text-[40px] font-semibold tnum leading-none mt-1">{realAqi}</p>
                    <AqiChip category={aqiCategory(realAqi)} className="mt-2" />
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">What-if forecast (peak)</p>
                    <p className="text-[40px] font-semibold tnum leading-none mt-1">{wiAqi}</p>
                    <AqiChip category={aqiCategory(wiAqi)} className="mt-2" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Difference</span>
                  <span className="px-2.5 py-1 rounded-full text-sm font-semibold tnum" style={{ backgroundColor: delta > 0 ? 'rgba(239,68,68,0.12)' : delta < 0 ? 'rgba(22,163,74,0.12)' : 'var(--secondary)', color: delta > 0 ? '#b91c1c' : delta < 0 ? '#15803d' : '#111827' }} data-testid="whatif-delta">
                    {delta > 0 ? '+' : ''}{delta} AQI
                  </span>
                </div>
                <p className="text-sm text-foreground mt-3">
                  Biggest driver: {whatIfQ.data?.drivers?.[0]?.feature} (pushing AQI {whatIfQ.data?.drivers?.[0]?.effect === 'rising' ? 'up' : 'down'}).
                </p>
                <div className="mt-4 h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={driverBars} layout="vertical" margin={{ left: 0, right: 10 }}>
                      <CartesianGrid stroke={COLORS.gridLine} horizontal={false} />
                      <XAxis type="number" domain={[-1, 1]} hide />
                      <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: COLORS.textSecondary }} axisLine={false} tickLine={false} />
                      <Bar dataKey="v" radius={3}>
                        {driverBars.map((d, i) => <Cell key={i} fill={d.v > 0 ? '#EF4444' : '#16A34A'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted-foreground">Bars to the right push AQI up, to the left pull it down.</p>
              </>
            )}
          </Card>

          <Card className="p-6" data-testid="whatif-step3">
            <p className="text-xs font-medium text-primary">STEP 3</p>
            <h2 className="text-[20px] font-semibold mt-1 mb-4">What it means for a person</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm mb-1.5">Who is this for?</p>
                <PillSelect value={profile} onChange={setProfile} options={PROFILES} testid="profile-select" />
              </div>
              <div>
                <p className="text-sm mb-1.5">Activity</p>
                <PillSelect value={activity} onChange={setActivity} options={ACTIVITIES} testid="activity-select" />
              </div>
              <div>
                <p className="text-sm mb-1.5">Mask</p>
                <PillSelect value={mask} onChange={setMask} options={MASKS} testid="mask-select" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5"><span>Hours outdoors</span><span className="tnum font-medium">{hours} h</span></div>
                <Slider value={[hours]} min={0} max={8} step={1} onValueChange={(v) => setHours(v[0])} data-testid="hours-slider" />
              </div>
            </div>
            <div className="mt-6">
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Risk score</span>
                <span className="text-[40px] font-semibold tnum leading-none" data-testid="risk-score">{risk}<span className="text-sm text-muted-foreground">/100</span></span>
              </div>
              <div className="h-3 rounded-full bg-secondary mt-2 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-200" style={{ width: `${risk}%`, backgroundColor: risk < 25 ? '#16A34A' : risk < 55 ? '#F59E0B' : risk < 80 ? '#FF7E00' : '#DC2626' }} />
              </div>
              <p className="text-sm text-foreground mt-3">{riskAdvice}</p>
              <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">Illustrative index, not medical advice.</p>
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}