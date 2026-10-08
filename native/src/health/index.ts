// Fallback for platforms without a health store. Metro picks index.ios.ts or index.android.ts on phones.
import { BridgeError, type WorkoutsResult } from './types';

export const HEALTH_NAME = 'Health';

export async function readWorkouts(_days: number): Promise<WorkoutsResult> {
  throw new BridgeError('unavailable', 'Health data is only available in the iPhone and Android apps.');
}

export async function openHealthSettings(): Promise<void> {}
