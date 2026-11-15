// Sync through a private GitHub gist. Each device pulls the gist, merges it
// with local data, and pushes back if the gist was missing anything.
import { save, snapshot, mergeInto } from './store.js';

const KEY = 'forge.sync';          // kept apart from app data so it's never exported
const FILE = 'forge-sync.json';
const API = 'https://api.github.com';

const cfg = (() => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
})();

function saveCfg() {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* storage unavailable */ }
}

export const isConnected = () => !!(cfg.token && cfg.gistId);
export const gistUrl = () => (cfg.gistId ? `https://gist.github.com/${cfg.gistId}` : null);
export const lastSync = () => cfg.lastSync || null;

/* status: 'idle' | 'syncing' | 'ok' | 'error' */
let status = { state: 'idle', error: null };
const statusListeners = new Set();
const dataListeners = new Set();
export const getStatus = () => status;
export const onStatus = (fn) => statusListeners.add(fn);
/** Called after a sync brought in changes from another device. */
export const onRemoteData = (fn) => dataListeners.add(fn);

function setStatus(state, error = null) {
  status = { state, error };
  statusListeners.forEach((fn) => fn(status));
}

async function gh(path, opts = {}, token = cfg.token) {
  let res;
  try {
    res = await fetch(API + path, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new Error('Offline — will sync when you are back online');
  }
  if (!res.ok) {
    const msg = {
      401: 'GitHub rejected the token (wrong, expired or revoked)',
      403: 'GitHub refused access — check the token has the "gist" scope',
      404: 'Sync gist not found — it may have been deleted',
    }[res.status] || `GitHub error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

async function readGist(id = cfg.gistId, token = cfg.token) {
  const g = await gh(`/gists/${id}`, {}, token);
  const f = g.files?.[FILE];
  if (!f) return null;
  const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
  return JSON.parse(text);
}

const writeGist = (id = cfg.gistId, token = cfg.token) =>
  gh(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: JSON.stringify(snapshot()) } } }) }, token);

async function findGist(token) {
  for (let page = 1; page <= 10; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`, {}, token);
    const hit = list.find((g) => g.files?.[FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return null;
}

/**
 * Connect with a token: reuse this account's existing Forge gist (so a second
 * device picks up the first one's data) or create a new private one.
 */
export async function connect(token) {
  token = token.trim();
  setStatus('syncing');
  try {
    let id = await findGist(token);
    let created = false;
    if (id) {
      const remote = await readGist(id, token);
      const { localChanged, remoteChanged } = remote ? mergeInto(remote) : { localChanged: false, remoteChanged: true };
      if (localChanged) save();
      if (remoteChanged) await writeGist(id, token);
      if (localChanged) dataListeners.forEach((fn) => fn());
    } else {
      const g = await gh('/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Forge workout app — sync data',
          public: false,
          files: { [FILE]: { content: JSON.stringify(snapshot()) } },
        }),
      }, token);
      id = g.id;
      created = true;
    }
    Object.assign(cfg, { token, gistId: id, lastSync: Date.now() });
    saveCfg();
    setStatus('ok');
    return { created };
  } catch (e) {
    setStatus('error', e.message);
    throw e;
  }
}

export function disconnect() {
  for (const k of Object.keys(cfg)) delete cfg[k];
  saveCfg();
  setStatus('idle');
}

let running = null;
let again = false;

export function syncNow() {
  if (!isConnected()) return Promise.resolve();
  if (running) {
    again = true; // something changed mid-sync; run once more afterwards
    return running;
  }
  running = (async () => {
    setStatus('syncing');
    try {
      const remote = await readGist();
      const { localChanged, remoteChanged } = remote ? mergeInto(remote) : { localChanged: false, remoteChanged: true };
      if (localChanged) save();
      if (remoteChanged) await writeGist();
      cfg.lastSync = Date.now();
      saveCfg();
      setStatus('ok');
      if (localChanged) dataListeners.forEach((fn) => fn());
    } catch (e) {
      setStatus('error', e.message);
    } finally {
      running = null;
      if (again) {
        again = false;
        syncNow();
      }
    }
  })();
  return running;
}

let timer;
/** Debounced sync after a local change. */
export function scheduleSync() {
  if (!isConnected()) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, 1500);
}
