import { Map, MapMarker, MarkerContent, MarkerPopup, MapControls } from './ui/map';
import { Button } from "@/components/ui/button";
import { useTranslation } from 'react-i18next';
import circuits from '@/data/circuits.json';

export function CircuitMap({ onCircuitSelect }) {
  const { t } = useTranslation();
  
  const handleCreatePoster = (circuit) => {
    if (!circuit.geojsonId) {
      alert(t('map.alert'));
      return;
    }
    onCircuitSelect(circuit);
  };

  return (
    <div className="w-full h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
      <Map center={[7.4260, 43.7368]} zoom={1}>
        {circuits.map((circuit) => (
          <MapMarker
            key={circuit.id}
            longitude={circuit.lng}
            latitude={circuit.lat}
          >
            <MarkerContent>
              <div className="bg-zinc-900 dark:bg-zinc-100 size-4 rounded-full border-2 border-white dark:border-zinc-900 shadow-lg cursor-pointer hover:scale-125 transition-all duration-200 animate-pulse" />
            </MarkerContent>
            <MarkerPopup className="p-0 w-64 border-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 bg-zinc-50">
              <div className="relative overflow-hidden max-h-26 rounded-t-md">
                <img
                    src={circuit.image}
                    alt={circuit.name}
                    className="object-cover"
                />
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 leading-tight mb-1">
                    {circuit.name}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wide">
                    {circuit.country}
                  </p>
                </div>
                <Button
                  onClick={() => handleCreatePoster(circuit)}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900"
                  size="sm"
                >
                  {t('map.createButton')}
                </Button>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
        <MapControls />
      </Map>
    </div>
  );
}
