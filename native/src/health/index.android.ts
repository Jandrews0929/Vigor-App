// Health Connect. Read-only: Vigor never writes to Health Connect.
import {
  aggregateRecord,
  ExerciseType,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';
import { BridgeError, humanize, positive, type HealthWorkout, type Kind, type WorkoutsResult } from './types';

export const HEALTH_NAME = 'Health Connect';

const RECORDS = ['ExerciseSession', 'Distance', 'ElevationGained', 'HeartRate', 'TotalCaloriesBurned'] as const;
type Rec = (typeof RECORDS)[number];
const PERMISSIONS: Permission[] = RECORDS.map((recordType) => ({ accessType: 'read', recordType }));

const KINDS: Record<number, Kind> = {
  [ExerciseType.RUNNING]: 'run',
  [ExerciseType.RUNNING_TREADMILL]: 'run',
  [ExerciseType.WALKING]: 'walk',
  [ExerciseType.HIKING]: 'hike',
  [ExerciseType.BIKING]: 'ride',
  [ExerciseType.BIKING_STATIONARY]: 'ride',
  [ExerciseType.SWIMMING_POOL]: 'swim',
  [ExerciseType.SWIMMING_OPEN_WATER]: 'swim',
  [ExerciseType.ROWING]: 'row',
  [ExerciseType.ROWING_MACHINE]: 'row',
};
const TYPE_NAMES: Record<number, string> = Object.fromEntries(Object.entries(ExerciseType).map(([k, v]) => [v, k]));
const APPS: Record<string, string> = {
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.ouraring.oura': 'Oura',
  'com.whoop.android': 'WHOOP',
  'com.nike.plusgps': 'Nike Run Club',
  'com.strava': 'Strava',
};

async function ensureAccess(): Promise<Set<Rec>> {
  const status = await getSdkStatus();
  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    throw new BridgeError('update', 'Update Health Connect from the Play Store, then try again.');
  }
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new BridgeError('unavailable', "Health Connect isn't on this phone. Install it from the Play Store (Android 13 and older) or update Android, then try again.");
  }
  if (!(await initialize())) throw new BridgeError('unavailable', "Couldn't open Health Connect. Try again.");
  const has = (list: { recordType?: string; accessType?: string }[]) =>
    new Set(list.filter((p) => p.accessType === 'read').map((p) => p.recordType as Rec));
  let granted = has(await getGrantedPermissions());
  if (!granted.has('ExerciseSession')) granted = has(await requestPermission(PERMISSIONS));
  if (!granted.has('ExerciseSession')) {
    throw new BridgeError('denied', 'Vigor needs permission to read your exercise. Open Health Connect, tap App permissions, then Vigor, and allow Exercise.');
  }
  return granted;
}

export async function readWorkouts(days: number): Promise<WorkoutsResult> {
  const granted = await ensureAccess();
  const now = new Date();
  const { records } = await readRecords('ExerciseSession', {
    timeRangeFilter: { operator: 'between', startTime: new Date(+now - days * 86400000).toISOString(), endTime: now.toISOString() },
    ascendingOrder: false,
    pageSize: 60,
  });
  const workouts: HealthWorkout[] = [];
  for (const r of records) {
    const range = { operator: 'between' as const, startTime: r.startTime, endTime: r.endTime };
    const origin = r.metadata?.dataOrigin;
    // Totals for this session only, from the app that recorded it, so a phone and a watch don't double count.
    const agg = async <T>(type: Rec, pick: (res: any) => T): Promise<T | null> => {
      if (!granted.has(type)) return null;
      try {
        return pick(await aggregateRecord({ recordType: type, timeRangeFilter: range, dataOriginFilter: origin ? [origin] : undefined }));
      } catch {
        return null;
      }
    };
    const kind = KINDS[r.exerciseType] ?? 'other';
    const active = await agg('ExerciseSession', (a) => a.EXERCISE_DURATION_TOTAL?.inSeconds as number);
    workouts.push({
      id: r.metadata?.id ?? `${r.startTime}-${r.exerciseType}`,
      kind,
      activityName: kind === 'other' ? humanize(TYPE_NAMES[r.exerciseType] ?? 'Workout') : undefined,
      title: r.title || undefined,
      start: r.startTime,
      end: r.endTime,
      duration_s: Math.round(positive(active) ?? (Date.parse(r.endTime) - Date.parse(r.startTime)) / 1000),
      distance_m: positive(await agg('Distance', (a) => a.DISTANCE?.inMeters)),
      elevation_m: positive(await agg('ElevationGained', (a) => a.ELEVATION_GAINED_TOTAL?.inMeters)),
      avg_hr: positive(await agg('HeartRate', (a) => a.BPM_AVG)),
      calories: positive(await agg('TotalCaloriesBurned', (a) => a.ENERGY_TOTAL?.inKilocalories)),
      sourceName: origin ? APPS[origin] : undefined,
    });
  }
  return { workouts, hint: workouts.length ? undefined : 'Workouts your watch or fitness app saves to Health Connect show up here. Check that app shares exercise with Health Connect.' };
}

export async function openHealthSettings(): Promise<void> {
  openHealthConnectSettings();
}
