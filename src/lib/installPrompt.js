// PWA install-prompt helper. Browsers fire `beforeinstallprompt` when the app
// is installable; we stash the event and expose it reactively.

let deferredPrompt = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(!!deferredPrompt));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function canInstall() {
  return !!deferredPrompt;
}

export function onInstallAvailability(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  try {
    await deferredPrompt.userChoice;
  } catch {
    /* user dismissed */
  }
  deferredPrompt = null;
  notify();
  return true;
}

/** True when running as an installed standalone PWA. */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/** iOS Safari never fires beforeinstallprompt; users install via Share menu. */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
