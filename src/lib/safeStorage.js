// Safe localStorage wrapper. In sandboxed iframes (like in-app previews)
// touching window.localStorage THROWS — we fall back to an in-memory Map so
// the app keeps working (data just won't survive a reload there).

const mem = new Map();

let usable = false;
try {
  const probe = '__nh_probe__';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  usable = true;
} catch {
  usable = false;
}

export default {
  get available() {
    return usable;
  },
  getItem(key) {
    if (usable) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        /* fall through to memory */
      }
    }
    return mem.has(key) ? mem.get(key) : null;
  },
  setItem(key, value) {
    if (usable) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    mem.set(key, String(value));
  },
  removeItem(key) {
    if (usable) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch {
        /* fall through */
      }
    }
    mem.delete(key);
  },
};
