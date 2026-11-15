// Training logic: recovery model, workout generator, progressive overload, stats.
import { EXERCISES, EX, MUSCLES } from './exercises.js';

const HOUR = 3.6e6;
const DAY = 864e5;
const LB = 2.20462;

/* ---------- units & formatting ---------- */

export const toDisp = (kg, units) => (kg == null ? null : units === 'lb' ? kg * LB : kg);
export const fromDisp = (v, units) => (v == null || isNaN(v) ? null : units === 'lb' ? v / LB : +v);
export const fmtNum = (n) => String(Math.round(n * 10) / 10);
export const fmtW = (kg, units) => (kg == null ? '—' : `${fmtNum(toDisp(kg, units))} ${units}`);
const roundTo = (v, step) => Math.round(v / step) * step;

export function fmtBig(kg, units) {
  const v = toDisp(kg, units);
  return v >= 10000 ? `${fmtNum(v / 1000)}k ${units}` : `${Math.round(v)} ${units}`;
}

export function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDur(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  return h ? `${h}:${fmtClock(t % 3600).padStart(5, '0')}` : fmtClock(t);
}

export const fmtMinutes = (ms) => `${Math.max(1, Math.round(ms / 60000))} min`;

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekStart(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.getTime();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** 0% = red, 100% = green */
export const recColor = (pct) => `hsl(${Math.round(pct * 1.3)} 68% 48%)`;

/* ---------- recovery ---------- */

const doneSets = (e) => e.sets.filter((s) => s.done);

/**
 * Each completed set adds fatigue to the muscles it trains (primary 12 pts,
 * secondary 5 pts, capped at 100). Fatigue drains linearly so a fully
 * fatigued muscle is ready again after its recovery window (36–72h).
 */
export function recoveryMap(workouts, now = Date.now()) {
  const f = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));
  const hours = Object.fromEntries(MUSCLES.map((m) => [m.id, m.hours]));
  const recent = workouts.filter((w) => w.end <= now && now - w.end < 7 * DAY).sort((a, b) => a.end - b.end);
  let clock = recent.length ? recent[0].end : now;
  const drain = (t) => {
    const dt = (t - clock) / HOUR;
    for (const m in f) f[m] = Math.max(0, f[m] - (dt * 100) / hours[m]);
    clock = t;
  };
  for (const w of recent) {
    drain(w.end);
    for (const e of w.exercises) {
      const ex = EX[e.exId];
      if (!ex) continue;
      const n = doneSets(e).length;
      ex.primary.forEach((m) => (f[m] = Math.min(100, f[m] + n * 12)));
      ex.secondary.forEach((m) => (f[m] = Math.min(100, f[m] + n * 5)));
    }
  }
  drain(now);
  const out = {};
  for (const m in f) out[m] = { pct: Math.round(100 - f[m]), hoursLeft: (f[m] * hours[m]) / 100 };
  return out;
}

/* ---------- prescriptions & progression ---------- */

/** Sets, rep range and rest (seconds) for an exercise given the user's goal. */
export function prescribe(ex, profile) {
  if (ex.timed) return { sets: 3, min: 30, max: 60, rest: 60 };
  const compound = ex.kind === 'compound';
  let sets, min, max, rest;
  if (profile.goal === 'strength') {
    [sets, min, max, rest] = compound ? [4, 3, 6, 180] : [3, 6, 10, 90];
  } else if (profile.goal === 'endurance') {
    [sets, min, max, rest] = [3, 12, 20, compound ? 75 : 45];
  } else {
    [sets, min, max, rest] = compound ? [3, 6, 10, 120] : [3, 10, 15, 75];
  }
  if (!compound && ['abs', 'calves', 'forearms'].includes(ex.primary[0])) {
    min = Math.max(min, 12);
    max = Math.max(max, 20);
  }
  if (ex.bw && profile.goal !== 'endurance') {
    min = Math.max(min, 6);
    max = Math.max(max, 15);
  }
  if (profile.experience === 'beginner') sets = Math.max(2, sets - 1);
  if (profile.experience === 'advanced' && compound) sets += 1;
  return { sets, min, max, rest };
}

/** Past sessions of an exercise, newest first: [{ w: workout, sets: [done sets] }] */
export function sessionsFor(exId, workouts) {
  return workouts
    .filter((w) => w.exercises.some((e) => e.exId === exId))
    .sort((a, b) => b.end - a.end)
    .map((w) => ({ w, sets: w.exercises.filter((e) => e.exId === exId).flatMap(doneSets) }))
    .filter((s) => s.sets.length);
}

function increment(ex, units) {
  const kg = units === 'kg';
  if (ex.equip.includes('barbell')) return kg ? 2.5 : 5;
  if (ex.equip.includes('kettlebell')) return kg ? 4 : 10;
  if (ex.equip.includes('dumbbell')) return kg ? 2 : 5;
  return kg ? 2.5 : 5;
}

const topOf = (sets) => Math.max(...sets.map((s) => s.w || 0));
const minRepsAt = (sets, top) => Math.min(...sets.filter((s) => (s.w || 0) >= top - 0.01).map((s) => s.r || 0));

/**
 * Double progression: stay at a weight and add reps until every top set hits
 * the top of the range, then add weight and drop to the bottom of the range.
 * Missing the bottom of the range two sessions in a row triggers a 10% deload.
 * Returns { w (kg|null), r, note, kind }.
 */
export function suggest(exId, rx, workouts, units) {
  const ex = EX[exId];
  const hist = sessionsFor(exId, workouts);
  const unit = ex.timed ? 'sec' : 'reps';

  if (!hist.length) {
    return {
      w: null,
      r: Math.round((rx.min + rx.max) / 2),
      kind: 'new',
      note: ex.bw
        ? `First time — find a ${unit} count that feels hard but clean.`
        : `First time — pick a weight you could lift ~${rx.max} times with 2 reps to spare.`,
    };
  }

  const sets = hist[0].sets;
  // For assisted moves the working set is the one with the LEAST assistance.
  const top = ex.assist && sets.some((s) => s.w > 0)
    ? Math.min(...sets.filter((s) => s.w > 0).map((s) => s.w))
    : topOf(sets);

  if (top <= 0) {
    // Bodyweight / timed: progress by reps or seconds.
    const step = ex.timed ? 5 : 1;
    const best = Math.max(...sets.map((s) => s.r || 0));
    const allMax = sets.every((s) => (s.r || 0) >= rx.max);
    return {
      w: null,
      r: best + step,
      kind: 'reps',
      note: allMax && !ex.timed && ex.bw
        ? `You're past ${rx.max} reps — beat ${best}, or add weight to make it harder.`
        : `Beat last time: aim for ${best + step} ${unit}.`,
    };
  }

  const dTop = toDisp(top, units);
  const step = units === 'kg' ? 0.5 : 2.5;
  const minR = minRepsAt(sets, top);

  if (ex.assist) {
    // Weight is assistance: progress by taking assistance away.
    const inc = units === 'kg' ? 2.5 : 5;
    const minR = Math.min(...sets.filter((s) => (s.w || 0) <= top + 0.01).map((s) => s.r || 0));
    if (minR >= rx.max) {
      const next = Math.max(0, roundTo(dTop - inc, step));
      return next > 0
        ? { w: fromDisp(next, units), r: rx.min, kind: 'up', note: `All sets hit ${rx.max} reps — less assistance: ${fmtNum(next)} ${units}.` }
        : { w: null, r: rx.min, kind: 'up', note: 'Ready to try it with no assistance!' };
    }
    if (minR < rx.min) {
      const next = roundTo(dTop + inc, step);
      return { w: fromDisp(next, units), r: rx.min, kind: 'hold', note: `Missed the target — a bit more assistance (${fmtNum(next)} ${units}).` };
    }
    const r = Math.min(rx.max, minR + 1);
    return { w: top, r, kind: 'reps', note: `Same assistance, one more rep: ${minR} → ${r}.` };
  }

  if (minR >= rx.max) {
    const next = roundTo(dTop + increment(ex, units), step);
    return { w: fromDisp(next, units), r: rx.min, kind: 'up', note: `All sets hit ${rx.max} reps — up to ${fmtNum(next)} ${units}.` };
  }

  if (minR < rx.min) {
    const prev = hist[1]?.sets;
    const stalled = prev && Math.abs(topOf(prev) - top) < 0.01 && minRepsAt(prev, top) < rx.min;
    if (stalled) {
      const next = roundTo(dTop * 0.9, increment(ex, units));
      return { w: fromDisp(next, units), r: Math.round((rx.min + rx.max) / 2), kind: 'down', note: `Stalled twice — deload to ${fmtNum(next)} ${units} and build back up.` };
    }
    return { w: top, r: rx.min, kind: 'hold', note: `Missed the target last time — same weight, aim for ${rx.min} reps.` };
  }

  const r = Math.min(rx.max, minR + 1);
  return { w: top, r, kind: 'reps', note: `Same weight, one more rep: ${minR} → ${r}.` };
}

/* ---------- workout generator ---------- */

export const SPLITS = {
  full: { name: 'Full Body', muscles: ['quads', 'chest', 'lats', 'hamstrings', 'shoulders', 'glutes', 'traps', 'biceps', 'triceps', 'abs', 'calves'] },
  upper: { name: 'Upper Body', muscles: ['chest', 'lats', 'shoulders', 'traps', 'triceps', 'biceps'] },
  lower: { name: 'Lower Body', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs', 'lowerback'] },
  push: { name: 'Push', muscles: ['chest', 'shoulders', 'triceps', 'abs'] },
  pull: { name: 'Pull', muscles: ['lats', 'traps', 'biceps', 'lowerback', 'forearms'] },
  legs: { name: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'abs'] },
};

export function rotation(days) {
  if (days <= 3) return ['full'];
  if (days === 4) return ['upper', 'lower'];
  return ['push', 'pull', 'legs'];
}

/** Pick the split day whose main muscles are freshest, favouring days not trained recently. */
function pickDay(profile, workouts, rec, now) {
  const types = rotation(profile.days);
  let best = types[0], bestScore = -Infinity;
  for (const t of types) {
    const ms = SPLITS[t].muscles.slice(0, 4);
    const avg = ms.reduce((a, m) => a + rec[m].pct, 0) / ms.length;
    const last = workouts.filter((w) => w.dayType === t).reduce((a, w) => Math.max(a, w.end), 0);
    const daysSince = last ? (now - last) / DAY : 14;
    const score = avg + Math.min(daysSince, 7) * 4;
    if (score > bestScore) [best, bestScore] = [t, score];
  }
  return best;
}

const sortKey = (ex) => (ex.primary[0] === 'abs' ? 2 : ex.kind === 'compound' ? 0 : 1);

export function generate(profile, workouts, excluded = [], forceType = null, now = Date.now()) {
  const rec = recoveryMap(workouts, now);
  const type = forceType || pickDay(profile, workouts, rec, now);
  const split = SPLITS[type];
  const equip = new Set(profile.equipment);
  const pool = EXERCISES.filter((e) => !excluded.includes(e.id) && e.equip.every((q) => equip.has(q)));
  const loadable = profile.equipment.some((q) => ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell'].includes(q));
  const n = Math.max(3, Math.min(9, Math.round(profile.minutes / (profile.goal === 'strength' ? 12 : 8.5))));
  // How often each exercise was done in the last ~4 months: favour your staples.
  const known = {};
  for (const w of workouts) {
    if (now - w.end > 120 * DAY) continue;
    for (const id of new Set(w.exercises.map((e) => e.exId))) known[id] = (known[id] || 0) + 1;
  }

  // Skip muscles that are still fatigued, unless that leaves too little to train.
  let muscles = split.muscles.filter((m) => rec[m].pct >= 50);
  if (muscles.length < Math.min(3, split.muscles.length)) muscles = split.muscles.slice();

  const chosen = [];
  const covered = {};

  const pick = (m, pass) => {
    let best = null, bestScore = -Infinity;
    for (const e of pool) {
      if (!e.primary.includes(m) || chosen.includes(e)) continue;
      let s = Math.random() * 1.5;
      if (pass === 0 && e.kind === 'compound') s += chosen.length < 3 ? 4 : 1.5;
      if (pass > 0 && e.kind === 'isolation') s += 2;
      if (known[e.id]) s += Math.min(4, 1 + Math.log2(known[e.id])); // stick with lifts you're progressing on
      if (e.bw && loadable && !e.timed) s -= 1;
      s -= e.secondary.filter((x) => rec[x].pct < 35).length * 1.5;
      s -= e.primary.filter((x) => x !== m && covered[x]).length * 1.5;
      if (s > bestScore) [best, bestScore] = [e, s];
    }
    return best;
  };

  for (let pass = 0; pass < 3 && chosen.length < n; pass++) {
    for (const m of muscles) {
      if (chosen.length >= n) break;
      if ((covered[m] || 0) > pass) continue;
      if (pass > 0 && ['abs', 'calves', 'forearms', 'lowerback'].includes(m)) continue;
      const e = pick(m, pass);
      if (!e) continue;
      chosen.push(e);
      e.primary.forEach((x) => (covered[x] = (covered[x] || 0) + 1));
    }
  }

  chosen.sort((a, b) => sortKey(a) - sortKey(b));
  return {
    date: todayKey(new Date(now)),
    dayType: type,
    name: split.name,
    items: chosen.map((e) => ({ exId: e.id, rx: prescribe(e, profile) })),
  };
}

export function estimateMinutes(items) {
  return Math.round(5 + items.reduce((a, it) => a + it.rx.sets * (40 + it.rx.rest), 0) / 60);
}

/* ---------- stats ---------- */

export const e1rm = (w, r) => (!w || !r ? 0 : r === 1 ? w : w * (1 + r / 30));

export function volume(workout) {
  let v = 0;
  for (const e of workout.exercises) {
    if (EX[e.exId]?.timed || EX[e.exId]?.assist) continue;
    for (const s of doneSets(e)) v += (s.w || 0) * (s.r || 0);
  }
  return v;
}

export const setCount = (workout) => workout.exercises.reduce((a, e) => a + doneSets(e).length, 0);

export function bestE1rm(sets) {
  return Math.max(0, ...sets.map((s) => e1rm(s.w, s.r)));
}

/** Exercises in `workout` where estimated 1RM beat every earlier session. */
export function findPRs(workout, prior) {
  const prs = [];
  for (const e of workout.exercises) {
    if (EX[e.exId]?.assist || EX[e.exId]?.timed) continue;
    const before = sessionsFor(e.exId, prior.filter((w) => w.end < workout.end));
    if (!before.length) continue;
    const now = bestE1rm(doneSets(e));
    const prev = Math.max(...before.map((s) => bestE1rm(s.sets)));
    if (now > 0 && now > prev + 0.01) prs.push({ exId: e.exId, value: now, prev });
  }
  return prs;
}

/** Completed sets per muscle since `since` (secondary muscles count half). */
export function setsPerMuscle(workouts, since) {
  const out = Object.fromEntries(MUSCLES.map((m) => [m.id, 0]));
  for (const w of workouts) {
    if (w.end < since) continue;
    for (const e of w.exercises) {
      const ex = EX[e.exId];
      if (!ex) continue;
      const n = doneSets(e).length;
      ex.primary.forEach((m) => (out[m] += n));
      ex.secondary.forEach((m) => (out[m] += n / 2));
    }
  }
  return out;
}

export function weekStreak(workouts, now = Date.now()) {
  const weeks = new Set(workouts.map((w) => weekStart(w.end)));
  let wk = weekStart(now);
  if (!weeks.has(wk)) wk = weekStart(wk - DAY);
  let n = 0;
  while (weeks.has(wk)) {
    n++;
    wk = weekStart(wk - DAY);
  }
  return n;
}

export { DAY };
