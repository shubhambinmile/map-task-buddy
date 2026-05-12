export type LatLng = { lat: number; lng: number };

export type User = {
  id: string;
  location: LatLng;
  assignedTasks: string[];
  totalDistance: number;
};

export type Task = {
  id: string;
  location: LatLng;
};

// Users given starting locations around Delhi NCR (data did not include coords)
export const users: User[] = [
  { id: "U1", location: { lat: 28.6139, lng: 77.209 }, assignedTasks: [], totalDistance: 0 },
  { id: "U2", location: { lat: 28.7041, lng: 77.1025 }, assignedTasks: [], totalDistance: 0 },
  { id: "U3", location: { lat: 28.5355, lng: 77.391 }, assignedTasks: [], totalDistance: 0 },
];

export const tasks: Task[] = [
  { id: "T1", location: { lat: 28.7, lng: 77.1 } },
  { id: "T2", location: { lat: 28.9, lng: 77.5 } },
  { id: "T3", location: { lat: 28.61, lng: 77.21 } },
  { id: "T4", location: { lat: 28.75, lng: 77.3 } },
  { id: "T5", location: { lat: 28.82, lng: 77.42 } },
  { id: "T6", location: { lat: 28.64, lng: 77.24 } },
  { id: "T7", location: { lat: 28.95, lng: 77.65 } },
  { id: "T8", location: { lat: 28.5, lng: 77.15 } },
  { id: "T9", location: { lat: 28.78, lng: 77.4 } },
];
