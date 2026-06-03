import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LocationsMap, type MapFilters } from "@/components/LocationsMap";
import {
  defaultOfficeLocation,
  dispatchPriorityJob,
  manualReserveDispatch,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  RADIUS_KM,
  runV9Simulation,
  simulateCompletion,
  summary,
  type EngineEvent,
  type LatLng,
  type PriorityLevel,
  type SimulationState,
} from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "V9 Dispatch Engine — Workforce Operations Command Center" },
      {
        name: "description",
        content:
          "Operational dispatch dashboard for the V9 territory engine — regions, territories, capacity, priority dispatch, reserve flow, and event timeline.",
      },
    ],
  }),
});

function fmt(n: number, d = 2) {
  return n.toFixed(d);
}

function Index() {
  const [totalJobs, setTotalJobs] = useState(200);
  const [totalInstallers, setTotalInstallers] = useState(12);
  const [regionCount, setRegionCount] = useState(4);
  const [radiusKm, setRadiusKm] = useState(RADIUS_KM);
  const [center, setCenter] = useState<LatLng>(defaultOfficeLocation);
  const [pickMode, setPickMode] = useState(false);
  const [seed, setSeed] = useState(42);

  const [config, setConfig] = useState({
    totalJobs,
    totalInstallers,
    regionCount,
    radiusKm,
    center,
    seed,
  });
  const initial = useMemo(() => runV9Simulation(config), [config]);
  const [state, setState] = useState<SimulationState>(initial);
  // reset state when config changes
  useMemo(() => {
    setState(initial);
  }, [initial]);

  const stats = useMemo(() => summary(state), [state]);

  // map filters
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [installerFilter, setInstallerFilter] = useState<string>("all");
  const [showRegions, setShowRegions] = useState(true);
  const [showTerritories, setShowTerritories] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showCore, setShowCore] = useState(true);
  const [showReserve, setShowReserve] = useState(true);
  const [showPriorityOnly, setShowPriorityOnly] = useState(false);
  const [showAnchors, setShowAnchors] = useState(false);
  const [showBorders, setShowBorders] = useState(false);

  const filters: MapFilters = {
    regionId: regionFilter === "all" ? null : regionFilter,
    installerId: installerFilter === "all" ? null : installerFilter,
    showRegions,
    showTerritories,
    showRoutes,
    showCore,
    showReserve,
    showPriorityOnly,
    showAnchors,
    showBorders,
  };

  function regenerate() {
    setConfig({ totalJobs, totalInstallers, regionCount, radiusKm, center, seed });
  }
  function pickCenter(c: LatLng) {
    setCenter(c);
    setPickMode(false);
  }

  // simulation controls
  const [simInstaller, setSimInstaller] = useState<string>("");
  const [newJobRegion, setNewJobRegion] = useState<string>("R1");
  const [newJobWorkload, setNewJobWorkload] = useState<number>(1);
  const [newJobPriority, setNewJobPriority] = useState<PriorityLevel>(4);

  function applyCompletion(pct: number) {
    if (!simInstaller) return;
    setState((s) => simulateCompletion(s, simInstaller, pct));
  }
  function addPriority() {
    setState((s) =>
      dispatchPriorityJob(s, {
        regionId: newJobRegion,
        workload: newJobWorkload,
        priorityLevel: newJobPriority,
      }),
    );
  }
  function runReserveDispatch() {
    setState((s) => manualReserveDispatch(s));
  }
  function resetSim() {
    setState(initial);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              V9 Dispatch Engine · Operations Command Center
            </h1>
            <p className="text-xs text-muted-foreground">
              Regions → Territories → Core/Reserve → Installer · Capacity-aware priority &amp; reserve dispatch
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">V9</Badge>
            <Badge variant="outline">{state.totalJobs} jobs</Badge>
            <Badge variant="outline">{state.totalInstallers} installers</Badge>
            <Badge variant="outline">{state.regions.length} regions</Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto grid grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[320px_1fr]">
        {/* Sidebar: configuration */}
        <aside className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Simulation Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Jobs</Label>
                  <Input
                    type="number"
                    value={totalJobs}
                    min={10}
                    max={1000}
                    onChange={(e) => setTotalJobs(+e.target.value || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Installers</Label>
                  <Input
                    type="number"
                    value={totalInstallers}
                    min={1}
                    max={60}
                    onChange={(e) => setTotalInstallers(+e.target.value || 1)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Regions</Label>
                  <Input
                    type="number"
                    value={regionCount}
                    min={1}
                    max={12}
                    onChange={(e) => setRegionCount(+e.target.value || 1)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Seed</Label>
                  <Input type="number" value={seed} onChange={(e) => setSeed(+e.target.value || 0)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Radius (km): {radiusKm}</Label>
                <Slider
                  value={[radiusKm]}
                  min={5}
                  max={200}
                  step={5}
                  onValueChange={(v) => setRadiusKm(v[0])}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Center</Label>
                <div className="text-xs text-muted-foreground">
                  {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
                </div>
                <Button
                  size="sm"
                  variant={pickMode ? "default" : "outline"}
                  className="w-full"
                  onClick={() => setPickMode((p) => !p)}
                >
                  {pickMode ? "Click map to set center…" : "Pick center on map"}
                </Button>
              </div>
              <Button className="w-full" onClick={regenerate}>
                Generate Simulation
              </Button>
              <Button className="w-full" variant="outline" onClick={resetSim}>
                Reset live state
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Map Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div>
                <Label className="text-xs">Region</Label>
                <Select value={regionFilter} onValueChange={setRegionFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All regions</SelectItem>
                    {state.regions.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.id} ({r.jobs.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Installer</Label>
                <Select value={installerFilter} onValueChange={setInstallerFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All installers</SelectItem>
                    {state.installers.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Toggle label="Regions" checked={showRegions} onChange={setShowRegions} />
              <Toggle label="Territories" checked={showTerritories} onChange={setShowTerritories} />
              <Toggle label="Routes" checked={showRoutes} onChange={setShowRoutes} />
              <Toggle label="Core jobs" checked={showCore} onChange={setShowCore} />
              <Toggle label="Reserve jobs" checked={showReserve} onChange={setShowReserve} />
              <Toggle label="Priority only" checked={showPriorityOnly} onChange={setShowPriorityOnly} />
              <Toggle label="Anchor rings" checked={showAnchors} onChange={setShowAnchors} />
              <Toggle label="Border rings" checked={showBorders} onChange={setShowBorders} />
            </CardContent>
          </Card>
        </aside>

        {/* Main */}
        <main className="space-y-4 min-w-0">
          <KpiRow stats={stats} state={state} />
          <Tabs defaultValue="map">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="installers">Installers</TabsTrigger>
              <TabsTrigger value="territories">Territories</TabsTrigger>
              <TabsTrigger value="priority">Priority Queue</TabsTrigger>
              <TabsTrigger value="reserve">Reserve</TabsTrigger>
              <TabsTrigger value="timeline">Event Timeline</TabsTrigger>
              <TabsTrigger value="simulate">Simulation</TabsTrigger>
            </TabsList>

            <TabsContent value="map">
              <Card>
                <CardContent className="p-0">
                  <div className="h-[640px] w-full overflow-hidden rounded-md">
                    <LocationsMap
                      state={state}
                      filters={filters}
                      pickMode={pickMode}
                      onPickCenter={pickCenter}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="installers">
              <InstallersPanel state={state} onSelect={setInstallerFilter} />
            </TabsContent>

            <TabsContent value="territories">
              <TerritoriesPanel state={state} onSelectRegion={setRegionFilter} />
            </TabsContent>

            <TabsContent value="priority">
              <PriorityPanel state={state} />
            </TabsContent>

            <TabsContent value="reserve">
              <ReservePanel state={state} />
            </TabsContent>

            <TabsContent value="timeline">
              <TimelinePanel events={state.events} />
            </TabsContent>

            <TabsContent value="simulate">
              <SimulationPanel
                state={state}
                simInstaller={simInstaller}
                setSimInstaller={setSimInstaller}
                onComplete={applyCompletion}
                newJobRegion={newJobRegion}
                setNewJobRegion={setNewJobRegion}
                newJobWorkload={newJobWorkload}
                setNewJobWorkload={setNewJobWorkload}
                newJobPriority={newJobPriority}
                setNewJobPriority={setNewJobPriority}
                onAddPriority={addPriority}
                onRunReserveDispatch={runReserveDispatch}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

function Toggle({
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

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn" | "danger" | "ok";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-500/40"
      : tone === "danger"
        ? "border-red-500/40"
        : tone === "ok"
          ? "border-emerald-500/40"
          : "";
  return (
    <Card className={`flex-1 min-w-[140px] ${toneClass}`}>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function KpiRow({
  stats,
  state,
}: {
  stats: ReturnType<typeof summary>;
  state: SimulationState;
}) {
  const util = (stats.capacityUtilization * 100).toFixed(0) + "%";
  const reservePct =
    stats.coreJobs + stats.reserveJobs > 0
      ? (stats.reserveJobs / (stats.coreJobs + stats.reserveJobs)) * 100
      : 0;
  return (
    <div className="flex flex-wrap gap-2">
      <Kpi label="Total Jobs" value={String(state.jobs.length)} />
      <Kpi
        label="Core / Reserve"
        value={`${stats.coreJobs} / ${stats.reserveJobs}`}
        hint={`${reservePct.toFixed(0)}% reserve`}
      />
      <Kpi
        label="Workload (core)"
        value={fmt(stats.coreWorkload, 1)}
        hint={`remaining ${fmt(stats.totalRemaining, 1)}`}
      />
      <Kpi
        label="Capacity Utilization"
        value={util}
        tone={stats.capacityUtilization >= 0.9 ? "danger" : stats.capacityUtilization >= 0.75 ? "warn" : "ok"}
      />
      <Kpi
        label="Reserve Eligible"
        value={String(stats.eligible)}
        tone={stats.eligible > 0 ? "ok" : "default"}
      />
      <Kpi
        label="Overloaded"
        value={String(stats.overloaded)}
        tone={stats.overloaded > 0 ? "danger" : "default"}
      />
      <Kpi label="Capacity Blocks" value={String(state.capacityBlocks)} tone={state.capacityBlocks > 0 ? "warn" : "default"} />
      <Kpi label="Priority Dispatched" value={String(state.dispatchMetrics.PRIORITY)} />
      <Kpi label="Route Distance" value={`${fmt(stats.routeDistance, 0)} km`} />
    </div>
  );
}

function InstallersPanel({
  state,
  onSelect,
}: {
  state: SimulationState;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[640px]">
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {state.installers.map((i) => {
              const territory = state.territories.find((t) => t.id === i.territoryId);
              const completionPct =
                i.assignedWorkload > 0
                  ? (i.completedWorkload / i.assignedWorkload) * 100
                  : 0;
              const toneBg =
                i.capacityStatus === "FULL"
                  ? "bg-red-500/10"
                  : i.capacityStatus === "WARNING"
                    ? "bg-amber-500/10"
                    : "bg-emerald-500/10";
              return (
                <Card key={i.id} className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: i.color }} />
                      <CardTitle className="text-sm">{i.id}</CardTitle>
                      <Badge variant="outline" className="text-[10px]">
                        {i.regionId ?? "—"}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {i.territoryId ?? "—"}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      {i.eligible && <Badge className="bg-emerald-600 text-[10px]">RESERVE OK</Badge>}
                      <Badge className={`text-[10px] ${toneBg}`} variant="outline">
                        {i.capacityStatus}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned</span>
                      <span className="tabular-nums font-semibold">{fmt(i.assignedWorkload)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="tabular-nums">{fmt(i.completedWorkload)}</span>
                    </div>
                    <Progress value={completionPct} className="h-1.5" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Remaining</span>
                      <span className="tabular-nums">{fmt(i.remainingWorkload)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="tabular-nums">
                        {fmt(i.assignedWorkload, 1)} / {i.shiftCapacity}
                      </span>
                    </div>
                    <Progress
                      value={i.utilization * 100}
                      className={`h-1.5 ${
                        i.capacityStatus === "FULL"
                          ? "[&>div]:bg-red-500"
                          : i.capacityStatus === "WARNING"
                            ? "[&>div]:bg-amber-500"
                            : "[&>div]:bg-emerald-500"
                      }`}
                    />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Availability</span>
                      <span className="tabular-nums">{fmt(i.availabilityScore, 3)}</span>
                    </div>
                    {territory && (
                      <div className="rounded border bg-muted/30 p-2">
                        <div className="text-[10px] text-muted-foreground">Territory</div>
                        <div>
                          {territory.coreJobs.length} core · {territory.reserveJobs.length} reserve · route{" "}
                          {fmt(territory.routeDistance, 1)}km
                        </div>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => onSelect(i.id)}
                    >
                      Show on map
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function TerritoriesPanel({
  state,
  onSelectRegion,
}: {
  state: SimulationState;
  onSelectRegion: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[640px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b text-left">
                <th className="p-2">Territory</th>
                <th>Region</th>
                <th>Owner</th>
                <th>Jobs</th>
                <th>Core</th>
                <th>Reserve</th>
                <th>Workload</th>
                <th>Route km</th>
                <th>Eff (wl/km)</th>
                <th>Anchors</th>
                <th>Borders</th>
                <th>Spread km</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {state.territories.map((t) => {
                const installer = state.installers.find((i) => i.id === t.installerId);
                return (
                  <tr key={t.id} className="border-b hover:bg-muted/40">
                    <td className="p-2 font-mono font-semibold">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full"
                        style={{ background: installer?.color ?? "#888" }}
                      />
                      {t.id}
                    </td>
                    <td>{t.regionId}</td>
                    <td>{t.ownerInstallerId}</td>
                    <td>{t.jobs.length}</td>
                    <td>{t.coreJobs.length}</td>
                    <td>{t.reserveJobs.length}</td>
                    <td className="tabular-nums">{fmt(t.workload)}</td>
                    <td className="tabular-nums">{fmt(t.routeDistance, 1)}</td>
                    <td className="tabular-nums">{fmt(t.efficiency, 2)}</td>
                    <td>{t.anchorJobs.length}</td>
                    <td>{t.borderJobs.length}</td>
                    <td className="tabular-nums">{fmt(t.spread, 1)}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => onSelectRegion(t.regionId)}>
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PriorityPanel({ state }: { state: SimulationState }) {
  const list = state.priorityAssignments;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Priority Dispatches ({list.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No priority dispatches yet. Use the Simulation tab to inject a live priority job.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((p) => (
              <div key={p.id} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: PRIORITY_COLORS[p.priorityLevel] }}
                    >
                      {PRIORITY_LABELS[p.priorityLevel]}
                    </span>
                    <span className="font-mono font-semibold">{p.jobId}</span>
                    <Badge variant="outline">{p.regionId}</Badge>
                  </div>
                  <Badge>{p.dispatchPath}</Badge>
                </div>
                <div className="mt-1 grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                  <div>→ {p.assignedTo}</div>
                  <div>wl {fmt(p.workload)}</div>
                  <div>score {fmt(p.score, 3)}</div>
                  <div>t {p.createdAt}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReservePanel({ state }: { state: SimulationState }) {
  const list = state.reserveAssignments;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Reserve / Auto-Reserve Dispatches ({list.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No reserve activity yet. Complete an installer's workload to trigger auto-reserve, or run
            manual reserve dispatch from the Simulation tab.
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((r) => (
              <div key={r.id} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.dispatchType === "AUTO_RESERVE" ? "default" : "secondary"}>
                      {r.dispatchType}
                    </Badge>
                    <span className="font-mono font-semibold">{r.territoryId}</span>
                    {r.temporaryAssignment && (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                        TEMPORARY
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">t {r.createdAt}</span>
                </div>
                <div className="mt-1 grid grid-cols-4 gap-2 text-[11px] text-muted-foreground">
                  <div>owner {r.territoryOwner}</div>
                  <div>→ {r.assignedTo}</div>
                  <div>wl {fmt(r.workload)}</div>
                  <div>score {fmt(r.score, 3)}</div>
                </div>
                <div className="mt-1 text-[11px]">jobs: {r.jobIds.join(", ")}</div>
                <div className="text-[11px] text-muted-foreground">reason: {r.reason}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function eventLabel(e: EngineEvent) {
  switch (e.kind) {
    case "JOB_ARRIVAL":
      return { label: "JOB ARRIVAL", color: "#3b82f6" };
    case "PRIORITY_DISPATCH":
      return { label: "PRIORITY DISPATCH", color: "#ef4444" };
    case "RESERVE_RELEASE":
      return { label: "RESERVE RELEASE", color: "#8b5cf6" };
    case "AUTO_RESERVE":
      return { label: "AUTO RESERVE", color: "#10b981" };
    case "COMPLETION":
      return { label: "COMPLETION", color: "#22c55e" };
    case "CAPACITY_BLOCK":
      return { label: "CAPACITY BLOCK", color: "#f59e0b" };
    case "RESERVE_DISPATCH":
      return { label: "RESERVE DISPATCH", color: "#a855f7" };
  }
}

function TimelinePanel({ events }: { events: EngineEvent[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Event Timeline ({events.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No events yet. Trigger completions or priority jobs to populate the timeline.
          </div>
        ) : (
          <ScrollArea className="h-[560px] pr-3">
            <div className="space-y-1.5">
              {[...events].reverse().map((e, idx) => {
                const meta = eventLabel(e);
                return (
                  <div key={idx} className="flex items-start gap-2 rounded border p-2 text-xs">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ background: meta.color }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">t={e.t}</span>
                    <span className="flex-1">
                      {e.kind === "JOB_ARRIVAL" &&
                        `${e.jobId} · ${PRIORITY_LABELS[e.priorityLevel]} · ${e.regionId} · wl ${e.workload}`}
                      {e.kind === "PRIORITY_DISPATCH" &&
                        `${e.jobId} → ${e.installerId} via ${e.dispatchPath} (score ${fmt(e.score, 3)})`}
                      {e.kind === "RESERVE_RELEASE" &&
                        `${e.installerId} released ${e.jobIds.length} jobs from ${e.territoryId}`}
                      {e.kind === "AUTO_RESERVE" &&
                        `${e.installerId} auto-assigned ${e.jobId} (score ${fmt(e.score, 3)})`}
                      {e.kind === "COMPLETION" &&
                        `${e.installerId} completed ${fmt(e.completedWorkload)} · remaining ${fmt(e.remainingWorkload)}`}
                      {e.kind === "CAPACITY_BLOCK" &&
                        `${e.installerId} BLOCKED — needed ${fmt(e.required)} but ${fmt(e.available)} available${e.jobId ? ` (${e.jobId})` : ""}`}
                      {e.kind === "RESERVE_DISPATCH" &&
                        `${e.territoryId} → ${e.installerId} (score ${fmt(e.score, 3)}) jobs ${e.jobIds.join(",")}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function SimulationPanel({
  state,
  simInstaller,
  setSimInstaller,
  onComplete,
  newJobRegion,
  setNewJobRegion,
  newJobWorkload,
  setNewJobWorkload,
  newJobPriority,
  setNewJobPriority,
  onAddPriority,
  onRunReserveDispatch,
}: {
  state: SimulationState;
  simInstaller: string;
  setSimInstaller: (v: string) => void;
  onComplete: (pct: number) => void;
  newJobRegion: string;
  setNewJobRegion: (v: string) => void;
  newJobWorkload: number;
  setNewJobWorkload: (v: number) => void;
  newJobPriority: PriorityLevel;
  setNewJobPriority: (v: PriorityLevel) => void;
  onAddPriority: () => void;
  onRunReserveDispatch: () => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Complete Workload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-xs">Installer</Label>
          <Select value={simInstaller} onValueChange={setSimInstaller}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select installer…" />
            </SelectTrigger>
            <SelectContent>
              {state.installers.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.id} ({fmt(i.remainingWorkload)} left)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-4 gap-1 pt-2">
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <Button key={p} size="sm" variant="outline" onClick={() => onComplete(p)}>
                {p * 100}%
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Completing ≥ 80% makes the installer reserve-eligible. Auto-reserve will then attempt to
            release additional work.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Inject Live Priority Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-xs">Region</Label>
          <Select value={newJobRegion} onValueChange={setNewJobRegion}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.regions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-xs">Priority</Label>
          <Select
            value={String(newJobPriority)}
            onValueChange={(v) => setNewJobPriority(Number(v) as PriorityLevel)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {([4, 3, 1, 2, 5] as PriorityLevel[]).map((p) => (
                <SelectItem key={p} value={String(p)}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label className="text-xs">Workload: {newJobWorkload}</Label>
          <Slider
            value={[newJobWorkload]}
            min={0.25}
            max={4}
            step={0.25}
            onValueChange={(v) => setNewJobWorkload(v[0])}
          />
          <Button className="w-full" onClick={onAddPriority}>
            Dispatch priority job
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Engine tries same-region first, then neighbor regions, then global. Watch the timeline.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Manual Reserve Dispatch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Run a system-wide reserve dispatch sweep. Releases reserve jobs into eligible installers
            using owner → same-region → neighbor-region hierarchy.
          </p>
          <Button className="w-full" onClick={onRunReserveDispatch}>
            Run reserve dispatch
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
