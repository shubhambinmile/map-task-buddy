import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LocationsMap } from "@/components/LocationsMap";
import {
  CATEGORY_CONFIG,
  defaultOfficeLocation,
  PRIORITY_CATEGORIES,
  RADIUS_KM,
  runSimulation,
  type Category,
  type LatLng,
} from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "V8 Territory Routing — Operational Dashboard" },
      {
        name: "description",
        content:
          "V8 priority-aware territory optimization engine — visualize core territories, flexible assignments, and priority execution flow.",
      },
    ],
  }),
});

const ALL_CATS: Category[] = ["A", "B", "C", "D"];

function Index() {
  const [totalUsers, setTotalUsers] = useState(15);
  const [totalTasks, setTotalTasks] = useState(250);
  const [radiusKm, setRadiusKm] = useState(RADIUS_KM);
  const [center, setCenter] = useState<LatLng>(defaultOfficeLocation);
  const [pickMode, setPickMode] = useState(false);
  const [seed, setSeed] = useState(42);

  const [config, setConfig] = useState({
    totalUsers,
    totalTasks,
    radiusKm,
    center,
    seed,
  });

  const simulation = useMemo(() => runSimulation(config), [config]);

  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(simulation.users.map((u) => u.id)),
  );
  const [cats, setCats] = useState<Set<Category>>(() => new Set(ALL_CATS));
  const [showRoutes, setShowRoutes] = useState(true);
  const [showTerritories, setShowTerritories] = useState(true);
  const [showStopNumbers, setShowStopNumbers] = useState(true);
  const [showOverlap, setShowOverlap] = useState(true);
  const [showBorderTasks, setShowBorderTasks] = useState(false);
  const [showSpread, setShowSpread] = useState(false);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [showFlexibleOnly, setShowFlexibleOnly] = useState(false);
  const [highlightFlexible, setHighlightFlexible] = useState(true);
  const [phasedRoutes, setPhasedRoutes] = useState(true);

  const userIds = simulation.users.map((u) => u.id).join(",");
  useEffect(() => {
    setVisible(new Set(simulation.users.map((u) => u.id)));
  }, [userIds]);

  const toggleUser = (id: string) =>
    setVisible((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleCat = (c: Category) =>
    setCats((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  const soloUser = (id: string) => setVisible(new Set([id]));

  const distances = simulation.users.map((u) => u.totalRouteDistance);
  const workloads = simulation.users.map((u) => u.totalWorkload);
  const avgD = distances.reduce((s, d) => s + d, 0) / distances.length;
  const avgW = workloads.reduce((s, d) => s + d, 0) / workloads.length;
  const totalStops = simulation.users.reduce(
    (s, u) => s + u.assignedTasks.length,
    0,
  );
  const avgEff =
    simulation.users.reduce((s, u) => s + u.efficiency, 0) /
    Math.max(1, simulation.users.length);

  const run = () =>
    setConfig({ totalUsers, totalTasks, radiusKm, center, seed });

  const newSeed = () => {
    const s = Math.floor(Math.random() * 1_000_000);
    setSeed(s);
    setConfig({ totalUsers, totalTasks, radiusKm, center, seed: s });
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/40 px-6 py-3 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            V8 Territory Routing — Operational Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            {simulation.users.length} installers ·{" "}
            {simulation.tasks.length} jobs ·{" "}
            <span className="text-blue-500">
              {simulation.totalPriority} priority
            </span>{" "}
            ·{" "}
            <span className="text-muted-foreground">
              {simulation.totalFlexible} flexible
            </span>{" "}
            · workload {simulation.totalWorkload.toFixed(1)} ·{" "}
            {simulation.totalDistance.toFixed(0)} km · overlap{" "}
            {simulation.overlapHotspots.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setVisible(new Set(simulation.users.map((u) => u.id)))
            }
          >
            Show all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVisible(new Set())}
          >
            Hide all
          </Button>
          <Button size="sm" variant="outline" onClick={newSeed}>
            New jobs
          </Button>
          <Button size="sm" onClick={run}>
            Recalculate
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-r border-border bg-card/20">
          <div className="flex-1 overflow-y-auto">
            {/* Controls */}
            <div className="space-y-3 border-b border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Installers</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={totalUsers}
                    onChange={(e) =>
                      setTotalUsers(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Jobs</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={totalTasks}
                    onChange={(e) =>
                      setTotalTasks(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>Radius</Label>
                  <span className="tabular-nums text-muted-foreground">
                    {radiusKm} km
                  </span>
                </div>
                <Slider
                  min={1}
                  max={200}
                  step={1}
                  value={[radiusKm]}
                  onValueChange={(v) => setRadiusKm(v[0])}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Center (lat, lng)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    step="0.0001"
                    value={center.lat}
                    onChange={(e) =>
                      setCenter({ ...center, lat: Number(e.target.value) })
                    }
                  />
                  <Input
                    type="number"
                    step="0.0001"
                    value={center.lng}
                    onChange={(e) =>
                      setCenter({ ...center, lng: Number(e.target.value) })
                    }
                  />
                </div>
                <Button
                  size="sm"
                  variant={pickMode ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setPickMode((p) => !p)}
                >
                  {pickMode ? "Click on map…" : "Pick center on map"}
                </Button>
              </div>

              <Button size="sm" className="w-full" onClick={run}>
                Run V8 optimization
              </Button>
            </div>

            {/* Operational Analytics */}
            <div className="space-y-2 border-b border-border p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Operational analytics
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Total workload"
                  value={simulation.totalWorkload.toFixed(1)}
                />
                <Stat
                  label="Total hours"
                  value={`${simulation.totalHours.toFixed(0)}h`}
                />
                <Stat
                  label="Total distance"
                  value={`${simulation.totalDistance.toFixed(0)} km`}
                />
                <Stat label="Total stops" value={String(totalStops)} />
                <Stat
                  label="Priority jobs"
                  value={String(simulation.totalPriority)}
                  accent="#3b82f6"
                />
                <Stat
                  label="Flexible jobs"
                  value={String(simulation.totalFlexible)}
                  accent="#a855f7"
                />
                <Stat label="Avg distance" value={`${avgD.toFixed(1)} km`} />
                <Stat label="Avg workload" value={avgW.toFixed(2)} />
                <Stat
                  label="Compactness"
                  value={`${simulation.avgCompactness.toFixed(2)} km`}
                />
                <Stat
                  label="Workload Δ"
                  value={simulation.workloadDelta.toFixed(1)}
                  hint="max - min"
                />
                <Stat
                  label="Workload σ"
                  value={simulation.workloadStdDev.toFixed(2)}
                  hint="std dev"
                />
                <Stat
                  label="Efficiency"
                  value={avgEff.toFixed(3)}
                  hint="load / km"
                />
              </div>
            </div>

            {/* Phase legend */}
            <div className="space-y-1.5 border-b border-border p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Route phases
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="h-1 w-8 rounded bg-blue-500" />
                <span className="font-medium text-blue-500">
                  Priority phase
                </span>
                <span className="text-muted-foreground">
                  ({PRIORITY_CATEGORIES.join(", ")})
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div
                  className="h-1 w-8 rounded"
                  style={{
                    background:
                      "repeating-linear-gradient(90deg, hsl(var(--muted-foreground)) 0 4px, transparent 4px 8px)",
                  }}
                />
                <span className="font-medium">Normal phase</span>
                <span className="text-muted-foreground">
                  (dashed segment)
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="h-3 w-3 rounded-full border-2 border-blue-500 bg-blue-500/40" />
                <span>Priority job</span>
                <span className="ml-auto h-3 w-3 rounded-full border border-dashed border-foreground/60" />
                <span>Flexible</span>
              </div>
            </div>

            {/* Layer toggles */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border p-3 text-xs">
              <ToggleRow
                label="Phased routes"
                checked={phasedRoutes}
                onChange={setPhasedRoutes}
              />
              <ToggleRow
                label="Routes"
                checked={showRoutes}
                onChange={setShowRoutes}
              />
              <ToggleRow
                label="Territories"
                checked={showTerritories}
                onChange={setShowTerritories}
              />
              <ToggleRow
                label="Spread"
                checked={showSpread}
                onChange={setShowSpread}
              />
              <ToggleRow
                label="Overlap"
                checked={showOverlap}
                onChange={setShowOverlap}
              />
              <ToggleRow
                label="Border tasks"
                checked={showBorderTasks}
                onChange={setShowBorderTasks}
              />
              <ToggleRow
                label="Stop #"
                checked={showStopNumbers}
                onChange={setShowStopNumbers}
              />
              <ToggleRow
                label="Mark flexible"
                checked={highlightFlexible}
                onChange={setHighlightFlexible}
              />
              <ToggleRow
                label="Priority only"
                checked={showPriorityOnly}
                onChange={(v) => {
                  setShowPriorityOnly(v);
                  if (v) setShowFlexibleOnly(false);
                }}
              />
              <ToggleRow
                label="Flexible only"
                checked={showFlexibleOnly}
                onChange={(v) => {
                  setShowFlexibleOnly(v);
                  if (v) setShowPriorityOnly(false);
                }}
              />
            </div>

            {/* Category filters */}
            <div className="border-b border-border p-3">
              <div className="mb-2 text-xs font-medium">Categories</div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_CATS.map((c) => {
                  const cfg = CATEGORY_CONFIG[c];
                  const on = cats.has(c);
                  const isPri = PRIORITY_CATEGORIES.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCat(c)}
                      className={`flex items-center justify-between rounded border px-2 py-1 text-xs transition ${
                        on ? "bg-accent/40" : "opacity-40"
                      } ${isPri ? "border-blue-500/60" : "border-border"}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: cfg.color }}
                        />
                        <span className="font-medium">{c}</span>
                        {isPri && (
                          <span className="rounded bg-blue-500/20 px-1 text-[9px] font-bold text-blue-500">
                            PRI
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {cfg.avgHours}h ×{cfg.weight}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Users table */}
            <div>
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left">
                    <th className="px-2 py-2"></th>
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2 text-right">Jobs</th>
                    <th className="px-2 py-2 text-right" title="Priority jobs">
                      Pri
                    </th>
                    <th className="px-2 py-2 text-right" title="Flexible jobs">
                      Flx
                    </th>
                    <th className="px-2 py-2 text-right">Load</th>
                    <th className="px-2 py-2 text-right">Km</th>
                    <th className="px-2 py-2 text-right" title="Avg spread">
                      Spr
                    </th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {simulation.users.map((u) => {
                    const on = visible.has(u.id);
                    const cb = u.categoryBreakdown;
                    return (
                      <tr
                        key={u.id}
                        className={`border-b border-border/60 ${
                          on ? "" : "opacity-40"
                        } hover:bg-accent/40`}
                      >
                        <td
                          className="cursor-pointer px-2 py-1.5"
                          onClick={() => toggleUser(u.id)}
                        >
                          <span
                            className="inline-block h-3 w-3 rounded-sm"
                            style={{ background: u.color }}
                          />
                        </td>
                        <td
                          className="cursor-pointer px-2 py-1.5 font-medium"
                          onClick={() => toggleUser(u.id)}
                          title={`A:${cb.A} B:${cb.B} C:${cb.C} D:${cb.D} · return ${u.returnDistance.toFixed(1)}km · ${u.totalHours.toFixed(0)}h · eff ${u.efficiency.toFixed(3)}`}
                        >
                          {u.id}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {u.assignedTasks.length}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-blue-500">
                          {u.priorityCount}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-purple-500">
                          {u.flexibleCount}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {u.totalWorkload.toFixed(1)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {u.totalRouteDistance.toFixed(0)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {u.avgSpread.toFixed(1)}
                        </td>
                        <td className="px-1 py-1">
                          <button
                            onClick={() => soloUser(u.id)}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
                            title="Solo this user"
                          >
                            solo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </aside>

        <main className="relative flex-1">
          {pickMode && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-md bg-foreground/90 px-3 py-1 text-xs text-background shadow">
              Click on the map to set the center
            </div>
          )}
          <LocationsMap
            simulation={simulation}
            visibleUsers={visible}
            visibleCategories={cats}
            showRoutes={showRoutes}
            showTerritories={showTerritories}
            showStopNumbers={showStopNumbers}
            showOverlap={showOverlap}
            showBorderTasks={showBorderTasks}
            showSpread={showSpread}
            showPriorityOnly={showPriorityOnly}
            showFlexibleOnly={showFlexibleOnly}
            highlightFlexible={highlightFlexible}
            phasedRoutes={phasedRoutes}
            center={config.center}
            radiusKm={config.radiusKm}
            pickMode={pickMode}
            onPickCenter={(c) => {
              setCenter(c);
              setPickMode(false);
            }}
          />
        </main>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: string;
  accent?: string;
  hint?: string;
}) {
  return (
    <div
      className="rounded-md border border-border bg-card/40 px-2 py-1.5"
      title={hint}
    >
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className="font-semibold tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
