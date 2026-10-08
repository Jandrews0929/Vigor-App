// The shape every health source hands to the web app. Matches what app.js healthPick() reads.
export type Kind = 'run' | 'walk' | 'hike' | 'ride' | 'swim' | 'row' | 'other';

export interface HealthWorkout {
  id: string;
  kind: Kind;
  activityName?: string; // for "other": Elliptical, Stair climbing…
  title?: string;
  start: string; // ISO time
  end: string;
  duration_s: number;
  distance_m?: number | null;
  elevation_m?: number | null;
  avg_hr?: number | null;
  calories?: number | null;
  sourceName?: string; // the watch or app that recorded it
}

export interface WorkoutsResult {
  workouts: HealthWorkout[];
  hint?: string; // shown when the list comes back empty
}

export class BridgeError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// highIntensityIntervalTraining / HIGH_INTENSITY_INTERVAL_TRAINING -> "High intensity interval training"
export function humanize(key: string): string {
  const words = key.includes('_') ? key.toLowerCase().split('_') : key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
  const s = words.filter(Boolean).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const positive = (n: unknown): number | null => (typeof n === 'number' && isFinite(n) && n > 0 ? n : null);
