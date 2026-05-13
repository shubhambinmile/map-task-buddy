import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LocationsMap } from "@/components/LocationsMap";
import {
  defaultOfficeLocation,
  RADIUS_KM,
  runSimulation,
  type LatLng,
} from "@/lib/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Fair Vehicle Routing — Map" },
      {
        name: "description",
        content:
          "Interactive visualization of a fair task allocation and vehicle routing algorithm.",
      },
    ],
  }),
});

function Index() {
  const [totalUsers, setTotalUsers] = useState(20);
  const [totalTasks, setTotalTasks] = useState(300);
  const [radiusKm, setRadiusKm] = useState(RADIUS_KM);
  const [center, setCenter] = useState<LatLng>(defaultOfficeLocation);
  const [pickMode, setPickMode] = useState(false);

  // Inputs that drive the simulation only after "Run"
  const [config, setConfig] = useState({
    totalUsers,
    totalTasks,
    radiusKm,
    center,
    seed: 42,
  });

  const simulation = useMemo(
    () =>
      runSimulation({
        totalUsers: config.totalUsers,
        totalTasks: config.totalTasks,
        radiusKm: config.radiusKm,
        center: config.center,
        seed: config.seed,
      }),
    [config],
  );

  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(simulation.users.map((u) => u.id)),
  );

  // Reset visibility when simulation changes
  const simIds = simulation.users.map((u) => u.id).join(",");
  useMemo(() => {
    setVisible(new Set(simulation.users.map((u) => u.id)));
  }, [simIds]);

  const toggle = (id: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const distances = simulation.users.map((u) => u.totalRouteDistance);
  const minD = Math.min(...distances);
  const maxD = Math.max(...distances);
  const avgD = distances.reduce((s, d) => s + d, 0) / distances.length;

  const run = () =>
    setConfig({ totalUsers, totalTasks, radiusKm, center, seed: 42 });

  const handlePickCenter = (c: LatLng) => {
    setCenter(c);
    setPickMode(false);
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div>
          <h1 className="text-xl font-semibold">Fair Vehicle Routing — Map</h1>
          <p className="text-xs text-muted-foreground">
            {simulation.users.length} users · {simulation.tasks.length} tasks ·
            fairness Δ {simulation.fairness.toFixed(1)} km · total{" "}
            {simulation.totalDistance.toFixed(0)} km · avg {avgD.toFixed(1)} km
            (min {minD.toFixed(1)} / max {maxD.toFixed(1)})
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-border">
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
              Run simulation
            </Button>
          </div>

          {/* Users */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left">
                  <th className="px-2 py-2"></th>
                  <th className="px-2 py-2">User</th>
                  <th className="px-2 py-2 text-right">Jobs</th>
                  <th className="px-2 py-2 text-right">Dist (km)</th>
                </tr>
              </thead>
              <tbody>
                {simulation.users.map((u) => {
                  const on = visible.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      onClick={() => toggle(u.id)}
                      className={`cursor-pointer border-b border-border/60 hover:bg-accent/50 ${
                        on ? "" : "opacity-40"
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{ background: u.color }}
                        />
                      </td>
                      <td className="px-2 py-1.5 font-medium">{u.id}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {u.assignedTasks.length}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {u.totalRouteDistance.toFixed(1)}
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
            center={config.center}
            radiusKm={config.radiusKm}
            pickMode={pickMode}
            onPickCenter={handlePickCenter}
          />
        </main>
      </div>
    </div>
  );
}
