# F1 Poster Maker

Aplicación web para generar pósteres artísticos y minimalistas de circuitos de Fórmula 1 con calidad de impresión profesional. Personaliza dimensiones, estilos, zoom y más; todo procesado en tu navegador sin necesidad de un backend.

![F1 Poster Maker](https://img.shields.io/badge/F1-Poster%20Maker-E10600?style=for-the-badge&logo=formula1&logoColor=white)
![React](https://img.shields.io/badge/React-19.2.4-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.0.1-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4.2.2-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## Características

- **Mapa interactivo** con todos los circuitos de la temporada 2026 de F1.
- **Generación de pósteres personalizables** con hasta 12 parámetros ajustables.
- **Alta calidad de impresión** con soporte de hasta 600 DPI.
- **Procesamiento 100% en el cliente** - sin backend, todo sucede en tu navegador.
- **Sin necesidad de API keys** - funciona inmediatamente después de clonar.
- **Multilenguaje** - Español e Inglés con detección automática.
- **Modo oscuro automático** basado en las preferencias del sistema.

## Stack Tecnológico

### Frontend
- **React** 19.2.4 - Framework de UI.
- **Vite** 8.0.1 - Herramienta de construcción y servidor de desarrollo ultrarrápido.
- **Tailwind CSS** 4.2.2 - Framework de CSS orientado a utilidades.
- **MapLibre GL** 5.22.0 - Mapas vectoriales interactivos.
- **Motion** 12.38.0 - Animaciones fluidas.

### Componentes de UI
- **Radix UI** - Componentes accesibles (Select, Slider, primitivos).
- **Lucide React** 1.7.0 - Iconos modernos y personalizables.
- **class-variance-authority** - Gestión de variantes de componentes.

### Internacionalización
- **i18next** 26.0.3 - Framework robusto de i18n.
- **react-i18next** 17.0.2 - Integración con React.
- **i18next-browser-languagedetector** 8.2.1 - Detección automática de idioma.

### Renderizado del Póster
- **Canvas API** (Nativa de HTML5) - Generación de imágenes en alta resolución.
- **Proyección de Mercator** - Conversión de coordenadas GPS a píxeles.

## APIs Utilizadas

Todas las APIs son públicas y gratuitas, **no requieren llaves (API keys)**:

### 1. CartoDB - Teselas de Mapa Base
- **URL**: `https://a.basemaps.cartocdn.com/{style}/{z}/{x}/{y}@2x.png`
- **Propósito**: Proporcionar las imágenes de fondo para el póster.
- **Estilos disponibles**:
  - `light_nolabels` - Mapa minimalista sin etiquetas.
  - `light_all` - Mapa con nombres de calles.
  - `dark_all` - Modo oscuro.
- **Resolución**: 512×512px @ 2x (retina).

### 2. CartoDB - Estilos MapLibre GL
- **URL Oscuro**: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
- **URL Claro**: `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json`
- **Propósito**: Estilos vectoriales para el mapa interactivo de navegación.
- **Uso**: Visualización y selección de circuitos.

### 3. F1 Circuits GeoJSON (GitHub CDN)
- **URL**: `https://cdn.jsdelivr.net/gh/bacinger/f1-circuits@master/circuits/{geojsonId}.geojson`
- **Propósito**: Coordenadas GPS precisas del trazado de cada circuito.
- **Formato**: GeoJSON con LineString.
- **Ejemplo**: `mc-1929.geojson` (Mónaco).

## Instalación y Configuración

### Prerrequisitos
- Node.js 18+ (recomendado: 20+)
- npm o pnpm

### Clonar el Repositorio
```bash
git clone [https://github.com/tu-usuario/f1-poster-maker.git](https://github.com/tu-usuario/f1-poster-maker.git)
cd f1-poster-maker
```

### Instalar Dependencias
```bash
npm install
```

### Ejecutar en Desarrollo
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Construir para Producción
```bash
npm run build
```

Los archivos optimizados se generarán en el directorio `dist/`

### Previsualizar la Construcción de Producción
```bash
npm run preview
```

## Estructura del Proyecto

```
f1-poster-maker/
├── src/
│   ├── components/           # Componentes de React
│   │   ├── ui/              # Componentes de UI reutilizables
│   │   │   ├── map.jsx      # Mapa interactivo base
│   │   │   ├── button.jsx   # Botón personalizado
│   │   │   ├── input.jsx    # Input con validación
│   │   │   ├── select.jsx   # Dropdown con Radix UI
│   │   │   ├── slider.jsx   # Slider para valores numéricos
│   │   │   └── background-beams.jsx  # Efecto visual animado
│   │   ├── CircuitMap.jsx   # Mapa con marcadores de circuitos
│   │   ├── PosterGenerator.jsx  # Generador principal
│   │   ├── PosterCanvas.jsx     # Previsualización del póster
│   │   ├── PosterControls.jsx   # Controles de personalización
│   │   └── LanguageSwitcher.jsx # Selector de idioma
│   ├── data/
│   │   └── circuits.json    # Base de datos de circuitos F1
│   ├── i18n/                # Configuración de idiomas
│   │   ├── config.js        # Configuración de i18next
│   │   └── locales/
│   │       ├── en.json      # Traducciones al inglés
│   │       └── es.json      # Traducciones al español
│   ├── lib/
│   │   └── utils.js         # Funciones de utilidad
│   ├── App.jsx              # Componente principal
│   ├── main.jsx             # Punto de entrada
│   └── index.css            # Estilos globales + Tailwind
├── public/
│   ├── icons.svg            # Sprite de iconos SVG
│   └── favicon.svg          # Favicon del sitio
├── vite.config.js           # Configuración de Vite
├── tailwind.config.js       # Configuración de Tailwind
├── components.json          # Configuración de shadcn/ui
└── package.json             # Dependencias y scripts
```

## Uso

### 1. Seleccionar un Circuito
- Navega por el **mapa interactivo** en la parte superior.
- Haz clic en cualquier **marcador rojo** para ver la información del circuito.
- Presiona **"Crear póster"** en la ventana emergente.

### 2. Personalizar el Póster
Ajusta los siguientes parámetros según tus preferencias:

#### Dimensiones y Calidad
- **Ancho / Alto**: Tamaño en centímetros (20-100cm × 20-140cm).
- **DPI/Calidad**:
    - 150 DPI - Rápido (previsualización digital).
    - 300 DPI - Impresión estándar.
    - 600 DPI - Alta calidad (impresión profesional).

#### Estilo del Mapa
- **Minimal** - Sin etiquetas, estilo limpio.
- **Nombres de calles** - Incluye nombres de vías.
- **Modo Oscuro** - Fondo oscuro.

#### Ajustes de Posición
- **Zoom**: Nivel de acercamiento (12-20).
- **Lat Offset / Lng Offset**: Ajuste fino de la posición (-0.02 a 0.02).

#### Estilo Visual
- **Grosor del trazado**: Espesor de la línea del circuito (2-15px).
- **Tamaño de texto**: Multiplicador del tamaño de fuente (0.5-1.4x).
- **Incluir texto**: Mostrar/ocultar información del circuito.
- **Borde decorativo**: Sin borde, fino, medio o grueso.

### 3. Generar y Descargar
- Haz clic en **"Generar Póster"**.
- Espera a que se carguen las teselas del mapa y el trazado.
- La previsualización se mostrará automáticamente.
- Haz clic en **"Descargar Póster en Alta Resolución"** para obtener el archivo PNG final.

## Cómo Funciona

### Proceso de Generación

1. **Cálculo de dimensiones**
   ```javascript
   pixelWidth = cmWidth × DPI / 2.54
   pixelHeight = cmHeight × DPI / 2.54
   ```

2. **Proyección de Mercator (Web Mercator)**
    - Convierte coordenadas GPS (lat/lng) a coordenadas de teselas (x/y).
   ```javascript
   lng2t(lng, zoom) = (lng + 180) / 360 × 2^zoom
   lat2t(lat, zoom) = (1 - log[tan(lat×π/180) + sec(lat×π/180)] / π) / 2 × 2^zoom
   ```

3. **Carga de teselas (Tiles)**
    - Determina qué teselas de mapa son necesarias según el encuadre.
    - Descarga teselas de 512×512px de CartoDB.
    - Las dibuja en el canvas en la posición correcta.

4. **Renderizado del trazado**
    - Descarga el GeoJSON del circuito desde jsDelivr.
    - Convierte coordenadas GPS a píxeles usando la proyección de Mercator.
    - Dibuja con sombra blanca + línea negra para máximo contraste.

5. **Texto e información**
    - Nombre del circuito (grande, negrita).
    - País y bandera.
    - Detalles: Primer GP, longitud, número de vueltas.

6. **Exportación**
    - Convierte el canvas a PNG usando `toDataURL()`.
    - Disparo automático de descarga con nombre descriptivo.

### Arquitectura

```
Usuario selecciona circuito
        ↓
CircuitMap (MapLibre GL)
        ↓
PosterControls (Radix UI)
        ↓
PosterGenerator (Canvas API)
   ↙          ↘
CartoDB      F1 Circuits
Tiles API    GeoJSON API
   ↘          ↙
PosterCanvas (Previsualización)
        ↓
Descargar PNG
```

## Configuración Avanzada

### Agregar Nuevos Circuitos

Edita `src/data/circuits.json`:
```json
{
  "id": "nuevo-circuito",
  "name": "Nombre del Circuito",
  "displayName": "Gran Premio del País",
  "lng": 0.0000,
  "lat": 0.0000,
  "country": "País",
  "firstGP": 2026,
  "length": "5.5",
  "laps": 60,
  "image": "[https://url-de-imagen.jpg](https://url-de-imagen.jpg)",
  "geojsonId": "id-del-geojson"
}
```

### Agregar Nuevos Idiomas

1. Crea un nuevo archivo en `src/i18n/locales/{código}.json`.
2. Copia la estructura de `en.json` o `es.json`.
3. Traduce todos los textos.
4. Agrega el idioma en `src/i18n/config.js`:
```javascript
resources: {
  es: { translation: es },
  en: { translation: en },
  fr: { translation: fr } // Nuevo idioma
}
```

### Personalizar Estilos de Mapa

Modifica las URLs en `src/components/PosterGenerator.jsx`:
```javascript
const tileUrl = `https://a.basemaps.cartocdn.com/${mapStyle}/{z}/{x}/{y}@2x.png`;
```

Estilos alternativos de CartoDB:
- `light_nolabels` / `light_all` / `light_only_labels`
- `dark_nolabels` / `dark_all` / `dark_only_labels`
- `rastertiles/voyager` / `rastertiles/voyager_nolabels`

## Roadmap

- [ ] Soporte para más estilos de mapa (satélite, terreno).
- [ ] Guardar configuraciones favoritas (localStorage).
- [ ] Galería de ejemplos pre-generados.
- [ ] Exportación en formatos adicionales (SVG, PDF).
- [ ] Editor de texto avanzado (fuentes personalizadas, colores).
- [ ] Modo de comparación de circuitos (lado a lado).
- [ ] Compartir configuraciones vía URL.
- [ ] Integración con redes sociales.

## Tecnologías y Librerías

### Dependencias de Producción
```json
{
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-slider": "^1.3.6",
  "@radix-ui/react-slot": "^1.2.4",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "i18next": "^26.0.3",
  "i18next-browser-languagedetector": "^8.2.1",
  "lucide-react": "^1.7.0",
  "maplibre-gl": "^5.22.0",
  "motion": "^12.38.0",
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "react-i18next": "^17.0.2",
  "tailwind-merge": "^3.5.0"
}
```

### Dependencias de Desarrollo
```json
{
  "@eslint/js": "^9.39.4",
  "@tailwindcss/vite": "^4.2.2",
  "@types/react": "^19.2.14",
  "@types/react-dom": "^19.2.3",
  "@vitejs/plugin-react": "^6.0.1",
  "eslint": "^9.39.4",
  "eslint-plugin-react-hooks": "^7.0.1",
  "eslint-plugin-react-refresh": "^0.5.2",
  "globals": "^17.4.0",
  "tailwindcss": "^4.2.2",
  "vite": "^8.0.1"
}
```

## Solución de Problemas

### Las teselas del mapa no cargan
- Verifica tu conexión a internet.
- Revisa la consola del navegador por errores de CORS.
- Intenta con un estilo de mapa diferente.

### El póster se ve borroso
- Incrementa los DPI a 300 o 600.
- Verifica que las dimensiones no sean demasiado grandes.
- Asegúrate de descargar la versión "High-Res", no la miniatura de previsualización.

### El trazado del circuito no aparece
- Verifica que el `geojsonId` en `circuits.json` sea correcto.
- Comprueba que el archivo GeoJSON exista en el CDN.
- Revisa la consola por errores de red (404).

### La aplicación no inicia
```bash
# Limpiar node_modules y reinstalar
rm -rf node_modules package-lock.json
npm install

# Limpiar caché de Vite
rm -rf .vite
npm run dev
```

## Créditos

- **F1 Circuits GeoJSON**: [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits)
- **Map tiles**: [CartoDB](https://carto.com/basemaps)
- **Iconos**: [Lucide Icons](https://lucide.dev)
- **Componentes de UI**: [Radix UI](https://www.radix-ui.com)

## Autor

Creado por Ignacio Pedemonte Berthoud - [@ipedemonteb](https://github.com/ipedemonteb)