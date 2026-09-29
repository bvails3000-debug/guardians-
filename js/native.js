// Thin bridge to Capacitor native plugins. In a browser (or Node tests) everything here is a no-op,
// so the same code runs as a website, a PWA, and the iOS/Android apps.
//
// Capacitor injects window.Capacitor into the native WebView and exposes installed native plugins on
// Capacitor.Plugins, so no bundler is needed.

export function isNative() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

export function platform() {
  return isNative() ? window.Capacitor.getPlatform() : 'web';
}

export function plugin(name) {
  return isNative() ? window.Capacitor.Plugins?.[name] || null : null;
}
