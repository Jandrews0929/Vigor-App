import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { APP_URL, bridgeScript, handleCall } from './src/bridge';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Same surface colors as the web app, so the status and navigation bars blend in.
const SURFACE = { light: '#FBFCFA', dark: '#141917' };

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const web = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  const bg = useColorScheme() === 'dark' ? SURFACE.dark : SURFACE.light;

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 5000);
    return () => clearTimeout(t);
  }, []);

  // Android back: close a sheet or go back a screen in the web app; leave the app only from the top.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      web.current?.injectJavaScript(`(window.__vigorBack && window.__vigorBack()) || window.ReactNativeWebView.postMessage('{"type":"exit"}'); true;`);
      return true;
    });
    return () => sub.remove();
  }, []);

  const reply = (id: number, ok: boolean, data: unknown) =>
    web.current?.injectJavaScript(`window.__vigorNativeReply && window.__vigorNativeReply(${JSON.stringify(id)}, ${ok}, ${JSON.stringify(data ?? null)}); true;`);

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    if (!e.nativeEvent.url.startsWith(APP_URL)) return; // only the Vigor web app may use the bridge
    let msg: { id?: unknown; method?: unknown; params?: unknown; type?: unknown };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'exit') {
      BackHandler.exitApp();
      return;
    }
    if (typeof msg.id !== 'number' || typeof msg.method !== 'string') return;
    try {
      reply(msg.id, true, await handleCall(msg.method, msg.params));
    } catch (err) {
      const x = err as { code?: string; message?: string };
      reply(msg.id, false, { code: x.code ?? 'error', message: x.message || 'Something went wrong.' });
    }
  }, []);

  // Vigor pages stay in the app; any other link opens in the browser.
  const onNav = (req: ShouldStartLoadRequest) => {
    if (req.url.startsWith(APP_URL) || req.url.startsWith('about:') || req.url.startsWith('blob:') || req.url.startsWith('data:')) return true;
    if (/^(https?|mailto|tel):/i.test(req.url)) Linking.openURL(req.url).catch(() => {});
    return false;
  };

  return (
    <View style={[styles.fill, { backgroundColor: bg }, Platform.OS === 'android' && { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="auto" />
      <WebView
        ref={web}
        source={{ uri: APP_URL }}
        style={[styles.fill, { backgroundColor: bg }]}
        originWhitelist={['https://*', 'about:*', 'blob:*', 'data:*']}
        injectedJavaScriptBeforeContentLoaded={bridgeScript}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={onNav}
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        allowsBackForwardNavigationGestures={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        applicationNameForUserAgent="VigorApp/1.0"
        textZoom={100}
        overScrollMode="never"
        webviewDebuggingEnabled={__DEV__}
        startInLoadingState
        renderLoading={() => <View style={[styles.center, { backgroundColor: bg }]}><ActivityIndicator /></View>}
        renderError={() => <Offline bg={bg} onRetry={() => web.current?.reload()} />}
        onLoadEnd={() => SplashScreen.hideAsync().catch(() => {})}
        onContentProcessDidTerminate={() => web.current?.reload()}
        onRenderProcessGone={() => web.current?.reload()}
      />
    </View>
  );
}

function Offline({ bg, onRetry }: { bg: string; onRetry: () => void }) {
  const dark = bg === SURFACE.dark;
  return (
    <View style={[styles.center, { backgroundColor: bg }]}>
      <Text style={[styles.h, dark && styles.light]}>Can't reach Vigor</Text>
      <Text style={[styles.p, dark && styles.light]}>Check your connection, then try again.</Text>
      <Pressable style={styles.btn} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.btnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  h: { fontSize: 20, fontWeight: '700', color: '#121915' },
  p: { fontSize: 15, color: '#59655E', textAlign: 'center' },
  light: { color: '#E8EEE9' },
  btn: { marginTop: 8, backgroundColor: '#2346C9', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
