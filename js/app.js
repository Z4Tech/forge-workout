import { state, save, replaceAll, exportData, mergeInto, touchPrefs } from './store.js';
import * as Sync from './sync.js';
import { parseGravl } from './gravl.js';
import { EXERCISES, EX, MUSCLES, EQUIPMENT, MUSCLE_NAME, EQUIP_NAME } from './exercises.js';
import * as E from './engine.js';
import { bodySvg } from './body.js';

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const resumeBar = document.getElementById('resume-bar');
const sheet = document.getElementById('sheet');
const sheetBody = sheet.querySelector('.sheet-body');
const toastEl = document.getElementById('toast');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const U = () => state.profile?.units || 'kg';
const muscleList = (ex) => ex.primary.map((m) => MUSCLE_NAME[m]).join(', ');
const unitLabel = (ex) => (ex.timed ? 'sec' : 'reps');

let sheetCtx = null;   // exercise picker context
let statEx = null;     // selected exercise on Stats

/* ---------- routing ---------- */

const route = () => (location.hash.replace(/^#\/?/, '') || 'today').split('/')[0];

function go(r) {
  if (route() === r) render();
  else location.hash = '#/' + r;
}

window.addEventListener('hashchange', render);

function render() {
  let r = route();
  if (!state.profile && r !== 'setup') {
    location.hash = '#/setup';
    return;
  }
  const views = { today: viewToday, workout: viewWorkout, recovery: viewRecovery, history: viewHistory, stats: viewStats, settings: viewSettings, setup: viewSetup };
  if (!views[r]) r = 'today';
  app.innerHTML = views[r]();
  tabs.hidden = r === 'setup';
  tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.tab === r || (r === 'workout' && a.dataset.tab === 'today')));
  const showResume = state.active && r !== 'workout' && r !== 'setup';
  resumeBar.hidden = !showResume;
  if (showResume) {
    resumeBar.innerHTML = `<button data-action="resume"><span>● ${esc(state.active.name)} in progress <b data-elapsed>${E.fmtDur(Date.now() - state.active.start)}</b></span><span>Resume →</span></button>`;
  }
  document.body.classList.toggle('has-resume', !!showResume);
}

/* ---------- shared UI ---------- */

function openSheet(html) {
  sheetBody.innerHTML = html;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('noscroll');
}

function closeSheet() {
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('noscroll');
  sheetCtx = null;
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

const header = (eyebrow, title, right = '') =>
  `<header class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${esc(title)}</h1></div>${right}</header>`;

/* ---------- setup / profile ---------- */

function profileForm(p, isNew) {
  p = p || { goal: 'hypertrophy', experience: 'intermediate', days: 4, minutes: 60, equipment: ['barbell', 'dumbbell', 'bench', 'machine', 'cable', 'pullupbar'], units: 'kg' };
  const chip = (name, value, label, checked, type = 'radio') =>
    `<label class="chip"><input type="${type}" name="${name}" value="${value}" ${checked ? 'checked' : ''}><span>${label}</span></label>`;
  const group = (legend, html, hint = '') =>
    `<fieldset><legend>${legend}</legend>${hint ? `<p class="hint-text">${hint}</p>` : ''}<div class="chips">${html}</div></fieldset>`;
  return `<form id="profile-form" class="stack">
    ${group('Goal', [['strength', 'Get stronger'], ['hypertrophy', 'Build muscle'], ['endurance', 'Muscular endurance']].map(([v, l]) => chip('goal', v, l, p.goal === v)).join(''))}
    ${group('Experience', [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']].map(([v, l]) => chip('experience', v, l, p.experience === v)).join(''))}
    ${group('Workouts per week', [2, 3, 4, 5, 6].map((d) => chip('days', d, d, p.days === d)).join(''), '2–3 → full body · 4 → upper/lower · 5–6 → push/pull/legs')}
    ${group('Session length', [30, 45, 60, 75, 90].map((m) => chip('minutes', m, m + ' min', p.minutes === m)).join(''))}
    ${group('Equipment you have', EQUIPMENT.map((q) => chip('equipment', q.id, q.name, p.equipment.includes(q.id), 'checkbox')).join(''), 'Bodyweight exercises are always available.')}
    ${group('Units', [['kg', 'kg'], ['lb', 'lb']].map(([v, l]) => chip('units', v, l, p.units === v)).join(''))}
    <button class="btn primary block" type="submit">${isNew ? 'Build my first workout' : 'Save changes'}</button>
  </form>`;
}

function viewSetup() {
  return `<div class="hero"><div class="logo">F</div><h1>Welcome to Forge</h1>
    <p class="muted">Tell it how you train. It builds each workout around what's recovered, then nudges the weight or reps up every session.</p>
    <button class="btn link" data-action="open-sync">Already use Forge on another device? Restore with sync →</button></div>
    ${profileForm(state.profile, !state.profile)}`;
}

/* ---------- today ---------- */

function ensureDraft() {
  const d = state.draft;
  if (!d || d.date !== E.todayKey() || !d.items.every((it) => EX[it.exId])) {
    state.draft = E.generate(state.profile, state.workouts, state.excluded);
    save();
  }
  return state.draft;
}

function viewToday() {
  const p = state.profile;
  const d = ensureDraft();
  const rec = E.recoveryMap(state.workouts);
  const weekCount = state.workouts.filter((w) => w.end >= E.weekStart(Date.now())).length;
  const muscles = [...new Set(d.items.flatMap((it) => EX[it.exId].primary))];
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const items = d.items.map((it, i) => {
    const ex = EX[it.exId];
    const s = E.suggest(it.exId, it.rx, state.workouts, U());
    const load = s.w != null ? ` · ${E.fmtW(s.w, U())}` : '';
    return `<li class="plan-item">
      <span class="pi-num">${i + 1}</span>
      <div class="pi-main"><div class="pi-name">${esc(ex.name)}</div>
        <div class="pi-sub">${it.rx.sets} × ${it.rx.min}–${it.rx.max} ${unitLabel(ex)}${load}</div>
        <div class="pi-muscles">${muscleList(ex)}</div></div>
      <button class="icon-btn" data-action="swap" data-target="draft" data-i="${i}" aria-label="Swap exercise">⇄</button>
      <button class="icon-btn" data-action="remove-draft" data-i="${i}" aria-label="Remove exercise">✕</button>
    </li>`;
  }).join('');

  const types = Object.entries(E.SPLITS).map(([k, v]) =>
    `<button class="chip-btn ${k === d.dayType ? 'on' : ''}" data-action="force-type" data-type="${k}">${v.name}</button>`).join('');

  return `${header(date, d.name, `<div class="week-ring" title="Workouts this week"><b>${weekCount}/${p.days}</b><small>this week</small></div>`)}
    <div class="meta-row"><span>${d.items.length} exercises</span><span>~${E.estimateMinutes(d.items)} min</span><span>${({ strength: 'Strength', hypertrophy: 'Muscle', endurance: 'Endurance' })[p.goal]}</span></div>
    <div class="muscle-chips">${muscles.map((m) => `<span class="mchip" style="--c:${E.recColor(rec[m].pct)}">${MUSCLE_NAME[m]} <b>${rec[m].pct}%</b></span>`).join('')}</div>
    ${d.items.length ? `<ol class="plan card">${items}</ol>` : `<div class="empty card">No exercises match your equipment for this focus. Add one or change focus.</div>`}
    <div class="row gap wrap">
      <button class="btn ghost" data-action="add-ex" data-target="draft">+ Add exercise</button>
      <button class="btn ghost" data-action="regen">↻ Regenerate</button>
    </div>
    <details class="focus"><summary>Change focus</summary><div class="chips">${types}</div></details>
    <div class="cta-wrap">
      <button class="btn primary block big" data-action="start" ${d.items.length ? '' : 'disabled'}>${state.active ? 'Start (replaces current)' : 'Start workout'}</button>
      <button class="btn link block" data-action="start-empty">or start an empty workout</button>
    </div>`;
}

/* ---------- active workout ---------- */

function makeActiveEx(exId, rx) {
  const s = E.suggest(exId, rx, state.workouts, U());
  return { exId, rx, note: s.note, kind: s.kind, sets: Array.from({ length: rx.sets }, () => ({ w: s.w, r: s.r, done: false })) };
}

function startWorkout(fromDraft) {
  if (state.active && !confirm('Replace the workout in progress? Its sets will be lost.')) return false;
  const d = state.draft;
  state.active = {
    id: E.uid(),
    start: Date.now(),
    name: fromDraft ? d.name : 'Custom Workout',
    dayType: fromDraft ? d.dayType : null,
    exercises: fromDraft ? d.items.map((it) => makeActiveEx(it.exId, it.rx)) : [],
    rest: null,
  };
  save();
  go('workout');
  return true;
}

function prevText(s) {
  if (!s.w) return `${s.r}`;
  return `${E.fmtNum(E.toDisp(s.w, U()))}×${s.r}`;
}

function restBar() {
  const r = state.active?.rest;
  if (!r) return '';
  const left = Math.max(0, Math.ceil((r.until - Date.now()) / 1000));
  return `<div class="rest">
    <div class="rest-fill" style="width:${(100 * left) / r.total}%"></div>
    <span class="rest-label">Rest <b data-rest>${E.fmtClock(left)}</b></span>
    <span class="rest-btns"><button class="btn small" data-action="rest-adj" data-d="-15">−15</button><button class="btn small" data-action="rest-adj" data-d="15">+15</button><button class="btn small" data-action="rest-skip">Skip</button></span>
  </div>`;
}

function exCard(e, i) {
  const ex = EX[e.exId];
  const u = U();
  const prev = E.sessionsFor(e.exId, state.workouts)[0]?.sets || [];
  const done = e.sets.filter((s) => s.done).length;
  const rows = e.sets.map((s, j) => `<tr class="${s.done ? 'done' : ''}">
      <td class="setno">${j + 1}</td>
      <td class="prev">${prev[j] ? prevText(prev[j]) : '—'}</td>
      <td><input class="num" inputmode="decimal" autocomplete="off" data-ex="${i}" data-set="${j}" data-f="w" value="${s.w == null ? '' : E.fmtNum(E.toDisp(s.w, u))}" placeholder="${ex.bw ? '0' : '—'}" aria-label="Weight set ${j + 1}"></td>
      <td><input class="num" inputmode="numeric" autocomplete="off" data-ex="${i}" data-set="${j}" data-f="r" value="${s.r ?? ''}" aria-label="${unitLabel(ex)} set ${j + 1}"></td>
      <td><button class="check" data-action="toggle-set" data-i="${i}" data-j="${j}" aria-label="Mark set ${j + 1} done" aria-pressed="${s.done}">✓</button></td>
    </tr>`).join('');
  return `<section class="card ex-card ${done && done === e.sets.length ? 'complete' : ''}">
    <div class="ex-head">
      <div><h2>${esc(ex.name)}</h2><p class="pi-muscles">${muscleList(ex)} · ${e.rx.min}–${e.rx.max} ${unitLabel(ex)} · rest ${E.fmtClock(e.rx.rest)}</p></div>
      <div class="ex-tools"><button class="icon-btn" data-action="swap" data-target="active" data-i="${i}" aria-label="Swap exercise">⇄</button><button class="icon-btn" data-action="remove-active" data-i="${i}" aria-label="Remove exercise">✕</button></div>
    </div>
    ${e.note ? `<p class="hint hint-${e.kind}">${esc(e.note)}</p>` : ''}
    <table class="sets"><thead><tr><th>Set</th><th>Last</th><th>${ex.assist ? 'Assist ' + u : ex.bw ? '+' + u : u}</th><th>${ex.timed ? 'Sec' : 'Reps'}</th><th></th></tr></thead><tbody>${rows}</tbody></table>
    <div class="row gap"><button class="btn small ghost" data-action="add-set" data-i="${i}">+ Set</button>${e.sets.length > 1 ? `<button class="btn small ghost" data-action="del-set" data-i="${i}">− Set</button>` : ''}</div>
  </section>`;
}

function viewWorkout() {
  const a = state.active;
  if (!a) return `${header('Workout', 'Nothing in progress')}<div class="empty card"><p>Start today's plan from the Today tab.</p><a class="btn primary" href="#/today">Go to Today</a></div>`;
  const done = a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const total = a.exercises.reduce((n, e) => n + e.sets.length, 0);
  return `${header(`<span data-elapsed>${E.fmtDur(Date.now() - a.start)}</span> · ${done}/${total} sets`, a.name, '<button class="btn primary" data-action="finish">Finish</button>')}
    <div id="rest-slot" class="rest-slot">${restBar()}</div>
    ${a.exercises.map(exCard).join('') || '<div class="empty card">Add your first exercise.</div>'}
    <button class="btn ghost block" data-action="add-ex" data-target="active">+ Add exercise</button>
    <button class="btn danger-ghost block" data-action="discard">Discard workout</button>`;
}

function finishWorkout() {
  const a = state.active;
  const exercises = a.exercises
    .map((e) => ({ exId: e.exId, rx: e.rx, sets: e.sets.filter((s) => s.done && s.r > 0).map(({ w, r }) => ({ w, r, done: true })) }))
    .filter((e) => e.sets.length);
  if (!exercises.length) {
    if (confirm('No sets completed. Discard this workout?')) {
      state.active = null;
      save();
      go('today');
    }
    return;
  }
  const open = a.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
  if (open && !confirm(`${open} set${open > 1 ? 's' : ''} not checked off. Finish anyway?`)) return;
  const w = { id: a.id, start: a.start, end: Date.now(), name: a.name, dayType: a.dayType, exercises };
  const prs = E.findPRs(w, state.workouts);
  state.workouts.push(w);
  state.active = null;
  state.draft = null;
  save();
  Sync.scheduleSync();
  go('history');
  openSheet(workoutSheet(w, prs, true));
}

/* rest timer + clock */
let audio;
function unlockAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ }
}
function restDone() {
  navigator.vibrate?.([200, 100, 200]);
  if (!audio) return;
  [0, 0.25].forEach((t) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.2, audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.2);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + t);
    o.stop(audio.currentTime + t + 0.2);
  });
}

setInterval(() => {
  const a = state.active;
  if (!a) return;
  document.querySelectorAll('[data-elapsed]').forEach((el) => (el.textContent = E.fmtDur(Date.now() - a.start)));
  if (!a.rest) return;
  const left = (a.rest.until - Date.now()) / 1000;
  if (left <= 0) {
    a.rest = null;
    save();
    restDone();
    const slot = document.getElementById('rest-slot');
    if (slot) slot.innerHTML = '';
    return;
  }
  const b = document.querySelector('[data-rest]');
  if (b) b.textContent = E.fmtClock(Math.ceil(left));
  const f = document.querySelector('.rest-fill');
  if (f) f.style.width = `${(100 * left) / a.rest.total}%`;
}, 500);

/* ---------- exercise picker ---------- */

const overlap = (a, b) => (a.primary[0] === b.primary[0] ? 3 : 0) + a.primary.filter((m) => b.primary.includes(m)).length + (a.kind === b.kind ? 0.5 : 0);

function currentPickerEx() {
  if (sheetCtx?.mode !== 'swap') return null;
  const list = sheetCtx.target === 'draft' ? state.draft.items : state.active.exercises;
  return EX[list[sheetCtx.i].exId];
}

function openPicker(ctx) {
  sheetCtx = ctx;
  const cur = currentPickerEx();
  openSheet(`<div class="sheet-head"><h2>${cur ? `Swap ${esc(cur.name)}` : 'Add exercise'}</h2><button class="icon-btn" data-action="close-sheet" aria-label="Close">✕</button></div>
    <input id="ex-search" class="search" type="search" placeholder="Search by name or muscle" autocomplete="off">
    <div class="row between"><label class="toggle"><input type="checkbox" id="ex-mine" checked> Only my equipment</label>
    ${cur ? `<button class="btn small danger-ghost" data-action="exclude" data-id="${cur.id}">Never suggest this</button>` : ''}</div>
    <ul id="ex-list" class="ex-list"></ul>`);
  renderExList();
}

function renderExList() {
  const listEl = document.getElementById('ex-list');
  if (!listEl || !sheetCtx) return;
  const q = document.getElementById('ex-search').value.trim().toLowerCase();
  const mine = document.getElementById('ex-mine').checked;
  const eq = new Set(state.profile.equipment);
  const cur = currentPickerEx();
  let list = EXERCISES.filter((e) =>
    (!mine || e.equip.every((x) => eq.has(x))) &&
    (!q || e.name.toLowerCase().includes(q) || e.primary.some((m) => MUSCLE_NAME[m].toLowerCase().includes(q))));
  if (cur) {
    list = list.filter((e) => e.id !== cur.id && (q || overlap(e, cur) >= 3));
    list.sort((a, b) => overlap(b, cur) - overlap(a, cur) || a.name.localeCompare(b.name));
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  listEl.innerHTML = list.map((e) => `<li><button data-action="pick-ex" data-id="${e.id}">
      <b>${esc(e.name)}${state.excluded.includes(e.id) ? ' <span class="tag">hidden</span>' : ''}</b>
      <small>${muscleList(e)} · ${e.equip.length ? e.equip.map((x) => EQUIP_NAME[x]).join(', ') : 'Bodyweight'}</small></button></li>`).join('')
    || '<li class="muted pad">No matches.</li>';
}

function pickExercise(id) {
  const ctx = sheetCtx;
  const ex = EX[id];
  const rx = E.prescribe(ex, state.profile);
  if (ctx.target === 'draft') {
    const item = { exId: id, rx };
    if (ctx.mode === 'swap') state.draft.items[ctx.i] = item;
    else state.draft.items.push(item);
  } else {
    const item = makeActiveEx(id, rx);
    if (ctx.mode === 'swap') state.active.exercises[ctx.i] = item;
    else state.active.exercises.push(item);
  }
  save();
  closeSheet();
  render();
}

/* ---------- recovery ---------- */

function viewRecovery() {
  const rec = E.recoveryMap(state.workouts);
  const list = [...MUSCLES].sort((a, b) => rec[a.id].pct - rec[b.id].pct);
  return `${header('How fresh you are', 'Recovery')}
    <div class="bodies card">${bodySvg('front', rec)}${bodySvg('back', rec)}</div>
    <div class="legend"><span style="--c:${E.recColor(10)}">Fatigued</span><span style="--c:${E.recColor(55)}">Recovering</span><span style="--c:${E.recColor(100)}">Ready</span></div>
    <ul class="rec-list card">${list.map((m) => {
      const r = rec[m.id];
      return `<li><span>${m.name}</span><div class="bar"><i style="width:${r.pct}%;background:${E.recColor(r.pct)}"></i></div><b>${r.pct}%</b><small>${r.pct >= 100 ? 'Ready' : `~${Math.ceil(r.hoursLeft)}h`}</small></li>`;
    }).join('')}</ul>
    <p class="muted small">Estimated from your logged sets: each hard set adds fatigue to the muscles it works, which fades over 1½–3 days depending on the muscle. Today's plan avoids muscles under 50%.</p>`;
}

/* ---------- history ---------- */

function viewHistory() {
  const ws = [...state.workouts].sort((a, b) => b.end - a.end);
  if (!ws.length) return `${header('Your log', 'History')}<div class="empty card">No workouts yet. Finish one and it shows up here.</div>`;
  let html = '', month = '';
  for (const w of ws) {
    const m = new Date(w.end).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (m !== month) {
      if (month) html += '</div>';
      html += `<h3 class="month">${m}</h3><div class="card list">`;
      month = m;
    }
    const d = new Date(w.end);
    html += `<button class="hist-item" data-action="open-workout" data-id="${w.id}">
      <span class="date-badge"><b>${d.getDate()}</b><small>${d.toLocaleDateString(undefined, { weekday: 'short' })}</small></span>
      <span class="hi-main"><b>${esc(w.name)}</b><small>${w.exercises.map((e) => EX[e.exId]?.name).filter(Boolean).join(' · ')}</small></span>
      <span class="hi-meta">${E.fmtMinutes(w.end - w.start)}<small>${E.setCount(w)} sets</small></span>
    </button>`;
  }
  return `${header('Your log', 'History')}${html}</div>`;
}

function workoutSheet(w, prs = [], fresh = false) {
  const u = U();
  const date = new Date(w.end).toLocaleString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const prSet = new Set(prs.map((p) => p.exId));
  return `<div class="sheet-head"><div><p class="eyebrow">${fresh ? 'Workout complete' : date}</p><h2>${esc(w.name)}</h2></div><button class="icon-btn" data-action="close-sheet" aria-label="Close">✕</button></div>
    <div class="tiles">
      <div class="tile"><b>${E.fmtMinutes(w.end - w.start)}</b><small>Duration</small></div>
      <div class="tile"><b>${E.setCount(w)}</b><small>Sets</small></div>
      <div class="tile"><b>${E.fmtBig(E.volume(w), u)}</b><small>Volume</small></div>
    </div>
    ${prs.length ? `<div class="pr-banner">🏆 ${prs.length} new personal record${prs.length > 1 ? 's' : ''}: ${prs.map((p) => esc(EX[p.exId].name)).join(', ')}</div>` : ''}
    ${w.exercises.map((e) => {
      const ex = EX[e.exId];
      if (!ex) return '';
      return `<div class="detail-ex"><b>${esc(ex.name)}${prSet.has(e.exId) ? ' <span class="tag pr">PR</span>' : ''}</b>
        <div class="set-pills">${e.sets.map((s) => `<span>${s.w ? `${ex.assist ? '−' : ''}${E.fmtNum(E.toDisp(s.w, u))}${u} × ` : ''}${s.r}${ex.timed ? 's' : ''}</span>`).join('')}</div></div>`;
    }).join('')}
    ${fresh ? '<button class="btn primary block" data-action="close-sheet">Done</button>' : `<button class="btn danger-ghost block" data-action="delete-workout" data-id="${w.id}">Delete workout</button>`}`;
}

/* ---------- stats ---------- */

function barChart(data, fmt) {
  const W = 320, H = 150, P = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - P * 2) / data.length;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Weekly volume">
    ${data.map((d, i) => {
      const h = ((H - 40) * d.value) / max;
      const x = P + i * bw + bw * 0.15;
      const last = i === data.length - 1;
      return `<rect x="${x}" y="${H - 22 - h}" width="${bw * 0.7}" height="${Math.max(h, d.value ? 2 : 0)}" rx="3" class="${last ? 'bar-now' : 'bar-fill'}"><title>${d.label}: ${fmt(d.value)}</title></rect>
        ${last && d.value ? `<text x="${x + bw * 0.35}" y="${H - 28 - h}" class="val" text-anchor="middle">${fmt(d.value)}</text>` : ''}
        <text x="${x + bw * 0.35}" y="${H - 6}" class="axis" text-anchor="middle">${d.label}</text>`;
    }).join('')}
  </svg>`;
}

function lineChart(points, fmt) {
  const W = 320, H = 160, L = 8, R = 8, T = 18, B = 22;
  if (points.length < 2) return '<p class="muted small">Log this exercise at least twice to see a trend.</p>';
  const vs = points.map((p) => p.v);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const first = points[0], last = points[points.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Estimated one-rep max over time">
    <path d="${path}" class="line"/>
    ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.v)}" r="3.5" class="dot"><title>${p.label}: ${fmt(p.v)}</title></circle>`).join('')}
    <text x="${x(points.length - 1)}" y="${y(last.v) - 9}" class="val" text-anchor="end">${fmt(last.v)}</text>
    <text x="${L}" y="${H - 6}" class="axis">${first.label}</text>
    <text x="${W - R}" y="${H - 6}" class="axis" text-anchor="end">${last.label}</text>
  </svg>`;
}

function viewStats() {
  const u = U();
  const ws = state.workouts;
  const now = Date.now();
  const thisWeek = E.weekStart(now);
  // +3 days then re-snap to Monday so DST shifts don't break week matching
  const weeks = Array.from({ length: 8 }, (_, i) => E.weekStart(thisWeek - (7 - i) * 7 * E.DAY + 3 * E.DAY));
  const vol = weeks.map((start) => {
    const v = ws.filter((w) => E.weekStart(w.end) === start).reduce((a, w) => a + E.volume(w), 0);
    const d = new Date(start);
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: E.toDisp(v, u) };
  });
  const last30 = ws.filter((w) => now - w.end < 30 * E.DAY);
  const avgMin = last30.length ? Math.round(last30.reduce((a, w) => a + (w.end - w.start), 0) / last30.length / 60000) : 0;
  const tiles = `<div class="tiles four">
    <div class="tile"><b>${ws.length}</b><small>Workouts</small></div>
    <div class="tile"><b>${ws.filter((w) => w.end >= thisWeek).length}/${state.profile.days}</b><small>This week</small></div>
    <div class="tile"><b>${E.weekStreak(ws)}</b><small>Week streak</small></div>
    <div class="tile"><b>${avgMin || '—'}</b><small>Avg min</small></div>
  </div>`;

  if (!ws.length) return `${header('Progress', 'Stats')}${tiles}<div class="empty card">Stats appear after your first workout.</div>`;

  // Sets per muscle in the last 7 days
  const spm = E.setsPerMuscle(ws, now - 7 * E.DAY);
  const maxSets = Math.max(20, ...Object.values(spm));
  const muscleRows = MUSCLES.map((m) => `<li><span>${m.name}</span><div class="bar"><i style="width:${(100 * spm[m.id]) / maxSets}%"></i><em style="left:${(100 * 10) / maxSets}%"></em><em style="left:${(100 * 20) / maxSets}%"></em></div><b>${E.fmtNum(spm[m.id])}</b></li>`).join('');

  // Exercise progress
  const counts = {};
  ws.forEach((w) => w.exercises.forEach((e) => (counts[e.exId] = (counts[e.exId] || 0) + 1)));
  const exIds = Object.keys(counts).filter((id) => EX[id]).sort((a, b) => counts[b] - counts[a]);
  if (!statEx || !counts[statEx]) statEx = exIds[0];
  const ex = EX[statEx];
  const sess = E.sessionsFor(statEx, ws).reverse();
  const timedOrBw = ex.timed || ex.assist || sess.every((s) => s.sets.every((x) => !x.w));
  const fmtV = (v) => (timedOrBw ? `${Math.round(v)} ${unitLabel(ex)}` : `${E.fmtNum(v)} ${u}`);
  const points = sess.slice(-20).map((s) => ({
    label: new Date(s.w.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    v: timedOrBw ? Math.max(...s.sets.map((x) => x.r)) : E.toDisp(E.bestE1rm(s.sets), u),
  }));
  const all = sess.flatMap((s) => s.sets);
  const heaviest = all.reduce((a, s) => ((s.w || 0) > (a?.w || 0) ? s : a), null);
  const mostReps = Math.max(...all.map((s) => s.r));
  const best = E.bestE1rm(all);

  return `${header('Progress', 'Stats')}${tiles}
    <section class="card"><h3>Weekly volume <small>${u} lifted</small></h3>${barChart(vol, (v) => E.fmtBig(E.fromDisp(v, u), u))}</section>
    <section class="card"><h3>Sets per muscle <small>last 7 days · marks at 10 & 20</small></h3><ul class="rec-list spm">${muscleRows}</ul></section>
    <section class="card"><h3>Exercise progress</h3>
      <select id="stat-ex" class="search">${exIds.map((id) => `<option value="${id}" ${id === statEx ? 'selected' : ''}>${esc(EX[id].name)} (${counts[id]})</option>`).join('')}</select>
      <p class="muted small">${timedOrBw ? `Best ${unitLabel(ex)} per session` : 'Estimated 1-rep max per session'}</p>
      ${lineChart(points, fmtV)}
      <div class="tiles">
        ${timedOrBw ? '' : `<div class="tile"><b>${E.fmtW(best, u)}</b><small>Best est. 1RM</small></div>
        <div class="tile"><b>${heaviest ? E.fmtW(heaviest.w, u) : '—'}</b><small>Heaviest${heaviest ? ` × ${heaviest.r}` : ''}</small></div>`}
        <div class="tile"><b>${mostReps}</b><small>Most ${unitLabel(ex)}</small></div>
        <div class="tile"><b>${sess.length}</b><small>Sessions</small></div>
      </div>
    </section>`;
}

/* ---------- settings ---------- */

function viewSettings() {
  return `${header('Your training', 'Settings')}
    <section class="card">${profileForm(state.profile, false)}</section>
    <section class="card"><h3>Hidden exercises</h3>
      ${state.excluded.length ? `<ul class="plain">${state.excluded.filter((id) => EX[id]).map((id) => `<li><span>${esc(EX[id].name)}</span><button class="btn small ghost" data-action="unexclude" data-id="${id}">Allow</button></li>`).join('')}</ul>`
        : '<p class="muted small">None. Use “Never suggest this” when swapping an exercise.</p>'}
    </section>
    <section class="card" id="sync-card">${syncCard()}</section>
    <section class="card"><h3>Export &amp; backup</h3>
      <p class="muted small">Data is stored in this browser${Sync.isConnected() ? ' and synced to your gist' : ' only — clearing site data deletes it'}.
        The JSON backup can be imported on any device (it merges, nothing is overwritten). The CSV has one row per set for spreadsheets.</p>
      <div class="row gap wrap">
        <button class="btn ghost" data-action="export">Backup (.json)</button>
        <button class="btn ghost" data-action="export-csv">Sets (.csv)</button>
        <label class="btn ghost">Import backup<input type="file" id="import-file" accept="application/json,.json" hidden></label>
      </div>
    </section>
    <section class="card"><h3>Move from Gravl</h3>
      <p class="muted small">In Gravl, go to Profile → Export Data and save the CSV, then pick it here. You'll see a preview before anything is saved.
        Strength sets are imported. Cardio and warm-up sets are skipped. Importing the same file twice won't create duplicates.</p>
      <label class="btn ghost">Import Gravl CSV<input type="file" id="gravl-file" accept=".csv,text/csv" hidden></label>
      <button class="btn danger-ghost block" data-action="reset">Erase data on this device</button>
    </section>`;
}

/* ---------- sync UI ---------- */

function ago(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

function syncStatusText() {
  const st = Sync.getStatus();
  if (st.state === 'syncing') return '<span class="sync-dot busy"></span>Syncing…';
  if (st.state === 'error') return `<span class="sync-dot err"></span>${esc(st.error)}`;
  return `<span class="sync-dot ok"></span>${Sync.lastSync() ? `Synced ${ago(Sync.lastSync())}` : 'Connected'}`;
}

function syncCard() {
  if (Sync.isConnected()) {
    return `<h3>Sync across devices</h3>
      <p id="sync-status" class="small sync-status">${syncStatusText()}</p>
      <p class="muted small">Syncs when the app opens, when you come back to it, and after each change.</p>
      <div class="row gap wrap">
        <button class="btn ghost" data-action="sync-now">Sync now</button>
        <a class="btn ghost" href="${Sync.gistUrl()}" target="_blank" rel="noopener">View gist</a>
        <button class="btn danger-ghost" data-action="sync-disconnect">Disconnect</button>
      </div>`;
  }
  return `<h3>Sync across devices</h3>
    <p class="muted small">Keeps your workouts in a private GitHub gist so every device you use stays up to date.</p>
    <ol class="steps small">
      <li><a href="https://github.com/settings/tokens/new?scopes=gist&description=Forge%20workout%20sync" target="_blank" rel="noopener">Create a GitHub token</a> with only the <b>gist</b> scope. Pick a long expiry or none.</li>
      <li>Paste it here. Use the same token on your other devices — they find the same gist automatically.</li>
    </ol>
    <form id="sync-form" class="row gap">
      <input id="sync-token" class="search" type="password" placeholder="ghp_…" autocomplete="off" spellcheck="false" required aria-label="GitHub token">
      <button class="btn primary" type="submit">Connect</button>
    </form>
    <p id="sync-status" class="small sync-status">${Sync.getStatus().state === 'error' ? syncStatusText() : ''}</p>
    <p class="muted small">The token is stored only in this browser and is never included in exports.</p>`;
}

function exportCsv() {
  const u = U();
  const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const rows = [['date', 'time', 'workout', 'exercise', 'set', `weight_${u}`, 'reps_or_sec', `est_1rm_${u}`, 'duration_min']];
  for (const w of [...state.workouts].sort((a, b) => a.end - b.end)) {
    const d = new Date(w.start);
    const mins = Math.round((w.end - w.start) / 60000);
    for (const e of w.exercises) {
      const ex = EX[e.exId];
      e.sets.forEach((s, i) => {
        const wt = s.w ? E.fmtNum(E.toDisp(s.w, u)) : '';
        const one = s.w && !ex?.timed ? E.fmtNum(E.toDisp(E.e1rm(s.w, s.r), u)) : '';
        rows.push([E.todayKey(d), d.toTimeString().slice(0, 5), w.name, ex?.name || e.exId, i + 1, wt, s.r, one, mins]);
      });
    }
  }
  download(`forge-sets-${E.todayKey()}.csv`, rows.map((r) => r.map(q).join(',')).join('\r\n'), 'text/csv');
}

/* ---------- Gravl import ---------- */

let gravlPending = null;

function gravlPreview(res) {
  const { workouts, stats, lb } = res;
  const have = new Set(state.workouts.map((w) => w.id));
  const fresh = workouts.filter((w) => !have.has(w.id) && !state.deleted[w.id]);
  const fmtD = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const exCount = new Set(workouts.flatMap((w) => w.exercises.map((e) => e.exId))).size;
  const usedEquip = new Set(workouts.flatMap((w) => w.exercises.flatMap((e) => EX[e.exId].equip)));
  const missingEquip = [...usedEquip].filter((q) => !state.profile.equipment.includes(q));
  const unknown = Object.entries(stats.unknown).sort((a, b) => b[1] - a[1]);
  const fileUnits = lb ? 'lb' : 'kg';
  gravlPending = { fresh, missingEquip, fileUnits };

  return `<div class="sheet-head"><div><p class="eyebrow">Import preview</p><h2>Gravl history</h2></div><button class="icon-btn" data-action="close-sheet" aria-label="Close">✕</button></div>
    ${workouts.length ? `<p class="small">${fmtD(workouts[0].start)} – ${fmtD(workouts[workouts.length - 1].start)}</p>` : ''}
    <div class="tiles">
      <div class="tile"><b>${fresh.length}</b><small>New workouts</small></div>
      <div class="tile"><b>${stats.sets}</b><small>Sets</small></div>
      <div class="tile"><b>${exCount}</b><small>Exercises</small></div>
    </div>
    <ul class="plain small import-notes">
      ${workouts.length - fresh.length ? `<li>${workouts.length - fresh.length} workouts already imported, so they'll be skipped</li>` : ''}
      ${stats.cardio ? `<li>${stats.cardio} cardio entries skipped (walking, running…)</li>` : ''}
      ${stats.warmup ? `<li>${stats.warmup} warm-up sets skipped</li>` : ''}
      ${unknown.length ? `<li class="warn">Not recognised, skipped: ${unknown.map(([n, c]) => `${esc(n)} (${c})`).join(', ')}</li>` : '<li>Every exercise matched Forge’s library</li>'}
    </ul>
    ${fileUnits !== U() ? `<label class="toggle opt"><input type="checkbox" id="gravl-units" checked> Switch Forge to ${fileUnits} (what Gravl used)</label>` : ''}
    ${missingEquip.length ? `<label class="toggle opt"><input type="checkbox" id="gravl-equip" checked> Add equipment you used in Gravl: ${missingEquip.map((q) => EQUIP_NAME[q]).join(', ')}</label>` : ''}
    <button class="btn primary block" data-action="gravl-confirm" ${fresh.length ? '' : 'disabled'}>${fresh.length ? `Import ${fresh.length} workouts` : 'Nothing new to import'}</button>`;
}

function gravlConfirm() {
  const p = gravlPending;
  if (!p) return;
  mergeInto({ workouts: p.fresh, deleted: {} });
  let prefs = false;
  if (document.getElementById('gravl-units')?.checked) { state.profile.units = p.fileUnits; prefs = true; }
  if (document.getElementById('gravl-equip')?.checked) { state.profile.equipment = [...state.profile.equipment, ...p.missingEquip]; prefs = true; }
  if (prefs) touchPrefs();
  state.draft = null;
  save();
  Sync.scheduleSync();
  gravlPending = null;
  closeSheet();
  toast(`Imported ${p.fresh.length} workouts from Gravl`);
  go('history');
}

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- events ---------- */

const actions = {
  'close-sheet': closeSheet,
  resume: () => go('workout'),
  regen: () => { state.draft = E.generate(state.profile, state.workouts, state.excluded, state.draft?.dayType); save(); render(); },
  'force-type': (t) => { state.draft = E.generate(state.profile, state.workouts, state.excluded, t.dataset.type); save(); render(); },
  'remove-draft': (t) => { state.draft.items.splice(+t.dataset.i, 1); save(); render(); },
  start: () => startWorkout(true),
  'start-empty': () => { if (startWorkout(false)) openPicker({ mode: 'add', target: 'active' }); },
  'add-ex': (t) => openPicker({ mode: 'add', target: t.dataset.target }),
  swap: (t) => openPicker({ mode: 'swap', target: t.dataset.target, i: +t.dataset.i }),
  'pick-ex': (t) => pickExercise(t.dataset.id),
  exclude: (t) => {
    if (!state.excluded.includes(t.dataset.id)) state.excluded.push(t.dataset.id);
    touchPrefs();
    save();
    Sync.scheduleSync();
    toast(`${EX[t.dataset.id].name} won't be suggested`);
    renderExList();
  },
  unexclude: (t) => {
    state.excluded = state.excluded.filter((id) => id !== t.dataset.id);
    touchPrefs();
    save();
    Sync.scheduleSync();
    render();
  },
  'toggle-set': (t) => {
    unlockAudio();
    const e = state.active.exercises[+t.dataset.i];
    const s = e.sets[+t.dataset.j];
    s.done = !s.done;
    if (s.done) {
      if (!s.r) s.r = e.rx.min;
      state.active.rest = { until: Date.now() + e.rx.rest * 1000, total: e.rx.rest };
    }
    save();
    render();
  },
  'add-set': (t) => {
    const e = state.active.exercises[+t.dataset.i];
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ w: last?.w ?? null, r: last?.r ?? e.rx.min, done: false });
    save();
    render();
  },
  'del-set': (t) => { state.active.exercises[+t.dataset.i].sets.pop(); save(); render(); },
  'remove-active': (t) => {
    const e = state.active.exercises[+t.dataset.i];
    if (e.sets.some((s) => s.done) && !confirm(`Remove ${EX[e.exId].name} and its logged sets?`)) return;
    state.active.exercises.splice(+t.dataset.i, 1);
    save();
    render();
  },
  'rest-adj': (t) => {
    const r = state.active.rest;
    r.until += +t.dataset.d * 1000;
    r.total = Math.max(r.total, (r.until - Date.now()) / 1000);
    save();
    document.getElementById('rest-slot').innerHTML = restBar();
  },
  'rest-skip': () => { state.active.rest = null; save(); document.getElementById('rest-slot').innerHTML = ''; },
  finish: finishWorkout,
  discard: () => {
    if (!confirm('Discard this workout? Logged sets will be lost.')) return;
    state.active = null;
    save();
    go('today');
  },
  'open-workout': (t) => {
    const w = state.workouts.find((x) => x.id === t.dataset.id);
    if (w) openSheet(workoutSheet(w));
  },
  'delete-workout': (t) => {
    if (!confirm('Delete this workout from your history? This cannot be undone.')) return;
    state.workouts = state.workouts.filter((w) => w.id !== t.dataset.id);
    state.deleted[t.dataset.id] = Date.now(); // so other devices delete it too
    save();
    Sync.scheduleSync();
    closeSheet();
    render();
  },
  export: () => download(`forge-backup-${E.todayKey()}.json`, exportData(), 'application/json'),
  'export-csv': exportCsv,
  reset: () => {
    const synced = Sync.isConnected();
    const msg = synced
      ? 'Erase all data on this device and disconnect sync? Your synced copy in the gist is kept — reconnect to get it back.'
      : 'Erase all workouts and settings on this device? Export a backup first if you want to keep them.';
    if (!confirm(msg)) return;
    Sync.disconnect();
    replaceAll({});
    go('setup');
  },
  'open-sync': () => openSheet(`<div class="sheet-head"><h2>Restore with sync</h2><button class="icon-btn" data-action="close-sheet" aria-label="Close">✕</button></div><div id="sync-card">${syncCard()}</div>`),
  'gravl-confirm': gravlConfirm,
  'sync-now': () => Sync.syncNow(),
  'sync-disconnect': () => {
    if (!confirm('Stop syncing on this device? Data here and in the gist are both kept.')) return;
    Sync.disconnect();
    render();
  },
};

document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-action]');
  if (!t || t.disabled) return;
  const fn = actions[t.dataset.action];
  if (fn) {
    ev.preventDefault();
    fn(t, ev);
  }
});

document.addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.id === 'ex-search') return renderExList();
  if (!t.dataset.f || !state.active) return;
  const s = state.active.exercises[+t.dataset.ex]?.sets[+t.dataset.set];
  if (!s) return;
  const v = parseFloat(t.value.replace(',', '.'));
  if (t.dataset.f === 'w') s.w = isNaN(v) ? null : E.fromDisp(v, U());
  else s.r = isNaN(v) ? null : Math.round(v);
  save();
});

document.addEventListener('change', async (ev) => {
  const t = ev.target;
  if (t.id === 'ex-mine') return renderExList();
  if (t.id === 'stat-ex') { statEx = t.value; return render(); }
  if (t.dataset.f === 'w' && state.active) {
    // Carry a new weight down to the remaining sets of that exercise.
    const i = +t.dataset.ex, j = +t.dataset.set;
    const e = state.active.exercises[i];
    e.sets.forEach((s, k) => {
      if (k <= j || s.done) return;
      s.w = e.sets[j].w;
      const inp = document.querySelector(`input[data-ex="${i}"][data-set="${k}"][data-f="w"]`);
      if (inp) inp.value = t.value;
    });
    save();
  }
  if (t.id === 'gravl-file' && t.files[0]) {
    try {
      openSheet(gravlPreview(parseGravl(await t.files[0].text())));
    } catch (err) {
      alert('Could not read the Gravl file: ' + err.message);
    } finally {
      t.value = '';
    }
    return;
  }
  if (t.id === 'import-file' && t.files[0]) {
    try {
      const data = JSON.parse(await t.files[0].text());
      if (!Array.isArray(data.workouts)) throw new Error('Not a Forge backup');
      const before = state.workouts.length;
      mergeInto(data);
      save();
      Sync.scheduleSync();
      toast(`Imported — ${state.workouts.length - before} new workout${state.workouts.length - before === 1 ? '' : 's'}`);
      go(state.profile ? 'today' : 'setup');
    } catch (err) {
      alert('Could not import: ' + err.message);
    } finally {
      t.value = '';
    }
  }
});

document.addEventListener('submit', async (ev) => {
  if (ev.target.id === 'sync-form') {
    ev.preventDefault();
    const btn = ev.target.querySelector('button');
    btn.disabled = true;
    try {
      const { created } = await Sync.connect(document.getElementById('sync-token').value);
      toast(created ? 'Sync set up — created a private gist' : 'Connected — synced with your other devices');
      closeSheet();
      if (state.profile && route() === 'setup') go('today');
      else render();
    } catch {
      btn.disabled = false;
    }
    return;
  }
  if (ev.target.id !== 'profile-form') return;
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const isNew = !state.profile;
  state.profile = {
    goal: fd.get('goal'),
    experience: fd.get('experience'),
    days: +fd.get('days'),
    minutes: +fd.get('minutes'),
    equipment: fd.getAll('equipment'),
    units: fd.get('units'),
  };
  state.draft = null;
  touchPrefs();
  save();
  Sync.scheduleSync();
  if (!isNew) toast('Saved — today’s plan was rebuilt');
  go('today');
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('./sw.js');
}

/* ---------- sync wiring ---------- */

Sync.onStatus(() => {
  const el = document.getElementById('sync-status');
  if (el) el.innerHTML = syncStatusText();
});

Sync.onRemoteData(() => {
  // Don't yank the screen out from under someone typing a set.
  if (document.activeElement?.matches('input, select, textarea')) return;
  if (!state.profile) return;
  if (route() === 'setup') go('today');
  else render();
  toast('Synced changes from another device');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') Sync.syncNow();
});
window.addEventListener('online', () => Sync.syncNow());

render();
Sync.syncNow();
