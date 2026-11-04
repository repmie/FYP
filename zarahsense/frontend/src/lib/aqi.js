import { PM25_BREAKPOINTS, AQI_MAX, CATEGORY_COLORS, CATEGORY_ORDER } from '@/config/breakpoints';

function truncate1(c) {
  return Math.floor(c * 10) / 10;
}

export function pm25ToAqi(c) {
  if (c == null || isNaN(c)) return null;
  const conc = truncate1(Math.max(0, c));
  let bp = PM25_BREAKPOINTS.find((b) => conc >= b.cLow && conc <= b.cHigh);
  if (!bp) {
    if (conc > PM25_BREAKPOINTS[PM25_BREAKPOINTS.length - 1].cHigh) return AQI_MAX;
    bp = PM25_BREAKPOINTS[0];
  }
  const aqi = ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (conc - bp.cLow) + bp.iLow;
  return Math.min(AQI_MAX, Math.round(aqi));
}

export function aqiCategory(aqi) {
  if (aqi == null || isNaN(aqi)) return 'Good';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

export function categoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Good;
}

export function categoryTint(category) {
  const hex = categoryColor(category);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}

export function healthMessage(category) {
  switch (category) {
    case 'Good':
      return 'Air quality is good. It is a fine day to be active outside.';
    case 'Moderate':
      return 'Air quality is acceptable. Unusually sensitive people should watch for symptoms.';
    case 'Unhealthy for Sensitive Groups':
      return 'Sensitive people (children, older adults, heart or lung conditions) should limit long or intense outdoor activity.';
    case 'Unhealthy':
      return 'Everyone may feel effects. Sensitive people should avoid long outdoor activity.';
    case 'Very Unhealthy':
      return 'Health warning. Everyone should avoid outdoor exertion and stay indoors where possible.';
    case 'Hazardous':
      return 'Emergency conditions. Everyone should stay indoors and keep activity low.';
    default:
      return '';
  }
}

export { CATEGORY_ORDER };