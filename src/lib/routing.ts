// V9 Workforce Dispatch Engine — TypeScript port
// Hierarchy: Region → Territory → Core/Reserve Jobs → Installer

export type LatLng = { lat: number; lng: number };
export type Category = "A" | "B" | "C" | "D";
export type DispatchType = "PRIORITY" | "RESERVE" | "AUTO_RESERVE";
export type PriorityLevel = 1 | 2 | 3 | 4 | 5;
export type DispatchPath = "SAME_REGION" | "NEIGHBOR_REGION" | "GLOBAL";

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  4: "EMERGENCY",
  3: "HIGH",
  1: "NORMAL",
  2: "LOW",
  5: "VERY_LOW",
};
export const PRIORITY_RANK: Record<PriorityLevel, number> = {
  4: 1,
  3: 2,
  1: 3,
  2: 4,
  5: 5,
};
export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  4: "#ef4444",
  3: "#f97316",
  1: "#3b82f6",
  2: "#a3a3a3",
  5: "#737373",
};

export const CATEGORY_CONFIG: Record<
  Category,
  { weight: number; avgHours: number; priority: boolean; color: string }
> = {
  A: { weight: 0.25, avgHours: 1, priority: false, color: "#22c55e" },
  B: { weight: 1, avgHours: 4, priority: true, color: "#3b82f6" },
  C: { weight: 0.5, avgHours: 2, priority: false, color: "#eab308" },
  D: { weight: 2, avgHours: 8, priority: false, color: "#ef4444" },
};

export const SCORING = {
  AVAILABILITY_WEIGHT: 0.5,
  DISTANCE_WEIGHT: 0.4,
  REGION_WEIGHT: 0.1,
};

export const CONFIG = {
  RESERVE_RELEASE_BATCH_SIZE: 2,
  RESERVE_ELIGIBILITY_THRESHOLD: 0.2,
  AUTO_RESERVE_BATCH_LIMIT: 5,
  CORE_PERCENT: 0.8,
  ANCHOR_PERCENT: 0.3,
  BORDER_PERCENT: 0.3,
  SHIFT_CAPACITY: 8,
};

export const defaultOfficeLocation: LatLng = { lat: 28.6139, lng: 77.209 };
export const RADIUS_KM = 50;
const EARTH = 6371;

export type Job = {
  id: string;
  category: Category;
  weight: number;
  avgHours: number;
  priority: boolean;
  priorityLevel?: PriorityLevel;
  lat: number;
  lng: number;
  regionId?: string;
  territoryId?: string;
  isCore?: boolean;
  isAnchor?: boolean;
  isBorder?: boolean;
  isReserve?: boolean;
  routeStop?: number;
  arrivalIndex?: number;
  external?: boolean; // priority jobs added live
};

export type Installer = {
  id: string;
  color: string;
  assignedWorkload: number;
  completedWorkload: number;
  remainingWorkload: number;
  shiftCapacity: number;
  availableCapacity: number;
  availabilityScore: number;
  utilization: number;
  regionId: string | null;
  territoryId: string | null;
  eligible: boolean;
  capacityStatus: "HEALTHY" | "WARNING" | "FULL";
};

export type Territory = {
  id: string;
  regionId: string;
  installerId: string;
  ownerInstallerId: string;
  jobs: Job[];
  coreJobs: Job[];
  reserveJobs: Job[];
  anchorJobs: Job[];
  borderJobs: Job[];
  optimizedRoute: Job[];
  routeDistance: number;
  seed: LatLng;
  center: LatLng;
  workload: number;
  coreWorkload: number;
  reserveWorkload: number;
  spread: number;
  efficiency: number; // workload / routeDistance
};

export type Region = {
  id: string;
  color: string;
  jobs: Job[];
  territories: Territory[];
  installerCount: number;
  seed: LatLng;
  center: LatLng;
  workload: number;
  neighbors: string[];
};

export type PriorityAssignment = {
  id: string;
  jobId: string;
  regionId: string;
  assignedTo: string;
  dispatchType: DispatchType;
  dispatchPath: DispatchPath;
  priorityLevel: PriorityLevel;
  workload: number;
  score: number;
  createdAt: number;
};

export type ReserveAssignment = {
  id: string;
  territoryId: string;
  territoryOwner: string;
  assignedTo: string;
  dispatchType: DispatchType;
  temporaryAssignment: boolean;
  reason: string;
  score: number;
  jobIds: string[];
  workload: number;
  createdAt: number;
};

export type EngineEvent =
  | {
      kind: "JOB_ARRIVAL";
      t: number;
      jobId: string;
      priorityLevel: PriorityLevel;
      regionId: string;
      workload: number;
    }
  | {
      kind: "PRIORITY_DISPATCH";
      t: number;
      jobId: string;
      installerId: string;
      dispatchPath: DispatchPath;
      score: number;
      regionId: string;
    }
  | {
      kind: "RESERVE_RELEASE";
      t: number;
      installerId: string;
      territoryId: string;
      jobIds: string[];
    }
  | {
      kind: "AUTO_RESERVE";
      t: number;
      installerId: string;
      jobId: string;
      score: number;
    }
  | {
      kind: "COMPLETION";
      t: number;
      installerId: string;
      completedWorkload: number;
      remainingWorkload: number;
    }
  | {
      kind: "CAPACITY_BLOCK";
      t: number;
      installerId: string;
      required: number;
      available: number;
      jobId?: string;
    }
  | {
      kind: "RESERVE_DISPATCH";
      t: number;
      territoryId: string;
      installerId: string;
      score: number;
      jobIds: string[];
    };

export type SimulationState = {
  jobs: Job[];
  installers: Installer[];
  regions: Region[];
  territories: Territory[];
  priorityQueue: Job[];
  priorityAssignments: PriorityAssignment[];
  reserveAssignments: ReserveAssignment[];
  events: EngineEvent[];
  dispatchMetrics: Record<DispatchType, number>;
  capacityBlocks: number;
  center: LatLng;
  radiusKm: number;
  regionCount: number;
  totalJobs: number;
  totalInstallers: number;
  tCounter: number;
};

export type SimulationConfig = {
  totalJobs?: number;
  totalInstallers?: number;
  regionCount?: number;
  seed?: number;
  center?: LatLng;
  radiusKm?: number;
};

// ====== utils ======
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
const toRad = (v: number) => (v * Math.PI) / 180;
export function haversine(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
export function convexHull(points: LatLng[]): LatLng[] {
  if (points.length < 3) return [...points];
  const pts = [...points].sort((a, b) =>
    a.lng === b.lng ? a.lat - b.lat : a.lng - b.lng,
  );
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: LatLng[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: LatLng[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
function centroid(jobs: { lat: number; lng: number }[], fallback: LatLng): LatLng {
  if (!jobs.length) return fallback;
  return {
    lat: jobs.reduce((s, j) => s + j.lat, 0) / jobs.length,
    lng: jobs.reduce((s, j) => s + j.lng, 0) / jobs.length,
  };
}
function makeColors(n: number, sat = 70, light = 50) {
  return Array.from({ length: n }, (_, i) => {
    const hue = Math.round((360 / Math.max(1, n)) * i);
    return `hsl(${hue} ${sat}% ${light}%)`;
  });
}

function randomCategory(r: () => number): Category {
  const v = r();
  if (v < 0.4) return "A";
  if (v < 0.7) return "B";
  if (v < 0.9) return "C";
  return "D";
}

function generateJobs(total: number, center: LatLng, radiusKm: number, rand: () => number): Job[] {
  const out: Job[] = [];
  for (let i = 1; i <= total; i++) {
    const cat = randomCategory(rand);
    const cfg = CATEGORY_CONFIG[cat];
    // uniform in radius
    const angle = rand() * 2 * Math.PI;
    const r = radiusKm * Math.sqrt(rand());
    const dLat = (r / EARTH) * (180 / Math.PI);
    const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
    out.push({
      id: `T${i}`,
      category: cat,
      weight: cfg.weight,
      avgHours: cfg.avgHours,
      priority: cfg.priority,
      priorityLevel: cfg.priority ? 3 : undefined,
      lat: +(center.lat + dLat * Math.cos(angle)).toFixed(6),
      lng: +(center.lng + dLng * Math.sin(angle)).toFixed(6),
    });
  }
  return out;
}

function generateInstallers(count: number): Installer[] {
  const colors = makeColors(count, 78, 45);
  return Array.from({ length: count }, (_, i) => ({
    id: `U${i + 1}`,
    color: colors[i],
    assignedWorkload: 0,
    completedWorkload: 0,
    remainingWorkload: 0,
    shiftCapacity: CONFIG.SHIFT_CAPACITY,
    availableCapacity: CONFIG.SHIFT_CAPACITY,
    availabilityScore: 0,
    utilization: 0,
    regionId: null,
    territoryId: null,
    eligible: false,
    capacityStatus: "HEALTHY",
  }));
}

function farthestPointSeeds<T extends LatLng>(items: T[], k: number): T[] {
  const seeds: T[] = [];
  if (!items.length) return seeds;
  seeds.push(items[0]);
  while (seeds.length < k) {
    let best: T | null = null;
    let bestD = -1;
    for (const it of items) {
      let nearest = Infinity;
      for (const s of seeds) nearest = Math.min(nearest, haversine(it, s));
      if (nearest > bestD) {
        bestD = nearest;
        best = it;
      }
    }
    if (best) seeds.push(best);
    else break;
  }
  return seeds;
}

function allocateInstallersToRegions(
  regions: Region[],
  totalInstallers: number,
  totalJobs: number,
) {
  let assigned = 0;
  regions.forEach((r) => {
    r.installerCount = Math.max(
      1,
      Math.round((r.jobs.length / Math.max(1, totalJobs)) * totalInstallers),
    );
    assigned += r.installerCount;
  });
  while (assigned > totalInstallers) {
    const largest = [...regions].sort((a, b) => b.installerCount - a.installerCount)[0];
    if (largest.installerCount > 1) {
      largest.installerCount--;
      assigned--;
    } else break;
  }
  while (assigned < totalInstallers) {
    const largest = [...regions].sort((a, b) => b.jobs.length - a.jobs.length)[0];
    largest.installerCount++;
    assigned++;
  }
}

function createTerritories(region: Region): Territory[] {
  if (!region.jobs.length || !region.installerCount) return [];
  const seeds = farthestPointSeeds(region.jobs, region.installerCount);
  const territories: Territory[] = [];
  for (let i = 0; i < region.installerCount; i++) {
    const s = seeds[i] ?? region.jobs[0];
    territories.push({
      id: `${region.id}-T${i + 1}`,
      regionId: region.id,
      installerId: "UNASSIGNED",
      ownerInstallerId: "UNASSIGNED",
      jobs: [],
      coreJobs: [],
      reserveJobs: [],
      anchorJobs: [],
      borderJobs: [],
      optimizedRoute: [],
      routeDistance: 0,
      seed: { lat: s.lat, lng: s.lng },
      center: { lat: s.lat, lng: s.lng },
      workload: 0,
      coreWorkload: 0,
      reserveWorkload: 0,
      spread: 0,
      efficiency: 0,
    });
  }
  const regionWorkload = region.jobs.reduce((s, j) => s + j.weight, 0);
  const target = regionWorkload / region.installerCount;
  const sortedJobs = [...region.jobs].sort((a, b) => b.weight - a.weight);
  for (const job of sortedJobs) {
    let best: Territory | null = null;
    let bestScore = Infinity;
    for (const t of territories) {
      const dist = haversine(job, t.seed);
      const cur = t.jobs.reduce((s, j) => s + j.weight, 0);
      const penalty = cur > target ? cur - target : 0;
      const score = dist + penalty * 15;
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    if (best) {
      best.jobs.push(job);
      job.territoryId = best.id;
    }
  }
  return territories;
}

function identifyAnchorBorder(t: Territory) {
  if (!t.jobs.length) {
    t.anchorJobs = [];
    t.borderJobs = [];
    return;
  }
  const c = centroid(t.jobs, t.seed);
  t.center = c;
  const withDist = t.jobs.map((j) => ({ j, d: haversine(c, j) }));
  withDist.sort((a, b) => a.d - b.d);
  const anchorN = Math.max(1, Math.ceil(t.jobs.length * CONFIG.ANCHOR_PERCENT));
  const anchorIds = new Set(withDist.slice(0, anchorN).map((x) => x.j.id));
  t.jobs.forEach((j) => {
    if (j.priority) anchorIds.add(j.id);
  });
  t.anchorJobs = t.jobs.filter((j) => anchorIds.has(j.id));
  t.jobs.forEach((j) => (j.isAnchor = anchorIds.has(j.id)));
  withDist.sort((a, b) => b.d - a.d);
  const borderN = Math.max(1, Math.ceil(t.jobs.length * CONFIG.BORDER_PERCENT));
  const borderIds = new Set(withDist.slice(0, borderN).map((x) => x.j.id));
  t.borderJobs = t.jobs.filter((j) => borderIds.has(j.id));
  t.jobs.forEach((j) => (j.isBorder = borderIds.has(j.id)));
  t.spread = withDist.length ? withDist[0].d : 0;
}

function createCoreReserve(t: Territory) {
  const total = t.jobs.length;
  const targetCore = Math.ceil(total * CONFIG.CORE_PERCENT);
  const coreMap = new Map<string, Job>();
  t.jobs.filter((j) => j.priority).forEach((j) => coreMap.set(j.id, j));
  const nonP = t.jobs.filter((j) => !j.priority).sort((a, b) => b.weight - a.weight);
  for (const j of nonP) {
    if (coreMap.size >= targetCore) break;
    coreMap.set(j.id, j);
  }
  t.coreJobs = [...coreMap.values()];
  t.reserveJobs = t.jobs.filter((j) => !coreMap.has(j.id));
  t.coreJobs.forEach((j) => {
    j.isCore = true;
    j.isReserve = false;
  });
  t.reserveJobs.forEach((j) => {
    j.isCore = false;
    j.isReserve = true;
  });
}

function nearestNeighborRoute(jobs: Job[]): { route: Job[]; distance: number } {
  if (jobs.length <= 1) return { route: [...jobs], distance: 0 };
  const remaining = [...jobs];
  const route: Job[] = [remaining.shift()!];
  let total = 0;
  while (remaining.length) {
    const cur = route[route.length - 1];
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversine(cur, remaining[i]);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    total += bd;
    route.push(remaining.splice(bi, 1)[0]);
  }
  route.forEach((j, i) => (j.routeStop = i + 1));
  return { route, distance: total };
}

function recomputeTerritory(t: Territory) {
  t.workload = t.jobs.reduce((s, j) => s + j.weight, 0);
  t.coreWorkload = t.coreJobs.reduce((s, j) => s + j.weight, 0);
  t.reserveWorkload = t.reserveJobs.reduce((s, j) => s + j.weight, 0);
  const r = nearestNeighborRoute(t.coreJobs);
  t.optimizedRoute = r.route;
  t.routeDistance = r.distance;
  t.efficiency = r.distance > 0 ? t.coreWorkload / r.distance : t.coreWorkload;
}

function recomputeInstaller(i: Installer) {
  i.remainingWorkload = Math.max(0, i.assignedWorkload - i.completedWorkload);
  i.availabilityScore = 1 / (i.remainingWorkload + 1);
  i.availableCapacity = Math.max(0, i.shiftCapacity - i.assignedWorkload);
  i.utilization = i.shiftCapacity > 0 ? Math.min(1, i.assignedWorkload / i.shiftCapacity) : 0;
  i.eligible =
    i.assignedWorkload > 0 &&
    (i.remainingWorkload === 0 ||
      i.remainingWorkload / i.assignedWorkload <= CONFIG.RESERVE_ELIGIBILITY_THRESHOLD);
  i.capacityStatus =
    i.utilization >= 0.99 ? "FULL" : i.utilization >= 0.8 ? "WARNING" : "HEALTHY";
}

function rebalanceRegion(region: Region) {
  if (region.territories.length < 2) return;
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    const stats = region.territories
      .map((t) => ({ t, w: t.jobs.reduce((s, j) => s + j.weight, 0) }))
      .sort((a, b) => a.w - b.w);
    const under = stats[0];
    const over = stats[stats.length - 1];
    const gap = Math.abs(over.w - under.w);
    let best: { job: Job; gap: number } | null = null;
    over.t.borderJobs.forEach((job) => {
      const after = Math.abs(over.w - job.weight - (under.w + job.weight));
      if (after < gap && (!best || after < best.gap)) best = { job, gap: after };
    });
    if (best !== null) {
      const move = best as { job: Job; gap: number };
      over.t.jobs = over.t.jobs.filter((j) => j.id !== move.job.id);
      under.t.jobs.push(move.job);
      move.job.territoryId = under.t.id;
      identifyAnchorBorder(over.t);
      identifyAnchorBorder(under.t);
      createCoreReserve(over.t);
      createCoreReserve(under.t);
      improved = true;
    }
  }
}

// neighbors: simple — k nearest regions by seed
function computeNeighbors(regions: Region[]) {
  regions.forEach((r) => {
    const others = regions
      .filter((o) => o.id !== r.id)
      .map((o) => ({ id: o.id, d: haversine(r.seed, o.seed) }))
      .sort((a, b) => a.d - b.d);
    r.neighbors = others.slice(0, Math.min(2, others.length)).map((o) => o.id);
  });
}

function dispatchScore(
  installer: Installer,
  territory: Territory,
  territoryMap: Map<string, Territory>,
) {
  let distance = Infinity;
  const own = installer.territoryId ? territoryMap.get(installer.territoryId) : undefined;
  if (own) distance = haversine(own.center, territory.center);
  const regionBonus = installer.regionId === territory.regionId ? 1 : 0;
  return (
    installer.availabilityScore * SCORING.AVAILABILITY_WEIGHT +
    (1 / (distance + 1)) * SCORING.DISTANCE_WEIGHT +
    regionBonus * SCORING.REGION_WEIGHT
  );
}

// ====== build initial simulation ======
export function runV9Simulation(cfg: SimulationConfig = {}): SimulationState {
  const {
    totalJobs = 200,
    totalInstallers = 12,
    seed = 42,
    center = defaultOfficeLocation,
    radiusKm = RADIUS_KM,
  } = cfg;
  const regionCount =
    cfg.regionCount ?? Math.max(1, Math.round(Math.sqrt(totalInstallers)));
  const rand = mulberry32(seed);

  const jobs = generateJobs(totalJobs, center, radiusKm, rand);
  const installers = generateInstallers(totalInstallers);

  const regionColors = makeColors(regionCount, 60, 55);
  const regions: Region[] = Array.from({ length: regionCount }, (_, i) => ({
    id: `R${i + 1}`,
    color: regionColors[i],
    jobs: [],
    territories: [],
    installerCount: 0,
    seed: { lat: 0, lng: 0 },
    center: { lat: 0, lng: 0 },
    workload: 0,
    neighbors: [],
  }));

  const regionSeeds = farthestPointSeeds(jobs, regionCount);
  regionSeeds.forEach((s, i) => {
    regions[i].seed = { lat: s.lat, lng: s.lng };
  });

  for (const job of jobs) {
    let bi = 0;
    let bd = Infinity;
    regionSeeds.forEach((s, i) => {
      const d = haversine(job, s);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    regions[bi].jobs.push(job);
    job.regionId = regions[bi].id;
  }

  allocateInstallersToRegions(regions, totalInstallers, totalJobs);

  regions.forEach((r) => {
    r.territories = createTerritories(r);
    r.center = centroid(r.jobs, r.seed);
    r.workload = r.jobs.reduce((s, j) => s + j.weight, 0);
  });

  // assign installers (one per territory)
  let idx = 0;
  regions.forEach((r) => {
    r.territories.forEach((t) => {
      const ins = installers[idx];
      if (ins) {
        t.installerId = ins.id;
        t.ownerInstallerId = ins.id;
        ins.regionId = r.id;
        ins.territoryId = t.id;
      }
      idx++;
    });
  });

  // process territories (anchors, borders, core/reserve)
  regions.forEach((r) =>
    r.territories.forEach((t) => {
      identifyAnchorBorder(t);
      createCoreReserve(t);
    }),
  );

  rebalanceRegions(regions);

  regions.forEach((r) => r.territories.forEach((t) => recomputeTerritory(t)));

  // installer states
  const installerMap = new Map(installers.map((i) => [i.id, i]));
  regions.forEach((r) =>
    r.territories.forEach((t) => {
      const ins = installerMap.get(t.installerId);
      if (!ins) return;
      ins.assignedWorkload = t.coreWorkload;
      ins.completedWorkload = 0;
      recomputeInstaller(ins);
    }),
  );

  computeNeighbors(regions);

  const territories = regions.flatMap((r) => r.territories);

  const state: SimulationState = {
    jobs,
    installers,
    regions,
    territories,
    priorityQueue: [],
    priorityAssignments: [],
    reserveAssignments: [],
    events: [],
    dispatchMetrics: { PRIORITY: 0, RESERVE: 0, AUTO_RESERVE: 0 },
    capacityBlocks: 0,
    center,
    radiusKm,
    regionCount,
    totalJobs,
    totalInstallers,
    tCounter: 0,
  };
  return state;
}

function rebalanceRegions(regions: Region[]) {
  regions.forEach(rebalanceRegion);
}

// ====== dynamic actions (return NEW state) ======
function clone(state: SimulationState): SimulationState {
  // deep clone — jobs are referenced from many arrays; use JSON round-trip then rebuild Maps
  const json = JSON.parse(JSON.stringify(state)) as SimulationState;
  // re-link references: territories/regions hold COPIES of job objects, but UI doesn't depend on identity, so OK.
  // For dispatch logic we still need to mutate the same job in jobs[] and in territory arrays — re-link by id.
  const jobById = new Map(json.jobs.map((j) => [j.id, j]));
  json.regions.forEach((r) => {
    r.jobs = r.jobs.map((j) => jobById.get(j.id) ?? j);
    r.territories.forEach((t) => {
      t.jobs = t.jobs.map((j) => jobById.get(j.id) ?? j);
      t.coreJobs = t.coreJobs.map((j) => jobById.get(j.id) ?? j);
      t.reserveJobs = t.reserveJobs.map((j) => jobById.get(j.id) ?? j);
      t.anchorJobs = t.anchorJobs.map((j) => jobById.get(j.id) ?? j);
      t.borderJobs = t.borderJobs.map((j) => jobById.get(j.id) ?? j);
      t.optimizedRoute = t.optimizedRoute.map((j) => jobById.get(j.id) ?? j);
    });
  });
  json.territories = json.regions.flatMap((r) => r.territories);
  return json;
}

function findTerritory(state: SimulationState, id: string | null) {
  if (!id) return undefined;
  return state.territories.find((t) => t.id === id);
}

function tryDispatch(
  state: SimulationState,
  installer: Installer,
  workload: number,
  dispatchType: DispatchType,
  jobId?: string,
): boolean {
  if (installer.availableCapacity < workload) {
    state.capacityBlocks++;
    state.events.push({
      kind: "CAPACITY_BLOCK",
      t: ++state.tCounter,
      installerId: installer.id,
      required: workload,
      available: installer.availableCapacity,
      jobId,
    });
    return false;
  }
  installer.assignedWorkload += workload;
  recomputeInstaller(installer);
  state.dispatchMetrics[dispatchType]++;
  return true;
}

function autoReserveFor(state: SimulationState, installer: Installer) {
  let made = 0;
  while (installer.eligible && made < CONFIG.AUTO_RESERVE_BATCH_LIMIT) {
    const t = findTerritory(state, installer.territoryId);
    if (!t || t.reserveJobs.length === 0) break;
    const job = t.reserveJobs[0];
    const ok = tryDispatch(state, installer, job.weight, "AUTO_RESERVE", job.id);
    if (!ok) break;
    t.reserveJobs.shift();
    job.isCore = true;
    job.isReserve = false;
    t.coreJobs.push(job);
    recomputeTerritory(t);
    state.reserveAssignments.push({
      id: `RA-${state.tCounter}`,
      territoryId: t.id,
      territoryOwner: t.ownerInstallerId,
      assignedTo: installer.id,
      dispatchType: "AUTO_RESERVE",
      temporaryAssignment: installer.id !== t.ownerInstallerId,
      reason: "INSTALLER_ELIGIBLE",
      score: installer.availabilityScore,
      jobIds: [job.id],
      workload: job.weight,
      createdAt: state.tCounter,
    });
    state.events.push({
      kind: "AUTO_RESERVE",
      t: ++state.tCounter,
      installerId: installer.id,
      jobId: job.id,
      score: installer.availabilityScore,
    });
    made++;
  }
}

function releaseReservesAllInstallers(state: SimulationState) {
  state.installers.forEach((ins) => {
    if (!ins.eligible) return;
    const t = findTerritory(state, ins.territoryId);
    if (!t || t.reserveJobs.length === 0) return;
    const released = t.reserveJobs.splice(0, CONFIG.RESERVE_RELEASE_BATCH_SIZE);
    released.forEach((j) => {
      j.isReserve = false;
      j.isCore = true;
    });
    t.coreJobs.push(...released);
    ins.assignedWorkload = t.coreJobs.reduce((s, j) => s + j.weight, 0);
    recomputeInstaller(ins);
    recomputeTerritory(t);
    state.events.push({
      kind: "RESERVE_RELEASE",
      t: ++state.tCounter,
      installerId: ins.id,
      territoryId: t.id,
      jobIds: released.map((j) => j.id),
    });
  });
}

export function simulateCompletion(
  prev: SimulationState,
  installerId: string,
  percent: number,
): SimulationState {
  const state = clone(prev);
  const installer = state.installers.find((i) => i.id === installerId);
  if (!installer) return state;
  const completedDelta = installer.assignedWorkload * percent;
  installer.completedWorkload = Math.min(
    installer.assignedWorkload,
    installer.completedWorkload + completedDelta,
  );
  recomputeInstaller(installer);
  state.events.push({
    kind: "COMPLETION",
    t: ++state.tCounter,
    installerId: installer.id,
    completedWorkload: completedDelta,
    remainingWorkload: installer.remainingWorkload,
  });
  if (installer.eligible) {
    releaseReservesAllInstallers(state);
    autoReserveFor(state, installer);
  }
  return state;
}

function findBestForPriority(state: SimulationState, regionId: string): {
  installer: Installer | null;
  path: DispatchPath;
} {
  const sameRegion = state.installers
    .filter((i) => i.regionId === regionId)
    .sort((a, b) => a.remainingWorkload - b.remainingWorkload)[0];
  if (sameRegion) return { installer: sameRegion, path: "SAME_REGION" };

  const region = state.regions.find((r) => r.id === regionId);
  const neighbors = region?.neighbors ?? [];
  const neighborInstaller = state.installers
    .filter((i) => i.regionId && neighbors.includes(i.regionId))
    .sort((a, b) => a.remainingWorkload - b.remainingWorkload)[0];
  if (neighborInstaller) return { installer: neighborInstaller, path: "NEIGHBOR_REGION" };

  const global = [...state.installers].sort(
    (a, b) => a.remainingWorkload - b.remainingWorkload,
  )[0];
  return { installer: global ?? null, path: "GLOBAL" };
}

export function dispatchPriorityJob(
  prev: SimulationState,
  jobInput: {
    id?: string;
    regionId: string;
    workload: number;
    priorityLevel: PriorityLevel;
  },
): SimulationState {
  const state = clone(prev);
  const id = jobInput.id ?? `LIVE-${state.priorityAssignments.length + 1}`;
  const job: Job = {
    id,
    category: "B",
    weight: jobInput.workload,
    avgHours: jobInput.workload * 4,
    priority: true,
    priorityLevel: jobInput.priorityLevel,
    lat: state.regions.find((r) => r.id === jobInput.regionId)?.center.lat ?? state.center.lat,
    lng: state.regions.find((r) => r.id === jobInput.regionId)?.center.lng ?? state.center.lng,
    regionId: jobInput.regionId,
    arrivalIndex: state.jobs.length + 1,
    external: true,
  };
  state.jobs.push(job);
  state.events.push({
    kind: "JOB_ARRIVAL",
    t: ++state.tCounter,
    jobId: id,
    priorityLevel: jobInput.priorityLevel,
    regionId: jobInput.regionId,
    workload: jobInput.workload,
  });

  const { installer, path } = findBestForPriority(state, jobInput.regionId);
  if (!installer) return state;
  const score = installer.availabilityScore;
  const ok = tryDispatch(state, installer, jobInput.workload, "PRIORITY", id);
  if (ok) {
    state.priorityAssignments.push({
      id: `PA-${state.tCounter}`,
      jobId: id,
      regionId: jobInput.regionId,
      assignedTo: installer.id,
      dispatchType: "PRIORITY",
      dispatchPath: path,
      priorityLevel: jobInput.priorityLevel,
      workload: jobInput.workload,
      score,
      createdAt: state.tCounter,
    });
    state.events.push({
      kind: "PRIORITY_DISPATCH",
      t: ++state.tCounter,
      jobId: id,
      installerId: installer.id,
      dispatchPath: path,
      score,
      regionId: jobInput.regionId,
    });
  }
  return state;
}

export function manualReserveDispatch(prev: SimulationState): SimulationState {
  const state = clone(prev);
  const territoryMap = new Map(state.territories.map((t) => [t.id, t]));
  state.regions.forEach((r) => {
    r.territories.forEach((t) => {
      if (t.reserveJobs.length === 0) return;
      const ownerEligible = state.installers.find(
        (i) => i.id === t.ownerInstallerId && i.eligible,
      );
      let best: Installer | null = ownerEligible ?? null;
      let bestScore = best ? dispatchScore(best, t, territoryMap) : -Infinity;
      if (!best) {
        for (const ins of state.installers) {
          if (!ins.eligible) continue;
          if (ins.regionId !== t.regionId && !r.neighbors.includes(ins.regionId ?? "")) continue;
          const sc = dispatchScore(ins, t, territoryMap);
          if (sc > bestScore) {
            bestScore = sc;
            best = ins;
          }
        }
      }
      if (!best) return;
      const released = t.reserveJobs.slice(0, CONFIG.RESERVE_RELEASE_BATCH_SIZE);
      const wl = released.reduce((s, j) => s + j.weight, 0);
      const ok = tryDispatch(state, best, wl, "RESERVE");
      if (!ok) return;
      t.reserveJobs.splice(0, released.length);
      released.forEach((j) => {
        j.isReserve = false;
        j.isCore = true;
      });
      t.coreJobs.push(...released);
      recomputeTerritory(t);
      state.reserveAssignments.push({
        id: `RA-${state.tCounter}`,
        territoryId: t.id,
        territoryOwner: t.ownerInstallerId,
        assignedTo: best.id,
        dispatchType: "RESERVE",
        temporaryAssignment: best.id !== t.ownerInstallerId,
        reason: "DISPATCH_SCORE",
        score: bestScore,
        jobIds: released.map((j) => j.id),
        workload: wl,
        createdAt: state.tCounter,
      });
      state.events.push({
        kind: "RESERVE_DISPATCH",
        t: ++state.tCounter,
        territoryId: t.id,
        installerId: best.id,
        score: bestScore,
        jobIds: released.map((j) => j.id),
      });
    });
  });
  return state;
}

export function summary(state: SimulationState) {
  const ins = state.installers;
  const totalAssigned = ins.reduce((s, i) => s + i.assignedWorkload, 0);
  const totalCompleted = ins.reduce((s, i) => s + i.completedWorkload, 0);
  const totalRemaining = ins.reduce((s, i) => s + i.remainingWorkload, 0);
  const totalCapacity = ins.reduce((s, i) => s + i.shiftCapacity, 0);
  const eligible = ins.filter((i) => i.eligible).length;
  const overloaded = ins.filter((i) => i.capacityStatus === "FULL").length;
  const warning = ins.filter((i) => i.capacityStatus === "WARNING").length;
  const coreJobs = state.territories.reduce((s, t) => s + t.coreJobs.length, 0);
  const reserveJobs = state.territories.reduce((s, t) => s + t.reserveJobs.length, 0);
  const coreWorkload = state.territories.reduce((s, t) => s + t.coreWorkload, 0);
  const reserveWorkload = state.territories.reduce((s, t) => s + t.reserveWorkload, 0);
  const routeDistance = state.territories.reduce((s, t) => s + t.routeDistance, 0);
  return {
    totalAssigned,
    totalCompleted,
    totalRemaining,
    totalCapacity,
    capacityUtilization: totalCapacity > 0 ? totalAssigned / totalCapacity : 0,
    eligible,
    overloaded,
    warning,
    coreJobs,
    reserveJobs,
    coreWorkload,
    reserveWorkload,
    routeDistance,
  };
}
