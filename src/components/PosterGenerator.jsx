import { useState, useRef } from 'react';
import { PosterControls } from './PosterControls';
import { PosterCanvas } from './PosterCanvas';

const TILES = (s, z, x, y) => `https://a.basemaps.cartocdn.com/${s}/${z}/${x}/${y}@2x.png`;

function lng2t(lng, z) {
  return (lng + 180) / 360 * Math.pow(2, z);
}

function lat2t(lat, z) {
  return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z);
}

export function PosterGenerator({ circuit }) {
  const canvasRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [settings, setSettings] = useState({
    mapStyle: 'light_nolabels',
    zoom: 15.5,
    trackWidth: 8,
    resolution: '4724x6614', // 300 DPI default
    posterWidth: 40, // cm
    posterHeight: 56, // cm
    dpi: 300,
    textSize: 1.0, // multiplier
    showText: true,
    borderWidth: 0, // 0, 1, 2, or 3 px
    latOffset: 0, // desplazamiento de latitud
    lngOffset: 0, // desplazamiento de longitud
  });

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const generatePoster = async () => {
    setIsGenerating(true);
    setProgress(10);

    try {
      // Calcular dimensiones en píxeles basado en cm y DPI
      const PW = Math.round((settings.posterWidth / 2.54) * settings.dpi);
      const PH = Math.round((settings.posterHeight / 2.54) * settings.dpi);
      
      const sidePadding = PW * 0.04;
      const topPadding = PW * 0.04;

      const { zoom, mapStyle, trackWidth, showText, borderWidth, textSize, latOffset, lngOffset } = settings;
      
      // Coordenadas del circuito con desplazamiento
      const CLng = circuit.lng + lngOffset;
      const CLat = circuit.lat + latOffset;

      // Escalado
      const baseZoom = Math.floor(zoom);
      const zoomFrac = zoom - baseZoom;
      const scale = Math.pow(2, zoomFrac);
      const TS = 512;
      const scaledTS = TS * scale;

      const textMargin = PH * 0.12;
      const textAreaTop = PH - textMargin * 1.5;

      setProgress(20);

      // Cargar GeoJSON del circuito
      const resp = await fetch(`https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@master/circuits/${circuit.geojsonId}.geojson`);
      const geojson = await resp.json();
      let coords = (geojson.features) ? geojson.features[0].geometry.coordinates : geojson.geometry.coordinates;

      const centerX = lng2t(CLng, zoom);
      const centerY = lat2t(CLat, zoom);

      const mapDisplayW = PW - (sidePadding * 2);
      const mapDisplayH = textAreaTop - topPadding;

      const tilesX = Math.ceil(mapDisplayW / scaledTS) + 2;
      const tilesY = Math.ceil(mapDisplayH / scaledTS) + 2;

      const startTileX = Math.floor(lng2t(CLng, baseZoom) - (mapDisplayW / scaledTS) / 2);
      const startTileY = Math.floor(lat2t(CLat, baseZoom) - (mapDisplayH / scaledTS) / 2);

      setProgress(30);

      // Cargar tiles
      const tilePromises = [];
      for (let y = 0; y < tilesY; y++) {
        for (let x = 0; x < tilesX; x++) {
          const tx = startTileX + x;
          const ty = startTileY + y;
          tilePromises.push(new Promise(res => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = TILES(mapStyle, baseZoom, tx, ty);
            img.onload = () => res({ img, tx, ty });
            img.onerror = () => res({ img: null, tx, ty });
          }));
        }
      }

      const downloadedTiles = await Promise.all(tilePromises);
      setProgress(60);

      // Crear canvas
      const master = document.createElement('canvas');
      master.width = PW;
      master.height = PH;
      const ctx = master.getContext('2d');

      // Fondo blanco
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, PW, PH);

      // Fondo gris del mapa
      ctx.fillStyle = "#f5f3ef";
      ctx.fillRect(sidePadding, topPadding, mapDisplayW, mapDisplayH);

      // Offsets
      const originX = lng2t(CLng, zoom) * TS;
      const originY = lat2t(CLat, zoom) * TS;
      const tileBaseX = startTileX * scale * TS;
      const tileBaseY = startTileY * scale * TS;

      const offsetX = originX - tileBaseX - mapDisplayW / 2;
      const offsetY = originY - tileBaseY - mapDisplayH / 2;

      // Dibujar mapa
      ctx.save();
      ctx.beginPath();
      ctx.rect(sidePadding, topPadding, mapDisplayW, mapDisplayH);
      ctx.clip();
      downloadedTiles.forEach(t => {
        if (t.img) {
          ctx.drawImage(
            t.img,
            (t.tx - startTileX) * scaledTS - offsetX + sidePadding,
            (t.ty - startTileY) * scaledTS - offsetY + topPadding,
            scaledTS,
            scaledTS
          );
        }
      });
      ctx.restore();

      setProgress(80);

      // Dibujar circuito
      const scaleFactor = PW / 1200;
      const gps2px = (lng, lat) => ({
        x: (lng2t(lng, zoom) - startTileX * scale) * TS - offsetX + sidePadding,
        y: (lat2t(lat, zoom) - startTileY * scale) * TS - offsetY + topPadding
      });

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      coords.forEach((c, i) => {
        const p = gps2px(c[0], c[1]);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });

      // Sombra blanca
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = (trackWidth + 4) * scaleFactor;
      ctx.stroke();

      // Línea del circuito
      ctx.strokeStyle = "#111";
      ctx.lineWidth = trackWidth * scaleFactor;
      ctx.stroke();

      // Borde del mapa
      if (borderWidth > 0) {
        ctx.strokeStyle = "#bbb";
        ctx.lineWidth = borderWidth * scaleFactor;
        ctx.strokeRect(sidePadding, topPadding, mapDisplayW, mapDisplayH);
      }

      // Texto
      if (showText) {
        // 1. Nombre del circuito
        ctx.textAlign = "center";
        ctx.fillStyle = "#1a1a1a";
        ctx.font = `bold ${Math.round(PW * 0.042 * textSize)}px "Helvetica Neue", Helvetica, Arial`;
        ctx.letterSpacing = "6px";
        ctx.fillText(circuit.displayName || circuit.name.toUpperCase(), PW / 2, PH - textMargin);

        // 2. País
        // CAMBIOS: Peso de 300 a 500. Tamaño de 0.028 a 0.032. Posición Y levemente ajustada.
        ctx.font = `350 ${Math.round(PW * 0.032 * textSize)}px "Helvetica Neue", Helvetica`;
        ctx.letterSpacing = "4px";
        ctx.fillText(`— ${circuit.country.toUpperCase()} —`, PW / 2, PH - textMargin + (PW * 0.05));

        // 3. Detalles del circuito
        // CAMBIOS: Peso de 400 a 500. Tamaño de 0.016 a 0.022. Color levemente más oscuro.
        ctx.font = `300 ${Math.round(PW * 0.022 * textSize)}px "Helvetica Neue", Helvetica`;
        ctx.fillStyle = "#555555"; // Lo oscurecí un poco de #777 para darle más cuerpo
        ctx.letterSpacing = "4px"; // Un poco más de tracking ayuda a la legibilidad
        ctx.fillText(
            `First Grand Prix ${circuit.firstGP} / Number of Laps ${circuit.laps} / Circuit Length ${circuit.length}`,
            PW / 2,
            PH - textMargin + (PW * 0.09) // Bajamos un poco más la línea por el nuevo tamaño
        );
      }

      setProgress(90);

      // Preview
      const preview = canvasRef.current;
      if (preview) {
        preview.width = PW;
        preview.height = PH;
        preview.getContext('2d').drawImage(master, 0, 0);
        setPreviewUrl(master.toDataURL('image/png'));
      }

      setProgress(100);

    } catch (error) {
      console.error('Error generating poster:', error);
      alert('Error al generar el póster. Por favor intenta de nuevo.');
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
      }, 500);
    }
  };

  const downloadPoster = () => {
    if (previewUrl) {
      const link = document.createElement('a');
      link.download = `${circuit.name.replace(/\s+/g, '_')}_Poster.png`;
      link.href = previewUrl;
      link.click();
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400 tracking-wider">
          GENERADOR DE PÓSTER
        </span>
        <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-zinc-100 mt-3 tracking-tight">
          {circuit.name}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1.5">
          {circuit.country}
        </p>
      </div>

      {/* Content Grid - Preview left, Controls right (side by side) */}
      <div className="grid grid-cols-2 lg:grid-cols-[380px,1fr] gap-6 items-start">
        {/* Preview - Left */}
        <div className="w-full h-full">
          <PosterCanvas
            canvasRef={canvasRef}
            isGenerating={isGenerating}
            progress={progress}
          />
        </div>

        {/* Controls - Right */}
        <div className="w-full">
          <PosterControls
            settings={settings}
            onSettingChange={updateSetting}
            onGenerate={generatePoster}
            isGenerating={isGenerating}
            progress={progress}
            onDownload={downloadPoster}
            hasPreview={!!previewUrl}
          />
        </div>
      </div>
    </div>
  );
}
