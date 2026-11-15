// Stylised front/back body figures; each muscle group is coloured by recovery.
import { MUSCLE_NAME } from './exercises.js';
import { recColor } from './engine.js';

const pair = (tag, lx, rest, rx) =>
  `<${tag} cx="${lx}" ${rest}/><${tag} cx="${rx}" ${rest}/>`;

const BASE = [
  '<circle cx="100" cy="30" r="18"/>',
  '<rect x="91" y="44" width="18" height="18" rx="4"/>',
  '<rect x="64" y="62" width="72" height="116" rx="22"/>',
  '<rect x="68" y="166" width="64" height="42" rx="14"/>',
  pair('ellipse', 52, 'cy="118" rx="12" ry="32"', 148),
  pair('ellipse', 42, 'cy="172" rx="10" ry="28"', 158),
  pair('circle', 38, 'cy="206" r="8"', 162),
  pair('ellipse', 85, 'cy="248" rx="18" ry="48"', 115),
  pair('ellipse', 85, 'cy="330" rx="12" ry="36"', 115),
  pair('ellipse', 83, 'cy="372" rx="12" ry="6"', 117),
].join('');

const FRONT = {
  shoulders: pair('ellipse', 62, 'cy="80" rx="14" ry="12"', 138),
  chest: '<rect x="72" y="74" width="27" height="31" rx="10"/><rect x="101" y="74" width="27" height="31" rx="10"/>',
  biceps: pair('ellipse', 52, 'cy="120" rx="8" ry="20"', 148),
  forearms: pair('ellipse', 42, 'cy="172" rx="7" ry="20"', 158),
  abs: '<rect x="84" y="110" width="32" height="62" rx="9"/>',
  quads: pair('ellipse', 86, 'cy="244" rx="13" ry="38"', 114),
  calves: pair('ellipse', 85, 'cy="330" rx="8" ry="26"', 115),
};

const BACK = {
  traps: '<path d="M100 56 L126 74 L112 110 L100 118 L88 110 L74 74 Z"/>',
  shoulders: pair('ellipse', 62, 'cy="80" rx="14" ry="12"', 138),
  lats: '<path d="M74 90 L94 116 L96 150 L80 142 L70 110 Z"/><path d="M126 90 L106 116 L104 150 L120 142 L130 110 Z"/>',
  lowerback: '<rect x="88" y="136" width="24" height="30" rx="7"/>',
  triceps: pair('ellipse', 52, 'cy="116" rx="8" ry="20"', 148),
  forearms: pair('ellipse', 42, 'cy="172" rx="7" ry="20"', 158),
  glutes: pair('ellipse', 88, 'cy="190" rx="15" ry="16"', 112),
  hamstrings: pair('ellipse', 86, 'cy="252" rx="13" ry="34"', 114),
  calves: pair('ellipse', 85, 'cy="326" rx="10" ry="26"', 115),
};

export function bodySvg(side, rec) {
  const groups = side === 'front' ? FRONT : BACK;
  const muscles = Object.entries(groups)
    .map(([m, shapes]) => {
      const pct = rec[m]?.pct ?? 100;
      return `<g fill="${recColor(pct)}" data-muscle="${m}"><title>${MUSCLE_NAME[m]}: ${pct}% recovered</title>${shapes}</g>`;
    })
    .join('');
  return `<figure class="body-fig">
    <svg viewBox="0 0 200 385" role="img" aria-label="${side} view muscle recovery">
      <g class="body-base">${BASE}</g>${muscles}
    </svg>
    <figcaption>${side === 'front' ? 'Front' : 'Back'}</figcaption>
  </figure>`;
}
