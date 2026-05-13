// Fair Vehicle Routing System — ported from logic-v5.js

export type LatLng = { lat: number; lng: number };

export type Task = {
  id: string;
  location: LatLng;
  centerDistance?: number;
  travelDistance?: number;
};

export type User = {
  id: string;
  assignedTasks: Task[];
  totalDistance: number;
  optimizedRoute: Task[];
  totalRouteDistance: number;
  returnDistance: number;
  color: string;
};

export const defaultOfficeLocation: LatLng = { lat: 28.6139, lng: 77.209 };
export const officeLocation: LatLng = defaultOfficeLocation;
export const RADIUS_KM = 50;
const EARTH_RADIUS_KM = 6371;

// Deterministic PRNG (mulberry32) so the map is stable between renders
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatePointInRadius(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  rand: () => number,
): LatLng {
  const angle = rand() * 2 * Math.PI;
  const r = radiusKm * Math.sqrt(rand());
  const deltaLat = (r / EARTH_RADIUS_KM) * (180 / Math.PI);
  const deltaLng = deltaLat / Math.cos((centerLat * Math.PI) / 180);
  return {
    lat: +(centerLat + deltaLat * Math.cos(angle)).toFixed(6),
    lng: +(centerLng + deltaLng * Math.sin(angle)).toFixed(6),
  };
}

const toRad = (v: number) => (v * Math.PI) / 180;

function haversine(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function buildOptimizedRoute(tasks: Task[], center: LatLng) {
  if (tasks.length === 0)
    return { route: [] as Task[], totalDistance: 0, returnDistance: 0 };
  const remaining = [...tasks];
  const route: Task[] = [];
  let cur: LatLng = center;
  let total = 0;
  while (remaining.length) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(cur, remaining[i].location);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    const next = remaining[bi];
    route.push({ ...next, travelDistance: bd });
    total += bd;
    cur = next.location;
    remaining.splice(bi, 1);
  }
  const returnDistance = haversine(cur, center);
  total += returnDistance;
  return { route, totalDistance: total, returnDistance };
}

function buildAllRoutes(users: User[], center: LatLng) {
  for (const u of users) {
    const r = buildOptimizedRoute(u.assignedTasks, center);
    u.optimizedRoute = r.route;
    u.totalRouteDistance = r.totalDistance;
    u.returnDistance = r.returnDistance;
  }
}

function fairnessDiff(users: User[]) {
  const t = users.map((u) => u.totalRouteDistance);
  return Math.max(...t) - Math.min(...t);
}

function assignTasks(users: User[], tasks: Task[]) {
  const tasksPerUser = Math.floor(tasks.length / users.length);
  let extra = tasks.length % users.length;
  const capacities = users.map(() => {
    const c = tasksPerUser + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    return c;
  });
  for (const task of tasks) {
    const order = users
      .map((u, i) => ({ u, i }))
      .sort((a, b) => {
        if (a.u.assignedTasks.length !== b.u.assignedTasks.length)
          return a.u.assignedTasks.length - b.u.assignedTasks.length;
        return a.u.totalDistance - b.u.totalDistance;
      });
    const pick = order.find(
      ({ u, i }) => u.assignedTasks.length < capacities[i],
    )!;
    pick.u.assignedTasks.push(task);
    pick.u.totalDistance += task.centerDistance ?? 0;
  }
}

function optimize(users: User[], center: LatLng, iterations = 80) {
  for (let it = 0; it < iterations; it++) {
    buildAllRoutes(users, center);
    const sorted = [...users].sort(
      (a, b) => b.totalRouteDistance - a.totalRouteDistance,
    );
    const heavy = sorted[0];
    const light = sorted[sorted.length - 1];
    const curDiff = fairnessDiff(users);
    let improved = false;
    outer: for (const ht of heavy.assignedTasks) {
      for (const lt of light.assignedTasks) {
        const ha = heavy.assignedTasks.map((t) => (t.id === ht.id ? lt : t));
        const la = light.assignedTasks.map((t) => (t.id === lt.id ? ht : t));
        const hr = buildOptimizedRoute(ha, center);
        const lr = buildOptimizedRoute(la, center);
        const totals = users.map((u) =>
          u === heavy
            ? hr.totalDistance
            : u === light
              ? lr.totalDistance
              : u.totalRouteDistance,
        );
        const newDiff = Math.max(...totals) - Math.min(...totals);
        if (newDiff < curDiff) {
          heavy.assignedTasks = ha;
          light.assignedTasks = la;
          improved = true;
          break outer;
        }
      }
    }
    if (!improved) break;
  }
  buildAllRoutes(users, center);
}

// Distinct HSL colors for N users
function makeColors(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const hue = Math.round((360 / n) * i);
    return `hsl(${hue} 78% 45%)`;
  });
}

export type Simulation = {
  users: User[];
  tasks: Task[];
  fairness: number;
  totalDistance: number;
};

export function runSimulation(
  totalUsers = 50,
  totalTasks = 1000,
  seed = 42,
): Simulation {
  const rand = mulberry32(seed);
  const colors = makeColors(totalUsers);
  const users: User[] = Array.from({ length: totalUsers }, (_, i) => ({
    id: `U${i + 1}`,
    assignedTasks: [],
    totalDistance: 0,
    optimizedRoute: [],
    totalRouteDistance: 0,
    returnDistance: 0,
    color: colors[i],
  }));
  const tasks: Task[] = Array.from({ length: totalTasks }, (_, i) => ({
    id: `T${i + 1}`,
    location: generatePointInRadius(
      officeLocation.lat,
      officeLocation.lng,
      RADIUS_KM,
      rand,
    ),
  }));

  const withDist = tasks.map((t) => ({
    ...t,
    centerDistance: haversine(officeLocation, t.location),
  }));
  const sorted = [...withDist].sort(
    (a, b) => b.centerDistance - a.centerDistance,
  );
  assignTasks(users, sorted);
  optimize(users);

  const totalDistance = users.reduce((s, u) => s + u.totalRouteDistance, 0);
  return { users, tasks, fairness: fairnessDiff(users), totalDistance };
}
