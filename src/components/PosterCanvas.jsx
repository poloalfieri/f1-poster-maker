import { Loader2, ImageIcon } from 'lucide-react';

export function PosterCanvas({ canvasRef, isGenerating, progress }) {
  return (
    <div className="sticky top-6">
      <div className="bg-white dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-lg">
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-900 px-4 py-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Vista Previa
          </h3>
        </div>

        <div className="p-4 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
          <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden border-2 border-white dark:border-zinc-800">
            {!canvasRef.current?.width && !isGenerating ? (
              <div className="aspect-[5/7] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
                <div className="mb-4 p-4 bg-white dark:bg-zinc-800 rounded-xl shadow">
                  <svg
                    className="w-12 h-12 text-zinc-300 dark:text-zinc-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 text-center mb-1">
                  Listo para crear
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
                  Ajusta los controles y genera
                </p>
              </div>
            ) : (
              <div className="relative aspect-[5/7] bg-zinc-100 dark:bg-zinc-900">
                {isGenerating && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-zinc-900/95 z-10 backdrop-blur-sm">
                    <div className="mb-4 relative">
                      <div className="absolute inset-0 bg-zinc-900 dark:bg-zinc-100 rounded-full blur-xl opacity-20 animate-pulse" />
                      <Loader2 className="w-12 h-12 text-zinc-900 dark:text-zinc-100 animate-spin relative" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                      Generando póster
                    </p>
                    <div className="w-48 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden border border-zinc-300 dark:border-zinc-600">
                      <div
                        className="h-full bg-gradient-to-r from-zinc-900 via-zinc-700 to-zinc-900 dark:from-zinc-100 dark:via-zinc-300 dark:to-zinc-100 transition-all duration-300 relative overflow-hidden"
                        style={{ width: `${progress}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 font-mono">
                      {progress}%
                    </p>
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain"
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-700">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <p className="flex items-center gap-1.5">
              <span className="text-zinc-400 dark:text-zinc-600">•</span>
              <span>Vista previa en baja resolución</span>
            </p>
            <p className="flex items-center gap-1.5">
              <span className="text-zinc-400 dark:text-zinc-600">•</span>
              <span>Descarga en calidad completa</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
