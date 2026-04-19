import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Button } from './ui/button';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ArrowRight, Loader2, PenLine, X } from 'lucide-react';

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
  const [selectionBox, setSelectionBox] = useState(null);
  const [drawMode, setDrawMode] = useState(false);
  const [drawPhase, setDrawPhase] = useState(0); // 0=idle, 1=waiting for end point
  const drawModeRef = useRef(false);
  const drawStartRef = useRef(null);
  const drawMarkerRef = useRef(null);

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

    map.on('load', () => {
      map.on('click', (e) => {
        if (!drawModeRef.current) return;
        if (map.getSource('streets')) return; // handled by setupLayers handler
        const { lng, lat } = e.lngLat;
        if (!drawStartRef.current) {
          drawStartRef.current = { lng, lat };
          setDrawPhase(1);
          const el = document.createElement('div');
          el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#e63946;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5);';
          drawMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        } else {
          const start = drawStartRef.current;
          const newStreet = {
            id: `custom_${Date.now()}`,
            name: '',
            type: 'custom',
            coords: [[start.lng, start.lat], [lng, lat]],
            visible: true,
          };
          setStreets(prev => {
            const updated = [...prev, newStreet];
            setupLayers(map, toGeoJSON(updated));
            return updated;
          });
          setHasStreets(true);
          drawStartRef.current = null;
          setDrawPhase(0);
          if (drawMarkerRef.current) {
            drawMarkerRef.current.remove();
            drawMarkerRef.current = null;
          }
        }
      });
    });

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

    let justDragged = false;

    const toggleStreet = (clickedId, newVisible) => {
      if (justDragged || drawModeRef.current) return;
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

    const setCursor = (cursor) => () => {
      if (drawModeRef.current) return;
      map.getCanvas().style.cursor = cursor;
    };
    map.on('mouseenter', 'streets-visible-hit', setCursor('pointer'));
    map.on('mouseleave', 'streets-visible-hit', setCursor(''));
    map.on('mouseenter', 'streets-hidden-hit', setCursor('pointer'));
    map.on('mouseleave', 'streets-hidden-hit', setCursor(''));

    // Segment-rectangle intersection in pixel space (Liang-Barsky)
    const segmentCrossesBox = (x1, y1, x2, y2, minX, minY, maxX, maxY) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      let tMin = 0;
      let tMax = 1;
      for (const [p, q] of [[-dx, x1 - minX], [dx, maxX - x1], [-dy, y1 - minY], [dy, maxY - y1]]) {
        if (p === 0) { if (q < 0) return false; }
        else {
          const t = q / p;
          if (p < 0) tMin = Math.max(tMin, t);
          else tMax = Math.min(tMax, t);
          if (tMin > tMax) return false;
        }
      }
      return true;
    };

    // Project each street coord to pixels, then test against the pixel-space selection box
    const streetIntersectsPixelBox = (s, minX, minY, maxX, maxY) => {
      const px = s.coords.map(([lng, lat]) => {
        const p = map.project([lng, lat]);
        return [p.x, p.y];
      });
      for (const [x, y] of px) {
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return true;
      }
      for (let i = 0; i < px.length - 1; i++) {
        const [x1, y1] = px[i];
        const [x2, y2] = px[i + 1];
        if (segmentCrossesBox(x1, y1, x2, y2, minX, minY, maxX, maxY)) return true;
      }
      return false;
    };

    // Drag-to-select: click + drag creates a selection box that hides all visible streets inside
    const canvas = map.getCanvas();
    let dragStartX = 0;
    let dragStartY = 0;
    let dragging = false;
    let listenersActive = false;

    const cleanupDragListeners = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      listenersActive = false;
    };

    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - dragStartX;
      const dy = y - dragStartY;

      if (!dragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        dragging = true;
        map.dragPan.disable();
      }

      if (dragging) {
        setSelectionBox({
          x: Math.min(dragStartX, x),
          y: Math.min(dragStartY, y),
          width: Math.abs(dx),
          height: Math.abs(dy),
        });
      }
    };

    const onMouseUp = (e) => {
      cleanupDragListeners();

      if (dragging) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const minX = Math.min(dragStartX, x);
        const maxX = Math.max(dragStartX, x);
        const minY = Math.min(dragStartY, y);
        const maxY = Math.max(dragStartY, y);

        setStreets(prev => {
          const updated = prev.map(s => {
            if (!s.visible) return s;
            return streetIntersectsPixelBox(s, minX, minY, maxX, maxY)
              ? { ...s, visible: false }
              : s;
          });
          mapRef.current?.getSource('streets')?.setData(toGeoJSON(updated));
          return updated;
        });

        setSelectionBox(null);
        map.dragPan.enable();

        // Block the MapLibre click event that fires after a drag
        justDragged = true;
        setTimeout(() => { justDragged = false; }, 200);
      }

      dragging = false;
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      if (drawModeRef.current) return;
      if (listenersActive) cleanupDragListeners();
      const rect = canvas.getBoundingClientRect();
      dragStartX = e.clientX - rect.left;
      dragStartY = e.clientY - rect.top;
      dragging = false;
      listenersActive = true;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    canvas.addEventListener('mousedown', onMouseDown);

    map.on('click', (e) => {
      if (!drawModeRef.current) return;
      const { lng, lat } = e.lngLat;

      if (!drawStartRef.current) {
        drawStartRef.current = { lng, lat };
        setDrawPhase(1);
        const el = document.createElement('div');
        el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#e63946;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.5);';
        drawMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      } else {
        const start = drawStartRef.current;
        const newStreet = {
          id: `custom_${Date.now()}`,
          name: '',
          type: 'custom',
          coords: [[start.lng, start.lat], [lng, lat]],
          visible: true,
        };
        setStreets(prev => {
          const updated = [...prev, newStreet];
          if (mapRef.current?.getSource('streets')) {
            mapRef.current.getSource('streets').setData(toGeoJSON(updated));
          } else {
            setupLayers(mapRef.current, toGeoJSON(updated));
          }
          return updated;
        });
        setHasStreets(true);
        drawStartRef.current = null;
        setDrawPhase(0);
        if (drawMarkerRef.current) {
          drawMarkerRef.current.remove();
          drawMarkerRef.current = null;
        }
      }
    });

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

  const toggleDrawMode = useCallback(() => {
    const next = !drawModeRef.current;
    drawModeRef.current = next;
    setDrawMode(next);
    if (!next) {
      drawStartRef.current = null;
      setDrawPhase(0);
      if (drawMarkerRef.current) {
        drawMarkerRef.current.remove();
        drawMarkerRef.current = null;
      }
    }
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = next ? 'crosshair' : '';
    }
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

        {/* Drag selection overlay */}
        {selectionBox && (
          <div
            className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/20"
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}

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

        {/* Draw mode hint */}
        {drawMode && (
          <div className="absolute top-3 right-14 z-10 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700 rounded-lg px-3 py-2 text-xs shadow-lg max-w-[200px]">
            <p className="font-semibold text-red-700 dark:text-red-300 mb-0.5">{t('streetEditor.drawModeActive')}</p>
            <p className="text-red-600 dark:text-red-400">
              {drawPhase === 1 ? t('streetEditor.drawClickEnd') : t('streetEditor.drawClickStart')}
            </p>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          <Button
            onClick={loadStreets}
            disabled={isLoading || drawMode}
            className="bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{t('streetEditor.loading')}</>
              : t('streetEditor.loadButton')
            }
          </Button>

          <Button
            onClick={toggleDrawMode}
            className={drawMode
              ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg text-sm font-semibold'
              : 'bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold'
            }
          >
            {drawMode
              ? <><X className="w-4 h-4 mr-1.5" />{t('streetEditor.drawCancel')}</>
              : <><PenLine className="w-4 h-4 mr-1.5" />{t('streetEditor.drawButton')}</>
            }
          </Button>

          {hasStreets && visibleCount > 0 && !drawMode && (
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
