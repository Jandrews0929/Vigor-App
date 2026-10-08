// Apple Health (HealthKit). Read-only: Vigor never writes to Health.
import { Linking } from 'react-native';
import {
  isHealthDataAvailable,
  queryWorkoutSamples,
  requestAuthorization,
  WorkoutActivityType,
  type WorkoutProxyTyped,
} from '@kingstinct/react-native-healthkit';
import { BridgeError, humanize, positive, type HealthWorkout, type Kind, type WorkoutsResult } from './types';

export const HEALTH_NAME = 'Apple Health';

const KINDS: Partial<Record<WorkoutActivityType, Kind>> = {
  [WorkoutActivityType.running]: 'run',
  [WorkoutActivityType.walking]: 'walk',
  [WorkoutActivityType.hiking]: 'hike',
  [WorkoutActivityType.cycling]: 'ride',
  [WorkoutActivityType.handCycling]: 'ride',
  [WorkoutActivityType.swimming]: 'swim',
  [WorkoutActivityType.rowing]: 'row',
};

export async function readWorkouts(days: number): Promise<WorkoutsResult> {
  if (!isHealthDataAvailable()) throw new BridgeError('unavailable', "Apple Health isn't available on this device.");
  // iOS shows its permission sheet the first time. It never says whether someone said no; a denied read just comes back empty.
  await requestAuthorization({
    toRead: [
      'HKWorkoutTypeIdentifier',
      'HKQuantityTypeIdentifierHeartRate',
      'HKQuantityTypeIdentifierDistanceWalkingRunning',
      'HKQuantityTypeIdentifierDistanceCycling',
      'HKQuantityTypeIdentifierDistanceSwimming',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
    ],
  });
  const since = new Date(Date.now() - days * 86400000);
  const found = await queryWorkoutSamples({ limit: 60, ascending: false, filter: { date: { startDate: since } } });
  const workouts: HealthWorkout[] = [];
  for (const w of found) {
    try {
      workouts.push(await toWorkout(w));
    } finally {
      w.dispose();
    }
  }
  return {
    workouts,
    hint: workouts.length ? undefined : 'If you turned off access, open Settings, then Health > Data Access & Devices > Vigor, and turn on Workouts.',
  };
}

async function toWorkout(w: WorkoutProxyTyped): Promise<HealthWorkout> {
  const kind = KINDS[w.workoutActivityType] ?? 'other';
  const elev = (w.metadata as Record<string, unknown> | undefined)?.HKElevationAscended as { quantity?: number; unit?: string } | undefined;
  let avgHr: number | null = null;
  try {
    const hr = await w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
    avgHr = positive(hr?.averageQuantity?.quantity);
  } catch {
    // heart rate is optional
  }
  return {
    id: w.uuid,
    kind,
    activityName: kind === 'other' ? humanize(WorkoutActivityType[w.workoutActivityType] ?? 'Workout') : undefined,
    start: new Date(w.startDate).toISOString(),
    end: new Date(w.endDate).toISOString(),
    duration_s: Math.round(w.duration.quantity),
    distance_m: positive(w.totalDistance?.quantity),
    elevation_m: elev && (!elev.unit || elev.unit === 'm') ? positive(elev.quantity) : null,
    avg_hr: avgHr,
    calories: positive(w.totalEnergyBurned?.quantity),
    sourceName: w.sourceRevision?.source?.name,
  };
}

export async function openHealthSettings(): Promise<void> {
  await Linking.openSettings();
}
