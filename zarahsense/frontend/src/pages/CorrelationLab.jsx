import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Shell, PageHeader } from '@/components/Shell';
import { Card, Loading, ErrorState } from '@/components/common';
import { PillSelect } from '@/components/controls';
import { Slider } from '@/components/ui/slider';
import { getCorr } from '@/lib/api';
import { aqiCategory, categoryColor } from '@/lib/aqi';

function range(points, key) { const v = points.map((p) => p[key]); return [Math.min(...v), Math.max(...v)]; }
const norm = (v, a, b) => (b === a ? 0 : ((v - a) / (b - a)) * 3.2 - 1.6);

function RealCloud({ points, x, y, z }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(points.length * 3);
    const col = new Float32Array(points.length * 3);
    const rx = range(points, x), ry = range(points, y), rz = range(points, z);
    const c = new THREE.Color();
    points.forEach((p, i) => {
      pos[i * 3] = norm(p[x], rx[0], rx[1]);
      pos[i * 3 + 1] = norm(p[y], ry[0], ry[1]);
      pos[i * 3 + 2] = norm(p[z], rz[0], rz[1]);
      c.set(categoryColor(aqiCategory(p.aqi)));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [points, x, y, z]);
  return <points geometry={geo}><pointsMaterial size={0.055} vertexColors sizeAttenuation /></points>;
}

function SynthCloud({ r }) {
  const geo = useMemo(() => {
    const n = 900, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    for (let i = 0; i < n; i++) {
      const xx = randn(); const yy = r * xx + Math.sqrt(Math.max(0, 1 - r * r)) * randn();
      pos[i * 3] = xx * 0.9; pos[i * 3 + 1] = yy * 0.9; pos[i * 3 + 2] = randn() * 0.9;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [r]);
  return <points geometry={geo}><pointsMaterial size={0.06} color="#1D4ED8" sizeAttenuation /></points>;
}

function Scene({ children, autoRotate, labels }) {
  return (
    <Canvas camera={{ position: [3.2, 2.6, 3.8], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={['#F3F4F6']} />
      <ambientLight intensity={0.8} />
      <Grid args={[4, 4]} position={[0, -1.7, 0]} cellColor="#D1D5DB" sectionColor="#9CA3AF" fadeDistance={14} infiniteGrid={false} />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(3.4, 3.4, 3.4)]} />
        <lineBasicMaterial color="#C7CBD1" />
      </lineSegments>
      {labels && (
        <>
          <Text position={[1.9, -1.7, 0]} fontSize={0.18} color="#5B6472">{labels.x}</Text>
          <Text position={[0, 1.9, 0]} fontSize={0.18} color="#5B6472">{labels.y}</Text>
          <Text position={[0, -1.7, 1.9]} fontSize={0.18} color="#5B6472">{labels.z}</Text>
        </>
      )}
      {children}
      <OrbitControls enablePan={false} autoRotate={autoRotate} autoRotateSpeed={1.2} minDistance={2.5} maxDistance={9} />
    </Canvas>
  );
}

function cellColor(v) {
  if (v >= 0) { const t = v; return `rgba(255, ${Math.round(255 - t * 129)}, ${Math.round(255 - t * 255)}, ${0.25 + t * 0.6})`; }
  const t = -v; return `rgba(${Math.round(255 - t * 226)}, ${Math.round(255 - t * 177)}, 255, ${0.25 + t * 0.6})`;
}

export default function CorrelationLab() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['corr'], queryFn: getCorr });
  const [mode, setMode] = useState('real');
  const [autoRotate, setAutoRotate] = useState(true);
  const [r, setR] = useState(0.6);
  const [axes, setAxes] = useState({ x: 'PM2.5', y: 'Humidity', z: 'Temperature' });

  if (isLoading) return <Shell><Card className="p-6"><Loading label="Loading 2,500 data points…" /></Card></Shell>;
  if (isError) return <Shell><Card className="p-6"><ErrorState onRetry={refetch} /></Card></Shell>;

  const { cols, matrix, points } = data;
  const ci = (name) => cols.indexOf(name);
  const pair = (a, b) => matrix[ci(a)][ci(b)];

  return (
    <Shell>
      <PageHeader
        title="Correlation Lab"
        purpose="Explore how the measurements relate to each other in 3D. Correlation measures how strongly two readings move together, from −1 to +1."
        action={<PillSelect value={mode} onChange={setMode} options={[{ value: 'real', label: 'Real data' }, { value: 'sim', label: 'Simulator' }]} testid="corr-mode" />}
        testid="corr-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-3">
            <div className="rounded-lg overflow-hidden" style={{ height: 460, background: '#F3F4F6' }} data-testid="corr-canvas">
              <Scene autoRotate={autoRotate} labels={mode === 'real' ? axes : { x: 'X', y: 'Y', z: 'Z' }}>
                {mode === 'real' ? <RealCloud points={points} x={axes.x} y={axes.y} z={axes.z} /> : <SynthCloud r={r} />}
              </Scene>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-2 py-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRotate} onChange={(e) => setAutoRotate(e.target.checked)} data-testid="auto-rotate" /> Auto-rotate</label>
              <span className="text-xs text-muted-foreground">Drag to rotate · scroll to zoom</span>
            </div>
          </Card>

          {mode === 'real' ? (
            <Card className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {['x', 'y', 'z'].map((ax) => (
                  <div key={ax}>
                    <p className="text-xs text-muted-foreground mb-1 uppercase">{ax} axis</p>
                    <select
                      value={axes[ax]}
                      onChange={(event) => setAxes({ ...axes, [ax]: event.target.value })}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid={`axis-${ax}`}
                    >
                      {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {['Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'].map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/10" style={{ background: categoryColor(c) }} /> {c}</span>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex justify-between text-sm mb-2"><span>Correlation r</span><span className="tnum font-medium">{r.toFixed(2)}</span></div>
              <Slider value={[r]} min={-1} max={1} step={0.01} onValueChange={(v) => setR(v[0])} data-testid="r-slider" />
              <p className="text-sm text-muted-foreground mt-3">At r = 1 the cloud is a tight line (perfectly linked). At r = 0 it is a shapeless ball (no link). Negative values slope the other way.</p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[16px] font-semibold mb-3">Correlation matrix</h3>
            <div className="overflow-x-auto">
              <table className="text-xs tnum border-collapse">
                <thead><tr><th></th>{cols.map((c) => <th key={c} className="p-1 font-medium text-muted-foreground align-bottom" style={{ writingMode: 'vertical-rl' }}>{c}</th>)}</tr></thead>
                <tbody>
                  {cols.map((rowC, ri) => (
                    <tr key={rowC}>
                      <td className="p-1 pr-2 font-medium text-muted-foreground whitespace-nowrap">{rowC}</td>
                      {cols.map((colC, cidx) => (
                        <td key={colC} className="p-0.5">
                          <button
                            onClick={() => setAxes({ ...axes, x: rowC, y: colC })}
                            data-testid={`corr-cell-${ri}-${cidx}`}
                            className="w-10 h-9 rounded text-[11px] font-medium hover:ring-2 hover:ring-primary transition-all"
                            style={{ background: cellColor(matrix[ri][cidx]) }}
                          >{matrix[ri][cidx].toFixed(2)}</button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Click any cell to set it as the X and Y axes.</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-[16px] font-semibold mb-2">In plain words</h3>
            <ul className="space-y-1.5 text-sm">
              <li>PM2.5 and PM1 move together strongly (r = {pair('PM2.5', 'PM1').toFixed(2)}).</li>
              <li>Humidity and temperature move in opposite directions (r = {pair('Humidity', 'Temperature').toFixed(2)}).</li>
              <li>PM2.5 and particle count move together (r = {pair('PM2.5', 'Particle count').toFixed(2)}).</li>
            </ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}