import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the settings; CI stamps each build with a higher build number so phones accept it as an update.
export default ({ config }: ConfigContext): ExpoConfig => {
  const build = Number(process.env.VIGOR_BUILD_NUMBER) || 0;
  return {
    ...(config as ExpoConfig),
    ios: { ...config.ios, ...(build ? { buildNumber: String(build) } : {}) },
    android: { ...config.android, ...(build ? { versionCode: build } : {}) },
  };
};
