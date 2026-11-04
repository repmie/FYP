import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { categoryColor, aqiCategory } from '@/lib/aqi';

maplibregl.setWorkerUrl(workerUrl);

const STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    base: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors',
    },
    labels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#F6F7F9' } },
    { id: 'base', type: 'raster', source: 'base' },
    { id: 'labels', type: 'raster', source: 'labels' },
  ],
};

function markerEl(station, aqi, selected) {
  const el = document.createElement('button');
  el.className = 'zs-marker';
  el.setAttribute('data-testid', `map-marker-${station.id}`);
  el.style.cssText = 'cursor:pointer;border:none;background:transparent;padding:0;transition:transform 150ms ease;';
  const limited = aqi == null;
  const ring = limited ? '#9CA3AF' : categoryColor(aqiCategory(aqi));
  const label = limited ? 'No data' : aqi;
  const size = selected ? 46 : 40;
  el.innerHTML = `
    <div style="width:${size}px;height:${size}px;border-radius:9999px;background:#fff;border:3px solid ${ring};
      box-shadow:0 1px 3px rgba(16,24,40,.18);display:flex;align-items:center;justify-content:center;
      font-weight:600;font-size:${limited ? 9 : 14}px;color:#111827;font-variant-numeric:tabular-nums;
      outline:${selected ? '3px solid rgba(29,78,216,.35)' : 'none'};">${label}</div>`;
  if (selected) el.style.transform = 'scale(1.05)';
  return el;
}

export function MapView({ stations, aqiByStation, selectedId, onSelect, show3d, showHeat }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const fittedRef = useRef(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [101.65, 3.05],
      zoom: 10.2,
      pitch: 0,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = {}; fittedRef.current = false; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !stations) return;
    if (!fittedRef.current && stations.length) {
      const b = new maplibregl.LngLatBounds();
      stations.forEach((s) => b.extend([s.lon, s.lat]));
      map.fitBounds(b, { padding: { top: 60, bottom: 70, left: 60, right: 60 }, maxZoom: 11.5, duration: 0 });
      fittedRef.current = true;
    }
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    stations.forEach((s) => {
      const aqi = aqiByStation[s.id];
      const el = markerEl(s, aqi, s.id === selectedId);
      el.addEventListener('click', () => onSelect(s.id));
      const m = new maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map);
      markersRef.current[s.id] = m;
    });
  }, [stations, aqiByStation, selectedId, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ pitch: show3d ? 55 : 0, duration: 400 });
  }, [show3d]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !stations) return;
    const apply = () => {
      if (map.getLayer('heat')) map.removeLayer('heat');
      if (map.getSource('heat')) map.removeSource('heat');
      if (!showHeat) return;
      map.addSource('heat', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: stations.filter((s) => aqiByStation[s.id] != null).map((s) => ({
            type: 'Feature',
            properties: { color: categoryColor(aqiCategory(aqiByStation[s.id])) },
            geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          })),
        },
      });
      map.addLayer({
        id: 'heat', type: 'circle', source: 'heat',
        paint: { 'circle-radius': 70, 'circle-color': ['get', 'color'], 'circle-opacity': 0.22, 'circle-blur': 1 },
      }, 'labels');
    };
    if (map.isStyleLoaded()) apply(); else map.once('idle', apply);
  }, [showHeat, stations, aqiByStation]);

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" data-testid="map-view" />;
}