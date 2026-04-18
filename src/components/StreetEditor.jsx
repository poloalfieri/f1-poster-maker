import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Button } from './ui/button';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ArrowRight, Loader2 } from 'lucide-react';

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const HIGHWAY_EXCLUDE = 'footway|path|steps|construction|proposed|platform|elevator|corridor';
const MAX_BBOX_SIZE = 0.3;

function toGeoJSON(streets) {
  return {
    type: 'FeatureCollection',
    features: streets.map(s => ({
      type: 'Feature',
      id: s.id,
      properties: { id: s.id, name: s.name, streetType: s.type, visible: s.visible },
      geometry: { type: 'LineString', coordinates: s.coords },
    })),
  };
}

export function StreetEditor({ onMapSelect }) {
  const { t } = useTranslation();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [streets, setStreets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasStreets, setHasStreets] = useState(false);
  const [layersReady, setLayersReady] = useState(false);
  const layersReadyRef = useRef(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const style = isDark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style,
      center: [2.3522, 48.8566],
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    return () => {
      layersReadyRef.current = false;
      map.remove();
    };
  }, []);

  const setupLayers = useCallback((map, geojson) => {
    if (map.getSource('streets')) {
      map.getSource('streets').setData(geojson);
      return;
    }

    map.addSource('streets', { type: 'geojson', data: geojson, generateId: false });

    map.addLayer({
      id: 'streets-hidden',
      type: 'line',
      source: 'streets',
      filter: ['==', ['get', 'visible'], false],
      paint: {
        'line-color': '#aaa',
        'line-width': 3,
        'line-opacity': 0.35,
        'line-dasharray': [2, 3],
      },
    });

    map.addLayer({
      id: 'streets-visible',
      type: 'line',
      source: 'streets',
      filter: ['==', ['get', 'visible'], true],
      paint: {
        'line-color': '#e63946',
        'line-width': 3,
        'line-opacity': 0.9,
      },
    });

    map.addLayer({
      id: 'streets-visible-hit',
      type: 'line',
      source: 'streets',
      filter: ['==', ['get', 'visible'], true],
      paint: { 'line-color': 'transparent', 'line-width': 12 },
    });

    map.addLayer({
      id: 'streets-hidden-hit',
      type: 'line',
      source: 'streets',
      filter: ['==', ['get', 'visible'], false],
      paint: { 'line-color': 'transparent', 'line-width': 12 },
    });

    const toggleStreet = (clickedId, newVisible) => {
      setStreets(prev => {
        const updated = prev.map(s => s.id === clickedId ? { ...s, visible: newVisible } : s);
        mapRef.current?.getSource('streets')?.setData(toGeoJSON(updated));
        return updated;
      });
    };

    map.on('click', 'streets-visible-hit', (e) => {
      if (e.features.length) toggleStreet(e.features[0].properties.id, false);
    });
    map.on('click', 'streets-hidden-hit', (e) => {
      if (e.features.length) toggleStreet(e.features[0].properties.id, true);
    });

    const setCursor = (cursor) => () => { map.getCanvas().style.cursor = cursor; };
    map.on('mouseenter', 'streets-visible-hit', setCursor('pointer'));
    map.on('mouseleave', 'streets-visible-hit', setCursor(''));
    map.on('mouseenter', 'streets-hidden-hit', setCursor('pointer'));
    map.on('mouseleave', 'streets-hidden-hit', setCursor(''));

    layersReadyRef.current = true;
    setLayersReady(true);
  }, []);

  const loadStreets = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds();
    const s = bounds.getSouth();
    const w = bounds.getWest();
    const n = bounds.getNorth();
    const e = bounds.getEast();
    const bboxSize = (n - s) * (e - w);

    if (bboxSize > MAX_BBOX_SIZE) {
      alert(t('streetEditor.zoomInWarning'));
      return;
    }

    setIsLoading(true);

    const query = `[out:json][timeout:25];(way["highway"]["highway"!~"${HIGHWAY_EXCLUDE}"](${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)}););out geom;`;

    try {
      let data = null;
      let lastError = null;

      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });

          if (!resp.ok) {
            lastError = new Error(`HTTP ${resp.status} from ${endpoint}`);
            continue;
          }

          const text = await resp.text();
          data = JSON.parse(text);

          if (data.elements) break;
        } catch (e) {
          lastError = e;
          console.warn(`Overpass endpoint failed (${endpoint}):`, e);
        }
      }

      if (!data) throw lastError || new Error('All Overpass endpoints failed');

      if (!data.elements?.length) {
        alert(t('streetEditor.noStreetsFound'));
        return;
      }

      const newStreets = data.elements.map(el => ({
        id: el.id,
        name: el.tags?.name || '',
        type: el.tags?.highway || 'unclassified',
        coords: el.geometry.map(pt => [pt.lon, pt.lat]),
        visible: true,
      }));

      setStreets(newStreets);
      setHasStreets(true);

      const waitForMap = () => {
        if (map.isStyleLoaded()) {
          setupLayers(map, toGeoJSON(newStreets));
        } else {
          map.once('load', () => setupLayers(map, toGeoJSON(newStreets)));
        }
      };
      waitForMap();
    } catch (err) {
      console.error(err);
      alert(t('streetEditor.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [setupLayers, t]);

  const resetStreets = useCallback(() => {
    setStreets(prev => {
      const updated = prev.map(s => ({ ...s, visible: true }));
      mapRef.current?.getSource('streets')?.setData(toGeoJSON(updated));
      return updated;
    });
  }, []);

  const handleCreatePoster = () => {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    onMapSelect({
      type: 'freeMap',
      id: `freemap_${Date.now()}`,
      name: 'Custom Map',
      displayName: 'CUSTOM MAP',
      country: '',
      lng: center.lng,
      lat: center.lat,
      zoom: Math.round(zoom * 10) / 10,
      streets: streets.filter(s => s.visible),
    });
  };

  const visibleCount = streets.filter(s => s.visible).length;

  return (
    <div className="w-full">
      <div className="w-full h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Top-left info badge */}
        {hasStreets && (
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
            <div className="bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-xs shadow-lg border border-zinc-200 dark:border-zinc-700">
              <p className="text-zinc-500 dark:text-zinc-400 mb-0.5">{t('streetEditor.streetsVisible')}</p>
              <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                {visibleCount} / {streets.length}
              </p>
            </div>
            <button
              onClick={resetStreets}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-1.5 shadow transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              {t('streetEditor.resetAll')}
            </button>
          </div>
        )}

        {/* Instructions badge */}
        {!hasStreets && (
          <div className="absolute top-3 left-3 z-10 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 text-xs shadow-lg border border-zinc-200 dark:border-zinc-700 max-w-[200px]">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">{t('streetEditor.instructionsTitle')}</p>
            <ol className="text-zinc-500 dark:text-zinc-400 space-y-0.5 list-decimal list-inside leading-relaxed">
              <li>{t('streetEditor.step1')}</li>
              <li>{t('streetEditor.step2')}</li>
              <li>{t('streetEditor.step3')}</li>
            </ol>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          <Button
            onClick={loadStreets}
            disabled={isLoading}
            className="bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{t('streetEditor.loading')}</>
              : t('streetEditor.loadButton')
            }
          </Button>

          {hasStreets && visibleCount > 0 && (
            <Button
              onClick={handleCreatePoster}
              className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-lg text-sm font-semibold"
            >
              {t('streetEditor.createButton')}
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          )}
        </div>
      </div>

      {hasStreets && (
        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-3">
          {t('streetEditor.clickHint')}
        </p>
      )}
    </div>
  );
}
