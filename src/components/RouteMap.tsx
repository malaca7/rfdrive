import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons (Leaflet + bundlers issue)
const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Coords {
  lat: number;
  lon: number;
}

interface RouteMapProps {
  origem: Coords;
  destino: Coords;
}

// Auto-fit bounds when coords change
const FitBounds: React.FC<{ origem: Coords; destino: Coords }> = ({ origem, destino }) => {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds(
      [origem.lat, origem.lon],
      [destino.lat, destino.lon],
    );
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, origem, destino]);

  return null;
};

const RouteMap: React.FC<RouteMapProps> = ({ origem, destino }) => {
  const center: [number, number] = [
    (origem.lat + destino.lat) / 2,
    (origem.lon + destino.lon) / 2,
  ];

  const polyline: [number, number][] = [
    [origem.lat, origem.lon],
    [destino.lat, destino.lon],
  ];

  return (
    <div className="rounded-xl overflow-hidden border border-border/50 h-[45vw] sm:h-[220px] max-h-[280px]">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom={false}
        dragging={true}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[origem.lat, origem.lon]} icon={originIcon} />
        <Marker position={[destino.lat, destino.lon]} icon={destIcon} />
        <Polyline
          positions={polyline}
          pathOptions={{ color: '#6366f1', weight: 4, dashArray: '8, 8' }}
        />
        <FitBounds origem={origem} destino={destino} />
      </MapContainer>
    </div>
  );
};

export default RouteMap;
