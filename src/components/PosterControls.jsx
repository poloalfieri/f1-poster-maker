import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Download, Sparkles, Settings, Image, Type, Palette, Ruler, Move } from 'lucide-react';

export function PosterControls({ 
  settings, 
  onSettingChange, 
  onGenerate, 
  isGenerating, 
  progress,
  onDownload,
  hasPreview 
}) {
  const controlGroups = [
    {
      label: 'Ancho del Póster (cm)',
      id: 'posterWidth',
      type: 'number',
      icon: Ruler,
      min: 20,
      max: 100,
      step: 1,
      showValue: false,
    },
    {
      label: 'Alto del Póster (cm)',
      id: 'posterHeight',
      type: 'number',
      icon: Ruler,
      min: 20,
      max: 140,
      step: 1,
      showValue: false,
    },
    {
      label: 'DPI (Calidad)',
      id: 'dpi',
      type: 'select',
      icon: Image,
      options: [
        { value: 150, label: '150 DPI (Rápido)' },
        { value: 300, label: '300 DPI (Impresión)' },
        { value: 600, label: '600 DPI (Alta calidad)' },
      ]
    },
    {
      label: 'Estilo de Mapa',
      id: 'mapStyle',
      type: 'select',
      icon: Palette,
      options: [
        { value: 'light_nolabels', label: 'Minimalista (Sin etiquetas)' },
        { value: 'light_all', label: 'Con nombres de calles' },
        { value: 'dark_all', label: 'Modo Oscuro' },
      ]
    },
    {
      label: 'Zoom (Encuadre)',
      id: 'zoom',
      type: 'range',
      icon: Settings,
      min: 12,
      max: 20,
      step: 0.1,
      showValue: true,
    },
    {
      label: 'Desplazamiento Latitud',
      id: 'latOffset',
      type: 'range',
      icon: Move,
      min: -0.02,
      max: 0.02,
      step: 0.001,
      showValue: true,
    },
    {
      label: 'Desplazamiento Longitud',
      id: 'lngOffset',
      type: 'range',
      icon: Move,
      min: -0.02,
      max: 0.02,
      step: 0.001,
      showValue: true,
    },
    {
      label: 'Grosor Pista',
      id: 'trackWidth',
      type: 'range',
      icon: Settings,
      min: 2,
      max: 15,
      step: 1,
      showValue: true,
    },
    {
      label: 'Tamaño de Texto',
      id: 'textSize',
      type: 'range',
      icon: Type,
      min: 0.5,
      max: 1.4,
      step: 0.1,
      showValue: true,
    },
    {
      label: 'Incluir Texto',
      id: 'showText',
      type: 'boolean',
      icon: Type,
      options: [
        { value: true, label: 'Sí, generar leyenda' },
        { value: false, label: 'No, solo espacio blanco' },
      ]
    },
    {
      label: 'Borde Decorativo Mapa',
      id: 'borderWidth',
      type: 'select',
      icon: Settings,
      options: [
        { value: 0, label: 'Sin borde' },
        { value: 1, label: 'Borde fino (1px)' },
        { value: 2, label: 'Borde medio (2px)' },
        { value: 3, label: 'Borde grueso (3px)' },
      ]
    },
  ];

  return (
    <div className="space-y-4">
      {/* Controls Card */}
      <div className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 px-5 py-3.5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Personalización
          </h3>
          <p className="text-zinc-300 text-xs mt-0.5">
            Ajusta cada detalle de tu póster
          </p>
        </div>
        
        <div className="p-5 space-y-4">
          {controlGroups.map((control) => {
            const Icon = control.icon;
            return (
              <div key={control.id} className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <Icon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  {control.label}
                  {control.showValue && (
                    <span className="ml-auto text-zinc-600 dark:text-zinc-300 font-mono text-xs bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 rounded">
                      {settings[control.id]}
                    </span>
                  )}
                </label>

                {control.type === 'select' && (
                  <Select
                    value={String(settings[control.id])}
                    onValueChange={(value) => {
                      // Convertir a número si es DPI o borderWidth
                      const parsedValue = (control.id === 'dpi' || control.id === 'borderWidth') 
                        ? parseInt(value) 
                        : value;
                      onSettingChange(control.id, parsedValue);
                    }}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {control.options.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {control.type === 'number' && (
                  <Input
                    type="number"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={settings[control.id]}
                    onChange={(e) => onSettingChange(control.id, parseFloat(e.target.value))}
                    className="w-full h-9 text-xs"
                  />
                )}

                {control.type === 'boolean' && (
                  <Select
                    value={String(settings[control.id])}
                    onValueChange={(value) => onSettingChange(control.id, value === 'true')}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {control.options.map((option) => (
                        <SelectItem key={String(option.value)} value={String(option.value)} className="text-xs">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {control.type === 'range' && (
                  <div className="pt-2 pb-1">
                    <Slider
                      min={control.min}
                      max={control.max}
                      step={control.step}
                      value={[settings[control.id]]}
                      onValueChange={(value) => onSettingChange(control.id, value[0])}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      {isGenerating && (
        <div className="bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden border border-zinc-200 dark:border-zinc-700">
          <div
            className="h-full bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-100 transition-all duration-300 relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-2.5">
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-zinc-800 hover:to-zinc-700 dark:from-zinc-100 dark:to-zinc-200 dark:hover:from-zinc-200 dark:hover:to-zinc-300 text-white dark:text-zinc-900 font-bold py-5 text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? `Generando... ${progress}%` : 'Generar Póster'}
        </Button>

        {hasPreview && (
          <Button
            onClick={onDownload}
            disabled={isGenerating}
            variant="outline"
            className="w-full border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 font-semibold py-5 text-sm transition-all duration-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar Póster
          </Button>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex gap-2.5">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
              <span className="text-base">💡</span>
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-blue-900 dark:text-blue-200">
            <p className="font-semibold">Tips para el mejor resultado:</p>
            <ul className="space-y-0.5 text-xs leading-relaxed">
              <li>• Tamaños comunes: 40×56, 30×42, 50×70 cm</li>
              <li>• 300 DPI es ideal para impresión profesional</li>
              <li>• Ajusta el zoom para encuadrar el circuito perfectamente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
