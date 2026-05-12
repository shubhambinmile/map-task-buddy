import { useEffect, useState } from "react";
import { users, tasks } from "@/data/locations";

export function LocationsMap() {
  const [Comp, setComp] = useState<null | {
    MapContainer: any;
    TileLayer: any;
    Marker: any;
    Popup: any;
    icon: any;
  }>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rl = await import("react-leaflet");
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!mounted) return;
      setComp({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        Marker: rl.Marker,
        Popup: rl.Popup,
        icon: L.icon,
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!Comp) {
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Loading map…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, icon } = Comp;

  const userIcon = icon({
    iconUrl:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='32' height='42' viewBox='0 0 32 42'><path d='M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0z' fill='#2563eb'/><circle cx='16' cy='16' r='6' fill='white'/></svg>`,
      ),
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -38],
  });

  const taskIcon = icon({
    iconUrl:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='38' viewBox='0 0 32 42'><path d='M16 0C7.2 0 0 7.2 0 16c0 11 16 26 16 26s16-15 16-26C32 7.2 24.8 0 16 0z' fill='#dc2626'/><circle cx='16' cy='16' r='6' fill='white'/></svg>`,
      ),
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -34],
  });

  const all = [...users.map((u) => u.location), ...tasks.map((t) => t.location)];
  const center: [number, number] = [
    all.reduce((s, p) => s + p.lat, 0) / all.length,
    all.reduce((s, p) => s + p.lng, 0) / all.length,
  ];

  return (
    <MapContainer center={center} zoom={10} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {users.map((u) => (
        <Marker key={u.id} position={[u.location.lat, u.location.lng]} icon={userIcon}>
          <Popup>
            <div className="font-semibold">User {u.id}</div>
            <div className="text-xs">
              {u.location.lat.toFixed(4)}, {u.location.lng.toFixed(4)}
            </div>
          </Popup>
        </Marker>
      ))}
      {tasks.map((t) => (
        <Marker key={t.id} position={[t.location.lat, t.location.lng]} icon={taskIcon}>
          <Popup>
            <div className="font-semibold">Task {t.id}</div>
            <div className="text-xs">
              {t.location.lat.toFixed(4)}, {t.location.lng.toFixed(4)}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
