// V7 Fairness-Aware Territory Workforce Routing System

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

export const CONFIG = {
  CLUSTER_ITERATIONS: 20,
  OPTIMIZATION_ITERATIONS: 100,
  BORDER_MOVE_DISTANCE_KM: 15,
  OVERLAP_DISTANCE_KM: 5,
  WORKLOAD_SCORE_WEIGHT: 100,
  DISTANCE_SCORE_WEIGHT: 0.15,
  COMPACTNESS_SCORE_WEIGHT: 1.5,
  OVERLAP_SCORE_WEIGHT: 50,
};

export const FAIRNESS_CONFIG = {
  WORKLOAD_WEIGHT: 0.4,
  DISTANCE_WEIGHT: 0.3,
  COMPACTNESS_WEIGHT: 0.2,
  OVERLAP_WEIGHT: 0.1,
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
  isBorder?: boolean;
};

export type CategoryBreakdown = Record<Category, number>;

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
  compactness: number; // sum of distances of tasks to territory center (lower = more compact)
  avgSpread: number; // avg distance from centroid (km)
  overlapCount: number; // number of own tasks within OVERLAP_DISTANCE_KM of another user's task
  fairnessScore: number;
  categoryBreakdown: CategoryBreakdown;
};

export type OverlapHotspot = {
  a: { userId: string; taskId: string; location: LatLng };
  b: { userId: string; taskId: string; location: LatLng };
  distanceKm: number;
};

export type FairnessReport = {
  overallFairnessScore: number;
  workloadFairness: number;
  distanceFairness: number;
  compactnessFairness: number;
  overlapFairness: number;
  label: "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR" | "VERY POOR";
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

function territoryCenter(tasks: Task[], fallback: LatLng): LatLng {
  if (!tasks.length) return fallback;
  const lat = tasks.reduce((s, t) => s + t.location.lat, 0) / tasks.length;
  const lng = tasks.reduce((s, t) => s + t.location.lng, 0) / tasks.length;
  return { lat, lng };
}

function computeCompactness(tasks: Task[]): {
  total: number;
  avg: number;
  centroid: LatLng;
} {
  if (!tasks.length)
    return { total: 0, avg: 0, centroid: { lat: 0, lng: 0 } };
  const c = territoryCenter(tasks, { lat: 0, lng: 0 });
  const total = tasks.reduce((s, t) => s + haversine(t.location, c), 0);
  return { total, avg: total / tasks.length, centroid: c };
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
  const c = computeCompactness(user.assignedTasks);
  user.compactness = c.total;
  user.avgSpread = c.avg;
  user.centroid = user.assignedTasks.length ? c.centroid : center;
  user.hull = user.assignedTasks.length
    ? convexHull(user.assignedTasks.map((t) => t.location))
    : [];
  const cb: CategoryBreakdown = { A: 0, B: 0, C: 0, D: 0 };
  user.assignedTasks.forEach((t) => {
    cb[t.category]++;
  });
  user.categoryBreakdown = cb;
  user.fairnessScore =
    user.totalWorkload * CONFIG.WORKLOAD_SCORE_WEIGHT +
    user.totalRouteDistance * CONFIG.DISTANCE_SCORE_WEIGHT +
    user.compactness * CONFIG.COMPACTNESS_SCORE_WEIGHT;
}

// V7 territory clustering: workload-aware
function createTerritories(tasks: Task[], k: number) {
  let centroids: LatLng[] = tasks.slice(0, k).map((t) => ({
    lat: t.location.lat,
    lng: t.location.lng,
  }));
  let clusters: Task[][] = [];
  for (let it = 0; it < CONFIG.CLUSTER_ITERATIONS; it++) {
    clusters = Array.from({ length: k }, () => []);
    for (const t of tasks) {
      let bi = 0;
      let bs = Infinity;
      for (let i = 0; i < centroids.length; i++) {
        const geo = haversine(t.location, centroids[i]);
        const cw = clusters[i].reduce((s, x) => s + x.workloadWeight, 0);
        const score = geo + cw * 2;
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
  return clusters;
}

function calculateOverlapPenalty(users: User[]) {
  let penalty = 0;
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      for (const a of users[i].assignedTasks) {
        for (const b of users[j].assignedTasks) {
          if (haversine(a.location, b.location) < CONFIG.OVERLAP_DISTANCE_KM) {
            penalty += CONFIG.OVERLAP_SCORE_WEIGHT;
          }
        }
      }
    }
  }
  return penalty;
}

function getGlobalScore(users: User[]) {
  const overlap = calculateOverlapPenalty(users);
  const scores = users.map((u) => u.fairnessScore);
  return Math.max(...scores) - Math.min(...scores) + overlap;
}

function getBorderTasks(user: User): Task[] {
  if (!user.assignedTasks.length) return [];
  const center = territoryCenter(user.assignedTasks, user.centroid);
  return [...user.assignedTasks]
    .map((t) => ({ t, d: haversine(t.location, center) }))
    .sort((a, b) => b.d - a.d)
    .slice(0, 5)
    .map((x) => x.t);
}

function optimizeTerritories(users: User[], center: LatLng) {
  for (let it = 0; it < CONFIG.OPTIMIZATION_ITERATIONS; it++) {
    const cur = getGlobalScore(users);
    users.sort((a, b) => b.fairnessScore - a.fairnessScore);
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
        heavy.assignedTasks = heavy.assignedTasks.filter(
          (t) => t.id !== task.id,
        );
        target.assignedTasks.push(task);
        calculateUserMetrics(heavy, center);
        calculateUserMetrics(target, center);
        const nd = getGlobalScore(users);
        if (nd < cur) {
          task.assignedUserId = target.id;
          improved = true;
          break;
        }
        // revert
        target.assignedTasks = target.assignedTasks.filter(
          (t) => t.id !== task.id,
        );
        heavy.assignedTasks.push(task);
        calculateUserMetrics(heavy, center);
        calculateUserMetrics(target, center);
      }
      if (improved) break;
    }
    if (!improved) break;
  }
}

function normalize(min: number, max: number) {
  if (max === 0) return 1;
  return 1 - (max - min) / max;
}

function fairnessLabel(score: number): FairnessReport["label"] {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 60) return "AVERAGE";
  if (score >= 40) return "POOR";
  return "VERY POOR";
}

function calculateFairness(users: User[]): FairnessReport {
  const wl = users.map((u) => u.totalWorkload);
  const dt = users.map((u) => u.totalRouteDistance);
  const cp = users.map((u) => u.compactness);
  const workload = normalize(Math.min(...wl), Math.max(...wl));
  const distance = normalize(Math.min(...dt), Math.max(...dt));
  const compact = normalize(Math.min(...cp), Math.max(...cp));
  const overlap = calculateOverlapPenalty(users);
  const overlapF = overlap === 0 ? 1 : 1 / (1 + overlap);
  const final =
    workload * FAIRNESS_CONFIG.WORKLOAD_WEIGHT +
    distance * FAIRNESS_CONFIG.DISTANCE_WEIGHT +
    compact * FAIRNESS_CONFIG.COMPACTNESS_WEIGHT +
    overlapF * FAIRNESS_CONFIG.OVERLAP_WEIGHT;
  const overall = +(final * 100).toFixed(2);
  return {
    overallFairnessScore: overall,
    workloadFairness: +(workload * 100).toFixed(2),
    distanceFairness: +(distance * 100).toFixed(2),
    compactnessFairness: +(compact * 100).toFixed(2),
    overlapFairness: +(overlapF * 100).toFixed(2),
    label: fairnessLabel(overall),
  };
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
  // Border tasks per user (top 5 farthest from centroid)
  users.forEach((u) => {
    u.assignedTasks.forEach((t) => (t.isBorder = false));
    const border = getBorderTasks(u);
    border.forEach((t) => {
      const ref = u.assignedTasks.find((x) => x.id === t.id);
      if (ref) ref.isBorder = true;
      const ro = u.optimizedRoute.find((x) => x.id === t.id);
      if (ro) ro.isBorder = true;
    });
  });
  // Overlap counts
  users.forEach((u) => (u.overlapCount = 0));
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const A = users[i];
      const B = users[j];
      let pairs = 0;
      for (const a of A.assignedTasks) {
        for (const b of B.assignedTasks) {
          if (haversine(a.location, b.location) < CONFIG.OVERLAP_DISTANCE_KM) {
            pairs++;
          }
        }
      }
      A.overlapCount += pairs;
      B.overlapCount += pairs;
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
  fairness: FairnessReport;
  overlapPenalty: number;
  overlapHotspots: OverlapHotspot[];
  totalDistance: number;
  totalWorkload: number;
  avgCompactness: number;
  legacyFairnessDelta: number; // max-min of fairnessScore
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
      workloadWeight: cfg.weight,
      avgCompletionHours: cfg.avgHours,
      centerDistance: haversine(center, loc),
    };
  });

  const clusters = createTerritories(tasks, totalUsers);

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
    compactness: 0,
    avgSpread: 0,
    overlapCount: 0,
    fairnessScore: 0,
    categoryBreakdown: { A: 0, B: 0, C: 0, D: 0 },
  }));
  users.forEach((u) => {
    u.assignedTasks.forEach((t) => (t.assignedUserId = u.id));
    calculateUserMetrics(u, center);
  });

  optimizeTerritories(users, center);

  users.forEach((u) =>
    u.assignedTasks.forEach((t) => (t.assignedUserId = u.id)),
  );

  tagBorderAndOverlap(users);

  const fairness = calculateFairness(users);
  const overlapPenalty = calculateOverlapPenalty(users);
  const overlapHotspots = computeOverlapHotspots(users);
  const totalDistance = users.reduce((s, u) => s + u.totalRouteDistance, 0);
  const totalWorkload = users.reduce((s, u) => s + u.totalWorkload, 0);
  const avgCompactness =
    users.reduce((s, u) => s + u.avgSpread, 0) / Math.max(1, users.length);
  const fs = users.map((u) => u.fairnessScore);
  const legacyFairnessDelta = Math.max(...fs) - Math.min(...fs);

  return {
    users,
    tasks,
    fairness,
    overlapPenalty,
    overlapHotspots,
    totalDistance,
    totalWorkload,
    avgCompactness,
    legacyFairnessDelta,
    center,
    radiusKm,
  };
}
