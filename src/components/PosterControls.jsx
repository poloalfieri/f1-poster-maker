import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { useTranslation } from 'react-i18next';
import {Download, Sparkles, Settings, Image, Type, Palette, Ruler, Move, Lightbulb} from 'lucide-react';

export function PosterControls({
  settings,
  onSettingChange,
  onGenerate,
  isGenerating,
  progress,
  onDownload,
  hasPreview,
  isFreeMap,
}) {
  const { t } = useTranslation();

  // Controles organizados: algunos en grid de 2 columnas, otros full width
  const controlLayout = [
    ...(isFreeMap ? [
      {
        type: 'single',
        control: {
          label: t('controls.customTitle'),
          id: 'customTitle',
          type: 'text',
          icon: Type,
          placeholder: t('controls.customTitlePlaceholder'),
        }
      },
      {
        type: 'single',
        control: {
          label: t('controls.customSubtitle'),
          id: 'customSubtitle',
          type: 'text',
          icon: Type,
          placeholder: t('controls.customSubtitlePlaceholder'),
        }
      },
    ] : []),
    {
      type: 'grid', // Grid de 2 columnas
      controls: [
        {
          label: t('controls.width'),
          id: 'posterWidth',
          type: 'number',
          icon: Ruler,
          min: 20,
          max: 100,
          step: 1,
          showValue: false,
        },
        {
          label: t('controls.height'),
          id: 'posterHeight',
          type: 'number',
          icon: Ruler,
          min: 20,
          max: 140,
          step: 1,
          showValue: false,
        },
      ]
    },
    {
      type: 'single',
      control: {
        label: t('controls.dpi'),
        id: 'dpi',
        type: 'select',
        icon: Image,
        options: [
          { value: 150, label: t('controls.dpiOptions.fast') },
          { value: 300, label: t('controls.dpiOptions.print') },
          { value: 600, label: t('controls.dpiOptions.high') },
        ]
      }
    },
    {
      type: 'single',
      control: {
        label: t('controls.mapStyle'),
        id: 'mapStyle',
        type: 'select',
        icon: Palette,
        options: [
          { value: 'light_nolabels', label: t('controls.mapStyleOptions.minimal') },
          { value: 'light_all', label: t('controls.mapStyleOptions.streets') },
          { value: 'dark_all', label: t('controls.mapStyleOptions.dark') },
        ]
      }
    },
    {
      type: 'single',
      control: {
        label: t('controls.zoom'),
        id: 'zoom',
        type: 'range',
        icon: Settings,
        min: 12,
        max: 20,
        step: 0.1,
        showValue: true,
      }
    },
    {
      type: 'grid', // Grid de 2 columnas para lat/lng
      controls: [
        {
          label: t('controls.latitude'),
          id: 'latOffset',
          type: 'range',
          icon: Move,
          min: -0.02,
          max: 0.02,
          step: 0.001,
          showValue: true,
        },
        {
          label: t('controls.longitude'),
          id: 'lngOffset',
          type: 'range',
          icon: Move,
          min: -0.02,
          max: 0.02,
          step: 0.001,
          showValue: true,
        },
      ]
    },
    {
      type: 'single',
      control: {
        label: t('controls.trackWidth'),
        id: 'trackWidth',
        type: 'range',
        icon: Settings,
        min: 2,
        max: 15,
        step: 1,
        showValue: true,
      }
    },
    {
      type: 'single',
      control: {
        label: t('controls.textSize'),
        id: 'textSize',
        type: 'range',
        icon: Type,
        min: 0.5,
        max: 1.4,
        step: 0.1,
        showValue: true,
      }
    },
    {
      type: 'single',
      control: {
        label: t('controls.includeText'),
        id: 'showText',
        type: 'boolean',
        icon: Type,
        options: [
          { value: true, label: t('controls.textOptions.yes') },
          { value: false, label: t('controls.textOptions.no') },
        ]
      }
    },
    {
      type: 'single',
      control: {
        label: t('controls.mapBorder'),
        id: 'borderWidth',
        type: 'select',
        icon: Settings,
        options: [
          { value: 0, label: t('controls.borderOptions.none') },
          { value: 1, label: t('controls.borderOptions.thin') },
          { value: 2, label: t('controls.borderOptions.medium') },
          { value: 3, label: t('controls.borderOptions.thick') },
        ]
      }
    },
  ];

  const renderControl = (control) => {
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

        {control.type === 'text' && (
          <Input
            type="text"
            value={settings[control.id]}
            placeholder={control.placeholder}
            onChange={(e) => onSettingChange(control.id, e.target.value)}
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
  };

  return (
    <div className="space-y-4">
      {/* Controls Card */}
      <div className="bg-white dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 px-5 py-3.5">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Settings className="w-4 h-4" />
            {t('controls.header')}
          </h3>
          <p className="text-zinc-300 text-xs mt-0.5">
            {t('controls.subtitle')}
          </p>
        </div>
        
        <div className="p-5 space-y-4">
          {controlLayout.map((item, index) => {
            if (item.type === 'grid') {
              // Grid de 2 columnas
              return (
                <div key={index} className="grid grid-cols-2 gap-3">
                  {item.controls.map(control => renderControl(control))}
                </div>
              );
            } else {
              // Control individual full width
              return renderControl(item.control);
            }
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2.5">
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-zinc-900 to-zinc-800 hover:from-zinc-800 hover:to-zinc-700 dark:from-zinc-100 dark:to-zinc-200 dark:hover:from-zinc-200 dark:hover:to-zinc-300 text-white dark:text-zinc-900 font-bold py-5 text-sm shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isGenerating ? t('controls.generatingButton', { progress }) : t('controls.generateButton')}
        </Button>

        {hasPreview && (
          <Button
            onClick={onDownload}
            disabled={isGenerating}
            variant="outline"
            className="w-full border-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 font-semibold py-5 text-sm transition-all duration-200 disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {t('controls.downloadButton')}
          </Button>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex gap-2.5">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 flex items-center justify-center">
              <Lightbulb className="size-5 text-white">💡</Lightbulb>
            </div>
          </div>
          <div className="space-y-1.5 text-xs text-blue-900 dark:text-blue-200">
            <p className="font-semibold">{t('controls.tips.header')}</p>
            <ul className="space-y-0.5 text-xs leading-relaxed">
              <li>• {t('controls.tips.sizes')}</li>
              <li>• {t('controls.tips.dpi')}</li>
              <li>• {t('controls.tips.zoom')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
