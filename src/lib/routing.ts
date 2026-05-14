// V6 Workforce Weighted Geo Routing System

export type LatLng = { lat: number; lng: number };

export type Category = "A" | "B" | "C" | "D";

export const CATEGORY_CONFIG: Record<
  Category,
  { avgHours: number; weight: number; color: string }
> = {
  A: { avgHours: 1, weight: 0.25, color: "#22c55e" },
  B: { avgHours: 4, weight: 1, color: "#3b82f6" },
  C: { avgHours: 2, weight: 0.5, color: "#eab308" },
  D: { avgHours: 8, weight: 2, color: "#ef4444" },
};

export type Task = {
  id: string;
  location: LatLng;
  category: Category;
  workloadWeight: number;
  avgCompletionHours: number;
  centerDistance: number;
  travelDistance?: number;
  clusterId?: number;
  assignedUserId?: string;
};

export type User = {
  id: string;
  color: string;
  clusterId: number;
  assignedTasks: Task[];
  optimizedRoute: Task[];
  totalRouteDistance: number;
  returnDistance: number;
  totalWorkload: number;
  totalHours: number;
  centroid: LatLng;
  hull: LatLng[];
  fairnessScore: number;
};

export const defaultOfficeLocation: LatLng = { lat: 28.6139, lng: 77.209 };
export const RADIUS_KM = 50;
const EARTH_RADIUS_KM = 6371;

// Deterministic PRNG
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

// Convex hull (Andrew's monotone chain) on lat/lng treated as planar
function convexHull(points: LatLng[]): LatLng[] {
  if (points.length < 3) return [...points];
  const pts = [...points].sort((a, b) =>
    a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng,
  );
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: LatLng[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: LatLng[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
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

function calculateUserMetrics(user: User, center: LatLng) {
  const r = buildOptimizedRoute(user.assignedTasks, center);
  user.optimizedRoute = r.route;
  user.totalRouteDistance = r.totalDistance;
  user.returnDistance = r.returnDistance;
  user.totalWorkload = user.assignedTasks.reduce(
    (s, t) => s + t.workloadWeight,
    0,
  );
  user.totalHours = user.assignedTasks.reduce(
    (s, t) => s + t.avgCompletionHours,
    0,
  );
  if (user.assignedTasks.length) {
    const lat =
      user.assignedTasks.reduce((s, t) => s + t.location.lat, 0) /
      user.assignedTasks.length;
    const lng =
      user.assignedTasks.reduce((s, t) => s + t.location.lng, 0) /
      user.assignedTasks.length;
    user.centroid = { lat, lng };
    user.hull = convexHull(user.assignedTasks.map((t) => t.location));
  } else {
    user.centroid = center;
    user.hull = [];
  }
  user.fairnessScore = user.totalWorkload * 100 + user.totalRouteDistance * 0.2;
}

// K-means clustering on geo points
function createGeoClusters(tasks: Task[], k: number, rand: () => number) {
  // seed centroids with k well-spread tasks (random sample)
  const idxs = new Set<number>();
  while (idxs.size < Math.min(k, tasks.length)) {
    idxs.add(Math.floor(rand() * tasks.length));
  }
  let centroids: LatLng[] = Array.from(idxs).map((i) => ({
    lat: tasks[i].location.lat,
    lng: tasks[i].location.lng,
  }));
  let clusters: Task[][] = [];
  for (let it = 0; it < 20; it++) {
    clusters = Array.from({ length: k }, () => []);
    for (const t of tasks) {
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const d = haversine(t.location, centroids[i]);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      clusters[bi].push(t);
    }
    centroids = clusters.map((c, i) => {
      if (!c.length) return centroids[i];
      const lat = c.reduce((s, t) => s + t.location.lat, 0) / c.length;
      const lng = c.reduce((s, t) => s + t.location.lng, 0) / c.length;
      return { lat, lng };
    });
  }
  // tag clusterId
  clusters.forEach((c, i) => c.forEach((t) => (t.clusterId = i)));
  return clusters;
}

function fairnessDiff(users: User[]) {
  const s = users.map((u) => u.fairnessScore);
  return Math.max(...s) - Math.min(...s);
}

function optimizeAssignments(
  users: User[],
  center: LatLng,
  iterations = 120,
) {
  for (let it = 0; it < iterations; it++) {
    const sorted = [...users].sort((a, b) => b.fairnessScore - a.fairnessScore);
    const heavy = sorted[0];
    const light = sorted[sorted.length - 1];
    const cur = fairnessDiff(users);
    let improved = false;
    // try moving heavy user's most-distant (border) tasks to light user
    const sortedTasks = [...heavy.assignedTasks].sort(
      (a, b) => b.centerDistance - a.centerDistance,
    );
    for (const task of sortedTasks) {
      heavy.assignedTasks = heavy.assignedTasks.filter((t) => t.id !== task.id);
      light.assignedTasks.push(task);
      calculateUserMetrics(heavy, center);
      calculateUserMetrics(light, center);
      const nd = fairnessDiff(users);
      if (nd < cur) {
        task.assignedUserId = light.id;
        improved = true;
        break;
      }
      // revert
      light.assignedTasks = light.assignedTasks.filter((t) => t.id !== task.id);
      heavy.assignedTasks.push(task);
      calculateUserMetrics(heavy, center);
      calculateUserMetrics(light, center);
    }
    if (!improved) break;
  }
}

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
  totalWorkload: number;
  center: LatLng;
  radiusKm: number;
};

export type SimulationConfig = {
  totalUsers?: number;
  totalTasks?: number;
  seed?: number;
  center?: LatLng;
  radiusKm?: number;
};

export function runSimulation(config: SimulationConfig = {}): Simulation {
  const {
    totalUsers = 20,
    totalTasks = 300,
    seed = 42,
    center = defaultOfficeLocation,
    radiusKm = RADIUS_KM,
  } = config;
  const rand = mulberry32(seed);
  const colors = makeColors(totalUsers);
  const cats: Category[] = ["A", "B", "C", "D"];

  // tasks with categories
  const tasks: Task[] = Array.from({ length: totalTasks }, (_, i) => {
    const loc = generatePointInRadius(center.lat, center.lng, radiusKm, rand);
    const cat = cats[Math.floor(rand() * 4)];
    const cfg = CATEGORY_CONFIG[cat];
    return {
      id: `T${i + 1}`,
      location: loc,
      category: cat,
      workloadWeight: cfg.weight,
      avgCompletionHours: cfg.avgHours,
      centerDistance: haversine(center, loc),
    };
  });

  // k-means clustering
  const clusters = createGeoClusters(tasks, totalUsers, rand);

  const users: User[] = Array.from({ length: totalUsers }, (_, i) => ({
    id: `U${i + 1}`,
    color: colors[i],
    clusterId: i,
    assignedTasks: clusters[i] ? [...clusters[i]] : [],
    optimizedRoute: [],
    totalRouteDistance: 0,
    returnDistance: 0,
    totalWorkload: 0,
    totalHours: 0,
    centroid: center,
    hull: [],
    fairnessScore: 0,
  }));
  users.forEach((u) => {
    u.assignedTasks.forEach((t) => (t.assignedUserId = u.id));
    calculateUserMetrics(u, center);
  });

  optimizeAssignments(users, center);
  // reassign IDs after rebalancing
  users.forEach((u) =>
    u.assignedTasks.forEach((t) => (t.assignedUserId = u.id)),
  );

  const totalDistance = users.reduce((s, u) => s + u.totalRouteDistance, 0);
  const totalWorkload = users.reduce((s, u) => s + u.totalWorkload, 0);

  return {
    users,
    tasks,
    fairness: fairnessDiff(users),
    totalDistance,
    totalWorkload,
    center,
    radiusKm,
  };
}
