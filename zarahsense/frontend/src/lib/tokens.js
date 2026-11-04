export const COLORS = {
  pageBg: '#F6F7F9',
  surface: '#FFFFFF',
  border: '#E3E6EB',
  text: '#111827',
  textSecondary: '#5B6472',
  accent: '#1D4ED8',
  accentTint: 'rgba(29,78,216,0.12)',
  gridLine: '#EEF0F3',
};

export const AQI_BANDS = [
  { name: 'Good', from: 0, to: 50, color: '#00E400' },
  { name: 'Moderate', from: 50, to: 100, color: '#FFFF00' },
  { name: 'Unhealthy for Sensitive Groups', from: 100, to: 150, color: '#FF7E00' },
  { name: 'Unhealthy', from: 150, to: 200, color: '#FF0000' },
  { name: 'Very Unhealthy', from: 200, to: 300, color: '#8F3F97' },
  { name: 'Hazardous', from: 300, to: 500, color: '#7E0023' },
];