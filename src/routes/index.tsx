import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LocationsMap } from "@/components/LocationsMap";
import { runSimulation } from "@/lib/routing";
import { Button } from "@/components/ui/button";

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
  // Heavy run — memoize so it only happens once
  const simulation = useMemo(() => runSimulation(50, 1000, 42), []);

  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(simulation.users.map((u) => u.id)),
  );

  const toggle = (id: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOn = visible.size === simulation.users.length;

  const distances = simulation.users.map((u) => u.totalRouteDistance);
  const minD = Math.min(...distances);
  const maxD = Math.max(...distances);
  const avgD = distances.reduce((s, d) => s + d, 0) / distances.length;

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
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (allOn) setVisible(new Set([simulation.users[0].id]));
            }}
          >
            Solo first
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
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
        </aside>

        <main className="flex-1">
          <LocationsMap simulation={simulation} visibleUsers={visible} />
        </main>
      </div>
    </div>
  );
}
