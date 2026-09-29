// Fitness test definitions for every U.S. military branch plus special-warfare screening tests.
//
// IMPORTANT: Standards here are condensed from publicly available score charts and pipeline
// guidance. Official charts are long age/sex tables that change regularly, so this app models
// each event with two anchor points (the minimum standard and the max/competitive standard)
// per sex and interpolates between them, with an age adjustment. Treat scores as estimates for
// training purposes and always confirm with official charts or a recruiter.
//
// Event fields:
//   id, name, short, kind (drives training prescriptions), unit ('reps' | 'time' | 'lb' | 'ratio'),
//   better ('higher' | 'lower'), std: { male: [min, max], female: [min, max] } or { all: [min, max] },
//   optional minPts/maxPts overrides, optional group (for "pick one" alternatives),
//   optional distanceMi / distanceYd / distanceM for pace math, optional howTo override.
//
// Test fields:
//   scoring: 'points' — each event scores minPts..maxPts, total is the sum (official-style points)
//            'readiness' — pass/fail screening test; each event scores 0-100 where 60 = meets the
//                          minimum and 100 = competitive. Total is the average.

export const BRANCHES = {
  army: { id: 'army', name: 'Army', color: '#4b5320' },
  marines: { id: 'marines', name: 'Marine Corps', color: '#8b0000' },
  navy: { id: 'navy', name: 'Navy', color: '#000080' },
  airforce: { id: 'airforce', name: 'Air Force', color: '#00308f' },
  spaceforce: { id: 'spaceforce', name: 'Space Force', color: '#1c2841' },
  coastguard: { id: 'coastguard', name: 'Coast Guard', color: '#c8102e' },
};

// Default instructions for how to self-test each kind of event.
export const HOW_TO = {
  deadlift:
    'Use a hex/trap bar. Warm up, then work up to the heaviest weight you can lift for 3 clean reps (hips and chest rise together, no rounding). Rest 2–3 min between attempts. Enter that weight.',
  hrp:
    'Hand-release push-ups for 2 minutes. Start on your chest, push to full lockout, lower chest to the ground, lift hands briefly, repeat. Only count reps with a straight body line.',
  pushup:
    'Standard push-ups for the time limit shown (rest only in the up position). Chest lowers until upper arms are parallel to the ground; full lockout at the top. Count clean reps only.',
  pullup:
    'Dead-hang pull-ups (overhand grip). Start from full extension, chin clearly over the bar, no kipping. Count until you can no longer complete a rep.',
  situp:
    'Sit-ups for the time limit shown. Knees bent, feet anchored, hands per your test rules. Count full reps (shoulders to ground, elbows/chest to knees).',
  plank:
    'Forearm plank: elbows under shoulders, straight line head to heels. Hold as long as possible with good form. Enter your total time (m:ss).',
  run:
    'Run the distance shown on a measured track or flat route as fast as you can after a thorough warm-up. Enter your total time (m:ss).',
  swim:
    'Swim the distance shown (combat sidestroke or breaststroke, no flip turns) as fast as you can. Enter your total time (m:ss).',
  ruck:
    'Ruck march the distance shown carrying the listed pack weight (dry). Walk/shuffle, no running shoes if your pipeline requires boots. Enter your total time (h:mm:ss).',
  sdc:
    'Sprint-Drag-Carry: 5 × 50 m shuttles — sprint, 90 lb sled drag (backwards), lateral shuffle, 2 × 40 lb kettlebell carry, sprint. Enter total time (m:ss).',
  row:
    'Row 2,000 m on a Concept2 (or similar) erg as fast as you can. Enter your total time (m:ss).',
  mtc:
    'Movement to Contact: 880-yard sprint (in boots/utilities if possible). Enter your time (m:ss).',
  acl:
    'Ammo Can Lift: lift a 30 lb ammo can from shoulder height to full lockout overhead as many times as possible in 2 minutes.',
  manuf:
    'Maneuver Under Fire: ~300 yd shuttle course with crawls, buddy drag, fireman’s carry, ammo can carry and grenade throw. Enter total time (m:ss). If you have no course, estimate with 6 × 50 yd shuttles mixing crawls and carries.',
  hamr:
    'HAMR: 20 m shuttle run to the beeps (FitnessGram-style). Enter the total number of shuttles completed.',
  whtr:
    'Waist-to-Height Ratio: measure your waist at the navel (inches), divide by your height (inches). Example: 32 ÷ 70 = 0.46.',
  tread:
    'Tread water in deep water (hands allowed) for as long as possible, up to 10 minutes. Enter the time (m:ss).',
};

function ev(o) {
  return { better: o.unit === 'time' || o.unit === 'ratio' ? 'lower' : 'higher', ...o };
}

export const TESTS = {
  // ------------------------------------------------------------------ ARMY
  acft: {
    id: 'acft',
    name: 'Army Fitness Test (AFT / ACFT)',
    short: 'AFT',
    branch: 'army',
    special: false,
    scoring: 'points',
    minPts: 60,
    maxPts: 100,
    maxTotal: 500,
    ageAdjust: true,
    pass: { minTotal: 300 },
    description:
      'Five events, 0–100 points each. General standard: 60 per event and 300 total. Combat MOS standard (sex-neutral): 60 per event and 350 total.',
    events: [
      ev({ id: 'mdl', name: '3-Rep Max Deadlift', short: 'Deadlift', kind: 'deadlift', unit: 'lb', std: { male: [150, 340], female: [120, 220] } }),
      ev({ id: 'hrp', name: 'Hand-Release Push-Up (2 min)', short: 'HR Push-ups', kind: 'hrp', unit: 'reps', std: { male: [15, 58], female: [11, 53] } }),
      ev({ id: 'sdc', name: 'Sprint-Drag-Carry', short: 'SDC', kind: 'sdc', unit: 'time', std: { male: [148, 89], female: [175, 115] } }),
      ev({ id: 'plk', name: 'Plank', short: 'Plank', kind: 'plank', unit: 'time', better: 'higher', std: { male: [90, 220], female: [90, 220] } }),
      ev({ id: '2mr', name: '2-Mile Run', short: '2-Mile Run', kind: 'run', unit: 'time', distanceMi: 2, std: { male: [1320, 802], female: [1425, 950] } }),
    ],
    categories(total, test, allPassed) {
      if (!allPassed) return 'Fail';
      if (total >= 450) return 'Exceptional (450+)';
      if (total >= 350) return 'Meets Combat Standard';
      if (total >= 300) return 'Pass';
      return 'Fail';
    },
  },
  army_sof: {
    id: 'army_sof',
    name: 'Army SOF Screening (Ranger / Special Forces)',
    short: 'SOF Screen',
    branch: 'army',
    special: true,
    scoring: 'readiness',
    ageAdjust: false,
    description:
      'Ranger Physical Assessment–style events plus the 12-mile ruck used across RASP, Ranger School and SFAS prep. 60 = minimum standard, 100 = competitive.',
    events: [
      ev({ id: 'pu', name: 'Push-ups (2 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '2 min', std: { all: [49, 80] } }),
      ev({ id: 'su', name: 'Sit-ups (2 min)', short: 'Sit-ups', kind: 'situp', unit: 'reps', timeLimit: '2 min', std: { all: [59, 85] } }),
      ev({ id: 'pull', name: 'Pull-ups', short: 'Pull-ups', kind: 'pullup', unit: 'reps', std: { all: [6, 18] } }),
      ev({ id: '5mr', name: '5-Mile Run', short: '5-Mile Run', kind: 'run', unit: 'time', distanceMi: 5, std: { all: [2400, 2040] } }),
      ev({ id: 'ruck', name: '12-Mile Ruck (35 lb dry + water)', short: '12-Mi Ruck', kind: 'ruck', unit: 'time', distanceMi: 12, ruckLb: 35, std: { all: [10800, 9000] } }),
    ],
  },

  // ------------------------------------------------------------ MARINE CORPS
  pft: {
    id: 'pft',
    name: 'Marine Corps Physical Fitness Test (PFT)',
    short: 'PFT',
    branch: 'marines',
    special: false,
    scoring: 'points',
    minPts: 40,
    maxPts: 100,
    maxTotal: 300,
    ageAdjust: true,
    pass: { minTotal: 150 },
    groups: { upper: { label: 'Upper body', default: 'pull' } },
    description:
      'Pull-ups (or push-ups, max 70 pts), forearm plank and 3-mile run. 1st Class 235+, 2nd Class 200–234, 3rd Class 150–199.',
    events: [
      ev({ id: 'pull', name: 'Pull-ups', short: 'Pull-ups', kind: 'pullup', unit: 'reps', group: 'upper', std: { male: [3, 23], female: [1, 11] } }),
      ev({ id: 'pu', name: 'Push-ups (2 min, max 70 pts)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '2 min', group: 'upper', maxPts: 70, std: { male: [42, 87], female: [19, 50] } }),
      ev({ id: 'plk', name: 'Forearm Plank', short: 'Plank', kind: 'plank', unit: 'time', better: 'higher', std: { male: [70, 225], female: [70, 225] } }),
      ev({ id: '3mr', name: '3-Mile Run', short: '3-Mile Run', kind: 'run', unit: 'time', distanceMi: 3, std: { male: [1680, 1080], female: [1860, 1260] } }),
    ],
    categories: marineClass,
  },
  cft: {
    id: 'cft',
    name: 'Marine Corps Combat Fitness Test (CFT)',
    short: 'CFT',
    branch: 'marines',
    special: false,
    scoring: 'points',
    minPts: 40,
    maxPts: 100,
    maxTotal: 300,
    ageAdjust: true,
    pass: { minTotal: 150 },
    description:
      'Movement to Contact, Ammo Can Lift and Maneuver Under Fire. 1st Class 235+, 2nd Class 200–234, 3rd Class 150–199.',
    events: [
      ev({ id: 'mtc', name: 'Movement to Contact (880 yd)', short: 'MTC', kind: 'mtc', unit: 'time', std: { male: [253, 160], female: [303, 194] } }),
      ev({ id: 'acl', name: 'Ammo Can Lift (2 min)', short: 'Ammo Lift', kind: 'acl', unit: 'reps', std: { male: [45, 106], female: [30, 66] } }),
      ev({ id: 'manuf', name: 'Maneuver Under Fire', short: 'MANUF', kind: 'manuf', unit: 'time', std: { male: [232, 130], female: [319, 176] } }),
    ],
    categories: marineClass,
  },
  marsoc_screen: {
    id: 'marsoc_screen',
    name: 'MARSOC Raider Screening (A&S prep)',
    short: 'MARSOC',
    branch: 'marines',
    special: true,
    scoring: 'readiness',
    ageAdjust: false,
    description:
      'Events used to prepare for MARSOC Assessment & Selection: uniform swim, ruck, pull-ups and run. Pair with a 225+ PFT and CFT.',
    events: [
      ev({ id: 'swim', name: '300 m Swim (utilities)', short: '300m Swim', kind: 'swim', unit: 'time', distanceM: 300, std: { all: [780, 480] } }),
      ev({ id: 'tread', name: 'Tread Water (utilities)', short: 'Tread', kind: 'tread', unit: 'time', better: 'higher', std: { all: [660, 900] } }),
      ev({ id: 'pull', name: 'Pull-ups', short: 'Pull-ups', kind: 'pullup', unit: 'reps', std: { all: [15, 25] } }),
      ev({ id: '3mr', name: '3-Mile Run', short: '3-Mile Run', kind: 'run', unit: 'time', distanceMi: 3, std: { all: [1320, 1080] } }),
      ev({ id: 'ruck', name: '12-Mile Ruck (45 lb)', short: '12-Mi Ruck', kind: 'ruck', unit: 'time', distanceMi: 12, ruckLb: 45, std: { all: [10800, 9000] } }),
    ],
  },
  recon_screen: {
    id: 'recon_screen',
    name: 'Marine Recon Screening (BRC prep)',
    short: 'Recon',
    branch: 'marines',
    special: true,
    scoring: 'readiness',
    ageAdjust: false,
    description:
      'Recon indoctrination-style events: 500 m swim, pull-ups, 3-mile run and ruck. Pair with a 225+ PFT/CFT.',
    events: [
      ev({ id: 'swim', name: '500 m Swim (no fins)', short: '500m Swim', kind: 'swim', unit: 'time', distanceM: 500, std: { all: [1020, 720] } }),
      ev({ id: 'tread', name: 'Tread Water', short: 'Tread', kind: 'tread', unit: 'time', better: 'higher', std: { all: [600, 900] } }),
      ev({ id: 'pull', name: 'Pull-ups', short: 'Pull-ups', kind: 'pullup', unit: 'reps', std: { all: [15, 23] } }),
      ev({ id: '3mr', name: '3-Mile Run', short: '3-Mile Run', kind: 'run', unit: 'time', distanceMi: 3, std: { all: [1260, 1080] } }),
      ev({ id: 'ruck', name: '6-Mile Ruck (50 lb)', short: '6-Mi Ruck', kind: 'ruck', unit: 'time', distanceMi: 6, ruckLb: 50, std: { all: [5400, 4500] } }),
    ],
  },

  // ------------------------------------------------------------------- NAVY
  prt: {
    id: 'prt',
    name: 'Navy Physical Readiness Test (PRT)',
    short: 'PRT',
    branch: 'navy',
    special: false,
    scoring: 'points',
    minPts: 60,
    maxPts: 100,
    maxTotal: 300,
    ageAdjust: true,
    pass: { minTotal: 180 },
    groups: { cardio: { label: 'Cardio', default: 'run' } },
    description:
      'Push-ups (2 min), forearm plank and 1.5-mile run or 2 km row. Each event must reach Satisfactory-Medium (60).',
    events: [
      ev({ id: 'pu', name: 'Push-ups (2 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '2 min', std: { male: [42, 100], female: [19, 51] } }),
      ev({ id: 'plk', name: 'Forearm Plank', short: 'Plank', kind: 'plank', unit: 'time', better: 'higher', std: { male: [90, 260], female: [90, 260] } }),
      ev({ id: 'run', name: '1.5-Mile Run', short: '1.5-Mile Run', kind: 'run', unit: 'time', distanceMi: 1.5, group: 'cardio', std: { male: [735, 517], female: [870, 611] } }),
      ev({ id: 'row', name: '2,000 m Row', short: '2k Row', kind: 'row', unit: 'time', group: 'cardio', std: { male: [545, 435], female: [600, 480] } }),
    ],
    categories(total, test, allPassed) {
      if (!allPassed) return 'Failure';
      const avg = total / 3;
      if (avg >= 90) return 'Outstanding';
      if (avg >= 80) return 'Excellent';
      if (avg >= 70) return 'Good';
      return 'Satisfactory';
    },
  },
  seal_pst: navyPst('seal_pst', 'Navy SEAL Physical Screening Test (PST)', 'SEAL PST', {
    swim: [750, 540], pu: [50, 100], su: [50, 100], pull: [10, 20], run: [630, 540],
  }, 'Official minimums are well below what selectees score. The competitive column reflects numbers commonly cited for BUD/S candidates.'),
  swcc_pst: navyPst('swcc_pst', 'Navy SWCC Physical Screening Test (PST)', 'SWCC PST', {
    swim: [780, 600], pu: [50, 80], su: [50, 80], pull: [10, 15], run: [750, 600],
  }, 'Special Warfare Combatant-craft Crewman screening. Competitive values reflect typical selectees.'),
  eod_pst: navyPst('eod_pst', 'Navy EOD / Diver Physical Screening Test (PST)', 'EOD/Diver PST', {
    swim: [750, 600], pu: [50, 80], su: [50, 80], pull: [10, 15], run: [630, 570],
  }, 'Used for Navy Explosive Ordnance Disposal and Navy Diver programs.'),
  airr_pst: navyPst('airr_pst', 'Navy AIRR Physical Screening Test (PST)', 'AIRR PST', {
    swim: [720, 570], pu: [42, 70], su: [50, 80], pull: [4, 12], run: [750, 600],
  }, 'Aviation Rescue Swimmer (AIRR) screening.'),

  // --------------------------------------------------------------- AIR FORCE
  af_pfa: afPfa('af_pfa', 'Air Force Physical Fitness Assessment (PFA)', 'airforce'),
  af_past: {
    id: 'af_past',
    name: 'Air Force Special Warfare PAST (PJ / CCT / SR)',
    short: 'SW PAST',
    branch: 'airforce',
    special: true,
    scoring: 'readiness',
    ageAdjust: false,
    description:
      'Physical Ability and Stamina Test for Pararescue, Combat Control and Special Reconnaissance. Also includes 2 × 25 m underwater swims (pass/fail). 60 = minimum, 100 = competitive.',
    events: [
      ev({ id: 'swim', name: '500 m Swim', short: '500m Swim', kind: 'swim', unit: 'time', distanceM: 500, std: { all: [780, 600] } }),
      ev({ id: 'run', name: '1.5-Mile Run', short: '1.5-Mile Run', kind: 'run', unit: 'time', distanceMi: 1.5, std: { all: [587, 510] } }),
      ev({ id: 'pull', name: 'Pull-ups (2 min)', short: 'Pull-ups', kind: 'pullup', unit: 'reps', std: { all: [10, 20] } }),
      ev({ id: 'su', name: 'Sit-ups (2 min)', short: 'Sit-ups', kind: 'situp', unit: 'reps', timeLimit: '2 min', std: { all: [54, 90] } }),
      ev({ id: 'pu', name: 'Push-ups (2 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '2 min', std: { all: [60, 100] } }),
    ],
  },
  tacp_past: {
    id: 'tacp_past',
    name: 'Air Force TACP / SERE PAST',
    short: 'TACP PAST',
    branch: 'airforce',
    special: true,
    scoring: 'readiness',
    ageAdjust: false,
    description:
      'PAST for Tactical Air Control Party and SERE Specialist candidates (no swim). 60 = minimum, 100 = competitive.',
    events: [
      ev({ id: 'run', name: '1.5-Mile Run', short: '1.5-Mile Run', kind: 'run', unit: 'time', distanceMi: 1.5, std: { all: [647, 555] } }),
      ev({ id: 'pull', name: 'Pull-ups (2 min)', short: 'Pull-ups', kind: 'pullup', unit: 'reps', std: { all: [6, 15] } }),
      ev({ id: 'su', name: 'Sit-ups (2 min)', short: 'Sit-ups', kind: 'situp', unit: 'reps', timeLimit: '2 min', std: { all: [48, 80] } }),
      ev({ id: 'pu', name: 'Push-ups (2 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '2 min', std: { all: [45, 80] } }),
      ev({ id: 'ruck', name: '4-Mile Ruck (50 lb)', short: '4-Mi Ruck', kind: 'ruck', unit: 'time', distanceMi: 4, ruckLb: 50, std: { all: [3600, 3000] } }),
    ],
  },

  // ------------------------------------------------------------- SPACE FORCE
  ussf_pfa: afPfa('ussf_pfa', 'Space Force Physical Fitness Assessment', 'spaceforce'),

  // ------------------------------------------------------------- COAST GUARD
  uscg_pft: {
    id: 'uscg_pft',
    name: 'Coast Guard Physical Fitness Test (Recruit / Accession)',
    short: 'USCG PFT',
    branch: 'coastguard',
    special: false,
    scoring: 'readiness',
    ageAdjust: true,
    description:
      'Pass/fail accession standards (push-ups, sit-ups, 1.5-mile run) plus water survival (5-minute tread and 100 m swim). 60 = meets the standard, 100 = well above it.',
    events: [
      ev({ id: 'pu', name: 'Push-ups (1 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '1 min', std: { male: [29, 60], female: [15, 40] } }),
      ev({ id: 'su', name: 'Sit-ups (1 min)', short: 'Sit-ups', kind: 'situp', unit: 'reps', timeLimit: '1 min', std: { male: [38, 60], female: [32, 55] } }),
      ev({ id: 'run', name: '1.5-Mile Run', short: '1.5-Mile Run', kind: 'run', unit: 'time', distanceMi: 1.5, std: { male: [771, 600], female: [926, 720] } }),
      ev({ id: 'tread', name: 'Tread Water', short: 'Tread', kind: 'tread', unit: 'time', better: 'higher', std: { all: [300, 600] } }),
    ],
  },
  uscg_ast: {
    id: 'uscg_ast',
    name: 'Coast Guard Rescue Swimmer (AST) PFT',
    short: 'AST PFT',
    branch: 'coastguard',
    special: true,
    scoring: 'readiness',
    ageAdjust: false,
    description:
      'Aviation Survival Technician screening. Also includes underwater swims and a buddy tow. 60 = minimum, 100 = competitive.',
    events: [
      ev({ id: 'pu', name: 'Push-ups (2 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '2 min', std: { all: [50, 90] } }),
      ev({ id: 'su', name: 'Sit-ups (2 min)', short: 'Sit-ups', kind: 'situp', unit: 'reps', timeLimit: '2 min', std: { all: [60, 100] } }),
      ev({ id: 'pull', name: 'Pull-ups', short: 'Pull-ups', kind: 'pullup', unit: 'reps', std: { all: [5, 15] } }),
      ev({ id: 'swim', name: '500 yd Swim', short: '500yd Swim', kind: 'swim', unit: 'time', distanceYd: 500, std: { all: [720, 540] } }),
      ev({ id: 'run', name: '1.5-Mile Run', short: '1.5-Mile Run', kind: 'run', unit: 'time', distanceMi: 1.5, std: { all: [720, 570] } }),
    ],
  },
};

function marineClass(total, test, allPassed) {
  if (!allPassed || total < 150) return 'Fail';
  if (total >= 235) return '1st Class';
  if (total >= 200) return '2nd Class';
  return '3rd Class';
}

function navyPst(id, name, short, s, note) {
  return {
    id,
    name,
    short,
    branch: 'navy',
    special: true,
    scoring: 'readiness',
    ageAdjust: false,
    description: `500 yd swim, 2-min push-ups, 2-min sit-ups, pull-ups and 1.5-mile run with rest between events. 60 = official minimum, 100 = competitive. ${note}`,
    events: [
      ev({ id: 'swim', name: '500 yd Swim (sidestroke/breaststroke)', short: '500yd Swim', kind: 'swim', unit: 'time', distanceYd: 500, std: { all: s.swim } }),
      ev({ id: 'pu', name: 'Push-ups (2 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '2 min', std: { all: s.pu } }),
      ev({ id: 'su', name: 'Sit-ups (2 min)', short: 'Sit-ups', kind: 'situp', unit: 'reps', timeLimit: '2 min', std: { all: s.su } }),
      ev({ id: 'pull', name: 'Pull-ups', short: 'Pull-ups', kind: 'pullup', unit: 'reps', std: { all: s.pull } }),
      ev({ id: 'run', name: '1.5-Mile Run', short: '1.5-Mile Run', kind: 'run', unit: 'time', distanceMi: 1.5, std: { all: s.run } }),
    ],
  };
}

function afPfa(id, name, branch) {
  return {
    id,
    name,
    short: branch === 'spaceforce' ? 'USSF PFA' : 'AF PFA',
    branch,
    special: false,
    scoring: 'points',
    maxTotal: 100,
    ageAdjust: true,
    pass: { minTotal: 75 },
    groups: {
      cardio: { label: 'Cardio', default: 'run' },
      core: { label: 'Core', default: 'su' },
    },
    description:
      'Department of the Air Force PFA: cardio (2-mile run or 20 m HAMR, 50 pts), push-ups (15 pts), core (sit-ups or plank, 15 pts) and waist-to-height ratio (20 pts). 75 composite to pass, 90+ Excellent.',
    events: [
      ev({ id: 'run', name: '2-Mile Run', short: '2-Mile Run', kind: 'run', unit: 'time', distanceMi: 2, group: 'cardio', maxPts: 50, minPts: 30, std: { male: [1185, 805], female: [1350, 930] } }),
      ev({ id: 'hamr', name: '20 m HAMR Shuttle', short: 'HAMR', kind: 'hamr', unit: 'reps', group: 'cardio', maxPts: 50, minPts: 30, std: { male: [39, 94], female: [22, 75] } }),
      ev({ id: 'pu', name: 'Push-ups (1 min)', short: 'Push-ups', kind: 'pushup', unit: 'reps', timeLimit: '1 min', maxPts: 15, minPts: 9, std: { male: [30, 67], female: [15, 47] } }),
      ev({ id: 'su', name: 'Sit-ups (1 min)', short: 'Sit-ups', kind: 'situp', unit: 'reps', timeLimit: '1 min', group: 'core', maxPts: 15, minPts: 9, std: { male: [39, 58], female: [38, 54] } }),
      ev({ id: 'plk', name: 'Forearm Plank', short: 'Plank', kind: 'plank', unit: 'time', better: 'higher', group: 'core', maxPts: 15, minPts: 9, std: { male: [65, 215], female: [65, 215] } }),
      ev({ id: 'whtr', name: 'Waist-to-Height Ratio', short: 'WHtR', kind: 'whtr', unit: 'ratio', noAge: true, maxPts: 20, minPts: 12, std: { all: [0.55, 0.49] } }),
    ],
    categories(total, test, allPassed) {
      if (!allPassed || total < 75) return 'Unsatisfactory';
      if (total >= 90) return 'Excellent';
      return 'Satisfactory';
    },
  };
}

export const TEST_LIST = Object.values(TESTS);

export function getTest(id) {
  return TESTS[id];
}

export function testsForBranch(branchId) {
  return TEST_LIST.filter((t) => t.branch === branchId);
}

export function howTo(event) {
  let text = event.howTo || HOW_TO[event.kind] || '';
  if (event.timeLimit && (event.kind === 'pushup' || event.kind === 'situp')) {
    text = text.replace('the time limit shown', event.timeLimit);
  }
  return text;
}
