// Military jobs and the fitness scores they require / that make a candidate competitive.
//
// Each job lists one or more tests with a requirement:
//   standard:   'combat' uses the sex-neutral (male) column — Army combat MOS standard
//   minTotal / minPerEvent:       what you must hit to qualify
//   targetTotal / targetPerEvent: what we recommend training for so you are competitive
// For 'readiness' tests (pass/fail screening), 60 per event = the official minimum and
// 100 = the competitive number, so minPerEvent is 60 and targets sit between 80 and 100.
// Requirements change — always confirm with a recruiter or your chain of command.

const armyGeneral = (targetTotal = 400) => ({ testId: 'acft', minTotal: 300, minPerEvent: 60, targetTotal });
const armyCombat = (targetTotal = 430, minTotal = 350) => ({
  testId: 'acft',
  standard: 'combat',
  minTotal,
  minPerEvent: 60,
  targetTotal,
});
const pft = (minTotal = 150, targetTotal = 235) => ({ testId: 'pft', minTotal, targetTotal });
const cft = (minTotal = 150, targetTotal = 235) => ({ testId: 'cft', minTotal, targetTotal });
const prt = (targetTotal = 225) => ({ testId: 'prt', minTotal: 180, minPerEvent: 60, targetTotal });
const afPfa = (targetTotal = 85, testId = 'af_pfa') => ({ testId, minTotal: 75, targetTotal });
const screen = (testId, targetTotal = 90) => ({ testId, minTotal: 60, minPerEvent: 60, targetTotal });

function job(branch, code, title, tests, notes = '', extra = {}) {
  const id = `${branch}-${code}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return { id, branch, code, title, tests, notes, special: false, keywords: [], ...extra };
}

export const JOBS = [
  // ------------------------------------------------------------------ ARMY
  job('army', '11B', 'Infantryman', [armyCombat()], 'Combat MOS: sex-neutral standard, 350 total with 60+ in every event.', { keywords: ['infantry', 'grunt'] }),
  job('army', '11C', 'Indirect Fire Infantryman (Mortars)', [armyCombat()], 'Combat MOS standard applies.', { keywords: ['mortar'] }),
  job('army', '12B', 'Combat Engineer', [armyCombat()], 'Combat MOS standard applies.', { keywords: ['engineer', 'sapper'] }),
  job('army', '13F', 'Joint Fire Support Specialist', [armyCombat()], 'Combat MOS standard applies.', { keywords: ['fister', 'forward observer'] }),
  job('army', '19D', 'Cavalry Scout', [armyCombat()], 'Combat MOS standard applies.', { keywords: ['scout', 'cav'] }),
  job('army', '19K', 'M1 Armor Crewman', [armyCombat()], 'Combat MOS standard applies.', { keywords: ['tank', 'armor'] }),
  job('army', '13B', 'Cannon Crewmember', [armyCombat(410)], 'Field artillery; train to the combat standard for competitiveness.', { keywords: ['artillery'] }),
  job('army', '68W', 'Combat Medic Specialist', [armyGeneral(400)], 'General standard; medics attached to combat units should aim higher.', { keywords: ['medic', 'medical'] }),
  job('army', '31B', 'Military Police', [armyGeneral(400)], '', { keywords: ['mp', 'police'] }),
  job('army', '25B', 'Information Technology Specialist', [armyGeneral(360)], '', { keywords: ['it', 'computer', 'cyber'] }),
  job('army', '17C', 'Cyber Operations Specialist', [armyGeneral(360)], '', { keywords: ['cyber', 'hacker'] }),
  job('army', '35F', 'Intelligence Analyst', [armyGeneral(360)], '', { keywords: ['intel', 'intelligence'] }),
  job('army', '88M', 'Motor Transport Operator', [armyGeneral(360)], '', { keywords: ['driver', 'truck'] }),
  job('army', '92Y', 'Unit Supply Specialist', [armyGeneral(350)], '', { keywords: ['supply', 'logistics'] }),
  job('army', '15T', 'UH-60 Helicopter Repairer', [armyGeneral(360)], '', { keywords: ['aviation', 'helicopter', 'mechanic'] }),
  job('army', 'ABN', 'Airborne (Parachutist, Option 40 prep)', [armyGeneral(420)], 'Airborne School has no separate test, but high scores help you get and keep the slot.', { keywords: ['airborne', 'paratrooper', 'jump'] }),
  job('army', '75R', '75th Ranger Regiment (RASP)', [armyCombat(460, 360), screen('army_sof', 90)], 'Train for the combat standard well above 350 plus the SOF screening events (5-mile run, 12-mile ruck).', { special: true, keywords: ['ranger', 'rasp', 'sof', 'special operations'] }),
  job('army', '18X', 'Special Forces Candidate (Green Beret)', [armyCombat(470, 360), screen('army_sof', 90)], 'SFAS candidates need a strong AFT plus rucking and land-nav endurance.', { special: true, keywords: ['green beret', 'special forces', 'sfas', 'sof'] }),
  job('army', 'RANGER-SCHOOL', 'Ranger School (Tab)', [armyCombat(450, 350), screen('army_sof', 85)], 'Ranger Physical Assessment: 49 push-ups, 59 sit-ups, 5-mile run in 40:00, 6 pull-ups.', { special: true, keywords: ['ranger school', 'tab', 'rpa'] }),
  job('army', 'OFFICER', 'Army Officer (ROTC / OCS / West Point)', [armyGeneral(450)], 'Officer candidates are ranked partly on fitness — aim for 450+.', { keywords: ['officer', 'rotc', 'ocs', 'lieutenant'] }),
  job('army', 'OTHER', 'Other Army MOS', [armyGeneral(360)], 'General standard: 60 per event and 300 total.', { keywords: ['other', 'army'] }),

  // ------------------------------------------------------------ MARINE CORPS
  job('marines', '0311', 'Rifleman', [pft(150, 250), cft(150, 250)], 'Infantry: aim for 1st Class on both PFT and CFT.', { keywords: ['infantry', 'grunt', 'rifleman'] }),
  job('marines', '0331', 'Machine Gunner', [pft(150, 245), cft(150, 250)], '', { keywords: ['machine gun', 'infantry'] }),
  job('marines', '0352', 'Anti-Tank Missile Gunner', [pft(150, 240), cft(150, 245)], '', { keywords: ['anti-tank', 'javelin'] }),
  job('marines', '1371', 'Combat Engineer', [pft(150, 240), cft(150, 245)], '', { keywords: ['engineer'] }),
  job('marines', '0811', 'Field Artillery Cannoneer', [pft(150, 235), cft(150, 240)], '', { keywords: ['artillery'] }),
  job('marines', '5811', 'Military Police', [pft(150, 235), cft(150, 235)], '', { keywords: ['mp', 'police'] }),
  job('marines', '0621', 'Field Radio Operator', [pft(150, 225), cft(150, 230)], '', { keywords: ['radio', 'comm'] }),
  job('marines', '3531', 'Motor Vehicle Operator', [pft(150, 225), cft(150, 230)], '', { keywords: ['driver', 'motor t'] }),
  job('marines', '0231', 'Intelligence Specialist', [pft(150, 225), cft(150, 230)], '', { keywords: ['intel'] }),
  job('marines', '0321', 'Reconnaissance Marine', [pft(225, 275), cft(225, 275), screen('recon_screen', 90)], 'Recon screeners expect a 225+ PFT, strong swim and ruck.', { special: true, keywords: ['recon', 'brc', 'reconnaissance'] }),
  job('marines', '0372', 'Critical Skills Operator (MARSOC Raider)', [pft(225, 280), cft(225, 280), screen('marsoc_screen', 90)], 'MARSOC requires 225+ PFT/CFT and a uniform swim screen; A&S is a long rucking and endurance test.', { special: true, keywords: ['raider', 'marsoc', 'cso', 'sof', 'special operations'] }),
  job('marines', 'OFFICER', 'Marine Officer (OCS / PLC)', [pft(235, 285), cft(235, 285)], 'OCS candidates should arrive with a 1st Class PFT; 285+ is competitive.', { keywords: ['officer', 'ocs', 'plc'] }),
  job('marines', 'OTHER', 'Other Marine MOS', [pft(150, 235), cft(150, 235)], 'Minimum is 3rd Class (150); 1st Class (235+) helps promotions.', { keywords: ['other', 'marine'] }),

  // ------------------------------------------------------------------- NAVY
  job('navy', 'SO', 'Navy SEAL (Special Warfare Operator)', [screen('seal_pst', 92)], 'Minimums rarely get contracts. Aim for competitive numbers on every PST event.', { special: true, keywords: ['seal', 'buds', 'special warfare', 'sof', 'special operations'] }),
  job('navy', 'SB', 'Special Warfare Boat Operator (SWCC)', [screen('swcc_pst', 90)], '', { special: true, keywords: ['swcc', 'boat', 'special warfare'] }),
  job('navy', 'EOD', 'Explosive Ordnance Disposal Technician', [screen('eod_pst', 88)], '', { special: true, keywords: ['eod', 'bomb'] }),
  job('navy', 'ND', 'Navy Diver', [screen('eod_pst', 88)], '', { special: true, keywords: ['diver', 'dive'] }),
  job('navy', 'AIRR', 'Aviation Rescue Swimmer (AIRR)', [screen('airr_pst', 88)], '', { special: true, keywords: ['rescue swimmer', 'aircrew', 'airr'] }),
  job('navy', 'HM', 'Hospital Corpsman', [prt(225)], 'Corpsmen assigned to Marine units (FMF) should also train for the Marine PFT/CFT.', { keywords: ['corpsman', 'medic', 'medical'] }),
  job('navy', 'MA', 'Master-at-Arms', [prt(225)], '', { keywords: ['police', 'security', 'ma'] }),
  job('navy', 'AD', 'Aviation Machinist’s Mate', [prt(210)], '', { keywords: ['aviation', 'mechanic'] }),
  job('navy', 'IT', 'Information Systems Technician', [prt(210)], '', { keywords: ['it', 'computer', 'cyber'] }),
  job('navy', 'CTN', 'Cryptologic Technician (Networks)', [prt(210)], '', { keywords: ['cyber', 'crypto'] }),
  job('navy', 'BM', 'Boatswain’s Mate', [prt(210)], '', { keywords: ['deck', 'boat'] }),
  job('navy', 'OFFICER', 'Navy Officer (OCS / NROTC / USNA)', [prt(240)], '', { keywords: ['officer', 'ocs', 'nrotc', 'naval academy'] }),
  job('navy', 'OTHER', 'Other Navy Rating', [prt(210)], 'Satisfactory-Medium (60) in every event is required.', { keywords: ['other', 'navy', 'sailor'] }),

  // --------------------------------------------------------------- AIR FORCE
  job('airforce', '1Z1', 'Pararescue (PJ)', [screen('af_past', 92), afPfa(90)], '', { special: true, keywords: ['pj', 'pararescue', 'special warfare', 'sof'] }),
  job('airforce', '1Z2', 'Combat Control (CCT)', [screen('af_past', 92), afPfa(90)], '', { special: true, keywords: ['cct', 'combat control', 'special warfare', 'sof'] }),
  job('airforce', '1Z3', 'Special Reconnaissance (SR)', [screen('af_past', 90), afPfa(90)], '', { special: true, keywords: ['sr', 'special reconnaissance', 'special warfare'] }),
  job('airforce', '1Z4', 'Tactical Air Control Party (TACP)', [screen('tacp_past', 90), afPfa(90)], '', { special: true, keywords: ['tacp', 'jtac', 'special warfare'] }),
  job('airforce', '1T0', 'SERE Specialist', [screen('tacp_past', 88), afPfa(90)], '', { special: true, keywords: ['sere', 'survival'] }),
  job('airforce', '3E8', 'Explosive Ordnance Disposal', [afPfa(90)], '', { keywords: ['eod', 'bomb'] }),
  job('airforce', '3P0', 'Security Forces', [afPfa(88)], '', { keywords: ['security', 'police', 'sf'] }),
  job('airforce', '1D7', 'Cyber Defense Operations', [afPfa(82)], '', { keywords: ['cyber', 'it', 'computer'] }),
  job('airforce', '2A', 'Aircraft Maintenance', [afPfa(82)], '', { keywords: ['maintenance', 'mechanic', 'crew chief'] }),
  job('airforce', '4N0', 'Aerospace Medical Service', [afPfa(82)], '', { keywords: ['medic', 'medical'] }),
  job('airforce', '1N', 'Intelligence', [afPfa(82)], '', { keywords: ['intel'] }),
  job('airforce', 'PILOT', 'Pilot / Aircrew (Officer)', [afPfa(92)], 'Officer and rated-board candidates are more competitive with 90+.', { keywords: ['pilot', 'officer', 'aircrew'] }),
  job('airforce', 'OTHER', 'Other Air Force AFSC', [afPfa(85)], '75 composite with component minimums to pass; 90+ is Excellent.', { keywords: ['other', 'airman'] }),

  // ------------------------------------------------------------- SPACE FORCE
  job('spaceforce', '5C0', 'Cyber Operations', [afPfa(85, 'ussf_pfa')], '', { keywords: ['cyber', 'it'] }),
  job('spaceforce', '1C6', 'Space Systems Operations', [afPfa(85, 'ussf_pfa')], '', { keywords: ['space', 'satellite', 'operations'] }),
  job('spaceforce', '5I0', 'Intelligence', [afPfa(85, 'ussf_pfa')], '', { keywords: ['intel'] }),
  job('spaceforce', '13S', 'Space Operations Officer', [afPfa(90, 'ussf_pfa')], '', { keywords: ['officer', 'space'] }),
  job('spaceforce', 'OTHER', 'Other Space Force Specialty', [afPfa(85, 'ussf_pfa')], '', { keywords: ['other', 'guardian'] }),

  // ------------------------------------------------------------- COAST GUARD
  job('coastguard', 'AST', 'Aviation Survival Technician (Rescue Swimmer)', [screen('uscg_ast', 90), screen('uscg_pft', 85)], 'One of the hardest schools in the military — train swim and calisthenics every week.', { special: true, keywords: ['rescue swimmer', 'ast', 'swimmer'] }),
  job('coastguard', 'MSRT', 'Maritime Security Response Team (Direct Action)', [screen('uscg_ast', 85), screen('uscg_pft', 90)], 'Special-operations-capable unit; uses a demanding screener similar to AST.', { special: true, keywords: ['msrt', 'direct action', 'deployable specialized forces'] }),
  job('coastguard', 'ME', 'Maritime Enforcement Specialist', [screen('uscg_pft', 85)], '', { keywords: ['law enforcement', 'boarding', 'police'] }),
  job('coastguard', 'BM', 'Boatswain’s Mate', [screen('uscg_pft', 80)], '', { keywords: ['boat', 'deck'] }),
  job('coastguard', 'OS', 'Operations Specialist', [screen('uscg_pft', 75)], '', { keywords: ['operations', 'radio'] }),
  job('coastguard', 'OFFICER', 'Coast Guard Officer (OCS / Academy)', [screen('uscg_pft', 88)], '', { keywords: ['officer', 'ocs', 'academy'] }),
  job('coastguard', 'OTHER', 'Other Coast Guard Rating', [screen('uscg_pft', 80)], '', { keywords: ['other', 'coastie'] }),
];

export function getJob(id) {
  return JOBS.find((j) => j.id === id);
}

export function jobsForBranch(branchId) {
  return JOBS.filter((j) => j.branch === branchId);
}

/** Free-text search across code, title and keywords. Best matches first. */
export function searchJobs(query, branchId) {
  const q = String(query || '').trim().toLowerCase();
  const pool = branchId ? jobsForBranch(branchId) : JOBS;
  if (!q) return pool;
  const scored = pool
    .map((j) => {
      let s = 0;
      if (j.code.toLowerCase() === q) s += 100;
      if (j.code.toLowerCase().startsWith(q)) s += 30;
      if (j.title.toLowerCase().includes(q)) s += 20;
      for (const k of j.keywords) {
        if (k === q) s += 25;
        else if (k.includes(q) || q.includes(k)) s += 10;
      }
      for (const word of q.split(/\s+/)) {
        if (word.length > 2 && j.title.toLowerCase().includes(word)) s += 5;
      }
      return { j, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.map((x) => x.j);
}

/** Requirement object for a job/test pair (or a sensible default when no job is chosen). */
export function requirementFor(jobId, testId) {
  const j = getJob(jobId);
  const r = j?.tests.find((t) => t.testId === testId);
  return r || null;
}
