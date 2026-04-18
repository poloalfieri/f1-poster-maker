import './App.css'
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CircuitMap } from './components/CircuitMap'
import { StreetEditor } from './components/StreetEditor'
import { PosterGenerator } from './components/PosterGenerator'
import { BackgroundBeams } from './components/ui/background-beams'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import {Flag, Palette, Printer, Road, Map} from 'lucide-react'
import React from "react";
import xIcon from './assets/x.svg'
import xIconDark from './assets/x_dark.svg'
import githubIconLight from './assets/github_light.svg'
import githubIconDark from './assets/github_dark.svg'
import {Analytics} from "@vercel/analytics/react";

function App() {
  const { t } = useTranslation();
  const [mode, setMode] = useState('circuits');
  const [selectedItem, setSelectedItem] = useState(null);
  const generatorRef = useRef(null);

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setTimeout(() => {
      generatorRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setSelectedItem(null);
  };

  return (
      <>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
          {/* Hero Section */}
          <section className="relative px-6 py-12">
            <div className="max-w-7xl mx-auto w-full">
              {/* Language Switcher - Top Right */}
              <div className="absolute top-0 right-6 z-20 pointer-events-auto">
                <LanguageSwitcher />
              </div>

              {/* Header - Text */}
              <div className="relative z-10 text-center mb-8 pointer-events-none">
                <div className="inline-block mb-4">
                  <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400 tracking-wider">
                    {t('hero.formula1')}
                  </span>
                </div>

                <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-4">
                  <span className="text-zinc-900 dark:text-zinc-100">{t('hero.circuit')}</span>
                  <span className="text-zinc-900 dark:text-zinc-100"> </span>
                  <span className="text-zinc-400 dark:text-zinc-600">{t('hero.posters')}</span>
                </h1>

                <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto font-light">
                  {t('hero.subtitle')}
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="relative z-10 flex justify-center gap-2 mb-6 pointer-events-auto">
                <button
                  onClick={() => handleModeChange('circuits')}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                    mode === 'circuits'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {t('mode.circuits')}
                </button>
                <button
                  onClick={() => handleModeChange('freeMap')}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                    mode === 'freeMap'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md'
                      : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Map className="w-3.5 h-3.5" />
                  {t('mode.freeMap')}
                </button>
              </div>

              <BackgroundBeams />

              {/* Map - Full width below */}
              <div className="w-full relative z-10">
                {mode === 'circuits' ? (
                  <CircuitMap onCircuitSelect={handleItemSelect} />
                ) : (
                  <StreetEditor onMapSelect={handleItemSelect} />
                )}
              </div>
            </div>
          </section>

          {/* Generator Section */}
          <section ref={generatorRef} className="py-24 px-6 bg-white dark:bg-zinc-900">
            <div className="max-w-7xl mx-auto">
              {selectedItem ? (
                <PosterGenerator circuit={selectedItem} />
              ) : (
                <div className="text-center py-20">
                  <div className="inline-block p-6 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-6">
                    {mode === 'circuits'
                      ? <Road className="w-16 h-16 text-zinc-400 dark:text-zinc-600" />
                      : <Map className="w-16 h-16 text-zinc-400 dark:text-zinc-600" />
                    }
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                    {mode === 'circuits' ? t('emptyState.title') : t('emptyState.titleFreeMap')}
                  </h2>
                  <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                    {mode === 'circuits' ? t('emptyState.description') : t('emptyState.descriptionFreeMap')}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Features */}
          <section className="py-24 px-6 bg-zinc-50 dark:bg-zinc-950">
            <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <Flag className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t('features.allCircuits.title')}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {t('features.allCircuits.description')}
                </p>
              </div>

              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <Palette className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t('features.customizable.title')}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {t('features.customizable.description')}
                </p>
              </div>

              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <Printer className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {t('features.highQuality.title')}
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {t('features.highQuality.description')}
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-12 px-6 border-t border-zinc-200 dark:border-zinc-800">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-mono mb-4">
                {t('footer.copyright')}
              </p>
              <div className="flex items-center justify-center gap-4">
                <a
                  href="https://x.com/nacho_pedemonte"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={t('footer.twitter')}
                >
                  <img src={xIcon} alt="X" className="w-5 h-5 dark:hidden" />
                  <img src={xIconDark} alt="X" className="w-5 h-5 hidden dark:block" />
                </a>
                <a
                  href="https://github.com/ipedemonteb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                  aria-label={t('footer.github')}
                >
                  <img src={githubIconLight} alt="GitHub" className="w-5 h-5 dark:hidden" />
                  <img src={githubIconDark} alt="GitHub" className="w-5 h-5 hidden dark:block" />
                </a>
              </div>
            </div>
          </footer>
        </div>
        <Analytics />
      </>
  )
}

export default App
