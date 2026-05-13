import { useEffect, useMemo, useState } from "react";
import { officeLocation, type Simulation, type User } from "@/lib/routing";

type LeafletMods = {
  MapContainer: any;
  TileLayer: any;
  Marker: any;
  Popup: any;
  Polyline: any;
  CircleMarker: any;
  Tooltip: any;
  icon: any;
  divIcon: any;
};

export function LocationsMap({
  simulation,
  visibleUsers,
}: {
  simulation: Simulation;
  visibleUsers: Set<string>;
}) {
  const [L, setL] = useState<LeafletMods | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rl = await import("react-leaflet");
      const lf = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!mounted) return;
      setL({
        MapContainer: rl.MapContainer,
        TileLayer: rl.TileLayer,
        Marker: rl.Marker,
        Popup: rl.Popup,
        Polyline: rl.Polyline,
        CircleMarker: rl.CircleMarker,
        Tooltip: rl.Tooltip,
        icon: lf.icon,
        divIcon: lf.divIcon,
      });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const centerIcon = useMemo(() => {
    if (!L) return null;
    return L.divIcon({
      className: "",
      html: `<div style="
        background:hsl(var(--background));
        border:3px solid hsl(var(--foreground));
        width:22px;height:22px;border-radius:50%;
        box-shadow:0 0 0 4px rgba(0,0,0,.15);
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;color:hsl(var(--foreground));
      ">C</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }, [L]);

  if (!L)
    return (
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        Loading map…
      </div>
    );

  const {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    CircleMarker,
    Tooltip,
  } = L;

  const visible = simulation.users.filter((u) => visibleUsers.has(u.id));

  return (
    <MapContainer
      center={[officeLocation.lat, officeLocation.lng]}
      zoom={9}
      preferCanvas
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Route polylines */}
      {visible.map((u: User) => {
        const pts: [number, number][] = [
          [officeLocation.lat, officeLocation.lng],
          ...u.optimizedRoute.map(
            (t) => [t.location.lat, t.location.lng] as [number, number],
          ),
          [officeLocation.lat, officeLocation.lng],
        ];
        return (
          <Polyline
            key={`line-${u.id}`}
            positions={pts}
            pathOptions={{ color: u.color, weight: 3, opacity: 0.85 }}
          />
        );
      })}

      {/* Task markers per user */}
      {visible.map((u: User) =>
        u.optimizedRoute.map((t, idx) => (
          <CircleMarker
            key={`${u.id}-${t.id}`}
            center={[t.location.lat, t.location.lng]}
            radius={5}
            pathOptions={{
              color: u.color,
              fillColor: u.color,
              fillOpacity: 0.95,
              weight: 1,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.9}>
              {u.id} · #{idx + 1} · {t.id}
            </Tooltip>
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">{t.id}</div>
                <div>User: {u.id}</div>
                <div>Stop #: {idx + 1}</div>
                <div>Leg: {(t.travelDistance ?? 0).toFixed(2)} km</div>
                <div>
                  {t.location.lat.toFixed(4)}, {t.location.lng.toFixed(4)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        )),
      )}

      {/* Center */}
      <Marker
        position={[officeLocation.lat, officeLocation.lng]}
        icon={centerIcon}
      >
        <Popup>
          <div className="text-xs">
            <div className="font-semibold">Center / Origin</div>
            <div>
              {officeLocation.lat.toFixed(4)}, {officeLocation.lng.toFixed(4)}
            </div>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
