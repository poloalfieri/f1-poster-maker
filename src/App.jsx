import './App.css'
import { useState, useRef } from 'react'
import { CircuitMap } from './components/CircuitMap'
import { PosterGenerator } from './components/PosterGenerator'
import { BackgroundBeams } from './components/ui/background-beams'
import { Flag, Palette, Printer } from 'lucide-react'
import React from "react";

function App() {
  const [selectedCircuit, setSelectedCircuit] = useState(null);
  const generatorRef = useRef(null);

  const handleCircuitSelect = (circuit) => {
    setSelectedCircuit(circuit);
    // Scroll suave a la sección del generador
    setTimeout(() => {
      generatorRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative px-6 py-12">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header - Text */}
          <div className="relative z-10 text-center mb-12 pointer-events-none">
            <div className="inline-block mb-4">
              <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400 tracking-wider">
                FORMULA 1
              </span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter mb-4">
              <span className="text-zinc-900 dark:text-zinc-100">Circuit</span>
              <span className="text-zinc-900 dark:text-zinc-100"> </span>
              <span className="text-zinc-400 dark:text-zinc-600">Posters</span>
            </h1>
            
            <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-2xl mx-auto font-light">
              Crea posters minimalistas de tus circuitos favoritos de F1
            </p>
          </div>
          <BackgroundBeams />

          {/* Map - Full width below */}
          <div className="w-full">
            <CircuitMap onCircuitSelect={handleCircuitSelect} />
          </div>
        </div>
      </section>

      {/* Generator Section */}
      <section ref={generatorRef} className="py-24 px-6 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto">
          {selectedCircuit ? (
            <PosterGenerator circuit={selectedCircuit} />
          ) : (
            <div className="text-center py-20">
              <div className="inline-block p-6 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-6">
                <Flag className="w-16 h-16 text-zinc-400 dark:text-zinc-600" />
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                Selecciona un circuito
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 max-w-md mx-auto">
                Haz clic en cualquier circuito del mapa para comenzar a crear tu póster personalizado
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
              Todos los circuitos
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Accede a la colección completa de circuitos de la F1 en 2026.
            </p>
          </div>
          
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                <Palette className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Personalizable
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Elige colores, estilos de mapa y ajusta cada detalle.
            </p>
          </div>
          
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                <Printer className="w-8 h-8 text-zinc-900 dark:text-zinc-100" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Alta calidad
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Descarga en 300 DPI listo para imprimir.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-mono">
            F1 POSTER MAKER — 2026
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
