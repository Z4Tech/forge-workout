// Import workout history from a Gravl CSV export (Profile → Export Data).
// One row per set: Date, Start Date, Workout, Source, Workout Duration (min),
// Energy, Exercise, Superset, Set, Set Type, Reps, Weight (lb|kg), Distance,
// Set Duration (sec), Incline, Steps, Effort, Workout Notes
import { EXERCISES, EX } from './exercises.js';

// Gravl exercise name (lower-case) → Forge exercise id
const MAP = {
  'lat pulldown': 'lat_pulldown',
  'lat pulldown neutral grip': 'close_grip_pulldown',
  'close grip pulldown': 'close_grip_pulldown',
  'v bar pulldown': 'close_grip_pulldown',
  'reverse grip pulldown': 'reverse_pulldown',
  'machine lat pulldown': 'machine_pulldown',
  'plate-loaded lat pulldown': 'plate_pulldown',
  'straight arm pulldown': 'straight_arm_pd',
  'rope straight arm pulldown': 'straight_arm_pd',
  'assisted pull up': 'assisted_pullup',
  'assisted wide grip pull up': 'assisted_wide_pullup',
  'loop band pull up': 'band_pullup',
  'cable row': 'seated_row',
  'cable row wide grip': 'wide_cable_row',
  'machine row': 'machine_row',
  'barbell row': 'bb_row',
  'dumbbell row': 'db_row',
  'incline dumbbell row': 'chest_supported_row',
  'dumbbell bent over row': 'db_bent_row',
  'cable shrug': 'cable_shrug',
  'cable face pull': 'face_pull',
  'deadlift': 'deadlift',
  'back extension': 'back_ext',
  'machine back extension': 'machine_back_ext',

  'barbell bench press': 'bb_bench',
  'barbell incline bench press': 'bb_incline',
  'dumbbell bench press': 'db_bench',
  'dumbbell incline bench press': 'db_incline',
  'machine bench press': 'machine_chest',
  'plate-loaded chest press': 'plate_chest_press',
  'plate-loaded horizontal bench press': 'plate_chest_press',
  'plate-loaded incline chest press': 'plate_incline_press',
  'smith machine bench press': 'smith_bench',
  'smith machine incline bench press': 'smith_incline',
  'incline cable chest press': 'incline_cable_press',
  'dumbbell fly': 'db_fly',
  'dumbbell incline fly': 'db_incline_fly',
  'cable crossover fly': 'cable_fly',
  'mid cable crossover fly': 'cable_fly_mid',
  'low cable chest fly': 'cable_fly_low',
  'machine chest fly': 'pec_deck',

  'dumbbell shoulder press': 'db_shoulder_press',
  'machine shoulder press': 'machine_shoulder',
  'arnold press': 'arnold_press',
  'kettlebell overhead press': 'kb_press',
  'dumbbell lateral raise': 'lat_raise',
  'dumbbell lateral raise seated': 'seated_lat_raise',
  'machine reverse fly': 'machine_reverse_fly',
  'cable reverse fly': 'cable_reverse_fly',
  'dumbbell reverse fly (seated)': 'rear_delt_fly',
  'cable upright row': 'cable_upright_row',

  'ez bar curl': 'ez_curl',
  'dumbbell bicep curl': 'db_curl',
  'seated dumbbell curl': 'db_curl',
  'incline dumbbell curl': 'incline_curl',
  'hammer curls': 'hammer_curl',
  'cross body hammer curls': 'hammer_curl',
  'incline hammer curl': 'hammer_curl',
  'cable hammer curl': 'cable_hammer_curl',
  'dumbbell concentration curl': 'concentration_curl',
  'spider curls': 'spider_curl',
  'preacher curl': 'db_preacher_curl',
  'machine bicep curl': 'preacher_curl',
  'single arm cross body cable curl': 'sa_cable_curl',
  'single arm bayesian cable curl': 'sa_cable_curl',
  'single arm cable bicep curl': 'sa_cable_curl',
  'dumbbell reverse curl': 'reverse_curl',
  'palms up dumbbell wrist curl': 'wrist_curl',
  'farmer walk': 'farmer_walk',

  'dumbbell skullcrusher': 'db_skullcrusher',
  'tricep pushdown': 'tri_pushdown',
  'cable rope tricep extension': 'rope_pushdown',
  'single arm dumbbell tricep extension': 'sa_db_tri_ext',
  'dumbbell tricep extension': 'oh_tri_ext',
  'cable single arm tricep extension': 'sa_cable_tri_ext',
  'low cable overhead tricep extension': 'cable_oh_tri_ext',
  'machine tricep extension': 'machine_tri_ext',
  'machine tricep dip': 'machine_dip',

  'back squat': 'back_squat',
  'box squat': 'box_squat',
  'smith machine squat': 'smith_squat',
  'hack squat': 'hack_squat',
  'machine leg press': 'leg_press',
  'leg press': 'leg_press',
  'dumbbell squat': 'goblet_squat',
  'air squat': 'bw_squat',
  'kettlebell sumo squat': 'kb_sumo_squat',
  'dumbbell lunge': 'db_lunge',
  'dumbbell split squat': 'db_split_squat',
  'smith machine split squat': 'smith_split_squat',
  'bulgarian split squat': 'bss',
  'dumbbell bulgarian split squat': 'bss',
  'barbell bulgarian split squat': 'bss',
  'leg extension': 'leg_ext',
  'seated leg curl': 'seated_leg_curl',
  'lying hamstring curl': 'leg_curl',
  'dumbbell romanian deadlift': 'db_rdl',
  'barbell hip thrust': 'hip_thrust',
  'smith machine hip thrust': 'smith_hip_thrust',
  'cable pull through': 'cable_pull_through',
  'cable kickback': 'cable_kickback',
  'machine glute kickback': 'machine_glute_kickback',
  'machine abduction': 'hip_abduction',
  'machine adduction': 'hip_adduction',

  'vertical leg raise': 'vertical_leg_raise',
  'vertical knee raise': 'vertical_leg_raise',
  'hanging leg raise': 'hanging_leg_raise',
  'hanging knee raise': 'hanging_knee_raise',
  'machine seated crunch': 'machine_crunch',
  'torso rotation': 'torso_rotation',
  'cable torso rotation': 'cable_torso_rotation',
  'bicycle crunch': 'bicycle_crunch',
  'russian twist': 'russian_twist',
  'sit up': 'situp',
  'decline crunch': 'decline_crunch',
  'ab wheel rollout': 'ab_wheel',
};

const CARDIO = new Set(['walking', 'running', 'running on treadmill', 'air bike', 'rowing', 'elliptical', 'swimming', 'cycling', 'stair climber', 'hiking']);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const BY_NAME = Object.fromEntries(EXERCISES.map((e) => [norm(e.name), e.id]));

function lookup(name) {
  const k = name.trim().toLowerCase();
  return MAP[k] || BY_NAME[norm(name)] || null;
}

/** Minimal RFC 4180 CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ''));
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function parseWhen(date, time) {
  const [y, m, d] = date.split(/[/-]/).map(Number);
  const t = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(time || '') || [];
  let h = +t[1] || 0;
  const min = +t[2] || 0;
  if (t[3]) h = (h % 12) + (t[3].toUpperCase() === 'PM' ? 12 : 0);
  return new Date(y, m - 1, d, h, min).getTime();
}

/**
 * Parse a Gravl export into Forge workouts. Skips cardio and warm-up sets.
 * Workout ids are derived from the Gravl session, so importing the same
 * file twice never creates duplicates.
 */
export function parseGravl(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('The file is empty');
  const head = rows[0].map((h) => h.trim());
  const col = (re) => head.findIndex((h) => re.test(h));
  const C = {
    date: col(/^date$/i), time: col(/^start date$/i), workout: col(/^workout$/i),
    duration: col(/workout duration/i), exercise: col(/^exercise$/i), set: col(/^set$/i),
    type: col(/^set type$/i), reps: col(/^reps$/i), weight: col(/^weight/i),
    distance: col(/^distance/i), secs: col(/set duration/i),
  };
  if ([C.date, C.exercise, C.reps, C.weight].some((i) => i < 0)) {
    throw new Error("This doesn't look like a Gravl workout export");
  }
  const lb = /\(lb/i.test(head[C.weight]);
  const toKg = (v) => (lb ? v / 2.20462 : v);

  const sessions = new Map();
  const stats = { cardio: 0, warmup: 0, unknown: {}, sets: 0 };

  for (const r of rows.slice(1)) {
    const name = (r[C.exercise] || '').trim();
    if (!name) continue;
    const reps = parseFloat(r[C.reps]) || 0;
    const weight = parseFloat(r[C.weight]) || 0;
    const dist = parseFloat(r[C.distance]) || 0;
    const secs = parseFloat(r[C.secs]) || 0;

    if (CARDIO.has(name.toLowerCase()) || (!reps && !weight && (dist || secs))) { stats.cardio++; continue; }
    if (/warm/i.test(r[C.type] || '')) { stats.warmup++; continue; }
    const exId = lookup(name);
    if (!exId) { stats.unknown[name] = (stats.unknown[name] || 0) + 1; continue; }
    const ex = EX[exId];
    const r2 = ex.timed && secs ? Math.round(secs) : Math.round(reps);
    if (!r2) continue;

    const key = `${r[C.date]}|${r[C.time]}|${r[C.workout]}`;
    let s = sessions.get(key);
    if (!s) {
      const start = parseWhen(r[C.date], r[C.time]);
      const mins = parseFloat(r[C.duration]) || 0;
      s = { id: `gravl-${hash(key)}`, start, mins, name: (r[C.workout] || 'Gravl workout').trim(), dayType: null, source: 'gravl', exercises: [] };
      sessions.set(key, s);
    }
    let last = s.exercises[s.exercises.length - 1];
    if (!last || last.exId !== exId || last.gravlName !== name) {
      last = { exId, gravlName: name, sets: [] };
      s.exercises.push(last);
    }
    last.sets.push({ w: weight > 0 ? Math.round(toKg(weight) * 1000) / 1000 : null, r: r2, done: true });
    stats.sets++;
  }

  const workouts = [...sessions.values()]
    .filter((s) => s.exercises.length)
    .map(({ mins, ...s }) => {
      const nSets = s.exercises.reduce((a, e) => a + e.sets.length, 0);
      return {
        ...s,
        end: s.start + Math.max(1, mins || nSets * 2.5) * 60000,
        exercises: s.exercises.map(({ gravlName, ...e }) => e),
      };
    })
    .sort((a, b) => a.end - b.end);

  return { workouts, lb, stats };
}
