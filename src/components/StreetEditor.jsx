import { useRef, useEffect, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Button } from './ui/button';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ArrowRight, Loader2, PenLine, X, GitBranch } from 'lucide-react';

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const HIGHWAY_EXCLUDE = 'footway|path|steps|construction|proposed|platform|elevator|corridor';
const MAX_BBOX_SIZE = 0.3;

// --- Cul-de-sac generation ---

function lngPerMeterAt(lat) {
  return 1 / (111320 * Math.cos((lat * Math.PI) / 180));
}

function toLocalXY(lng, lat, originLng, originLat) {
  return {
    x: (lng - originLng) / lngPerMeterAt(originLat),
    y: (lat - originLat) / (1 / 111320),
  };
}

function fromLocalXY(x, y, originLng, originLat) {
  return [originLng + x * lngPerMeterAt(originLat), originLat + y / 111320];
}

function makeSquarePreset(lng, lat, sideM) {
  const hLng = (sideM / 2) * lngPerMeterAt(lat);
  const hLat = (sideM / 2) / 111320;
  return [
    [lng - hLng, lat + hLat],
    [lng + hLng, lat + hLat],
    [lng + hLng, lat - hLat],
    [lng - hLng, lat - hLat],
  ];
}

function makeTrianglePreset(lng, lat, baseM, heightM) {
  const hBase = (baseM / 2) * lngPerMeterAt(lat);
  const baseLat = lat - (heightM / 3) / 111320;
  const apexLat = lat + (2 * heightM / 3) / 111320;
  // Side 0 (BL→BR) = base = main side; side 1/2 = equal legs
  return [
    [lng - hBase, baseLat],
    [lng + hBase, baseLat],
    [lng, apexLat],
  ];
}

// Two-click interactive preset polygon from local XY corner1=(x1,y1) to corner2=(x2,y2)
function computePresetPolygon(type, x1, y1, x2, y2, originLng, originLat) {
  if (type === 'square') {
    const dx = x2 - x1, dy = y2 - y1;
    const side = Math.min(Math.abs(dx), Math.abs(dy));
    const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
    return [
      fromLocalXY(x1,           y1,           originLng, originLat),
      fromLocalXY(x1 + sx*side, y1,           originLng, originLat),
      fromLocalXY(x1 + sx*side, y1 + sy*side, originLng, originLat),
      fromLocalXY(x1,           y1 + sy*side, originLng, originLat),
    ];
  } else {
    // Triangle: base runs at y1 from x1 to x2; apex centered at y2 (or auto for equilateral)
    const apexY = type === 'equilateral'
      ? y1 + (Math.sign(y2 - y1) || 1) * Math.abs(x2 - x1) * (Math.sqrt(3) / 2)
      : y2;
    return [
      fromLocalXY(x1,             y1,    originLng, originLat),
      fromLocalXY(x2,             y1,    originLng, originLat),
      fromLocalXY((x1 + x2) / 2, apexY, originLng, originLat),
    ];
  }
}


function getMidpointPairs(polyXY) {
  const N = polyXY.length;
  const mids = polyXY.map(([x, y], i) => {
    const [nx, ny] = polyXY[(i + 1) % N];
    return [(x + nx) / 2, (y + ny) / 2];
  });
  const pairs = [];
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) {
      const adj = (j === i + 1) || (i === 0 && j === N - 1);
      if (!adj || N <= 3) pairs.push({ i, j, m1: mids[i], m2: mids[j] });
    }
  return pairs.length ? pairs : [{ i: 0, j: 1, m1: mids[0], m2: mids[1] }];
}

function computeSpineAngle(polyXY, params) {
  const { spineAngleMode, spineAngleMidpairIdx = 0, spineAngleDeg = 0 } = params;
  if (spineAngleMode === 'custom') return (spineAngleDeg * Math.PI) / 180;
  const pairs = getMidpointPairs(polyXY);
  const { m1, m2 } = pairs[((spineAngleMidpairIdx % pairs.length) + pairs.length) % pairs.length];
  return Math.atan2(m2[1] - m1[1], m2[0] - m1[0]);
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function clipLineToPolygon(ax, ay, bx, by, poly) {
  const dx = bx - ax, dy = by - ay;
  const ts = new Set([0, 1]);
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const ex = x2 - x1, ey = y2 - y1;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((x1 - ax) * ey - (y1 - ay) * ex) / denom;
    const u = ((x1 - ax) * dy - (y1 - ay) * dx) / denom;
    if (u > -1e-10 && u < 1 + 1e-10 && t > -1e-10 && t < 1 + 1e-10)
      ts.add(Math.max(0, Math.min(1, t)));
  }
  const sorted = [...ts].sort((a, b) => a - b);
  return sorted.slice(0, -1).reduce((acc, t1, i) => {
    const t2 = sorted[i + 1];
    const mx = ax + (t1 + t2) / 2 * dx, my = ay + (t1 + t2) / 2 * dy;
    if (pointInPolygon(mx, my, poly))
      acc.push([[ax + t1 * dx, ay + t1 * dy], [ax + t2 * dx, ay + t2 * dy]]);
    return acc;
  }, []);
}

function generateCulDeSacStreets(polygonLngLat, params) {
  if (!polygonLngLat || polygonLngLat.length < 3) return [];
  const { spacingM, spinePosition, ladoPrincipalIdx, marginM,
          spineAngleMode, spineAngleMidpairIdx, spineAngleDeg } = params;

  const originLng = polygonLngLat[0][0];
  const originLat = polygonLngLat[0][1];
  const poly = polygonLngLat.map(([lng, lat]) => {
    const p = toLocalXY(lng, lat, originLng, originLat);
    return [p.x, p.y];
  });
  const N = poly.length;

  // --- Main side UV system (controls secondary street direction and depth) ---
  const sideIdx = ((ladoPrincipalIdx % N) + N) % N;
  const [px0, py0] = poly[sideIdx];
  const [px1, py1] = poly[(sideIdx + 1) % N];
  const sideLen = Math.hypot(px1 - px0, py1 - py0);
  if (sideLen < 1e-6) return [];

  const es = [(px1 - px0) / sideLen, (py1 - py0) / sideLen]; // along main side
  let eu = [-es[1], es[0]];                                    // perpendicular, will point inward
  const cx = poly.reduce((s, [x]) => s + x, 0) / N;
  const cy = poly.reduce((s, [, y]) => s + y, 0) / N;
  if (eu[0] * (cx - px0) + eu[1] * (cy - py0) < 0) eu = [-eu[0], -eu[1]];

  // u = depth from main side (eu direction); v = position along main side (es direction)
  const toUV = (x, y) => [(x-px0)*eu[0]+(y-py0)*eu[1], (x-px0)*es[0]+(y-py0)*es[1]];
  const toXY = (u, v) => [px0+u*eu[0]+v*es[0], py0+u*eu[1]+v*es[1]];

  const polyUV = poly.map(([x, y]) => toUV(x, y));
  const uFar = Math.max(...polyUV.map(([u]) => u));
  const vMin = Math.min(...polyUV.map(([, v]) => v));
  const vMax = Math.max(...polyUV.map(([, v]) => v));

  // --- Spine anchor and direction ---
  let anchorX, anchorY, spineDir;

  if (spineAngleMode === 'vertex' && N === 3) {
    // Anchor: spinePosition fraction along main side (P0→P1)
    anchorX = px0 + spinePosition * (px1 - px0);
    anchorY = py0 + spinePosition * (py1 - py0);
    const [oppX, oppY] = poly[(sideIdx + 2) % 3];
    const dLen = Math.hypot(oppX - anchorX, oppY - anchorY);
    if (dLen < 1e-6) return [];
    spineDir = [(oppX - anchorX) / dLen, (oppY - anchorY) / dLen];
    if (spineDir[0] * eu[0] + spineDir[1] * eu[1] < 0) spineDir = [-spineDir[0], -spineDir[1]];
  } else if (spineAngleMode === 'side') {
    const vAnchor = vMin + spinePosition * (vMax - vMin);
    anchorX = px0 + vAnchor * es[0];
    anchorY = py0 + vAnchor * es[1];
    spineDir = [eu[0], eu[1]];
  } else {
    const vAnchor = vMin + spinePosition * (vMax - vMin);
    anchorX = px0 + vAnchor * es[0];
    anchorY = py0 + vAnchor * es[1];
    const theta = computeSpineAngle(poly, { spineAngleMode, spineAngleMidpairIdx, spineAngleDeg });
    spineDir = [Math.cos(theta), Math.sin(theta)];
    if (spineDir[0] * eu[0] + spineDir[1] * eu[1] < 0) spineDir = [-spineDir[0], -spineDir[1]];
  }

  const du = spineDir[0] * eu[0] + spineDir[1] * eu[1];
  const dv = spineDir[0] * es[0] + spineDir[1] * es[1];
  if (Math.abs(du) < 0.01) return [];

  // v-coordinate of anchor in UV space (used to track where spine crosses each secondary street)
  const [, vAnchorUV] = toUV(anchorX, anchorY);

  const streets = [];
  const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  let idx = 0;

  // Last secondary street u-value
  const maxUk = uFar - marginM;
  const ukFirst = spacingM / 2;
  const ukLast = maxUk >= ukFirst
    ? ukFirst + Math.floor((maxUk - ukFirst) / spacingM) * spacingM
    : -1;
  if (ukLast < ukFirst) return streets;

  // --- Spine: from polygon boundary (near main side) to last secondary street ---
  const tNear = (uFar + 500) / Math.abs(du);
  const tFar = ukLast / du;
  clipLineToPolygon(
    anchorX - spineDir[0] * tNear, anchorY - spineDir[1] * tNear,
    anchorX + spineDir[0] * tFar,  anchorY + spineDir[1] * tFar,
    poly
  ).forEach(([[x1, y1], [x2, y2]]) => {
    streets.push({ id: `cds_spine_${ts}_${idx++}`, name: 'Calle Principal', type: 'cul-de-sac-spine', visible: true,
      coords: [fromLocalXY(x1, y1, originLng, originLat), fromLocalXY(x2, y2, originLng, originLat)] });
  });

  // --- Secondary streets: parallel to main side, first at spacingM/2 from main side ---
  let uk = ukFirst;
  while (uk <= uFar - marginM) {
    // Where does the spine cross u = uk?
    const vSpineAtUk = vAnchorUV + (uk / du) * dv;

    clipLineToPolygon(...toXY(uk, vMin - 1), ...toXY(uk, vMax + 1), poly).forEach(([[x1, y1], [x2, y2]]) => {
      const [, v1] = toUV(x1, y1), [, v2] = toUV(x2, y2);
      const vL = Math.min(v1, v2) + marginM, vR = Math.max(v1, v2) - marginM;
      if (vL >= vR) return;

      if (vSpineAtUk > vL) {
        const [lx1, ly1] = toXY(uk, vL), [lx2, ly2] = toXY(uk, Math.min(vSpineAtUk, vR));
        if (Math.hypot(lx2-lx1, ly2-ly1) > 5)
          streets.push({ id: `cds_L_${ts}_${idx++}`, name: '', type: 'cul-de-sac-branch', visible: true,
            coords: [fromLocalXY(lx1, ly1, originLng, originLat), fromLocalXY(lx2, ly2, originLng, originLat)] });
      }
      if (vSpineAtUk < vR) {
        const [rx1, ry1] = toXY(uk, Math.max(vSpineAtUk, vL)), [rx2, ry2] = toXY(uk, vR);
        if (Math.hypot(rx2-rx1, ry2-ry1) > 5)
          streets.push({ id: `cds_R_${ts}_${idx++}`, name: '', type: 'cul-de-sac-branch', visible: true,
            coords: [fromLocalXY(rx1, ry1, originLng, originLat), fromLocalXY(rx2, ry2, originLng, originLat)] });
      }
    });
    uk += spacingM;
  }

  return streets;
}

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

  const [culDeSacMode, setCulDeSacMode] = useState(false);
  const culDeSacModeRef = useRef(false);
  const [culDeSacPoints, setCulDeSacPoints] = useState([]); // polygon vertices being drawn
  const [culDeSacRegion, setCulDeSacRegion] = useState(null); // closed polygon [[lng,lat],...]
  const [culDeSacParams, setCulDeSacParams] = useState({
    spacingM: 100,
    spinePosition: 0.5,
    spineAngleMode: 'side',
    ladoPrincipalIdx: 0,
    spineAngleMidpairIdx: 0,
    spineAngleDeg: 0,
    marginM: 20,
  });
  const [culDeSacShapeType, setCulDeSacShapeType] = useState('custom');
  const [presetPlacingType, setPresetPlacingType] = useState(null); // 'square'|'equilateral'|'isosceles'|null
  const presetPlacingTypeRef = useRef(null);
  const [presetCorner1Set, setPresetCorner1Set] = useState(false);
  const presetCorner1Ref = useRef(null); // { x, y, originLng, originLat }

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const style = isDark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style,
      center: [-65.3236, -26.8241],
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      map.on('click', (e) => {
        if (culDeSacModeRef.current) {
          const { lng, lat } = e.lngLat;
          if (presetPlacingTypeRef.current) {
            if (!presetCorner1Ref.current) {
              presetCorner1Ref.current = { x: 0, y: 0, originLng: lng, originLat: lat };
              setPresetCorner1Set(true);
            } else {
              const { x: x1, y: y1, originLng, originLat } = presetCorner1Ref.current;
              const pt2 = toLocalXY(lng, lat, originLng, originLat);
              const poly = computePresetPolygon(presetPlacingTypeRef.current, x1, y1, pt2.x, pt2.y, originLng, originLat);
              setCulDeSacRegion(poly);
              setCulDeSacShapeType(presetPlacingTypeRef.current);
              if (presetPlacingTypeRef.current !== 'square') {
                setCulDeSacParams(p => ({ ...p, ladoPrincipalIdx: 0, spineAngleMode: 'side' }));
              }
              presetPlacingTypeRef.current = null;
              setPresetPlacingType(null);
              presetCorner1Ref.current = null;
              setPresetCorner1Set(false);
            }
            return;
          }
          setCulDeSacPoints(prev => [...prev, [lng, lat]]);
          return;
        }
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

      map.on('mousemove', (e) => {
        if (!culDeSacModeRef.current || !presetPlacingTypeRef.current || !presetCorner1Ref.current) return;
        const { lng, lat } = e.lngLat;
        const { x: x1, y: y1, originLng, originLat } = presetCorner1Ref.current;
        const pt2 = toLocalXY(lng, lat, originLng, originLat);
        const poly = computePresetPolygon(presetPlacingTypeRef.current, x1, y1, pt2.x, pt2.y, originLng, originLat);
        if (poly.length >= 3 && map.getSource('cds-region')) {
          map.getSource('cds-region').setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...poly, poly[0]]] }, properties: {} }],
          });
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
      if (justDragged || drawModeRef.current || culDeSacModeRef.current) return;
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
      if (drawModeRef.current || culDeSacModeRef.current) return;
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
      if (drawModeRef.current || culDeSacModeRef.current) return;
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

  // Live polygon drawing preview (vertices while clicking)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const pts = culDeSacPoints;
    const lineCoords = pts.length >= 2 ? [...pts, pts[0]] : pts; // close visually
    const lineGeoJSON = {
      type: 'FeatureCollection',
      features: pts.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: lineCoords }, properties: {} }] : [],
    };
    const pointsGeoJSON = {
      type: 'FeatureCollection',
      features: pts.map((pt, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: pt }, properties: { idx: i } })),
    };
    if (map.getSource('cds-drawing-line')) {
      map.getSource('cds-drawing-line').setData(lineGeoJSON);
      map.getSource('cds-drawing-pts').setData(pointsGeoJSON);
    } else {
      map.addSource('cds-drawing-line', { type: 'geojson', data: lineGeoJSON });
      map.addSource('cds-drawing-pts', { type: 'geojson', data: pointsGeoJSON });
      map.addLayer({ id: 'cds-drawing-line-layer', type: 'line', source: 'cds-drawing-line',
        paint: { 'line-color': '#22c55e', 'line-width': 2, 'line-dasharray': [4, 2], 'line-opacity': 0.9 } });
      map.addLayer({ id: 'cds-drawing-pts-layer', type: 'circle', source: 'cds-drawing-pts',
        paint: { 'circle-color': '#22c55e', 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
    }
  }, [culDeSacPoints]);

  // Update CDS region boundary + street preview whenever region or params change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const emptyFC = { type: 'FeatureCollection', features: [] };

    const regionGeoJSON = culDeSacRegion && culDeSacRegion.length >= 3
      ? {
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[...culDeSacRegion, culDeSacRegion[0]]] },
            properties: {},
          }],
        }
      : emptyFC;

    if (map.getSource('cds-region')) {
      map.getSource('cds-region').setData(regionGeoJSON);
    } else {
      map.addSource('cds-region', { type: 'geojson', data: regionGeoJSON });
      map.addLayer({ id: 'cds-region-fill', type: 'fill', source: 'cds-region',
        paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'cds-region-border', type: 'line', source: 'cds-region',
        paint: { 'line-color': '#16a34a', 'line-width': 2, 'line-dasharray': [4, 3], 'line-opacity': 0.85 } });
    }

    const preview = culDeSacRegion ? generateCulDeSacStreets(culDeSacRegion, culDeSacParams) : [];
    const previewGeoJSON = {
      type: 'FeatureCollection',
      features: preview.map(s => ({
        type: 'Feature', id: s.id,
        properties: { isSpine: s.type === 'cul-de-sac-spine' },
        geometry: { type: 'LineString', coordinates: s.coords },
      })),
    };

    if (map.getSource('cds-preview')) {
      map.getSource('cds-preview').setData(previewGeoJSON);
    } else {
      map.addSource('cds-preview', { type: 'geojson', data: previewGeoJSON });
      map.addLayer({ id: 'cds-preview-branch', type: 'line', source: 'cds-preview',
        filter: ['!=', ['get', 'isSpine'], true],
        paint: { 'line-color': '#22c55e', 'line-width': 2, 'line-opacity': 0.85 } });
      map.addLayer({ id: 'cds-preview-spine', type: 'line', source: 'cds-preview',
        filter: ['==', ['get', 'isSpine'], true],
        paint: { 'line-color': '#15803d', 'line-width': 3.5, 'line-opacity': 0.95 } });
    }

    // Highlight selected main side (only in 'side' mode)
    const mainSideGeoJSON = (() => {
      if (!culDeSacRegion || culDeSacParams.spineAngleMode !== 'side') return emptyFC;
      const N = culDeSacRegion.length;
      const i = ((culDeSacParams.ladoPrincipalIdx % N) + N) % N;
      return {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {},
          geometry: { type: 'LineString', coordinates: [culDeSacRegion[i], culDeSacRegion[(i + 1) % N]] } }],
      };
    })();
    if (map.getSource('cds-main-side')) {
      map.getSource('cds-main-side').setData(mainSideGeoJSON);
    } else {
      map.addSource('cds-main-side', { type: 'geojson', data: mainSideGeoJSON });
      map.addLayer({ id: 'cds-main-side-layer', type: 'line', source: 'cds-main-side',
        paint: { 'line-color': '#f59e0b', 'line-width': 5, 'line-opacity': 0.95 } });
    }
  }, [culDeSacRegion, culDeSacParams]);

  const clearCulDeSacDrawing = useCallback(() => {
    const map = mapRef.current;
    const emptyFC = { type: 'FeatureCollection', features: [] };
    if (map?.getSource('cds-drawing-line')) {
      map.getSource('cds-drawing-line').setData(emptyFC);
      map.getSource('cds-drawing-pts').setData(emptyFC);
    }
    if (map?.getSource('cds-main-side')) map.getSource('cds-main-side').setData(emptyFC);
  }, []);

  const toggleCulDeSacMode = useCallback(() => {
    const next = !culDeSacModeRef.current;
    culDeSacModeRef.current = next;
    setCulDeSacMode(next);
    if (next) {
      // exit draw mode
      if (drawModeRef.current) {
        drawModeRef.current = false;
        setDrawMode(false);
        drawStartRef.current = null;
        setDrawPhase(0);
        if (drawMarkerRef.current) { drawMarkerRef.current.remove(); drawMarkerRef.current = null; }
      }
    } else {
      setCulDeSacPoints([]);
      setCulDeSacRegion(null);
      presetPlacingTypeRef.current = null;
      setPresetPlacingType(null);
      presetCorner1Ref.current = null;
      setPresetCorner1Set(false);
      clearCulDeSacDrawing();
    }
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = next ? 'crosshair' : '';
  }, [clearCulDeSacDrawing]);

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
    if (next && culDeSacModeRef.current) {
      culDeSacModeRef.current = false;
      setCulDeSacMode(false);
      setCulDeSacRegion(null);
    }
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

  const applyCulDeSac = useCallback(() => {
    const map = mapRef.current;
    if (!map || !culDeSacRegion) return;
    const newStreets = generateCulDeSacStreets(culDeSacRegion, culDeSacParams);
    setStreets(prev => {
      const updated = [...prev, ...newStreets];
      if (map.getSource('streets')) {
        map.getSource('streets').setData(toGeoJSON(updated));
      } else {
        setupLayers(map, toGeoJSON(updated));
      }
      return updated;
    });
    setHasStreets(true);
    if (map.getSource('cds-preview')) map.getSource('cds-preview').setData({ type: 'FeatureCollection', features: [] });
    if (map.getSource('cds-region')) map.getSource('cds-region').setData({ type: 'FeatureCollection', features: [] });
    setCulDeSacRegion(null);
    setCulDeSacPoints([]);
    clearCulDeSacDrawing();
  }, [culDeSacRegion, culDeSacParams, setupLayers, clearCulDeSacDrawing]);

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
            className={`absolute pointer-events-none border-2 ${culDeSacMode ? 'border-green-500 bg-green-500/20' : 'border-blue-500 bg-blue-500/20'}`}
            style={{
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
            }}
          />
        )}

        {/* Top-left info badge (hidden in CDS mode to make room for CDS panel) */}
        {hasStreets && !culDeSacMode && (
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
        {!hasStreets && !culDeSacMode && (
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

        {/* Cul-de-sac: drawing polygon phase */}
        {culDeSacMode && !culDeSacRegion && (
          <div className="absolute top-3 left-3 z-10 bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 rounded-lg px-3 py-2 text-xs shadow-lg w-[240px]">
            <p className="font-semibold text-green-700 dark:text-green-300 mb-2">Árbol de Cul-de-Sac</p>

            {presetPlacingType ? (
              /* Two-click placement mode */
              <div>
                <p className="text-green-600 dark:text-green-400 mb-3 leading-relaxed">
                  {!presetCorner1Set
                    ? 'Hacé click en el mapa para colocar la primera esquina'
                    : 'Ahora hacé click en la esquina opuesta'}
                </p>
                <button
                  onClick={() => {
                    presetPlacingTypeRef.current = null;
                    setPresetPlacingType(null);
                    presetCorner1Ref.current = null;
                    setPresetCorner1Set(false);
                    const map = mapRef.current;
                    if (map?.getSource('cds-region')) {
                      map.getSource('cds-region').setData({ type: 'FeatureCollection', features: [] });
                    }
                  }}
                  className="w-full text-xs py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                {/* Preset shapes */}
                <div className="mb-2">
                  <p className="text-green-700 dark:text-green-300 font-medium mb-1.5">Forma predefinida</p>
                  <div className="flex gap-1">
                    {[
                      ['square', 'Cuadrado'],
                      ['equilateral', 'Equilátero'],
                      ['isosceles', 'Isósceles'],
                    ].map(([type, label]) => (
                      <button key={type}
                        onClick={() => {
                          presetPlacingTypeRef.current = type;
                          setPresetPlacingType(type);
                          setCulDeSacPoints([]);
                        }}
                        className="flex-1 text-xs py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-green-300 dark:border-green-700 mb-2" />

                {/* Manual drawing */}
                <p className="text-green-600 dark:text-green-400 mb-2">
                  {culDeSacPoints.length === 0
                    ? 'O dibujá manualmente: hacé click en el mapa'
                    : culDeSacPoints.length < 3
                    ? `${culDeSacPoints.length} vértice${culDeSacPoints.length > 1 ? 's' : ''} — necesitás al menos 3`
                    : `${culDeSacPoints.length} vértices — podés cerrar el polígono`}
                </p>
                <div className="flex gap-2">
                  {culDeSacPoints.length > 0 && (
                    <button
                      onClick={() => setCulDeSacPoints(prev => prev.slice(0, -1))}
                      className="flex-1 text-xs py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 transition-colors"
                    >
                      Deshacer
                    </button>
                  )}
                  {culDeSacPoints.length >= 3 && (
                    <button
                      onClick={() => {
                        setCulDeSacRegion(culDeSacPoints);
                        setCulDeSacPoints([]);
                        setCulDeSacShapeType('custom');
                        clearCulDeSacDrawing();
                      }}
                      className="flex-1 text-xs py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition-colors font-semibold"
                    >
                      Cerrar polígono
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Cul-de-sac config panel (polygon closed) */}
        {culDeSacMode && culDeSacRegion && (
          <div className="absolute top-3 left-3 z-10 bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-lg border border-zinc-200 dark:border-zinc-700 w-[240px]">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs mb-3">Árbol de Cul-de-Sac</p>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Separación entre calles</span>
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{culDeSacParams.spacingM}m</span>
                </div>
                <input type="range" min="30" max="500" step="10" value={culDeSacParams.spacingM}
                  onChange={e => setCulDeSacParams(p => ({ ...p, spacingM: +e.target.value }))}
                  className="w-full accent-green-600 h-1.5" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Posición calle principal</span>
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{Math.round(culDeSacParams.spinePosition * 100)}%</span>
                </div>
                <input type="range" min="0.05" max="0.95" step="0.05" value={culDeSacParams.spinePosition}
                  onChange={e => setCulDeSacParams(p => ({ ...p, spinePosition: +e.target.value }))}
                  className="w-full accent-green-600 h-1.5" />
              </div>

              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Orientación calle principal</p>
                <div className="flex gap-1 mb-2 flex-wrap">
                  {[
                    ['side', 'Perp. lado'],
                    ['midpoints', 'Centro-centro'],
                    ['custom', 'Personalizable'],
                    ...(culDeSacRegion.length === 3 && culDeSacShapeType === 'custom' ? [['vertex', 'Hacia vértice']] : []),
                  ].map(([val, label]) => (
                    <button key={val}
                      onClick={() => setCulDeSacParams(p => ({ ...p, spineAngleMode: val }))}
                      className={`flex-1 text-xs py-1 rounded border transition-colors leading-tight ${culDeSacParams.spineAngleMode === val
                        ? 'bg-green-600 text-white border-green-600'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-600 hover:border-green-400'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {culDeSacParams.spineAngleMode === 'midpoints' && (() => {
                  const polyXY = culDeSacRegion.map(([lng, lat]) => {
                    const { x, y } = toLocalXY(lng, lat, culDeSacRegion[0][0], culDeSacRegion[0][1]);
                    return [x, y];
                  });
                  const pairs = getMidpointPairs(polyXY);
                  const pidx = ((culDeSacParams.spineAngleMidpairIdx % pairs.length) + pairs.length) % pairs.length;
                  const { i: pi, j: pj } = pairs[pidx];
                  return (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCulDeSacParams(p => ({ ...p, spineAngleMidpairIdx: p.spineAngleMidpairIdx - 1 }))}
                        className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-50 text-sm">‹</button>
                      <span className="flex-1 text-xs text-center text-zinc-600 dark:text-zinc-300">Lado {pi + 1} ↔ Lado {pj + 1}</span>
                      <button onClick={() => setCulDeSacParams(p => ({ ...p, spineAngleMidpairIdx: p.spineAngleMidpairIdx + 1 }))}
                        className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-50 text-sm">›</button>
                    </div>
                  );
                })()}

                {culDeSacParams.spineAngleMode === 'custom' && (
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Ángulo</span>
                      <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{culDeSacParams.spineAngleDeg}°</span>
                    </div>
                    <input type="range" min="0" max="179" step="1" value={culDeSacParams.spineAngleDeg}
                      onChange={e => setCulDeSacParams(p => ({ ...p, spineAngleDeg: +e.target.value }))}
                      className="w-full accent-green-600 h-1.5" />
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Lado principal</p>
                {(() => {
                  const N = culDeSacRegion.length;
                  const i = ((culDeSacParams.ladoPrincipalIdx % N) + N) % N;
                  return (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setCulDeSacParams(p => ({ ...p, ladoPrincipalIdx: p.ladoPrincipalIdx - 1 }))}
                        className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-50 text-sm">‹</button>
                      <span className="flex-1 text-xs text-center text-zinc-600 dark:text-zinc-300">Lado {i + 1} de {N}</span>
                      <button onClick={() => setCulDeSacParams(p => ({ ...p, ladoPrincipalIdx: p.ladoPrincipalIdx + 1 }))}
                        className="w-6 h-6 flex items-center justify-center rounded border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-600 hover:bg-zinc-50 text-sm">›</button>
                    </div>
                  );
                })()}
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Margen a contornos</span>
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300">{culDeSacParams.marginM}m</span>
                </div>
                <input type="range" min="0" max="200" step="5" value={culDeSacParams.marginM}
                  onChange={e => setCulDeSacParams(p => ({ ...p, marginM: +e.target.value }))}
                  className="w-full accent-green-600 h-1.5" />
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setCulDeSacRegion(null); setCulDeSacShapeType('custom'); }}
                className="flex-1 text-xs py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                Redibujar
              </button>
              <button
                onClick={applyCulDeSac}
                className="flex-1 text-xs py-1.5 rounded bg-green-600 text-white hover:bg-green-700 transition-colors font-semibold"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          <Button
            onClick={loadStreets}
            disabled={isLoading || drawMode || culDeSacMode}
            className="bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold"
          >
            {isLoading
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{t('streetEditor.loading')}</>
              : t('streetEditor.loadButton')
            }
          </Button>

          <Button
            onClick={toggleDrawMode}
            disabled={culDeSacMode}
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

          <Button
            onClick={toggleCulDeSacMode}
            disabled={isLoading || drawMode}
            className={culDeSacMode
              ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg text-sm font-semibold'
              : 'bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm font-semibold'
            }
          >
            {culDeSacMode
              ? <><X className="w-4 h-4 mr-1.5" />Cancelar</>
              : <><GitBranch className="w-4 h-4 mr-1.5" />Cul-de-Sac</>
            }
          </Button>

          {hasStreets && visibleCount > 0 && !drawMode && !culDeSacMode && (
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
