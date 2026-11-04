// US EPA PM2.5 AQI breakpoints (2024 revision), in µg/m³.
export const PM25_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50, category: 'Good' },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100, category: 'Moderate' },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150, category: 'Unhealthy for Sensitive Groups' },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200, category: 'Unhealthy' },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300, category: 'Very Unhealthy' },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500, category: 'Hazardous' },
];

export const AQI_MAX = 500;

export const CATEGORY_COLORS = {
  Good: '#00E400',
  Moderate: '#FFFF00',
  'Unhealthy for Sensitive Groups': '#FF7E00',
  Unhealthy: '#FF0000',
  'Very Unhealthy': '#8F3F97',
  Hazardous: '#7E0023',
};

export const CATEGORY_ORDER = [
  'Good', 'Moderate', 'Unhealthy for Sensitive Groups',
  'Unhealthy', 'Very Unhealthy', 'Hazardous',
];