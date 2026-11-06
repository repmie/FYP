import axios from 'axios';
import { aqiCategory } from '@/lib/aqi';
import { fmtKLTime } from '@/lib/time';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const http = axios.create({ baseURL: `${BASE}/api` });

export const STATIONS = [
  { id: 'setia-eco', name: 'Setia Eco Park', status: 'ok' },
  { id: 'ttdi', name: 'Taman Tun Dr Ismail', status: 'ok' },
  { id: 'sejati', name: 'Sejati Residences', status: 'ok' },
  { id: 'klcc', name: 'KLCC', status: 'ok' },
  { id: 'enviro-exceltech', name: 'ENVIRO EXCELTECH SDN BHD', status: 'ok' },
];

function withLabels(points) {
  return points.map((p) => ({ ...p, label: fmtKLTime(new Date(p.time)) }));
}

function summarize(points) {
  const avgAqi = Math.round(points.reduce((s, p) => s + p.aqi, 0) / points.length);
  let peak = points[0];
  for (const p of points) if (p.aqi > peak.aqi) peak = p;
  let bestIdx = 0, bestAvg = Infinity;
  for (let i = 0; i + 2 < points.length; i++) {
    const avg = (points[i].aqi + points[i + 1].aqi + points[i + 2].aqi) / 3;
    if (avg < bestAvg) { bestAvg = avg; bestIdx = i; }
  }
  const start = points[bestIdx].time;
  const end = new Date(new Date(points[bestIdx + 2].time).getTime() + 3600000).toISOString();
  return { avgAqi, peakAqi: peak.aqi, peakTime: peak.time, bestWindow: { start, end } };
}

function buildWarning(points) {
  const over = points.find((p) => p.aqi >= 101);
  if (over) return { level: 'warning', message: `Air quality is expected to reach ${over.aqi} (${aqiCategory(over.aqi)}) around ${fmtKLTime(new Date(over.time))}.` };
  for (let i = 0; i + 1 < points.length; i++) {
    const catNow = aqiCategory(points[i].aqi);
    const rises = points.slice(i, i + 7).find((p) => aqiCategory(p.aqi) !== catNow && p.aqi > points[i].aqi);
    if (rises && catNow === 'Good') {
      return { level: 'watch', message: `Air quality may move from ${catNow} to ${aqiCategory(rises.aqi)} by ${fmtKLTime(new Date(rises.time))}.` };
    }
  }
  return null;
}

function decorate(fc) {
  if (fc.status !== 'ok' || !fc.points.length) return { ...fc, summary: null, warning: null };
  const points = withLabels(fc.points);
  return { ...fc, points, summary: summarize(points), warning: buildWarning(points) };
}

export async function getStations() {
  return (await http.get('/stations')).data;
}

export async function getCurrent(stationId) {
  const d = (await http.get(`/current/${stationId}`)).data;
  return { ...d, category: aqiCategory(d.aqi) };
}

export async function getForecast(stationId) {
  return decorate((await http.get(`/forecast/${stationId}`)).data);
}

export async function postWhatIf(stationId, overrides) {
  return decorate((await http.post(`/whatif/${stationId}`, overrides)).data);
}

export async function getAccuracy(stationId, horizon = 1) {
  return (await http.get(`/accuracy/${stationId}`, { params: { horizon } })).data;
}

export async function getCorr() {
  return (await http.get('/correlation')).data;
}

export async function sendChatMessage(message, history = [], adultConfirmed = false) {
  return (await http.post('/chat', { message, history, adultConfirmed })).data.answer;
}

export async function getFiles() {
  const files = (await http.get('/files')).data;
  return files.map((f) => ({ ...f, url: `${BASE}${f.url}` }));
}

export async function getModelInfo() {
  return (await http.get('/model')).data;
}

export const IS_MOCK = false;
export const CORR_COLUMNS = ['PM2.5', 'PM1', 'Humidity', 'Temperature', 'Particle count'];
export const WHATIF_RANGES = {
  pm25: { label: 'PM2.5', unit: 'µg/m³', min: 0, max: 250, step: 0.5 },
  pm1: { label: 'PM1', unit: 'µg/m³', min: 0, max: 180, step: 0.5 },
  rh: { label: 'Relative humidity', unit: '%', min: 20, max: 100, step: 1 },
  temp: { label: 'Temperature', unit: '°C', min: 20, max: 40, step: 0.1 },
  particles: { label: 'PM0.3 particle count', unit: 'per dL', min: 0, max: 22500, step: 50 },
};
export const WHATIF_PRESETS = {
  'Haze event': { pm25: 160, pm1: 120, rh: 55, temp: 34, particles: 18000 },
  'Clean air': { pm25: 5, pm1: 3, rh: 65, temp: 29, particles: 700 },
  'Hot and dry': { pm25: 45, pm1: 32, rh: 38, temp: 38, particles: 6000 },
  'Dust burst': { pm25: 90, pm1: 40, rh: 45, temp: 33, particles: 9000 },
};