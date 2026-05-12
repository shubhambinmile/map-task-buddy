import { createFileRoute } from "@tanstack/react-router";
import { LocationsMap } from "@/components/LocationsMap";
import { users, tasks } from "@/data/locations";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Users & Tasks Map" },
      { name: "description", content: "Live map view of users and task locations across the region." },
    ],
  }),
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-semibold text-foreground">Users & Tasks Map</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} users · {tasks.length} tasks
        </p>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="w-full border-b border-border lg:w-80 lg:border-b-0 lg:border-r">
          <div className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
              Users
            </h2>
            <ul className="mb-6 space-y-1 text-sm">
              {users.map((u) => (
                <li key={u.id} className="flex justify-between text-muted-foreground">
                  <span className="font-medium text-foreground">{u.id}</span>
                  <span className="font-mono text-xs">
                    {u.location.lat.toFixed(3)}, {u.location.lng.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>

            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-block h-3 w-3 rounded-full bg-red-600" />
              Tasks
            </h2>
            <ul className="space-y-1 text-sm">
              {tasks.map((t) => (
                <li key={t.id} className="flex justify-between text-muted-foreground">
                  <span className="font-medium text-foreground">{t.id}</span>
                  <span className="font-mono text-xs">
                    {t.location.lat.toFixed(3)}, {t.location.lng.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="min-h-[60vh] flex-1 lg:min-h-0">
          <LocationsMap />
        </main>
      </div>
    </div>
  );
}
