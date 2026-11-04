export const TZ = 'Asia/Kuala_Lumpur';

export function klParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const o = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
}

export function klDayKey(d = new Date()) {
  const p = klParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

export function nextFullHour(d = new Date()) {
  const ms = d.getTime();
  return new Date((Math.floor(ms / 3600000) + 1) * 3600000);
}

export function fmtKLTime(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
}

export function fmtKLDateTime(d) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d);
}

export function relativeDayLabel(d, ref = new Date()) {
  const dk = klDayKey(d);
  const todayK = klDayKey(ref);
  const tomorrowK = klDayKey(new Date(ref.getTime() + 24 * 3600000));
  if (dk === todayK) return 'today';
  if (dk === tomorrowK) return 'tomorrow';
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(d);
}

export function forecastWindow(ref = new Date()) {
  const start = nextFullHour(ref);
  const end = new Date(start.getTime() + 23 * 3600000);
  return { start, end };
}

export function pointsWindowText(points) {
  if (!points?.length) return '';
  const s = new Date(points[0].time), e = new Date(points[points.length - 1].time);
  return `Forecast from ${fmtKLDateTime(s)} to ${fmtKLDateTime(e)}`;
}

export function forecastWindowText(ref = new Date()) {
  const { start, end } = forecastWindow(ref);
  return `Forecast from ${fmtKLTime(start)} ${relativeDayLabel(start, ref)} to ${fmtKLTime(end)} ${relativeDayLabel(end, ref)}`;
}