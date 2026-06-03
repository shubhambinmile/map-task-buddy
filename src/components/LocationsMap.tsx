import { useEffect, useMemo, useState } from "react";
import {
  CATEGORY_CONFIG,
  PRIORITY_COLORS,
  type LatLng,
  type Region,
  type SimulationState,
  type Territory,
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

export type MapFilters = {
  regionId?: string | null;
  installerId?: string | null;
  showRegions: boolean;
  showTerritories: boolean;
  showRoutes: boolean;
  showReserve: boolean;
  showCore: boolean;
  showPriorityOnly: boolean;
  showAnchors: boolean;
  showBorders: boolean;
};

export function LocationsMap({
  state,
  filters,
  pickMode,
  onPickCenter,
}: {
  state: SimulationState;
  filters: MapFilters;
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
      html: `<div style="background:white;border:3px solid #111;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#111;box-shadow:0 0 0 4px rgba(0,0,0,.15)">B</div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
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
  } = L;

  const installerColorById = new Map(state.installers.map((i) => [i.id, i.color]));
  const territoryById = new Map(state.territories.map((t) => [t.id, t]));

  const visibleTerritory = (t: Territory) => {
    if (filters.regionId && t.regionId !== filters.regionId) return false;
    if (filters.installerId && t.installerId !== filters.installerId) return false;
    return true;
  };
  const visibleRegion = (r: Region) =>
    !filters.regionId || r.id === filters.regionId;

  return (
    <MapContainer
      center={[state.center.lat, state.center.lng]}
      zoom={9}
      preferCanvas
      style={{ height: "100%", width: "100%", cursor: pickMode ? "crosshair" : undefined }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pickMode && <ClickHandler useMapEvents={useMapEvents} onPick={onPickCenter} />}

      <Circle
        center={[state.center.lat, state.center.lng]}
        radius={state.radiusKm * 1000}
        pathOptions={{ color: "#444", weight: 1, opacity: 0.35, fillOpacity: 0.02, dashArray: "4 4" }}
      />

      {/* Regions (convex hull on all region jobs) */}
      {filters.showRegions &&
        state.regions.filter(visibleRegion).map((r) => {
          const pts = r.jobs.map((j) => ({ lat: j.lat, lng: j.lng }));
          if (pts.length < 3) return null;
          // simple convex hull via Andrew's monotone chain inline
          const sorted = [...pts].sort((a, b) =>
            a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng,
          );
          const cross = (o: LatLng, a: LatLng, b: LatLng) =>
            (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
          const lower: LatLng[] = [];
          for (const p of sorted) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
              lower.pop();
            lower.push(p);
          }
          const upper: LatLng[] = [];
          for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
              upper.pop();
            upper.push(p);
          }
          upper.pop();
          lower.pop();
          const hull = lower.concat(upper);
          return (
            <Polygon
              key={`region-${r.id}`}
              positions={hull.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{
                color: r.color,
                weight: 2,
                opacity: 0.6,
                fillColor: r.color,
                fillOpacity: 0.05,
                dashArray: "6 6",
              }}
            >
              <Tooltip>
                <div className="text-xs font-semibold">{r.id}</div>
                <div className="text-xs">{r.jobs.length} jobs · {r.installerCount} installers</div>
              </Tooltip>
            </Polygon>
          );
        })}

      {/* Territory hulls */}
      {filters.showTerritories &&
        state.territories.filter(visibleTerritory).map((t) => {
          if (t.jobs.length < 3) return null;
          const pts = t.jobs.map((j) => ({ lat: j.lat, lng: j.lng }));
          const sorted = [...pts].sort((a, b) =>
            a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng,
          );
          const cross = (o: LatLng, a: LatLng, b: LatLng) =>
            (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
          const lower: LatLng[] = [];
          for (const p of sorted) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
              lower.pop();
            lower.push(p);
          }
          const upper: LatLng[] = [];
          for (let i = sorted.length - 1; i >= 0; i--) {
            const p = sorted[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
              upper.pop();
            upper.push(p);
          }
          upper.pop();
          lower.pop();
          const hull = lower.concat(upper);
          const color = installerColorById.get(t.installerId) ?? "#888";
          return (
            <Polygon
              key={`terr-${t.id}`}
              positions={hull.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{
                color,
                weight: 1.5,
                opacity: 0.8,
                fillColor: color,
                fillOpacity: 0.08,
              }}
            >
              <Tooltip>
                <div className="text-xs font-semibold">{t.id}</div>
                <div className="text-xs">Owner: {t.ownerInstallerId}</div>
                <div className="text-xs">
                  {t.coreJobs.length} core · {t.reserveJobs.length} reserve
                </div>
                <div className="text-xs">Workload: {t.workload.toFixed(2)}</div>
              </Tooltip>
            </Polygon>
          );
        })}

      {/* Optimized core routes */}
      {filters.showRoutes &&
        state.territories.filter(visibleTerritory).map((t) => {
          if (t.optimizedRoute.length < 2) return null;
          const color = installerColorById.get(t.installerId) ?? "#888";
          const positions = [
            [t.center.lat, t.center.lng] as [number, number],
            ...t.optimizedRoute.map((j) => [j.lat, j.lng] as [number, number]),
            [t.center.lat, t.center.lng] as [number, number],
          ];
          return (
            <Polyline
              key={`route-${t.id}`}
              positions={positions}
              pathOptions={{ color, weight: 2, opacity: 0.75 }}
            />
          );
        })}

      {/* Jobs */}
      {state.territories.filter(visibleTerritory).flatMap((t) =>
        t.jobs
          .filter((j) => {
            if (filters.showPriorityOnly && !j.priority) return false;
            if (!filters.showReserve && j.isReserve) return false;
            if (!filters.showCore && j.isCore) return false;
            return true;
          })
          .map((j) => {
            const baseColor = installerColorById.get(t.installerId) ?? "#888";
            const isPriority = j.priority;
            const isReserve = j.isReserve;
            const radius = isPriority ? 7 : j.category === "D" ? 6 : 4;
            return (
              <CircleMarker
                key={`job-${j.id}`}
                center={[j.lat, j.lng]}
                radius={radius}
                pathOptions={{
                  color: isPriority ? PRIORITY_COLORS[j.priorityLevel ?? 3] : baseColor,
                  weight: isPriority ? 2 : 1,
                  fillColor: isReserve ? "#fff" : CATEGORY_CONFIG[j.category].color,
                  fillOpacity: isReserve ? 0.4 : 0.85,
                  dashArray: isReserve ? "2 2" : undefined,
                }}
              >
                <Tooltip>
                  <div className="text-xs font-semibold">
                    {j.id} {isPriority && "· PRIORITY"}
                  </div>
                  <div className="text-xs">Cat {j.category} · wl {j.weight}</div>
                  <div className="text-xs">
                    {isReserve ? "Reserve" : "Core"}
                    {j.isAnchor && " · Anchor"}
                    {j.isBorder && " · Border"}
                  </div>
                  <div className="text-xs">Territory: {t.id}</div>
                  <div className="text-xs">Installer: {t.installerId}</div>
                </Tooltip>
              </CircleMarker>
            );
          }),
      )}

      {/* Anchor + Border ring markers */}
      {filters.showAnchors &&
        state.territories.filter(visibleTerritory).flatMap((t) =>
          t.anchorJobs.map((j) => (
            <CircleMarker
              key={`anch-${j.id}`}
              center={[j.lat, j.lng]}
              radius={10}
              pathOptions={{ color: "#10b981", weight: 1.5, fill: false }}
            />
          )),
        )}
      {filters.showBorders &&
        state.territories.filter(visibleTerritory).flatMap((t) =>
          t.borderJobs.map((j) => (
            <CircleMarker
              key={`bord-${j.id}`}
              center={[j.lat, j.lng]}
              radius={9}
              pathOptions={{ color: "#f59e0b", weight: 1.5, fill: false, dashArray: "3 3" }}
            />
          )),
        )}

      {/* Territory centers */}
      {filters.showTerritories &&
        state.territories.filter(visibleTerritory).map((t) => (
          <CircleMarker
            key={`tc-${t.id}`}
            center={[t.center.lat, t.center.lng]}
            radius={5}
            pathOptions={{
              color: installerColorById.get(t.installerId) ?? "#888",
              weight: 2,
              fillColor: "#fff",
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -6]} className="!bg-transparent !border-0 !shadow-none">
              <span className="text-[10px] font-bold text-foreground">
                {t.id}·{t.installerId}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

      {/* Region seeds */}
      {filters.showRegions &&
        state.regions.filter(visibleRegion).map((r) => (
          <CircleMarker
            key={`rs-${r.id}`}
            center={[r.center.lat, r.center.lng]}
            radius={8}
            pathOptions={{ color: r.color, weight: 3, fillColor: r.color, fillOpacity: 0.4 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]} className="!bg-transparent !border-0 !shadow-none">
              <span className="text-xs font-bold" style={{ color: r.color }}>
                {r.id}
              </span>
            </Tooltip>
          </CircleMarker>
        ))}

      {/* Office */}
      {centerIcon && (
        <Marker position={[state.center.lat, state.center.lng]} icon={centerIcon}>
          <Popup>Base location</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
