import './App.css'
import { CircuitMap } from './components/CircuitMap'

function App() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative px-6 py-12">
        <div className="max-w-7xl mx-auto w-full">
          {/* Header - Text */}
          <div className="text-center mb-12">
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

          {/* Map - Full width below */}
          <div className="w-full">
            <CircuitMap />
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section className="py-24 px-6 bg-white dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-mono text-zinc-500 dark:text-zinc-400 tracking-wider">
              EJEMPLO
            </span>
            <h2 className="text-5xl font-bold text-zinc-900 dark:text-zinc-100 mt-4 tracking-tight">
              Monaco 1950
            </h2>
          </div>
          
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl aspect-[5/7] flex items-center justify-center">
            <span className="text-zinc-400 dark:text-zinc-600 font-mono text-sm">
              [Preview del circuito]
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-12">
          <div className="text-center">
            <div className="text-4xl mb-4">🏁</div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Todos los circuitos
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Accede a la colección completa de circuitos históricos de F1
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl mb-4">🎨</div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Personalizable
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Elige colores, estilos de mapa y ajusta cada detalle
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl mb-4">📐</div>
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Alta calidad
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              Descarga en 300 DPI listo para imprimir
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
