import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LocationsMap } from "@/components/LocationsMap";
import {
  CATEGORY_CONFIG,
  defaultOfficeLocation,
  RADIUS_KM,
  runSimulation,
  type Category,
  type FairnessReport,
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
      { title: "V7 Territory Routing — Fairness Dashboard" },
      {
        name: "description",
        content:
          "V7 fairness-aware territory workforce routing engine — visualize compactness, overlap, and operational fairness.",
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
  const [showBorderTasks, setShowBorderTasks] = useState(true);
  const [showSpread, setShowSpread] = useState(false);

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

  const f = simulation.fairness;
  const distances = simulation.users.map((u) => u.totalRouteDistance);
  const workloads = simulation.users.map((u) => u.totalWorkload);
  const avgD = distances.reduce((s, d) => s + d, 0) / distances.length;
  const avgW = workloads.reduce((s, d) => s + d, 0) / workloads.length;

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
            V7 Territory Routing — Fairness Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            {simulation.users.length} users · {simulation.tasks.length} tasks ·
            workload {simulation.totalWorkload.toFixed(1)} · total{" "}
            {simulation.totalDistance.toFixed(0)} km · overlap pairs{" "}
            {simulation.overlapHotspots.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FairnessBadge fairness={f} />
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
            New tasks
          </Button>
          <Button size="sm" onClick={run}>
            Recalculate
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-[360px] shrink-0 flex-col overflow-hidden border-r border-border bg-card/20">
          {/* Controls */}
          <div className="space-y-3 border-b border-border p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Users</Label>
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
                <Label className="text-xs">Tasks</Label>
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
              Run V7 optimization
            </Button>
          </div>

          {/* Fairness panel */}
          <div className="space-y-2 border-b border-border p-3">
            <div className="flex items-baseline justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Fairness
              </div>
              <div className="text-xs font-semibold">{f.label}</div>
            </div>
            <div className="flex items-baseline gap-1">
              <div className="text-3xl font-semibold tabular-nums">
                {f.overallFairnessScore.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">/ 100</div>
            </div>
            <ProgressBar
              label="Workload"
              value={f.workloadFairness}
              colorVar="#22c55e"
            />
            <ProgressBar
              label="Distance"
              value={f.distanceFairness}
              colorVar="#3b82f6"
            />
            <ProgressBar
              label="Compactness"
              value={f.compactnessFairness}
              colorVar="#a855f7"
            />
            <ProgressBar
              label="Overlap"
              value={f.overlapFairness}
              colorVar="#f97316"
            />
          </div>

          {/* Layer toggles */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border p-3 text-xs">
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
          </div>

          {/* Category filters */}
          <div className="border-b border-border p-3">
            <div className="mb-2 text-xs font-medium">Categories</div>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_CATS.map((c) => {
                const cfg = CATEGORY_CONFIG[c];
                const on = cats.has(c);
                return (
                  <button
                    key={c}
                    onClick={() => toggleCat(c)}
                    className={`flex items-center justify-between rounded border border-border px-2 py-1 text-xs transition ${
                      on ? "bg-accent/40" : "opacity-40"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: cfg.color }}
                      />
                      <span className="font-medium">{c}</span>
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {cfg.avgHours}h ×{cfg.weight}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Global metrics */}
          <div className="grid grid-cols-2 gap-2 border-b border-border p-3 text-xs">
            <Stat label="Avg distance" value={`${avgD.toFixed(1)} km`} />
            <Stat label="Avg workload" value={avgW.toFixed(2)} />
            <Stat
              label="Avg spread"
              value={`${simulation.avgCompactness.toFixed(2)} km`}
            />
            <Stat
              label="Overlap penalty"
              value={simulation.overlapPenalty.toFixed(0)}
            />
          </div>

          {/* Users table */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2">User</th>
                  <th className="px-2 py-2 text-right">Jobs</th>
                  <th className="px-2 py-2 text-right">Load</th>
                  <th className="px-2 py-2 text-right">Km</th>
                  <th className="px-2 py-2 text-right" title="Avg spread (km)">
                    Spr
                  </th>
                  <th className="px-2 py-2 text-right" title="Overlap pairs">
                    Ov
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
                        title={`A:${cb.A} B:${cb.B} C:${cb.C} D:${cb.D} · return ${u.returnDistance.toFixed(1)}km · score ${u.fairnessScore.toFixed(0)}`}
                      >
                        {u.id}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {u.assignedTasks.length}
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
                      <td
                        className={`px-2 py-1.5 text-right tabular-nums ${u.overlapCount > 0 ? "text-orange-500" : "text-muted-foreground"}`}
                      >
                        {u.overlapCount}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-semibold tabular-nums">{value}</div>
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

function ProgressBar({
  label,
  value,
  colorVar,
}: {
  label: string;
  value: number;
  colorVar: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: colorVar,
          }}
        />
      </div>
    </div>
  );
}

function FairnessBadge({ fairness }: { fairness: FairnessReport }) {
  const colorMap: Record<FairnessReport["label"], string> = {
    EXCELLENT: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    GOOD: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    AVERAGE: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
    POOR: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    "VERY POOR": "bg-red-500/15 text-red-500 border-red-500/30",
  };
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium ${colorMap[fairness.label]}`}
    >
      <span className="tabular-nums">
        {fairness.overallFairnessScore.toFixed(1)}
      </span>
      <span className="opacity-70">·</span>
      <span>{fairness.label}</span>
    </div>
  );
}
