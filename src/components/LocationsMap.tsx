import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_CONFIG,
  type Category,
  type LatLng,
  type Simulation,
  type User,
} from "@/lib/routing";

type LeafletMods = {
  MapContainer: any;
  TileLayer: any;
  Marker: any;
  Popup: any;
  Polyline: any;
  Polygon: any;
  CircleMarker: any;
  Circle: any;
  Tooltip: any;
  useMapEvents: any;
  divIcon: any;
};

function ClickHandler({
  useMapEvents,
  onPick,
}: {
  useMapEvents: any;
  onPick?: (c: LatLng) => void;
}) {
  useMapEvents({
    click(e: any) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function LocationsMap({
  simulation,
  visibleUsers,
  visibleCategories,
  showRoutes,
  showTerritories,
  showStopNumbers,
  showOverlap,
  showBorderTasks,
  showSpread,
  center,
  radiusKm,
  pickMode,
  onPickCenter,
}: {
  simulation: Simulation;
  visibleUsers: Set<string>;
  visibleCategories: Set<Category>;
  showRoutes: boolean;
  showTerritories: boolean;
  showStopNumbers: boolean;
  showOverlap: boolean;
  showBorderTasks: boolean;
  showSpread: boolean;
  center: LatLng;
  radiusKm: number;
  pickMode?: boolean;
  onPickCenter?: (c: LatLng) => void;
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
        Polygon: rl.Polygon,
        CircleMarker: rl.CircleMarker,
        Circle: rl.Circle,
        Tooltip: rl.Tooltip,
        useMapEvents: rl.useMapEvents,
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
        width:24px;height:24px;border-radius:50%;
        box-shadow:0 0 0 4px rgba(0,0,0,.18);
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;color:hsl(var(--foreground));
      ">⌂</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
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
    Polygon,
    CircleMarker,
    Circle,
    Tooltip,
    useMapEvents,
    divIcon,
  } = L;

  const visible = simulation.users.filter((u) => visibleUsers.has(u.id));

  const radiusByCat: Record<Category, number> = {
    A: 3,
    C: 4,
    B: 5,
    D: 7,
  };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={9}
      preferCanvas
      style={{
        height: "100%",
        width: "100%",
        cursor: pickMode ? "crosshair" : undefined,
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {pickMode && (
        <ClickHandler useMapEvents={useMapEvents} onPick={onPickCenter} />
      )}

      <Circle
        center={[center.lat, center.lng]}
        radius={radiusKm * 1000}
        pathOptions={{
          color: "hsl(var(--foreground))",
          weight: 1,
          opacity: 0.4,
          fillOpacity: 0.03,
          dashArray: "4 4",
        }}
      />

      {/* Territory hulls */}
      {showTerritories &&
        visible.map((u: User) =>
          u.hull.length >= 3 ? (
            <Polygon
              key={`hull-${u.id}`}
              positions={u.hull.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{
                color: u.color,
                weight: 1,
                opacity: 0.6,
                fillColor: u.color,
                fillOpacity: 0.08,
              }}
            />
          ) : null,
        )}

      {/* Routes */}
      {showRoutes &&
        visible.map((u: User) => {
          const pts: [number, number][] = [
            [center.lat, center.lng],
            ...u.optimizedRoute.map(
              (t) => [t.location.lat, t.location.lng] as [number, number],
            ),
            [center.lat, center.lng],
          ];
          return (
            <Polyline
              key={`line-${u.id}`}
              positions={pts}
              pathOptions={{ color: u.color, weight: 2.5, opacity: 0.85 }}
            />
          );
        })}

      {/* Task markers */}
      {visible.map((u: User) =>
        u.optimizedRoute
          .filter((t) => visibleCategories.has(t.category))
          .map((t, idx) => {
            const cfg = CATEGORY_CONFIG[t.category];
            return (
              <CircleMarker
                key={`${u.id}-${t.id}`}
                center={[t.location.lat, t.location.lng]}
                radius={radiusByCat[t.category]}
                pathOptions={{
                  color: u.color,
                  fillColor: cfg.color,
                  fillOpacity: 0.95,
                  weight: 1.5,
                }}
              >
                <Tooltip direction="top" offset={[0, -4]} opacity={0.9}>
                  {u.id} · #{idx + 1} · {t.id} · {t.category}
                </Tooltip>
                <Popup>
                  <div className="text-xs leading-relaxed">
                    <div className="font-semibold">{t.id}</div>
                    <div>Category: {t.category} (×{t.workloadWeight})</div>
                    <div>Est. hours: {t.avgCompletionHours}h</div>
                    <div>User: {u.id}</div>
                    <div>Cluster: {t.clusterId}</div>
                    <div>Stop #: {idx + 1}</div>
                    <div>Leg: {(t.travelDistance ?? 0).toFixed(2)} km</div>
                    <div>From center: {t.centerDistance.toFixed(2)} km</div>
                    <div>
                      {t.location.lat.toFixed(4)}, {t.location.lng.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          }),
      )}

      {/* Stop numbers (only when soloing few users to avoid clutter) */}
      {showStopNumbers &&
        visible.length <= 3 &&
        visible.map((u: User) =>
          u.optimizedRoute
            .filter((t) => visibleCategories.has(t.category))
            .map((t, idx) => (
              <Marker
                key={`num-${u.id}-${t.id}`}
                position={[t.location.lat, t.location.lng]}
                icon={divIcon({
                  className: "",
                  html: `<div style="
                    transform:translate(8px,-18px);
                    background:${u.color};color:white;
                    font-size:10px;font-weight:700;
                    padding:1px 5px;border-radius:8px;
                    border:1px solid rgba(255,255,255,.5);
                    box-shadow:0 1px 3px rgba(0,0,0,.3);
                  ">${idx + 1}</div>`,
                  iconSize: [0, 0],
                  iconAnchor: [0, 0],
                })}
                interactive={false}
              />
            )),
        )}

      {/* User centroid markers */}
      {showTerritories &&
        visible.map((u: User) =>
          u.assignedTasks.length > 0 ? (
            <CircleMarker
              key={`cent-${u.id}`}
              center={[u.centroid.lat, u.centroid.lng]}
              radius={6}
              pathOptions={{
                color: "white",
                weight: 2,
                fillColor: u.color,
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                {u.id} territory · {u.assignedTasks.length} jobs · workload{" "}
                {u.totalWorkload.toFixed(2)}
              </Tooltip>
            </CircleMarker>
          ) : null,
        )}

      <Marker position={[center.lat, center.lng]} icon={centerIcon}>
        <Popup>
          <div className="text-xs">
            <div className="font-semibold">Center / Origin</div>
            <div>
              {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
            </div>
            <div>Radius: {radiusKm} km</div>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
