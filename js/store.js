// All app data lives in localStorage on this device. Weights are stored in kg.
const KEY = 'forge.v1';

const defaults = () => ({
  profile: null,       // { goal, experience, days, minutes, equipment[], units }
  prefsUpdatedAt: 0,   // when profile/excluded last changed (last write wins on sync)
  workouts: [],        // finished workouts (never edited, only added or deleted)
  deleted: {},         // { workoutId: deletedAt } so deletions survive a merge
  active: null,        // workout in progress (this device only)
  draft: null,         // today's generated plan (this device only)
  excluded: [],        // exercise ids never to suggest
});

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved ? { ...defaults(), ...saved } : defaults();
  } catch {
    return defaults();
  }
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Could not save', e);
  }
}

export function replaceAll(data) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, defaults(), data);
  save();
}

export const touchPrefs = () => (state.prefsUpdatedAt = Date.now());

/** The data that is shared between devices (and written to backups). */
export function snapshot() {
  return {
    app: 'forge',
    version: 2,
    updatedAt: Date.now(),
    profile: state.profile,
    prefsUpdatedAt: state.prefsUpdatedAt || 0,
    excluded: state.excluded,
    workouts: state.workouts,
    deleted: state.deleted || {},
  };
}

export const exportData = () => JSON.stringify(snapshot(), null, 2);

const fingerprint = (s) => JSON.stringify([
  (s.workouts || []).map((w) => w.id).sort(),
  Object.keys(s.deleted || {}).sort(),
  s.prefsUpdatedAt || 0,
  !!s.profile,
]);

/**
 * Merge another copy of the data (sync file or backup) into local state.
 * Workouts are unioned by id minus anything deleted on either side; the
 * profile and hidden exercises come from whichever side changed them last.
 * Returns { localChanged, remoteChanged } — remoteChanged means the other
 * copy is missing something we have.
 */
export function mergeInto(remote) {
  if (!remote || typeof remote !== 'object' || !Array.isArray(remote.workouts)) {
    throw new Error('Not Forge data');
  }
  const before = fingerprint(state);

  const deleted = { ...(remote.deleted || {}) };
  for (const [id, t] of Object.entries(state.deleted || {})) deleted[id] = Math.max(t, deleted[id] || 0);

  const byId = new Map();
  for (const w of [...remote.workouts, ...state.workouts]) {
    if (w && w.id && Array.isArray(w.exercises) && !deleted[w.id]) byId.set(w.id, w);
  }

  const remotePrefsNewer = remote.profile && ((remote.prefsUpdatedAt || 0) > (state.prefsUpdatedAt || 0) || !state.profile);
  if (remotePrefsNewer) {
    state.profile = remote.profile;
    state.excluded = remote.excluded || [];
    state.prefsUpdatedAt = remote.prefsUpdatedAt || 0;
    state.draft = null; // rebuild today's plan with the new settings
  }
  state.workouts = [...byId.values()].sort((a, b) => a.end - b.end);
  state.deleted = deleted;

  const after = fingerprint(state);
  return { localChanged: after !== before, remoteChanged: after !== fingerprint(remote) };
}
