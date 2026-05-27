// V8 — Priority-Aware Territory Optimization Engine

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

export const PRIORITY_CATEGORIES: Category[] = ["B"];

export const CONFIG = {
  CORE_TASK_PERCENTAGE: 0.8,
  CLUSTER_ITERATIONS: 20,
  OPTIMIZATION_ITERATIONS: 80,
  BORDER_MOVE_DISTANCE_KM: 15,
  OVERLAP_DISTANCE_KM: 8,
  WORKLOAD_WEIGHT: 100,
  DISTANCE_WEIGHT: 0.2,
  COMPACTNESS_WEIGHT: 1.5,
  OVERLAP_WEIGHT: 50,
};

export type Task = {
  id: string;
  location: LatLng;
  category: Category;
  isPriority: boolean;
  isCore: boolean; // true if part of core 80%, false if flexible
  workloadWeight: number;
  avgCompletionHours: number;
  centerDistance: number;
  travelDistance?: number;
  clusterId?: number;
  assignedUserId?: string;
  isBorder?: boolean;
  routePhase?: "priority" | "normal";
  stopIndex?: number;
};

export type CategoryBreakdown = Record<Category, number>;

export type User = {
  id: string;
  color: string;
  clusterId: number;
  assignedTasks: Task[];
  optimizedRoute: Task[];
  priorityRoute: Task[];
  normalRoute: Task[];
  totalRouteDistance: number;
  priorityDistance: number;
  normalDistance: number;
  returnDistance: number;
  totalWorkload: number;
  totalHours: number;
  centroid: LatLng;
  hull: LatLng[];
  compactness: number;
  avgSpread: number;
  overlapCount: number;
  priorityCount: number;
  flexibleCount: number;
  coreCount: number;
  categoryBreakdown: CategoryBreakdown;
  efficiency: number; // workload per km
};

export type OverlapHotspot = {
  a: { userId: string; taskId: string; location: LatLng };
  b: { userId: string; taskId: string; location: LatLng };
  distanceKm: number;
};

export const defaultOfficeLocation: LatLng = { lat: 28.6139, lng: 77.209 };
export const RADIUS_KM = 50;
const EARTH_RADIUS_KM = 6371;

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
  cLat: number,
  cLng: number,
  radiusKm: number,
  rand: () => number,
): LatLng {
  const angle = rand() * 2 * Math.PI;
  const r = radiusKm * Math.sqrt(rand());
  const dLat = (r / EARTH_RADIUS_KM) * (180 / Math.PI);
  const dLng = dLat / Math.cos((cLat * Math.PI) / 180);
  return {
    lat: +(cLat + dLat * Math.cos(angle)).toFixed(6),
    lng: +(cLng + dLng * Math.sin(angle)).toFixed(6),
  };
}

const toRad = (v: number) => (v * Math.PI) / 180;

export function haversine(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

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

function nearestNeighborRoute(tasks: Task[], start: LatLng) {
  const remaining = [...tasks];
  const route: Task[] = [];
  let cur = start;
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
    const next = { ...remaining[bi], travelDistance: bd };
    route.push(next);
    total += bd;
    cur = next.location;
    remaining.splice(bi, 1);
  }
  return { route, totalDistance: total, end: cur };
}

// V8 phased route: center → priority → normal → center
function buildPhasedRoute(tasks: Task[], center: LatLng) {
  const priority = tasks.filter((t) => t.isPriority);
  const normal = tasks.filter((t) => !t.isPriority);
  const p = nearestNeighborRoute(priority, center);
  p.route.forEach((t) => (t.routePhase = "priority"));
  const n = nearestNeighborRoute(normal, p.end);
  n.route.forEach((t) => (t.routePhase = "normal"));
  const lastPoint = n.route.length
    ? n.route[n.route.length - 1].location
    : p.end;
  const returnDistance = haversine(lastPoint, center);
  const route = [...p.route, ...n.route];
  route.forEach((t, i) => (t.stopIndex = i + 1));
  return {
    route,
    priorityRoute: p.route,
    normalRoute: n.route,
    priorityDistance: p.totalDistance,
    normalDistance: n.totalDistance,
    returnDistance,
    totalDistance: p.totalDistance + n.totalDistance + returnDistance,
  };
}

function territoryCenter(tasks: Task[], fallback: LatLng): LatLng {
  if (!tasks.length) return fallback;
  const lat = tasks.reduce((s, t) => s + t.location.lat, 0) / tasks.length;
  const lng = tasks.reduce((s, t) => s + t.location.lng, 0) / tasks.length;
  return { lat, lng };
}

function calculateUserMetrics(user: User, center: LatLng) {
  const r = buildPhasedRoute(user.assignedTasks, center);
  user.optimizedRoute = r.route;
  user.priorityRoute = r.priorityRoute;
  user.normalRoute = r.normalRoute;
  user.totalRouteDistance = r.totalDistance;
  user.priorityDistance = r.priorityDistance;
  user.normalDistance = r.normalDistance;
  user.returnDistance = r.returnDistance;
  user.totalWorkload = user.assignedTasks.reduce(
    (s, t) => s + t.workloadWeight,
    0,
  );
  user.totalHours = user.assignedTasks.reduce(
    (s, t) => s + t.avgCompletionHours,
    0,
  );
  const c = territoryCenter(user.assignedTasks, center);
  user.centroid = user.assignedTasks.length ? c : center;
  const dists = user.assignedTasks.map((t) => haversine(t.location, c));
  user.compactness = dists.reduce((s, d) => s + d, 0);
  user.avgSpread = dists.length ? user.compactness / dists.length : 0;
  user.hull = user.assignedTasks.length
    ? convexHull(user.assignedTasks.map((t) => t.location))
    : [];
  const cb: CategoryBreakdown = { A: 0, B: 0, C: 0, D: 0 };
  user.assignedTasks.forEach((t) => cb[t.category]++);
  user.categoryBreakdown = cb;
  user.priorityCount = user.assignedTasks.filter((t) => t.isPriority).length;
  user.coreCount = user.assignedTasks.filter((t) => t.isCore).length;
  user.flexibleCount = user.assignedTasks.length - user.coreCount;
  user.efficiency =
    user.totalRouteDistance > 0
      ? user.totalWorkload / user.totalRouteDistance
      : 0;
}

// k-means on core tasks with workload awareness
function createCoreTerritories(coreTasks: Task[], k: number) {
  let centroids: LatLng[] = coreTasks.slice(0, k).map((t) => ({ ...t.location }));
  // pad centroids if not enough core tasks
  while (centroids.length < k) {
    centroids.push(
      coreTasks[centroids.length % Math.max(1, coreTasks.length)]?.location ?? {
        lat: 0,
        lng: 0,
      },
    );
  }
  let clusters: Task[][] = [];
  for (let it = 0; it < CONFIG.CLUSTER_ITERATIONS; it++) {
    clusters = Array.from({ length: k }, () => []);
    for (const t of coreTasks) {
      let bi = 0;
      let bs = Infinity;
      for (let i = 0; i < k; i++) {
        const geo = haversine(t.location, centroids[i]);
        const cw = clusters[i].reduce((s, x) => s + x.workloadWeight, 0);
        const score = geo + cw * 1.5;
        if (score < bs) {
          bs = score;
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
  clusters.forEach((c, i) => c.forEach((t) => (t.clusterId = i)));
  return { clusters, centroids };
}

// Assign flexible tasks to existing territories (workload-aware)
function assignFlexibleTasks(
  flexible: Task[],
  clusters: Task[][],
  centroids: LatLng[],
) {
  for (const t of flexible) {
    let bi = 0;
    let bs = Infinity;
    for (let i = 0; i < centroids.length; i++) {
      const geo = haversine(t.location, centroids[i]);
      const cw = clusters[i].reduce((s, x) => s + x.workloadWeight, 0);
      const score = geo + cw * 0.8;
      if (score < bs) {
        bs = score;
        bi = i;
      }
    }
    t.clusterId = bi;
    clusters[bi].push(t);
  }
}

function calculateOverlapPenalty(users: User[]) {
  let penalty = 0;
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      for (const a of users[i].assignedTasks) {
        for (const b of users[j].assignedTasks) {
          if (haversine(a.location, b.location) < CONFIG.OVERLAP_DISTANCE_KM) {
            penalty += CONFIG.OVERLAP_WEIGHT;
          }
        }
      }
    }
  }
  return penalty;
}

function userScore(u: User) {
  return (
    u.totalWorkload * CONFIG.WORKLOAD_WEIGHT +
    u.totalRouteDistance * CONFIG.DISTANCE_WEIGHT +
    u.compactness * CONFIG.COMPACTNESS_WEIGHT
  );
}

function globalScore(users: User[]) {
  const overlap = calculateOverlapPenalty(users);
  const s = users.map(userScore);
  return Math.max(...s) - Math.min(...s) + overlap;
}

function getBorderTasks(user: User): Task[] {
  if (!user.assignedTasks.length) return [];
  const c = user.centroid;
  // prefer moving flexible/non-priority tasks; priorities are sticky
  return [...user.assignedTasks]
    .map((t) => ({
      t,
      d: haversine(t.location, c) * (t.isPriority ? 0.4 : 1) * (t.isCore ? 0.7 : 1.3),
    }))
    .sort((a, b) => b.d - a.d)
    .slice(0, Math.max(3, Math.ceil(user.assignedTasks.length * CONFIG.BORDER_TASK_PERCENTAGE)))
    .map((x) => x.t);
}

const BORDER_TASK_PERCENTAGE_FACTOR = 0.3;
// extend config with border task percentage
(CONFIG as any).BORDER_TASK_PERCENTAGE = BORDER_TASK_PERCENTAGE_FACTOR;

function optimizeTerritories(users: User[], center: LatLng) {
  for (let it = 0; it < CONFIG.OPTIMIZATION_ITERATIONS; it++) {
    const cur = globalScore(users);
    users.sort((a, b) => userScore(b) - userScore(a));
    const heavy = users[0];
    const border = getBorderTasks(heavy);
    let improved = false;
    for (const task of border) {
      for (const target of users) {
        if (target.id === heavy.id) continue;
        const nearby = target.assignedTasks.some(
          (tt) =>
            haversine(task.location, tt.location) <
            CONFIG.BORDER_MOVE_DISTANCE_KM,
        );
        if (!nearby) continue;
        heavy.assignedTasks = heavy.assignedTasks.filter((t) => t.id !== task.id);
        target.assignedTasks.push(task);
        calculateUserMetrics(heavy, center);
        calculateUserMetrics(target, center);
        const nd = globalScore(users);
        if (nd < cur) {
          task.assignedUserId = target.id;
          task.clusterId = target.clusterId;
          improved = true;
          break;
        }
        target.assignedTasks = target.assignedTasks.filter((t) => t.id !== task.id);
        heavy.assignedTasks.push(task);
        calculateUserMetrics(heavy, center);
        calculateUserMetrics(target, center);
      }
      if (improved) break;
    }
    if (!improved) break;
  }
}

function computeOverlapHotspots(users: User[]): OverlapHotspot[] {
  const out: OverlapHotspot[] = [];
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      for (const a of users[i].assignedTasks) {
        for (const b of users[j].assignedTasks) {
          const d = haversine(a.location, b.location);
          if (d < CONFIG.OVERLAP_DISTANCE_KM) {
            out.push({
              a: { userId: users[i].id, taskId: a.id, location: a.location },
              b: { userId: users[j].id, taskId: b.id, location: b.location },
              distanceKm: d,
            });
          }
        }
      }
    }
  }
  return out;
}

function tagBorderAndOverlap(users: User[]) {
  users.forEach((u) => {
    u.assignedTasks.forEach((t) => (t.isBorder = false));
    getBorderTasks(u).forEach((t) => {
      const ref = u.assignedTasks.find((x) => x.id === t.id);
      if (ref) ref.isBorder = true;
      const ro = u.optimizedRoute.find((x) => x.id === t.id);
      if (ro) ro.isBorder = true;
    });
  });
  users.forEach((u) => (u.overlapCount = 0));
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      let pairs = 0;
      for (const a of users[i].assignedTasks) {
        for (const b of users[j].assignedTasks) {
          if (haversine(a.location, b.location) < CONFIG.OVERLAP_DISTANCE_KM) {
            pairs++;
          }
        }
      }
      users[i].overlapCount += pairs;
      users[j].overlapCount += pairs;
    }
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
  coreTasks: Task[];
  flexibleTasks: Task[];
  priorityTasks: Task[];
  overlapPenalty: number;
  overlapHotspots: OverlapHotspot[];
  totalDistance: number;
  totalWorkload: number;
  totalHours: number;
  avgCompactness: number;
  totalPriority: number;
  totalFlexible: number;
  workloadStdDev: number;
  workloadDelta: number;
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

  const tasks: Task[] = Array.from({ length: totalTasks }, (_, i) => {
    const loc = generatePointInRadius(center.lat, center.lng, radiusKm, rand);
    const cat = cats[Math.floor(rand() * 4)];
    const cfg = CATEGORY_CONFIG[cat];
    return {
      id: `T${i + 1}`,
      location: loc,
      category: cat,
      isPriority: PRIORITY_CATEGORIES.includes(cat),
      isCore: false,
      workloadWeight: cfg.weight,
      avgCompletionHours: cfg.avgHours,
      centerDistance: haversine(center, loc),
    };
  });

  // V8: priority tasks ALWAYS in core 80%
  const coreTargetCount = Math.floor(totalTasks * CONFIG.CORE_TASK_PERCENTAGE);
  const priority = tasks.filter((t) => t.isPriority);
  const normal = tasks.filter((t) => !t.isPriority);
  // sort normals by distance from center (closer = more stable territory definers)
  normal.sort((a, b) => a.centerDistance - b.centerDistance);
  const coreNormalsCount = Math.max(0, coreTargetCount - priority.length);
  const coreNormals = normal.slice(0, coreNormalsCount);
  const flexible = normal.slice(coreNormalsCount);
  const core = [...priority, ...coreNormals];
  core.forEach((t) => (t.isCore = true));
  flexible.forEach((t) => (t.isCore = false));

  const { clusters, centroids } = createCoreTerritories(core, totalUsers);
  assignFlexibleTasks(flexible, clusters, centroids);

  const users: User[] = Array.from({ length: totalUsers }, (_, i) => ({
    id: `U${i + 1}`,
    color: colors[i],
    clusterId: i,
    assignedTasks: clusters[i] ? [...clusters[i]] : [],
    optimizedRoute: [],
    priorityRoute: [],
    normalRoute: [],
    totalRouteDistance: 0,
    priorityDistance: 0,
    normalDistance: 0,
    returnDistance: 0,
    totalWorkload: 0,
    totalHours: 0,
    centroid: center,
    hull: [],
    compactness: 0,
    avgSpread: 0,
    overlapCount: 0,
    priorityCount: 0,
    flexibleCount: 0,
    coreCount: 0,
    categoryBreakdown: { A: 0, B: 0, C: 0, D: 0 },
    efficiency: 0,
  }));
  users.forEach((u) => {
    u.assignedTasks.forEach((t) => (t.assignedUserId = u.id));
    calculateUserMetrics(u, center);
  });

  optimizeTerritories(users, center);

  users.forEach((u) => {
    u.assignedTasks.forEach((t) => (t.assignedUserId = u.id));
    calculateUserMetrics(u, center);
  });

  tagBorderAndOverlap(users);

  const overlapPenalty = calculateOverlapPenalty(users);
  const overlapHotspots = computeOverlapHotspots(users);
  const totalDistance = users.reduce((s, u) => s + u.totalRouteDistance, 0);
  const totalWorkload = users.reduce((s, u) => s + u.totalWorkload, 0);
  const totalHours = users.reduce((s, u) => s + u.totalHours, 0);
  const avgCompactness =
    users.reduce((s, u) => s + u.avgSpread, 0) / Math.max(1, users.length);
  const wls = users.map((u) => u.totalWorkload);
  const mean = wls.reduce((s, w) => s + w, 0) / Math.max(1, wls.length);
  const variance =
    wls.reduce((s, w) => s + (w - mean) ** 2, 0) / Math.max(1, wls.length);
  const workloadStdDev = Math.sqrt(variance);
  const workloadDelta = Math.max(...wls) - Math.min(...wls);

  return {
    users,
    tasks,
    coreTasks: core,
    flexibleTasks: flexible,
    priorityTasks: priority,
    overlapPenalty,
    overlapHotspots,
    totalDistance,
    totalWorkload,
    totalHours,
    avgCompactness,
    totalPriority: priority.length,
    totalFlexible: flexible.length,
    workloadStdDev,
    workloadDelta,
    center,
    radiusKm,
  };
}
