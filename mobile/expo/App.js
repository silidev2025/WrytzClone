import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Linking, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

export default function App() {
  const config = Constants.expoConfig?.extra || {};
  const web = useRef(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [canGoBack, setCanGoBack] = useState(false);
  const allowed = [config.appUrl, config.platformUrl].filter(Boolean).map((url) => new URL(url).origin);
  const navigate = ({ url, isTopFrame }) => {
    if (isTopFrame === false) return true;
    try {
      const next = new URL(url);
      if (next.protocol === 'https:' && allowed.includes(next.origin)) return true;
      if (['https:', 'http:', 'mailto:', 'tel:'].includes(next.protocol)) {
        void Linking.openURL(url).catch(() => Alert.alert('Unable to open link', 'No app is available to open this link.'));
      }
    } catch { /* Reject malformed and executable URLs. */ }
    return false;
  };
  return <SafeAreaProvider><SafeAreaView style={styles.page}>
    {!config.appUrl || failed ? <View style={styles.message}>
      <Text style={styles.text}>Couldn't load this app. Check your connection and make sure the app is still published.</Text>
      <Button title="Try again" onPress={() => { setFailed(false); setAttempt((n) => n + 1); }} />
    </View> : <>
      {canGoBack && <View style={styles.back}><Button title="Back" onPress={() => web.current?.goBack()} /></View>}
      <WebView key={attempt} ref={web} style={styles.page} source={{ uri: config.appUrl }}
        originWhitelist={['*']} onShouldStartLoadWithRequest={navigate}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        startInLoadingState renderLoading={() => <ActivityIndicator accessibilityLabel="Loading app" style={StyleSheet.absoluteFill} />}
        onError={() => setFailed(true)} onHttpError={() => setFailed(true)}
        onContentProcessDidTerminate={() => web.current?.reload()}
        allowsBackForwardNavigationGestures allowsInlineMediaPlayback
        javaScriptCanOpenWindowsAutomatically={false} allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false} mixedContentMode="never"
        thirdPartyCookiesEnabled={false} sharedCookiesEnabled={false}
        mediaPlaybackRequiresUserAction setSupportMultipleWindows={false}
      />
    </>}
  </SafeAreaView></SafeAreaProvider>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  message: { padding: 24, flex: 1, justifyContent: 'center', gap: 16 },
  text: { fontSize: 16, lineHeight: 24, color: '#252335' },
  back: { alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#eeeeee' },
});
