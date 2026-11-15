// Exercise library. Each exercise lists the muscles it trains (primary get full
// credit for fatigue/volume, secondary get partial) and ALL equipment it needs.

export const MUSCLES = [
  { id: 'chest', name: 'Chest', hours: 72 },
  { id: 'shoulders', name: 'Shoulders', hours: 60 },
  { id: 'triceps', name: 'Triceps', hours: 48 },
  { id: 'biceps', name: 'Biceps', hours: 48 },
  { id: 'forearms', name: 'Forearms', hours: 36 },
  { id: 'lats', name: 'Lats', hours: 72 },
  { id: 'traps', name: 'Upper back', hours: 60 },
  { id: 'lowerback', name: 'Lower back', hours: 72 },
  { id: 'abs', name: 'Core', hours: 36 },
  { id: 'glutes', name: 'Glutes', hours: 72 },
  { id: 'quads', name: 'Quads', hours: 72 },
  { id: 'hamstrings', name: 'Hamstrings', hours: 72 },
  { id: 'calves', name: 'Calves', hours: 36 },
];

export const EQUIPMENT = [
  { id: 'barbell', name: 'Barbell & rack' },
  { id: 'dumbbell', name: 'Dumbbells' },
  { id: 'bench', name: 'Bench' },
  { id: 'machine', name: 'Machines' },
  { id: 'cable', name: 'Cable station' },
  { id: 'kettlebell', name: 'Kettlebells' },
  { id: 'pullupbar', name: 'Pull-up / dip bar' },
  { id: 'bands', name: 'Resistance bands' },
];

const C = 'compound', I = 'isolation';

// [id, name, primary, secondary, equipment, kind, flags]  flags: bw = bodyweight, sec = timed
const RAW = [
  // Chest
  ['bb_bench', 'Barbell Bench Press', ['chest'], ['triceps', 'shoulders'], ['barbell', 'bench'], C],
  ['bb_incline', 'Incline Barbell Bench Press', ['chest'], ['shoulders', 'triceps'], ['barbell', 'bench'], C],
  ['db_bench', 'Dumbbell Bench Press', ['chest'], ['triceps', 'shoulders'], ['dumbbell', 'bench'], C],
  ['db_incline', 'Incline Dumbbell Press', ['chest'], ['shoulders', 'triceps'], ['dumbbell', 'bench'], C],
  ['machine_chest', 'Machine Chest Press', ['chest'], ['triceps', 'shoulders'], ['machine'], C],
  ['db_fly', 'Dumbbell Fly', ['chest'], ['shoulders'], ['dumbbell', 'bench'], I],
  ['cable_fly', 'Cable Fly', ['chest'], ['shoulders'], ['cable'], I],
  ['pec_deck', 'Pec Deck', ['chest'], [], ['machine'], I],
  ['pushup', 'Push-Up', ['chest'], ['triceps', 'shoulders', 'abs'], [], C, 'bw'],
  ['dips', 'Dips', ['chest', 'triceps'], ['shoulders'], ['pullupbar'], C, 'bw'],
  ['band_press', 'Band Chest Press', ['chest'], ['triceps'], ['bands'], C],

  // Shoulders
  ['ohp', 'Overhead Press', ['shoulders'], ['triceps', 'traps', 'abs'], ['barbell'], C],
  ['db_shoulder_press', 'Seated Dumbbell Shoulder Press', ['shoulders'], ['triceps'], ['dumbbell', 'bench'], C],
  ['machine_shoulder', 'Machine Shoulder Press', ['shoulders'], ['triceps'], ['machine'], C],
  ['kb_press', 'Kettlebell Overhead Press', ['shoulders'], ['triceps', 'abs'], ['kettlebell'], C],
  ['pike_pushup', 'Pike Push-Up', ['shoulders'], ['triceps'], [], C, 'bw'],
  ['lat_raise', 'Dumbbell Lateral Raise', ['shoulders'], ['traps'], ['dumbbell'], I],
  ['cable_lat_raise', 'Cable Lateral Raise', ['shoulders'], [], ['cable'], I],
  ['rear_delt_fly', 'Rear Delt Fly', ['shoulders'], ['traps'], ['dumbbell'], I],
  ['face_pull', 'Face Pull', ['shoulders', 'traps'], ['biceps'], ['cable'], I],
  ['band_pull_apart', 'Band Pull-Apart', ['shoulders', 'traps'], [], ['bands'], I],
  ['band_lat_raise', 'Band Lateral Raise', ['shoulders'], [], ['bands'], I],

  // Back
  ['deadlift', 'Deadlift', ['hamstrings', 'glutes', 'lowerback'], ['traps', 'quads', 'forearms', 'lats'], ['barbell'], C],
  ['bb_row', 'Barbell Row', ['lats', 'traps'], ['biceps', 'lowerback', 'shoulders'], ['barbell'], C],
  ['db_row', 'One-Arm Dumbbell Row', ['lats', 'traps'], ['biceps', 'shoulders'], ['dumbbell', 'bench'], C],
  ['kb_row', 'Kettlebell Row', ['lats', 'traps'], ['biceps'], ['kettlebell'], C],
  ['pullup', 'Pull-Up', ['lats'], ['biceps', 'traps', 'forearms'], ['pullupbar'], C, 'bw'],
  ['chinup', 'Chin-Up', ['lats', 'biceps'], ['traps'], ['pullupbar'], C, 'bw'],
  ['lat_pulldown', 'Lat Pulldown', ['lats'], ['biceps', 'traps'], ['cable'], C],
  ['seated_row', 'Seated Cable Row', ['lats', 'traps'], ['biceps', 'shoulders'], ['cable'], C],
  ['machine_row', 'Machine Row', ['traps', 'lats'], ['biceps'], ['machine'], C],
  ['straight_arm_pd', 'Straight-Arm Pulldown', ['lats'], ['triceps'], ['cable'], I],
  ['inverted_row', 'Inverted Row', ['lats', 'traps'], ['biceps'], [], C, 'bw'],
  ['band_row', 'Band Row', ['lats', 'traps'], ['biceps'], ['bands'], C],
  ['db_shrug', 'Dumbbell Shrug', ['traps'], ['forearms'], ['dumbbell'], I],
  ['bb_shrug', 'Barbell Shrug', ['traps'], ['forearms'], ['barbell'], I],
  ['back_ext', 'Back Extension', ['lowerback'], ['glutes', 'hamstrings'], [], I, 'bw'],
  ['superman', 'Superman Hold', ['lowerback'], ['glutes'], [], I, 'bw sec'],

  // Arms
  ['bb_curl', 'Barbell Curl', ['biceps'], ['forearms'], ['barbell'], I],
  ['db_curl', 'Dumbbell Curl', ['biceps'], ['forearms'], ['dumbbell'], I],
  ['hammer_curl', 'Hammer Curl', ['biceps', 'forearms'], [], ['dumbbell'], I],
  ['incline_curl', 'Incline Dumbbell Curl', ['biceps'], [], ['dumbbell', 'bench'], I],
  ['cable_curl', 'Cable Curl', ['biceps'], ['forearms'], ['cable'], I],
  ['preacher_curl', 'Machine Preacher Curl', ['biceps'], [], ['machine'], I],
  ['band_curl', 'Band Curl', ['biceps'], [], ['bands'], I],
  ['tri_pushdown', 'Triceps Pushdown', ['triceps'], [], ['cable'], I],
  ['oh_tri_ext', 'Overhead Dumbbell Triceps Extension', ['triceps'], [], ['dumbbell'], I],
  ['skullcrusher', 'Skull Crusher', ['triceps'], [], ['barbell', 'bench'], I],
  ['close_grip_bench', 'Close-Grip Bench Press', ['triceps', 'chest'], ['shoulders'], ['barbell', 'bench'], C],
  ['diamond_pushup', 'Diamond Push-Up', ['triceps', 'chest'], ['shoulders'], [], C, 'bw'],
  ['bench_dip', 'Bench Dip', ['triceps'], ['chest', 'shoulders'], ['bench'], I, 'bw'],
  ['band_pushdown', 'Band Triceps Pushdown', ['triceps'], [], ['bands'], I],
  ['wrist_curl', 'Dumbbell Wrist Curl', ['forearms'], [], ['dumbbell'], I],

  // Legs
  ['back_squat', 'Back Squat', ['quads', 'glutes'], ['hamstrings', 'lowerback', 'abs'], ['barbell'], C],
  ['front_squat', 'Front Squat', ['quads'], ['glutes', 'abs'], ['barbell'], C],
  ['goblet_squat', 'Goblet Squat', ['quads', 'glutes'], ['abs'], ['dumbbell'], C],
  ['kb_goblet', 'Kettlebell Goblet Squat', ['quads', 'glutes'], ['abs'], ['kettlebell'], C],
  ['leg_press', 'Leg Press', ['quads', 'glutes'], ['hamstrings'], ['machine'], C],
  ['hack_squat', 'Hack Squat', ['quads'], ['glutes'], ['machine'], C],
  ['bss', 'Bulgarian Split Squat', ['quads', 'glutes'], ['hamstrings'], ['dumbbell', 'bench'], C],
  ['db_lunge', 'Dumbbell Lunge', ['quads', 'glutes'], ['hamstrings'], ['dumbbell'], C],
  ['bw_squat', 'Bodyweight Squat', ['quads', 'glutes'], [], [], C, 'bw'],
  ['bw_lunge', 'Walking Lunge', ['quads', 'glutes'], ['hamstrings'], [], C, 'bw'],
  ['leg_ext', 'Leg Extension', ['quads'], [], ['machine'], I],
  ['rdl', 'Romanian Deadlift', ['hamstrings', 'glutes'], ['lowerback', 'forearms'], ['barbell'], C],
  ['db_rdl', 'Dumbbell Romanian Deadlift', ['hamstrings', 'glutes'], ['lowerback'], ['dumbbell'], C],
  ['leg_curl', 'Lying Leg Curl', ['hamstrings'], ['calves'], ['machine'], I],
  ['seated_leg_curl', 'Seated Leg Curl', ['hamstrings'], [], ['machine'], I],
  ['nordic_curl', 'Nordic Hamstring Curl', ['hamstrings'], ['glutes'], [], I, 'bw'],
  ['hip_thrust', 'Barbell Hip Thrust', ['glutes'], ['hamstrings'], ['barbell', 'bench'], C],
  ['glute_bridge', 'Glute Bridge', ['glutes'], ['hamstrings'], [], I, 'bw'],
  ['kb_swing', 'Kettlebell Swing', ['glutes', 'hamstrings'], ['lowerback', 'shoulders'], ['kettlebell'], C],
  ['cable_kickback', 'Cable Glute Kickback', ['glutes'], [], ['cable'], I],
  ['standing_calf', 'Machine Standing Calf Raise', ['calves'], [], ['machine'], I],
  ['seated_calf', 'Seated Calf Raise', ['calves'], [], ['machine'], I],
  ['db_calf', 'Dumbbell Calf Raise', ['calves'], [], ['dumbbell'], I],
  ['bw_calf', 'Single-Leg Calf Raise', ['calves'], [], [], I, 'bw'],

  // Core
  ['plank', 'Plank', ['abs'], ['shoulders'], [], I, 'bw sec'],
  ['side_plank', 'Side Plank', ['abs'], [], [], I, 'bw sec'],
  ['crunch', 'Crunch', ['abs'], [], [], I, 'bw'],
  ['leg_raise', 'Lying Leg Raise', ['abs'], [], [], I, 'bw'],
  ['dead_bug', 'Dead Bug', ['abs'], [], [], I, 'bw'],
  ['russian_twist', 'Russian Twist', ['abs'], [], [], I, 'bw'],
  ['hanging_leg_raise', 'Hanging Leg Raise', ['abs'], ['forearms'], ['pullupbar'], I, 'bw'],
  ['cable_crunch', 'Cable Crunch', ['abs'], [], ['cable'], I],
  ['pallof_press', 'Pallof Press', ['abs'], [], ['cable'], I],
];

export const EXERCISES = RAW.map(([id, name, primary, secondary, equip, kind, flags = '']) => ({
  id, name, primary, secondary, equip, kind,
  bw: flags.includes('bw'),
  timed: flags.includes('sec'),
}));

export const EX = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const MUSCLE_NAME = Object.fromEntries(MUSCLES.map((m) => [m.id, m.name]));
export const EQUIP_NAME = Object.fromEntries(EQUIPMENT.map((q) => [q.id, q.name]));
