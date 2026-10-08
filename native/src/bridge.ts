// The phone app loads the live Vigor web app and gives it window.VigorNative for things a browser can't do.
// Contract (see app.js NATIVE()): VigorNative.call(method, params) -> Promise. Methods:
//   health.workouts {days}  -> { workouts: HealthWorkout[], hint? }
//   health.settings         -> opens the phone's health permissions
import { Platform } from 'react-native';
import { HEALTH_NAME, openHealthSettings, readWorkouts } from './health';
import { BridgeError } from './health/types';

export const APP_URL = 'https://jandrews0929.github.io/Vigor-App/';

export const bridgeScript = `(function () {
  if (window.VigorNative) return;
  var seq = 0, waiting = {};
  window.__vigorNativeReply = function (id, ok, data) {
    var w = waiting[id]; if (!w) return; delete waiting[id]; clearTimeout(w.timer);
    if (ok) { w.resolve(data); return; }
    var e = new Error((data && data.message) || 'Something went wrong.'); e.code = data && data.code; w.reject(e);
  };
  window.VigorNative = Object.freeze({
    platform: ${JSON.stringify(Platform.OS)},
    healthName: ${JSON.stringify(HEALTH_NAME)},
    call: function (method, params) {
      return new Promise(function (resolve, reject) {
        var id = ++seq;
        waiting[id] = { resolve: resolve, reject: reject, timer: setTimeout(function () {
          window.__vigorNativeReply(id, false, { code: 'timeout', message: 'That took too long. Try again.' });
        }, 180000) };
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: method, params: params || {} }));
      });
    }
  });
})();
true;`;

export async function handleCall(method: string, params: unknown): Promise<unknown> {
  const p = params && typeof params === 'object' ? (params as Record<string, unknown>) : {};
  switch (method) {
    case 'health.workouts':
      return readWorkouts(Math.min(90, Math.max(1, Math.round(Number(p.days) || 30))));
    case 'health.settings':
      await openHealthSettings();
      return true;
    default:
      throw new BridgeError('unknown_method', 'Update the Vigor app to use this.');
  }
}
