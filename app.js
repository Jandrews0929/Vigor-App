/* Vigor trial app. Plain JavaScript, no build step. Data lives in Supabase (see supabase/schema.sql). */
'use strict';

const VERSION = '0.1.4';
const CFG = window.VIGOR_CONFIG || {};

/* ---------- Exercise library ----------
   Built-ins are defined here. Member-created exercises load from the exercises table at sign-in (loadExercises).
   Each entry: name, plate color, muscle group, search aliases, and whether weight is added to bodyweight (+ before the name). */
const EX = {};
const EXGROUPS = ['Legs', 'Push', 'Pull', 'Hinge', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Mobility', 'Other'];
const GROUP_COLOR = { Legs: 'red', Push: 'blue', Pull: 'green', Hinge: 'yellow', Shoulders: 'blue', Arms: 'green', Core: 'yellow', Cardio: 'red', Mobility: 'green', Other: 'blue' };
function defEx(grp, list) {
  list.split('|').forEach(item => {
    const [key, name, alias = ''] = item.split(':');
    EX[key] = { name: name.replace(/^\+/, ''), color: GROUP_COLOR[grp], grp, alias, added: name[0] === '+', status: 'approved' };
  });
}
defEx('Legs', 'squat:Back squat:bb barbell quads|front:Front squat:barbell quads|goblet:Goblet squat:db kb|legpress:Leg press:machine quads|' +
  'splitsq:Bulgarian split squat:bss rfess db|lunge:Walking lunge:lunges db|hacksq:Hack squat:machine|legext:Leg extension:quads machine|' +
  'calf:Standing calf raise:calves|seatcalf:Seated calf raise:calves|sled:Sled push:prowler|smithsq:Smith machine squat|boxsq:Box squat:barbell|' +
  'stepup:Step-up:box db|adduct:Hip adduction:adductor machine inner thigh|abduct:Hip abduction:abductor machine outer thigh glutes');
defEx('Push', 'bench:Bench press:bp flat barbell chest|incline:Incline bench press:barbell chest|dbbench:Dumbbell bench press:db flat chest|' +
  'inclinedb:Incline DB press:dumbbell bench chest|cgbench:Close-grip bench:cgbp triceps press|dip:+Weighted dip:dips triceps chest|' +
  'pushup:Push-up:press up pushups chest|flyes:Cable fly:flye flies crossover chest|decline:Decline bench press:chest|' +
  'machinechest:Machine chest press|pecdeck:Pec deck:fly machine chest|dbfly:Dumbbell fly:flye flies db chest');
defEx('Pull', 'pullup:+Weighted pull-up:pullups chin up back lats|chinup:+Weighted chin-up:chinups back|latpd:Lat pulldown:lats cable back|' +
  'row:Barbell row:bent over bb back|dbrow:Dumbbell row:db one arm back|tbar:T-bar row:back|cablerow:Seated cable row:back|pendlay:Pendlay row:barbell back|' +
  'shrug:Shrug:traps|chestrow:Chest-supported row:incline row back|machinerow:Machine row:back|straightarm:Straight-arm pulldown:lats pullover cable|' +
  'invrow:Inverted row:bodyweight back');
defEx('Hinge', 'dead:Deadlift:conventional dl|sumo:Sumo deadlift:dl|rdl:Romanian deadlift:rdl dl stiff leg sldl hamstrings|trapbar:Trap bar deadlift:hex bar dl|' +
  'hipthrust:Hip thrust:glute bridge glutes|legcurl:Lying leg curl:hamstrings machine|seatlegcurl:Seated leg curl:hamstrings machine|goodmorning:Good morning|' +
  'kbswing:Kettlebell swing:kb|clean:Power clean:olympic|snatch:Power snatch:olympic|backext:Back extension:hyperextension hyper|pullthru:Cable pull-through:glutes');
defEx('Shoulders', 'ohp:Overhead press:ohp military standing barbell|pushpress:Push press|dbpress:Seated DB press:dumbbell shoulder press|' +
  'latraise:Lateral raise:side delts db dumbbell|facepull:Cable face pull:rear delts|arnold:Arnold press:dumbbell|reardelt:Rear delt fly:reverse fly delts|' +
  'uprow:Upright row|cablelat:Cable lateral raise:side delts|frontraise:Front raise:delts|machinesp:Machine shoulder press');
defEx('Arms', 'curl:Barbell curl:biceps bb|dbcurl:Dumbbell curl:biceps db|hammer:Hammer curl:biceps|triext:Triceps pushdown:tricep cable rope|' +
  'skull:Skull crusher:lying triceps extension ez|preacher:Preacher curl:biceps ez|cablecurl:Cable curl:biceps|ohtri:Overhead triceps extension:tricep cable db|' +
  'inclinecurl:Incline dumbbell curl:biceps db|ezcurl:EZ-bar curl:biceps');
defEx('Core', 'abwheel:Ab wheel rollout:abs|hanging:Hanging leg raise:abs|farmer:Farmer carry:farmers walk grip|cablecrunch:Cable crunch:abs|' +
  'russian:Russian twist:obliques abs|pallof:Pallof press:anti rotation');
const exName = k => (EX[k] ? EX[k].name : k);
const exColor = k => (EX[k] ? EX[k].color : 'blue');
const exAdded = k => !!(EX[k] && EX[k].added);
function addCustomEx(r) {
  EX[r.id] = { name: r.name, color: GROUP_COLOR[r.grp] || 'blue', grp: r.grp, alias: '', added: !!r.added, status: r.status, by: r.created_by, custom: true, created_at: r.created_at };
}
// Exercise search: every typed word must start a word of the name, an alias or the muscle group,
// so "db row", "pull up", "rdl" and "legs" all find what you'd expect. Spaces and hyphens are optional ("pullup").
const SYN = { db: 'dumbbell', dumbbell: 'db', bb: 'barbell', barbell: 'bb', kb: 'kettlebell', kettlebell: 'kb' };
const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const exKey = t => norm(t).replace(/ /g, '');
function exIndex(k) {
  const e = EX[k];
  if (!e.words) {
    e.nameWords = norm(e.name).split(' ');
    e.words = norm(e.name + ' ' + e.alias + ' ' + e.grp).split(' ');
    e.words.slice().forEach(w => SYN[w] && e.words.push(SYN[w]));
    e.key = exKey(e.name);
  }
  return e;
}
// What the picker offers: the shared list, plus exercises this person made that are still waiting for review.
function pickable() {
  const mine = store.get('vigor.myEx', []);
  return Object.keys(EX).filter(k => EX[k].status === 'approved' || (EX[k].status === 'pending' && S.me && (EX[k].by === S.me.id || mine.includes(k))));
}
function searchEx(text) {
  const qn = norm(text); const keys = pickable();
  if (!qn) return keys.sort((a, b) => exName(a).localeCompare(exName(b)));
  const toks = qn.split(' '); const compact = qn.replace(/ /g, '');
  const hits = [];
  keys.forEach(k => {
    const e = exIndex(k); const n = e.nameWords.join(' ');
    let rank;
    if (e.key === compact) rank = 0;
    else if (n.startsWith(qn) || e.key.startsWith(compact)) rank = 1;
    else if (toks.every(t => e.words.some(w => w.startsWith(t)))) rank = toks.every(t => e.nameWords.some(w => w.startsWith(t))) ? 2 : 3;
    else if (compact.length >= 3 && e.key.includes(compact)) rank = 3;
    else return;
    hits.push([rank, k]);
  });
  return hits.sort((a, b) => a[0] - b[0] || exName(a[1]).localeCompare(exName(b[1]))).map(h => h[1]);
}
// Same screen the database runs (add_exercise in schema.sql), so people get an answer before anything is sent.
const EX_BLOCK = /(https?:\/\/|www\.|\.com\b|@|\b(crypto|bitcoin|nft|casino|betting|giveaway|buy|sale|discount|promo\w*|coupon|subscribe|onlyfans|porn\w*|sex\w*|nude\w*|fuck\w*|shit\w*|bitch\w*|dick\w*)\b)/i;
function screenExName(n) {
  if (n.length < 3 || n.length > 40) return 'Exercise names need 3 to 40 characters.';
  if ((n.match(/\p{L}/gu) || []).length < 3) return 'Use the exercise\'s name, for example "Cable lateral raise".';
  if (EX_BLOCK.test(n)) return 'That doesn\'t look like an exercise. Names can\'t include links, ads or offensive words.';
  return '';
}
const TEMPLATES = [
  { name: 'Lower A', ex: ['squat', 'rdl', 'lunge'] },
  { name: 'Push A', ex: ['bench', 'ohp', 'inclinedb', 'triext'] },
  { name: 'Pull A', ex: ['pullup', 'row', 'latpd', 'curl'] },
  { name: 'Full body', ex: ['dead', 'bench', 'dbrow', 'splitsq'] }
];
const POST_CATS = ['Progress', 'Nutrition', 'Recovery', 'Mental health', 'Tip'];
const FOCUS = ['Powerlifting', 'Bodybuilding', 'Hybrid', 'Running', 'Calisthenics', 'CrossFit', 'Yoga', 'Mobility', 'Nutrition', 'Coaching', 'General fitness'];
const REACTS = [['strong', 'Strong'], ['form', 'Clean form'], ['inspired', 'Inspired']];
const ECATS = [['All', null], ['Strength', ['Workout', 'PR']], ['Cardio', ['Cardio']], ['Progress', ['Progress']], ['Recovery', ['Recovery']], ['Nutrition', ['Nutrition']], ['Mind', ['Mental health']], ['Tips', ['Tip']]];
/* ---------- Cardio ----------
   Stored in meters and seconds; shown in miles and feet (yards for swims, meters for rowing). */
const MI = 1609.344, YD = 0.9144, FT = 0.3048;
const CARDIO = {
  run: { label: 'Run', unit: 'mi', per: 'mi', color: 'red', elev: true },
  walk: { label: 'Walk', unit: 'mi', per: 'mi', color: 'green', elev: true },
  hike: { label: 'Hike', unit: 'mi', per: 'mi', color: 'green', elev: true, trail: true },
  ride: { label: 'Ride', unit: 'mi', speed: true, color: 'blue', elev: true },
  swim: { label: 'Swim', unit: 'yd', per: '100yd', color: 'blue' },
  row: { label: 'Row', unit: 'm', per: '500m', color: 'yellow' },
  other: { label: 'Other cardio', unit: 'mi', color: 'yellow' }
};
const UNIT_M = { mi: MI, yd: YD, m: 1 };
const PER_M = { mi: MI, '100yd': 100 * YD, '500m': 500 };
const EFFORT = ['Easy', 'Steady', 'Hard', 'Very hard', 'All out'];
// Run distances that get a "fastest" PR. A longer run counts at its average pace, which never flatters it.
const RUN_MARKS = [['Fastest mile', MI], ['Fastest 5K', 5000], ['Fastest 10K', 10000], ['Fastest half marathon', 21097.5]];
const cLabel = k => (CARDIO[k] || CARDIO.other).label;
function fmtDur(sec) {
  sec = Math.round(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, x = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
}
function fmtDist(kind, meters) {
  const u = (CARDIO[kind] || CARDIO.other).unit; const v = meters / UNIT_M[u];
  return (u === 'mi' ? (v >= 100 ? Math.round(v) : +v.toFixed(2)) : Math.round(v).toLocaleString('en-US')) + ' ' + u;
}
function fmtPace(kind, meters, sec) {
  const c = CARDIO[kind] || CARDIO.other;
  if (!(meters > 0) || !(sec > 0)) return '';
  if (c.speed) return (meters / MI / (sec / 3600)).toFixed(1) + ' mph';
  if (!c.per) return '';
  return fmtDur(sec / (meters / PER_M[c.per])) + ' /' + c.per;
}
const fmtFt = m => Math.round(m / FT).toLocaleString('en-US') + ' ft';
// One activity's stats in the order the plan lists them: distance, time, pace, elevation, heart rate.
function cardioStats(a) {
  return [a.distance_m > 0 ? fmtDist(a.kind, a.distance_m) : '', fmtDur(a.duration_s), fmtPace(a.kind, a.distance_m, a.duration_s),
    a.elevation_m > 0 ? fmtFt(a.elevation_m) + ' up' : '', a.avg_hr ? '♥ ' + a.avg_hr : ''].filter(Boolean);
}
// Value shown on a cardio PR badge or plate.
function cardioPr(a, type) {
  const mark = RUN_MARKS.find(m => m[0] === type);
  if (mark) return { val: fmtDur(a.duration_s * mark[1] / a.distance_m), unit: type.replace('Fastest ', ''), score: -a.duration_s * mark[1] / a.distance_m };
  if (type === 'Biggest elevation day') return { val: Math.round(a.elevation_m / FT).toLocaleString('en-US'), unit: 'ft', score: +a.elevation_m };
  return { val: String(+(a.distance_m / MI).toFixed(1)), unit: 'mi', score: +a.distance_m };
}
// PRs for one finished activity against the person's earlier ones. Like lifts, a first effort sets the baseline.
function detectCardio(a, hist) {
  const out = []; const same = hist.filter(h => h.kind === a.kind);
  if (a.kind === 'run' && a.distance_m > 0) {
    RUN_MARKS.forEach(([t, d]) => {
      if (a.distance_m < d * 0.99) return;
      const prev = same.filter(h => h.distance_m >= d * 0.99).map(h => h.duration_s * d / h.distance_m);
      if (prev.length && a.duration_s * d / a.distance_m < Math.min(...prev) - 0.5) out.push(t);
    });
  }
  if ((a.kind === 'run' || a.kind === 'hike') && a.distance_m > 0 && same.length && a.distance_m > Math.max(...same.map(h => +h.distance_m || 0)) + 1) out.push(a.kind === 'run' ? 'Longest run' : 'Longest hike');
  const climbs = hist.filter(h => CARDIO[h.kind] && CARDIO[h.kind].elev && h.elevation_m > 0);
  if (a.elevation_m > 0 && climbs.length && a.elevation_m > Math.max(...climbs.map(h => +h.elevation_m)) + 0.5) out.push('Biggest elevation day');
  return out;
}
// A cardio block in the logger holds what was typed; this turns it into an activity row.
function blockToActivity(c) {
  const u = (CARDIO[c.kind] || CARDIO.other).unit;
  const dur = (+c.h || 0) * 3600 + (+c.m || 0) * 60 + (+c.s || 0);
  return {
    kind: c.kind, title: (c.title || '').trim().slice(0, 80), duration_s: Math.round(dur),
    distance_m: c.exact_m && c.dist === c.exact_txt ? +(+c.exact_m).toFixed(1) : +c.dist > 0 ? +(+c.dist * UNIT_M[u]).toFixed(1) : null,
    elevation_m: c.exact_e && c.elev === c.exact_etxt ? +(+c.exact_e).toFixed(1) : +c.elev > 0 ? +(+c.elev * FT).toFixed(1) : null,
    avg_hr: +c.hr >= 30 && +c.hr <= 250 ? Math.round(+c.hr) : null,
    calories: c.calories ? Math.round(c.calories) : null, effort: c.effort || null,
    source: c.source || 'manual', external_id: c.external_id || null, started_at: c.started_at || null
  };
}
const dayPart = d => { const h = d.getHours(); return h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night'; };
const CARDIO_HINT = {
  run: 'Pace, plus fastest mile, 5K, 10K and half marathon PRs', walk: 'Distance, time and pace', hike: 'Trail name and elevation gain',
  ride: 'Distance, time and average speed', swim: 'Yards and pace per 100', row: 'Meters and split per 500', other: 'Elliptical, stairs, a class: time and how it felt'
};
const OFFTOPIC = /\b(crypto|bitcoin|nft|forex|election|vote for|giveaway|promo code|dm me|onlyfans|politic\w*)\b/i;

/* ---------- State ---------- */
const S = {
  view: 'loading', authMode: 'signin', authMsg: '', session: null, me: null,
  tab: 'feed', stack: [], sheet: null, data: {}, profiles: {}, follows: [], hist: {},
  workout: null, summary: null, rest: null, esort: 'popular', ecat: 'All', pq: '', presults: null, gridFilter: 'All', busy: false,
  schema: 1, // which version of supabase/schema.sql the database has; checked at sign-in
  legacy: false // true until the database has run the v2 schema (likes, set types, custom exercises)
};
const NEED_SCHEMA = 4;
const v3 = () => S.schema >= 3; // profile photos, comment replies and comment votes
const v4 = () => S.schema >= 4; // cardio
// Set by the Vigor phone app (native/), which loads this same web app and adds Apple Health or Health Connect.
const NATIVE = () => (window.VigorNative && typeof window.VigorNative.call === 'function' ? window.VigorNative : null);
let sb = null;

/* ---------- Helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Math.round(n).toLocaleString('en-US');
const e1 = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
const wt = (ex, w) => (exAdded(ex) ? '+' : '') + (+w % 1 ? (+w).toFixed(1) : +w);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
};
function ago(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 172800) return 'Yesterday';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return shortDate(ts);
}
const shortDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
const mediaUrl = path => sb.storage.from('media').getPublicUrl(path).data.publicUrl;
// Warm-up sets are logged but never count toward PRs, history or volume.
const noWarm = qb => (S.legacy ? qb : qb.neq('kind', 'warmup'));
const setCols = () => 'workout_id,ex,weight,reps,is_pr,pr_types,idx' + (S.legacy ? '' : ',kind');
function fmtCount(n) { return n >= 10000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : num(n); }

const ICON = {
  feed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 10h16"/></svg>',
  explore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z" fill="currentColor" stroke-linejoin="round"/></svg>',
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12h2M20 12h2M7 8v8M17 8v8M4 10v4M20 10v4M7 12h10"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3zm0 4H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 8V7z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" stroke-linejoin="round"><path d="M12 20.5s-7.6-4.5-9.3-9.6C1.6 7.4 3.8 4.5 7 4.5c2.1 0 3.7 1.2 5 3 1.3-1.8 2.9-3 5-3 3.2 0 5.4 2.9 4.3 6.4-1.7 5.1-9.3 9.6-9.3 9.6z"/></svg>',
  thumb: '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M7 10v11H3V10zM7 10l4-8c1.7 0 3 1.3 3 3v4h5.2a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 17.8 21H7"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
};
function hueOf(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function avatar(id, cls = '') {
  const p = S.profiles[id] || { name: '?' };
  if (p.avatar_path) return `<img class="av ${cls}" src="${esc(mediaUrl(p.avatar_path))}" alt="" loading="lazy" decoding="async">`;
  const ini = (p.name || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="av ${cls}" style="background:hsl(${hueOf(id)} 55% 40%)">${esc(ini)}</span>`;
}
const handle = id => (S.profiles[id] ? '@' + S.profiles[id].handle : '@someone');

let toastT;
function toast(msg) {
  $('#toast').innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toastT); toastT = setTimeout(() => ($('#toast').innerHTML = ''), Math.max(3200, msg.length * 55));
}
function fail(e) { console.error(e); toast(e && e.message ? e.message : 'Something went wrong. Check your connection and try again.'); }

/* ---------- Data loading ---------- */
async function ensureProfiles(ids) {
  const missing = [...new Set(ids)].filter(id => id && !S.profiles[id]);
  if (!missing.length) return;
  const rows = await q(sb.from('profiles').select('*').in('id', missing));
  rows.forEach(r => (S.profiles[r.id] = r));
}
async function loadFollows() { S.follows = await q(sb.from('follows').select('follower,followee')); }
const followsOf = u => S.follows.filter(f => f.follower === u).map(f => f.followee);
const followersOf = u => S.follows.filter(f => f.followee === u).map(f => f.follower);
const iFollow = u => S.follows.some(f => f.follower === S.me.id && f.followee === u);

async function hydratePosts(posts) {
  if (!posts.length) return posts;
  const ids = posts.map(p => p.id);
  const wids = posts.map(p => p.workout_id).filter(Boolean);
  const [reacts, comments, sets] = await Promise.all([
    q(sb.from('reactions').select('post_id,user_id,kind').in('post_id', ids)),
    q(sb.from('comments').select('post_id').in('post_id', ids)),
    wids.length ? q(sb.from('sets').select(setCols()).in('workout_id', wids).order('idx')) : Promise.resolve([])
  ]);
  const [titles, acts] = wids.length ? await Promise.all([
    q(sb.from('workouts').select('id,title').in('id', wids)),
    v4() ? q(sb.from('activities').select('*').in('workout_id', wids).order('idx')) : Promise.resolve([])
  ]) : [[], []];
  posts.forEach(p => {
    p.react = { strong: 0, form: 0, inspired: 0, like: 0 }; p.mine = {}; p.likers = [];
    reacts.filter(r => r.post_id === p.id).forEach(r => {
      if (!(r.kind in p.react)) return;
      p.react[r.kind]++; if (r.user_id === S.me.id) p.mine[r.kind] = true;
      if (r.kind === 'like') p.likers.push(r.user_id);
    });
    p.ncomments = comments.filter(c => c.post_id === p.id).length;
    p.sets = sets.filter(s => s.workout_id === p.workout_id);
    p.acts = acts.filter(a => a.workout_id === p.workout_id);
    const t = titles.find(w => w.id === p.workout_id); p.wtitle = t ? t.title : 'Workout';
  });
  await ensureProfiles([...posts.map(p => p.user_id), ...posts.map(likerShown)]);
  return posts;
}
const visibleSelect = () => sb.from('posts').select('*').neq('status', 'removed');

async function loadFeed() {
  await loadFollows();
  const ids = [...followsOf(S.me.id), S.me.id];
  const posts = await q(visibleSelect().eq('status', 'visible').in('user_id', ids).order('created_at', { ascending: false }).limit(40));
  S.data.feed = await hydratePosts(posts);
}
async function loadExplore() {
  await loadFollows();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const posts = await q(visibleSelect().eq('status', 'visible').neq('user_id', S.me.id).gte('created_at', since).order('created_at', { ascending: false }).limit(150));
  S.data.explore = await hydratePosts(posts);
  const people = await q(sb.from('profiles').select('*').neq('id', S.me.id).order('created_at', { ascending: false }).limit(60));
  people.forEach(p => (S.profiles[p.id] = p));
  S.data.creators = people.filter(p => !iFollow(p.id)).map(p => p.id)
    .sort((a, b) => followersOf(b).length - followersOf(a).length).slice(0, 12);
}
async function loadProfile(uid) {
  await Promise.all([loadFollows(), ensureProfiles([uid])]);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [posts, prs, workouts, monthSets, cprs] = await Promise.all([
    q(visibleSelect().eq('user_id', uid).order('created_at', { ascending: false }).limit(90)),
    q(sb.from('sets').select('ex,weight,reps,workout_id,created_at').eq('user_id', uid).eq('is_pr', true).order('weight', { ascending: false })),
    q(sb.from('workouts').select('id,started_at').eq('user_id', uid).gte('started_at', new Date(Date.now() - 120 * 86400000).toISOString())),
    q(noWarm(sb.from('sets').select('weight,reps').eq('user_id', uid).gte('created_at', monthStart.toISOString()))),
    v4() ? q(sb.from('activities').select('*').eq('user_id', uid).eq('is_pr', true)) : Promise.resolve([])
  ]);
  const best = {};
  prs.forEach(s => { if (!best[s.ex] || +s.weight > +best[s.ex].weight) best[s.ex] = s; });
  // cardio plates: the best activity for each PR type (fastest 5K, longest hike...)
  const cbest = {};
  cprs.forEach(a => (a.pr_types || []).forEach(t => { const v = cardioPr(a, t); if (!cbest[t] || v.score > cbest[t].v.score) cbest[t] = { a, v }; }));
  const ORDER = [...RUN_MARKS.map(m => m[0]), 'Longest run', 'Longest hike', 'Biggest elevation day'];
  const cardioWall = ORDER.filter(t => cbest[t]).map(t => ({ cardio: true, type: t, kind: cbest[t].a.kind, ...cbest[t].v, workout_id: cbest[t].a.workout_id, created_at: cbest[t].a.started_at }));
  const prWorkouts = [...Object.values(best), ...cardioWall].map(s => s.workout_id);
  const proof = prWorkouts.length ? await q(sb.from('posts').select('id,workout_id').in('workout_id', prWorkouts).eq('status', 'visible')) : [];
  const withPost = x => ({ ...x, post: (proof.find(p => p.workout_id === x.workout_id) || {}).id });
  const wall = Object.values(best).map(withPost).sort((a, b) => +b.weight - +a.weight).slice(0, 9).concat(cardioWall.map(withPost));
  // week streak: consecutive weeks (Mon start) with at least one workout, counting back from this week
  const weekKey = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
  const weeks = new Set(workouts.map(w => weekKey(w.started_at)));
  let streak = 0, k = weekKey(Date.now());
  if (!weeks.has(k)) k -= 7 * 86400000;
  while (weeks.has(k)) { streak++; k -= 7 * 86400000; }
  const month = workouts.filter(w => new Date(w.started_at) >= monthStart).length;
  const volume = monthSets.reduce((a, s) => a + s.weight * s.reps, 0);
  S.data['profile:' + uid] = { posts: posts.filter(p => p.status === 'visible' || uid === S.me.id), wall, streak, month, volume };
}
async function loadPost(id) {
  const rows = await q(visibleSelect().eq('id', id));
  if (!rows.length) { S.data['post:' + id] = null; return; }
  const p = (await hydratePosts(rows))[0];
  p.comments = await q(sb.from('comments').select('*').eq('post_id', id).order('created_at'));
  p.comments.forEach(c => { c.up = 0; c.down = 0; c.vote = 0; });
  if (v3() && p.comments.length) {
    const votes = await q(sb.from('comment_votes').select('comment_id,user_id,value').in('comment_id', p.comments.map(c => c.id)));
    votes.forEach(v => {
      const c = p.comments.find(x => x.id === v.comment_id); if (!c) return;
      if (v.value > 0) c.up++; else c.down++;
      if (v.user_id === S.me.id) c.vote = v.value;
    });
  }
  await ensureProfiles(p.comments.map(c => c.user_id));
  const pr = p.sets.find(s => s.is_pr);
  if (pr) {
    const hist = await q(noWarm(sb.from('sets').select('weight,workout_id,created_at').eq('user_id', p.user_id).eq('ex', pr.ex)).order('created_at'));
    const byW = new Map();
    hist.forEach(h => { const b = byW.get(h.workout_id); if (!b || +h.weight > +b.w) byW.set(h.workout_id, { w: +h.weight, d: h.created_at, wid: h.workout_id }); });
    p.history = { ex: pr.ex, points: [...byW.values()].slice(-10) };
  }
  S.data['post:' + id] = p;
}
// Every activity this person has logged, for cardio PR checks.
async function loadCardioHist() {
  if (S.ahist || !v4()) return;
  S.ahist = await q(sb.from('activities').select('kind,duration_s,distance_m,elevation_m,source,external_id').eq('user_id', S.me.id));
}
async function loadHist(ex) {
  if (S.hist[ex]) return;
  S.hist[ex] = await q(noWarm(sb.from('sets').select('weight,reps,created_at').eq('user_id', S.me.id).eq('ex', ex)).order('created_at'));
}
let searchSeq = 0;
async function searchPeople(raw) {
  const term = raw.trim().replace(/^@/, '').replace(/[^\p{L}\p{N} ._'-]/gu, '').slice(0, 40);
  const mine = ++searchSeq;
  if (!term) { S.presults = []; return; }
  const like = `%${term.replace(/[%_]/g, m => '\\' + m)}%`;
  const rows = await q(sb.from('profiles').select('*').or(`name.ilike.${JSON.stringify(like)},handle.ilike.${JSON.stringify(like)}`).neq('id', S.me.id).order('name').limit(25));
  if (mine !== searchSeq) return; // a newer search already answered
  rows.forEach(r => (S.profiles[r.id] = r));
  const t = term.toLowerCase();
  const rank = r => (String(r.handle).toLowerCase() === t ? 0 : String(r.handle).toLowerCase().startsWith(t) || r.name.toLowerCase().startsWith(t) ? 1 : 2);
  S.presults = rows.sort((a, b) => rank(a) - rank(b)).map(r => r.id);
}
function paintSearch() {
  const box = document.getElementById('psearch-results'); const body = document.getElementById('explore-body');
  if (box) box.innerHTML = searchResultsHtml();
  if (body) body.hidden = !!S.pq.trim();
}
let searchTimer;

// Checks which version of schema.sql the database has, then loads member-created exercises.
async function checkSchema() {
  try { S.schema = +(await q(sb.rpc('vigor_schema_version'))) || 1; } catch (_) { S.schema = 1; }
  S.legacy = S.schema < 2;
  if (!S.legacy) { try { await loadExercises(); } catch (e) { console.error(e); } }
}
async function loadExercises() {
  const rows = await q(sb.from('exercises').select('*').order('created_at').limit(5000));
  rows.forEach(addCustomEx);
}
async function loadAdmin() {
  const exq = S.legacy ? Promise.resolve([]) : q(sb.from('exercises').select('*').neq('status', 'rejected').order('created_at', { ascending: false }).limit(100));
  const [held, reports, feedback, code, exercises] = await Promise.all([
    q(sb.from('posts').select('*').eq('status', 'held').order('created_at', { ascending: false })),
    q(sb.from('reports').select('*').eq('resolved', false).order('created_at', { ascending: false })),
    q(sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(200)),
    q(sb.rpc('get_invite_code')),
    exq
  ]);
  exercises.forEach(addCustomEx);
  const rp = reports.length ? await q(sb.from('posts').select('*').in('id', reports.map(r => r.post_id))) : [];
  const members = await q(sb.from('profiles').select('*').order('created_at'));
  members.forEach(m => (S.profiles[m.id] = m));
  await ensureProfiles([...held, ...rp, ...reports, ...feedback].map(x => x.user_id).concat(exercises.map(x => x.created_by)));
  S.data.admin = { held, reports, reportPosts: rp, feedback, code, members, exercises };
}

/* ---------- PR detection ---------- */
function detect(ex, w, r) {
  const h = S.hist[ex] || [];
  w = +w; r = +r;
  if (!h.length || !(w > 0) || !(r > 0)) return [];
  const maxW = Math.max(...h.map(s => +s.weight)), maxE = Math.max(...h.map(s => e1(+s.weight, s.reps)));
  const atW = h.filter(s => +s.weight >= w); const out = [];
  if (w > maxW) out.push('Heaviest weight');
  if (e1(w, r) > maxE + 0.01) out.push('Est. 1RM ' + Math.round(e1(w, r)));
  if (atW.length && r > Math.max(...atW.map(s => s.reps))) out.push('Most reps at ' + wt(ex, w));
  return out;
}
function computePRs() {
  const groups = []; let sets = 0, vol = 0, warm = 0;
  S.workout.ex.forEach(e => {
    warm += e.sets.filter(s => s.done && +s.r > 0 && s.kind === 'warmup').length;
    const done = e.sets.filter(s => s.done && +s.w >= 0 && +s.r > 0 && s.kind !== 'warmup');
    sets += done.length; done.forEach(s => (vol += +s.w * +s.r));
    const h = S.hist[e.id] || [];
    if (!done.length) return;
    if (!h.length) return; // first time logging this lift sets the baseline, not a PR
    const maxW = Math.max(...h.map(s => +s.weight)), maxE = Math.max(...h.map(s => e1(+s.weight, s.reps)));
    const found = new Map();
    const add = (s, t) => { if (!found.has(s)) found.set(s, []); if (!found.get(s).includes(t)) found.get(s).push(t); };
    const heavy = done.reduce((a, s) => (+s.w > +a.w ? s : a), done[0]); if (+heavy.w > maxW) add(heavy, 'Heaviest weight');
    const est = done.reduce((a, s) => (e1(+s.w, +s.r) > e1(+a.w, +a.r) ? s : a), done[0]);
    if (e1(+est.w, +est.r) > maxE + 0.01) add(est, 'Est. 1RM ' + Math.round(e1(+est.w, +est.r)));
    done.forEach(s => { const atW = h.filter(x => +x.weight >= +s.w); if (atW.length && +s.r > Math.max(...atW.map(x => x.reps))) add(s, 'Most reps at ' + wt(e.id, s.w)); });
    found.forEach((types, s) => groups.push({ ex: e.id, w: +s.w, r: +s.r, types, set: s }));
  });
  const cardio = (S.workout.cardio || []).map(c => ({ c, a: blockToActivity(c) })).filter(x => x.a.duration_s > 0);
  cardio.forEach(x => { x.types = detectCardio(x.a, S.ahist || []); if (x.types.length) groups.push({ cardio: true, ...x }); });
  // Each cardio PR type gets its own plate on the wall; a lift set with several PR types is one.
  const prs = groups.reduce((t, g) => t + (g.cardio ? g.types.length : 1), 0);
  return { groups, sets, vol, warm, cardio, prs };
}

/* ---------- Rendering: shared pieces ---------- */
function mediaHtml(p, full) {
  // On a post's own page, double-tapping the photo likes it (videos keep their player controls).
  const dbl = full && !S.legacy && p.media_kind !== 'video' ? ` data-dbl="1" data-id="${p.id}"` : '';
  if (p.media_path) {
    const url = esc(mediaUrl(p.media_path));
    return `<div class="media"${dbl}>${p.media_kind === 'video'
      ? `<video src="${url}#t=0.1" playsinline preload="metadata" ${full ? 'controls' : 'muted'}></video>${full ? '' : `<span class="play">${ICON.play}</span>`}`
      : `<img src="${url}" alt="" loading="lazy">`}</div>`;
  }
  const h = hueOf(p.id); const pr = (p.sets || []).find(s => s.is_pr);
  const acts = p.acts || []; const cpr = acts.find(a => a.is_pr); const lead = acts[0];
  let big = pr ? wt(pr.ex, pr.weight) : (p.category === 'Workout' ? (p.wtitle || 'WORKOUT') : p.category);
  const ns = (p.sets || []).length;
  let sub = pr ? `${exName(pr.ex)} · ${pr.reps} rep${pr.reps > 1 ? 's' : ''}` : (p.category === 'Workout' ? [ns ? `${ns} set${ns === 1 ? '' : 's'}` : '', ...acts.map(a => a.distance_m > 0 ? `${fmtDist(a.kind, a.distance_m)} ${cLabel(a.kind).toLowerCase()}` : cLabel(a.kind))].filter(Boolean).join(' · ') : 'Text post');
  if (!pr && cpr) { const v = cardioPr(cpr, cpr.pr_types[0]); big = v.val + (v.unit === 'mi' || v.unit === 'ft' ? ' ' + v.unit : ''); sub = `${cpr.pr_types[0]} · ${cLabel(cpr.kind)}`; }
  else if (!pr && lead && !(p.sets || []).length) {
    big = lead.distance_m > 0 ? fmtDist(lead.kind, lead.distance_m) : fmtDur(lead.duration_s);
    sub = [cLabel(lead.kind), lead.title, lead.distance_m > 0 ? fmtDur(lead.duration_s) : ''].filter(Boolean).join(' · ');
  }
  return `<div class="media"${dbl}><div class="art" style="background:linear-gradient(160deg,hsl(${h} 45% 20%),hsl(${(h + 25) % 360} 55% 34%))">
    <span class="big">${esc(String(big).toUpperCase())}</span><span class="small">${esc(sub.toUpperCase())}</span></div></div>`;
}
const KIND_TAG = { warmup: 'W', drop: 'D' };
function workoutSummary(p, full) {
  const acts = p.acts || [];
  if ((!p.sets || !p.sets.length) && !acts.length) return '';
  const byEx = [];
  p.sets.forEach(s => { let g = byEx.find(x => x.ex === s.ex); if (!g) byEx.push(g = { ex: s.ex, sets: [] }); g.sets.push(s); });
  const count = [byEx.length ? `${byEx.length} exercise${byEx.length > 1 ? 's' : ''}` : '', acts.length ? `${acts.length} cardio` : ''].filter(Boolean).join(' · ');
  return `<div class="wk"><h4>${esc(p.wtitle)}<span>${count}</span></h4><ul>${acts.map(a => `<li class="cardio-li"><b>${esc(cLabel(a.kind))}${a.title ? ' · ' + esc(a.title) : ''}</b>
      <span class="cstats">${cardioStats(a).map(esc).join(' · ')}${full && a.effort ? ' · felt ' + esc(EFFORT[a.effort - 1].toLowerCase()) : ''}</span></li>`).join('')}${byEx.map(g => {
    const work = g.sets.filter(s => s.kind !== 'warmup'); const nw = g.sets.length - work.length;
    const top = (work.length ? work : g.sets).reduce((a, s) => (+s.weight > +a.weight ? s : a), (work.length ? work : g.sets)[0]);
    const count = `${work.length} set${work.length === 1 ? '' : 's'}${nw ? ` + ${nw} warm-up` : ''}`;
    return `<li><b>${esc(exName(g.ex))}</b><span>${wt(g.ex, top.weight)} × ${top.reps} · ${count}</span></li>` +
      (full ? `<li class="setline">${g.sets.map(s => `<span class="${s.kind || ''}">${KIND_TAG[s.kind] ? `<i>${KIND_TAG[s.kind]}</i>` : ''}${wt(g.ex, s.weight)}×${s.reps}</span>`).join('')}</li>` : '');
  }).join('')}</ul></div>`;
}
// The liker named under a post: someone you follow first, then anyone else, then you.
function likerShown(p) {
  return p.likers.find(u => u !== S.me.id && iFollow(u)) || p.likers.find(u => u !== S.me.id) || p.likers[0];
}
function likedBy(p) {
  const n = p.react.like; if (!n) return '';
  const u = likerShown(p); const who = u === S.me.id ? 'you' : esc(handle(u));
  return `<button class="likes" data-act="likers" data-id="${p.id}">Liked by <b>${who}</b>${n > 1 ? ` and <b>${n - 1} other${n > 2 ? 's' : ''}</b>` : ''}</button>`;
}
function postCard(p, full) {
  const U = S.profiles[p.user_id] || {};
  const prs = (p.sets || []).filter(s => s.is_pr);
  const cprs = (p.acts || []).filter(a => a.is_pr);
  const media = (p.media_path || p.sets.length || (p.acts || []).length || !full) ? (full ? mediaHtml(p, true)
    : `<button class="media-btn" data-act="open" data-id="${p.id}" ${S.legacy ? '' : 'data-dbl="1"'} aria-label="Open post. Double-tap to like.">${mediaHtml(p)}</button>`) : '';
  return `<article class="post">
    <div class="post-head">
      <button class="who" data-act="profile" data-id="${p.user_id}">${avatar(p.user_id)}<span><span class="nm">${esc(U.name)}</span><span class="hd">@${esc(U.handle)}</span></span></button>
      <span class="cat ${p.category === 'PR' ? 'is-pr' : ''}">${esc(p.category)}</span>
      <button class="icon-btn sm" data-act="postMenu" data-id="${p.id}" aria-label="Post options">${ICON.more}</button>
    </div>
    ${p.status === 'held' ? '<div class="hint" style="margin-top:0">Held for review. Only you and the moderators can see this post.</div>' : ''}
    ${media}
    ${prs.length || cprs.length ? `<div class="prs">${prs.map(s => `<span class="pr-badge">${ICON.trophy}${esc(exName(s.ex))} · ${wt(s.ex, s.weight)} × ${s.reps} · ${esc((s.pr_types || [])[0] || 'PR')}</span>`).join('')}${
      cprs.map(a => a.pr_types.map(t => { const v = cardioPr(a, t); return `<span class="pr-badge">${ICON.trophy}${esc(t)} · ${esc(v.val)} ${v.unit === 'mi' || v.unit === 'ft' ? esc(v.unit) : ''}</span>`; }).join('')).join('')}</div>` : ''}
    <div class="react-row">
      ${S.legacy ? '' : `<button class="like-btn" data-act="like" data-id="${p.id}" aria-pressed="${!!p.mine.like}" aria-label="${p.mine.like ? 'Unlike' : 'Like'}">${ICON.heart}<span class="n">${p.react.like ? fmtCount(p.react.like) : ''}</span></button>`}
      ${REACTS.map(([k, l]) => `<button class="react" data-act="react" data-id="${p.id}" data-k="${k}" aria-pressed="${!!p.mine[k]}">${l}<span class="n">${p.react[k]}</span></button>`).join('')}
      ${full ? '' : `<button class="react ghost" data-act="open" data-id="${p.id}">${p.ncomments} comment${p.ncomments === 1 ? '' : 's'}</button>`}
      ${p.sets.length && p.user_id !== S.me.id ? `<button class="react ghost" data-act="copy" data-id="${p.id}">Copy workout</button>` : ''}
    </div>
    ${likedBy(p)}
    ${workoutSummary(p, full)}
    ${p.caption ? `<p class="caption"><b>@${esc(U.handle)}</b> ${esc(p.caption)}</p>` : ''}
    <div class="when">${ago(p.created_at)}</div>
  </article>`;
}
function topBar(title, right = '', back = false) {
  return `<header class="top">${back ? `<button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>` : ''}${title}${right}</header>`;
}
const h2 = t => `<h2>${esc(t)}</h2>`;
const fbBtn = () => '<button class="text-btn" data-act="feedback">Feedback</button>';
const loading = () => '<div class="loading">Loading…</div>';
function followBtn(u, sm) {
  if (u === S.me.id) return '';
  const f = iFollow(u);
  return `<button class="btn ${sm ? 'sm' : ''} ${f ? '' : 'primary'}" data-act="follow" data-id="${u}">${f ? 'Following' : 'Follow'}</button>`;
}

/* ---------- Screens ---------- */
function authScreen() {
  const m = S.authMode;
  const msg = S.authMsg ? `<p class="${S.authErr ? 'err' : 'tagline'}">${esc(S.authMsg)}</p>` : '';
  if (m === 'reset') {
    return `<div class="auth"><span class="brand">VIGOR</span><p class="tagline">Choose a new password.</p>
      <form data-form="reset"><input class="field" type="password" id="pw" placeholder="New password (8+ characters)" minlength="8" required autocomplete="new-password">
      <button class="btn primary block">Save password</button></form>${msg}</div>`;
  }
  if (m === 'forgot') {
    return `<div class="auth"><span class="brand">VIGOR</span><p class="tagline">We'll email you a link to reset your password.</p>
      <form data-form="forgot"><input class="field" type="email" id="email" placeholder="Email" required autocomplete="email">
      <button class="btn primary block">Send reset link</button></form>${msg}
      <div class="row"><button class="text-btn" data-act="authMode" data-id="signin">Back to sign in</button></div></div>`;
  }
  const up = m === 'signup';
  return `<div class="auth"><span class="trial-badge">Private trial · v${VERSION}</span><span class="brand">VIGOR</span>
    <p class="tagline">The workout log is the post. Log your lifts, prove your PRs, and follow people who only post about getting healthier.</p>
    <form data-form="${up ? 'signup' : 'signin'}">
      <input class="field" type="email" id="email" placeholder="Email" required autocomplete="email">
      <input class="field" type="password" id="pw" placeholder="${up ? 'Password (8+ characters)' : 'Password'}" ${up ? 'minlength="8"' : ''} required autocomplete="${up ? 'new-password' : 'current-password'}">
      <button class="btn primary block" ${S.busy ? 'disabled' : ''}>${up ? 'Create account' : 'Sign in'}</button>
    </form>${msg}
    <div class="row">
      <button class="text-btn" data-act="authMode" data-id="${up ? 'signin' : 'signup'}">${up ? 'I already have an account' : 'Create an account'}</button>
      ${up ? '' : '<button class="text-btn" data-act="authMode" data-id="forgot">Forgot password</button>'}
    </div></div>`;
}
function onboardScreen() {
  const o = S.onboard || (S.onboard = { tags: [] });
  return `<header class="top"><h2>Set up your profile</h2></header>
    <form class="form" data-form="onboard">
      <label>Name<input class="field" id="ob-name" required maxlength="60" value="${esc(o.name || '')}" autocomplete="name"></label>
      <label>Username<input class="field" id="ob-handle" required pattern="[a-z0-9._]{3,24}" maxlength="24" value="${esc(o.handle || '')}" autocapitalize="none" autocomplete="username">
        <span class="help">3 to 24 lowercase letters, numbers, dots or underscores.</span></label>
      <label>Bio<textarea class="field" id="ob-bio" maxlength="200" placeholder="What are you training for?">${esc(o.bio || '')}</textarea></label>
      <div class="stack" style="gap:6px"><span class="label">Focus</span><div class="tagpick">${FOCUS.map(t => `<button type="button" class="chip" data-act="obTag" data-id="${t}" aria-pressed="${o.tags.includes(t)}">${t}</button>`).join('')}</div></div>
      <label>Invite code<input class="field" id="ob-code" value="${esc(o.code || '')}" autocapitalize="none">
        <span class="help">From the person who invited you. If you are the first person setting up Vigor, leave it blank and you become the admin.</span></label>
      ${S.obErr ? `<p class="err">${esc(S.obErr)}</p>` : ''}
      <button class="btn primary block" ${S.busy ? 'disabled' : ''}>Join Vigor</button>
      <button type="button" class="text-btn" data-act="signout">Sign out</button>
    </form>`;
}
function installNotice() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone || NATIVE() || store.get('vigor.installDismissed', false)) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="notice"><b>Add Vigor to your home screen</b>
    <span>${ios ? 'In Safari, tap the Share button, then "Add to Home Screen". Vigor then opens full screen like any other app.' : (deferredInstall ? 'Install Vigor so it opens full screen like any other app.' : 'Open your browser menu and choose "Install app" or "Add to Home screen".')}</span>
    <div class="row">${!ios && deferredInstall ? '<button class="btn primary sm" data-act="install">Install</button>' : ''}<button class="btn sm" data-act="dismissInstall">Not now</button></div></div>`;
}
function schemaNotice() {
  if (S.schema >= NEED_SCHEMA || !S.me.is_admin) return '';
  const missing = [S.schema < 2 && 'likes, warm-up and drop sets, new exercises', S.schema < 3 && 'profile photos, comment replies and votes', S.schema < 4 && 'cardio logging and Health imports'].filter(Boolean);
  const off = missing.length > 1 ? missing.slice(0, -1).join(', ') + ', and ' + missing[missing.length - 1] : missing[0];
  return `<div class="notice warnbox"><b>Database update needed</b><span>This version of Vigor needs the latest supabase/schema.sql. Open Supabase, go to SQL Editor, paste the whole file and press Run. Until then these are turned off: ${off}.</span></div>`;
}
function feedScreen() {
  const list = S.data.feed;
  const head = topBar(`<span class="wordmark">VIGOR</span><span class="sub">Following</span>`, `${fbBtn()}<button class="icon-btn" data-act="compose" aria-label="New post">${ICON.plus}</button>`);
  if (!list) return head + loading();
  return head + schemaNotice() + installNotice() + (list.length ? list.map(p => postCard(p)).join('') + `<div class="caught"><span class="ring">${ICON.check.replace('<svg', '<svg width="20" height="20"')}</span><strong>You're caught up</strong><span>That's everything from people you follow.</span></div>`
    : `<div class="empty"><p>Your feed shows posts from people you follow.</p><button class="btn primary" data-act="tab" data-id="explore">Find people on Explore</button></div>`);
}
function score(p) { const r = p.react.like + p.react.strong + p.react.form + p.react.inspired + p.ncomments * 3; return (r + 1) / Math.pow((Date.now() - new Date(p.created_at)) / 3600000 + 2, 0.8); }
function peopleRow(v) {
  const V = S.profiles[v] || {};
  return `<div class="person"><button class="who" data-act="profile" data-id="${v}">${avatar(v)}<span><span class="nm">${esc(V.name)}</span><span class="hd">@${esc(V.handle)}${V.tags && V.tags[0] ? ' · ' + esc(V.tags[0]) : ''}</span></span></button>${followBtn(v, true)}</div>`;
}
function searchResultsHtml() {
  if (!S.pq.trim()) return '';
  if (S.presults === null) return '<div class="loading" style="padding:20px">Searching…</div>';
  if (!S.presults.length) return `<div class="empty">No one matches "${esc(S.pq.trim())}". Check the spelling, or ask them for their username.</div>`;
  return S.presults.map(peopleRow).join('');
}
function exploreScreen() {
  const head = topBar(h2('Explore'), fbBtn()) +
    `<div class="search-wrap"><input class="field" id="psearch" type="search" placeholder="Search people by name or username" value="${esc(S.pq)}" autocomplete="off" autocapitalize="none" enterkeyhint="search" aria-label="Search people">
      ${S.pq ? '<button class="text-btn" data-act="clearSearch">Cancel</button>' : ''}</div>
    <div id="psearch-results">${searchResultsHtml()}</div>`;
  if (!S.data.explore) return head + `<div id="explore-body" ${S.pq.trim() ? 'hidden' : ''}>${loading()}</div>`;
  const cat = ECATS.find(c => c[0] === S.ecat)[1];
  const hasActs = p => (p.acts || []).length, hasSets = p => (p.sets || []).length;
  // Cardio holds anything with a run, ride or swim in it (cardio PRs too); Strength holds workouts and PRs with sets.
  const inCat = p => !cat || (S.ecat === 'Cardio' ? p.category === 'Cardio' || hasActs(p) : cat.includes(p.category) && (S.ecat !== 'Strength' || hasSets(p) || !hasActs(p)));
  let list = S.data.explore.filter(inCat);
  list = S.esort === 'new' ? list : [...list].sort((a, b) => score(b) - score(a));
  const creators = S.data.creators.filter(u => !iFollow(u));
  return head + `<div id="explore-body" ${S.pq.trim() ? 'hidden' : ''}>` + (creators.length ? `<div class="ex-sub label" style="padding-bottom:8px">People to follow</div>
    <div class="rising">${creators.map(u => { const U = S.profiles[u]; return `<div class="creator">
      <button data-act="profile" data-id="${u}" style="display:contents">${avatar(u)}<span class="nm">${esc(U.name)}</span></button>
      <span class="meta">${esc(U.tags[0] || 'Member')} · ${fmtCount(followersOf(u).length)} follower${followersOf(u).length === 1 ? '' : 's'}</span>${followBtn(u, true)}</div>`; }).join('')}</div>` : '') +
    `<div style="padding:0 16px"><div class="seg">${[['popular', 'Popular'], ['new', 'New']].map(([k, l]) => `<button data-act="esort" data-id="${k}" aria-pressed="${S.esort === k}">${l}</button>`).join('')}</div></div>
    <div class="chips" style="padding-bottom:0">${ECATS.map(([l]) => `<button class="chip" data-act="ecat" data-id="${l}" aria-pressed="${S.ecat === l}">${l}</button>`).join('')}</div>
    <p class="ex-sub">${S.esort === 'new' ? 'Newest posts from everyone, including people you don\'t follow yet.' : 'Ranked by reactions and comments, favoring recent posts.'}</p>
    ${list.length ? `<div class="egrid">${list.map(p => { const t = p.react.strong + p.react.form + p.react.inspired; const lk = p.react.like;
      return `<button class="etile" data-act="open" data-id="${p.id}" aria-label="Open post by ${esc(handle(p.user_id))}">${mediaHtml(p)}
        <span class="etile-foot">${avatar(p.user_id)}<span class="hn">${esc(handle(p.user_id))}</span></span>
        <span class="etile-rank">${S.esort === 'new' ? ago(p.created_at) : S.legacy ? `${num(t)} reaction${t === 1 ? '' : 's'}` : `♥ ${num(lk)}${t ? ` · ${num(t)} reaction${t === 1 ? '' : 's'}` : ''}`}</span></button>`; }).join('')}</div>`
      : '<div class="empty">No posts here yet. Be the first: log a workout or tap + on your feed.</div>'}</div>`;
}
function historyChart(hist) {
  const h = hist.points; if (h.length < 2) return '';
  const W = 320, H = 130, pl = 34, pr = 14, pt = 18, pb = 22;
  const ws = h.map(s => s.w); const lo = Math.min(...ws), hi = Math.max(...ws); const span = Math.max(hi - lo, 10);
  const x = i => pl + i * (W - pl - pr) / (h.length - 1);
  const y = w => pt + (1 - (w - lo) / span) * (H - pt - pb);
  const pts = h.map((s, i) => `${x(i)},${y(s.w)}`).join(' ');
  return `<div class="chart"><div class="label">${esc(exName(hist.ex))} history · top set, lb</div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(exName(hist.ex))} history">
      <line x1="${pl}" x2="${W - pr}" y1="${y(hi)}" y2="${y(hi)}" stroke="var(--line)" stroke-dasharray="3 3"/>
      <line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" stroke="var(--line)"/>
      <text x="${pl - 6}" y="${y(hi) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${hi}</text>
      <text x="${pl - 6}" y="${y(lo) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${lo}</text>
      <polygon points="${x(0)},${H - pb} ${pts} ${x(h.length - 1)},${H - pb}" fill="var(--accent)" fill-opacity=".1"/>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>
      ${h.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.w)}" r="${i === h.length - 1 ? 5 : 3.5}" fill="${i === h.length - 1 ? 'var(--pr)' : 'var(--surface)'}" stroke="${i === h.length - 1 ? 'var(--pr)' : 'var(--accent)'}" stroke-width="2"/>
        ${(h.length <= 6 || i % 2 === 0 || i === h.length - 1) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${shortDate(s.d)}</text>` : ''}`).join('')}
    </svg></div>`;
}
// @handles in comments open that person's profile.
function linkMentions(body) {
  return esc(body).replace(/@([a-z0-9._]{3,24})/gi, (m, h) => `<button class="mention" data-act="profileByHandle" data-id="${h.toLowerCase()}">${m}</button>`);
}
function commentHtml(c, reply) {
  const canDel = c.user_id === S.me.id || S.me.is_admin;
  return `<div class="comment ${reply ? 'reply' : ''}">
    <button class="c-av" data-act="profile" data-id="${c.user_id}" aria-label="${esc(handle(c.user_id))}'s profile">${avatar(c.user_id)}</button>
    <div class="c-main"><p><button class="c-name" data-act="profile" data-id="${c.user_id}">${esc(handle(c.user_id))}</button> ${linkMentions(c.body)}</p>
      <div class="c-meta"><span>${ago(c.created_at)}</span>
        ${v3() ? `<button class="vote" data-act="vote" data-id="${c.id}" data-v="1" aria-pressed="${c.vote === 1}" aria-label="Thumbs up${c.up ? ', ' + c.up : ''}">${ICON.thumb}${c.up || ''}</button>
        <button class="vote down" data-act="vote" data-id="${c.id}" data-v="-1" aria-pressed="${c.vote === -1}" aria-label="Thumbs down${c.down ? ', ' + c.down : ''}">${ICON.thumb}${c.down || ''}</button>
        <button data-act="replyTo" data-id="${c.id}">Reply</button>` : ''}
        ${canDel ? `<button data-act="delComment" data-id="${c.id}">Delete</button>` : ''}</div></div></div>`;
}
function commentsHtml(p) {
  if (!p.comments.length) return '<p class="when" style="padding:0">No comments yet. Start the conversation.</p>';
  const ids = new Set(p.comments.map(c => c.id));
  const tops = p.comments.filter(c => !c.parent_id || !ids.has(c.parent_id));
  return tops.map(c => commentHtml(c) + p.comments.filter(r => r.parent_id === c.id).map(r => commentHtml(r, true)).join('')).join('');
}
function postScreen(id) {
  const p = S.data['post:' + id];
  if (p === undefined) return topBar(h2('Post'), '', true) + loading();
  if (p === null) return topBar(h2('Post'), '', true) + '<div class="empty">This post was removed.</div>';
  const rt = S.replyTo && S.replyTo.post === p.id ? S.replyTo : null;
  return topBar(h2(p.category === 'PR' ? 'PR proof' : 'Post'), '', true) + postCard(p, true) +
    `<div class="section-pad">
      ${p.history ? historyChart(p.history) : ''}
      <span class="label">Comments${p.comments.length ? ' · ' + p.comments.length : ''}</span>
      ${commentsHtml(p)}
      ${rt ? `<div class="replying">Replying to <b>${esc(rt.handle)}</b><button class="text-btn" data-act="cancelReply">Cancel</button></div>` : ''}
      <form class="cform" data-form="comment" data-id="${p.id}"><input class="field" id="cmt" placeholder="${rt ? 'Write a reply' : 'Add a comment'}" autocomplete="off" maxlength="1000" value="${esc(S.cdraft && S.cdraft.post === p.id ? S.cdraft.text : '')}"><button class="btn primary sm">Post</button></form>
    </div>`;
}
function profileScreen(u) {
  const mine = u === S.me.id; const U = S.profiles[u]; const d = S.data['profile:' + u];
  const right = mine ? `${fbBtn()}<button class="icon-btn" data-act="meMenu" aria-label="Profile options">${ICON.more}</button>` : '';
  const head = topBar(h2(U ? '@' + U.handle : 'Profile'), right, !mine);
  if (!U || !d) return head + loading();
  const filters = ['All', 'Workouts', 'Progress', 'Nutrition', 'Tips'];
  const match = p => S.gridFilter === 'All' || (S.gridFilter === 'Workouts' && ['Workout', 'PR', 'Cardio'].includes(p.category)) ||
    (S.gridFilter === 'Progress' && p.category === 'Progress') || (S.gridFilter === 'Nutrition' && p.category === 'Nutrition') || (S.gridFilter === 'Tips' && p.category === 'Tip');
  const shown = d.posts.filter(match);
  let goal = '';
  if (U.goal_label && U.goal_ex && U.goal_target) {
    const best = d.wall.find(s => s.ex === U.goal_ex);
    const cur = best ? +best.weight : 0; const pct = Math.max(0, Math.min(100, cur / U.goal_target * 100));
    goal = `<div class="goal"><div class="row"><b>${esc(U.goal_label)}</b><span>${cur ? wt(U.goal_ex, cur) : 0} of ${wt(U.goal_ex, U.goal_target)} lb</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }
  return head + `<section class="prof">
      <div class="prof-head">${mine && v3() ? `<button class="av-edit" data-act="pickAvatar" aria-label="Change profile photo">${avatar(u, 'lg')}<span class="cam">${ICON.camera}</span></button>` : avatar(u, 'lg')}<div><h3>${esc(U.name)}${U.is_admin ? '<span class="cred">Team</span>' : ''}</h3><div class="hd">@${esc(U.handle)}</div>
        <div class="counts"><div><b>${d.posts.length}</b><span>posts</span></div>
          <button data-act="people" data-id="${u}:followers"><b>${fmtCount(followersOf(u).length)}</b><span>followers</span></button>
          <button data-act="people" data-id="${u}:following"><b>${followsOf(u).length}</b><span>following</span></button></div></div></div>
      ${U.bio ? `<p>${esc(U.bio)}</p>` : ''}
      ${U.tags && U.tags.length ? `<div class="tags">${U.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
      ${goal}
      ${mine ? '<button class="btn block" data-act="editProfile">Edit profile</button>' : followBtn(u)}
      <div class="stats"><div><b>${d.streak}</b><span>week streak</span></div><div><b>${d.month}</b><span>workouts this month</span></div><div><b>${d.volume >= 10000 ? Math.round(d.volume / 1000) + 'k' : num(d.volume)}</b><span>lb this month</span></div></div>
    </section>
    <section class="wall"><div class="wall-head"><h3>PR wall</h3><span>${d.wall.length ? 'Tap a plate for its proof' : ''}</span></div>
      ${d.wall.length ? `<div class="plates">${d.wall.map(x => `<button class="plate-tile" data-act="${x.post ? 'open' : 'noproof'}" data-id="${esc(x.post || (x.cardio ? x.type : x.ex))}">
          ${x.cardio ? `<span class="plate c-${CARDIO[x.kind].color}"><span class="plate-val ${x.val.length > 5 ? 'long' : ''}">${esc(x.val)}</span><span class="plate-unit">${esc(x.unit)}</span></span>
          <span class="plate-name">${esc(x.type)}</span>` : `<span class="plate c-${exColor(x.ex)}"><span class="plate-val">${wt(x.ex, x.weight)}</span><span class="plate-unit">lb × ${x.reps}</span></span>
          <span class="plate-name">${esc(exName(x.ex))}</span>`}
          ${x.post ? `<span class="plate-meta">▶ Proof · ${shortDate(x.created_at)}</span>` : `<span class="plate-meta none">No proof yet · ${shortDate(x.created_at)}</span>`}
        </button>`).join('')}</div>` : `<div class="empty" style="padding:8px">${mine ? 'Log a lift or a run twice and beat it to earn your first PR plate.' : 'No PRs yet.'}</div>`}
    </section>
    <div class="chips">${filters.map(f => `<button class="chip" data-act="gridf" data-id="${f}" aria-pressed="${S.gridFilter === f}">${f}</button>`).join('')}</div>
    ${shown.length ? `<div class="grid">${shown.map(p => `<button data-act="open" data-id="${p.id}" aria-label="Open ${esc(p.category)} post">${mediaHtml(p)}</button>`).join('')}</div>` : '<div class="empty">Nothing here yet.</div>'}
    ${mine && S.me.is_admin ? '<button class="admin-link" data-act="admin">Admin: invites, moderation and feedback</button>' : ''}
    <div style="height:24px"></div>`;
}
function peopleScreen(u, which) {
  const list = which === 'followers' ? followersOf(u) : followsOf(u);
  return topBar(h2(handle(u)), '', true) +
    `<div style="padding:12px 16px"><div class="seg">${[['followers', followersOf(u).length + ' followers'], ['following', followsOf(u).length + ' following']].map(([k, l]) =>
      `<button data-act="people" data-id="${u}:${k}" data-swap="1" aria-pressed="${which === k}">${l}</button>`).join('')}</div></div>
    ${list.map(peopleRow).join('')}
    ${!list.length ? `<div class="empty">${which === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}</div>` : ''}`;
}
function editProfileScreen() {
  const U = { ...S.me, ...(S.epDraft || {}) };
  return topBar(h2('Edit profile'), '', true) + `<form class="form" data-form="editProfile">
    ${v3() ? `<div class="photo-row">${avatar(S.me.id, 'lg')}<div class="stack" style="gap:4px;align-items:flex-start">
      <button type="button" class="btn sm" data-act="pickAvatar" ${S.avatarBusy ? 'disabled' : ''}>${S.avatarBusy ? 'Uploading…' : S.me.avatar_path ? 'Change photo' : 'Add a photo'}</button>
      ${S.me.avatar_path && !S.avatarBusy ? '<button type="button" class="text-btn" data-act="rmAvatar" style="color:var(--muted);padding-left:0">Remove photo</button>' : ''}</div></div>` : ''}
    <label>Name<input class="field" id="ep-name" required maxlength="60" value="${esc(U.name)}"></label>
    <label>Bio<textarea class="field" id="ep-bio" maxlength="200">${esc(U.bio)}</textarea></label>
    <div class="stack" style="gap:6px"><span class="label">Focus</span><div class="tagpick">${FOCUS.map(t => `<button type="button" class="chip" data-act="epTag" data-id="${t}" aria-pressed="${(S.epTags || U.tags).includes(t)}">${t}</button>`).join('')}</div></div>
    <span class="label">Goal (shows as a progress bar)</span>
    <label>Goal name<input class="field" id="ep-goal" maxlength="60" placeholder="Bench 300 by Dec 31" value="${esc(U.goal_label)}"></label>
    <label>Lift<select class="field" id="ep-goalex"><option value="">None</option>${[...new Set([...searchEx(''), ...(U.goal_ex ? [U.goal_ex] : [])])].map(k => `<option value="${esc(k)}" ${U.goal_ex === k ? 'selected' : ''}>${esc(exName(k))}</option>`).join('')}</select></label>
    <label>Target weight (lb)<input class="field" id="ep-target" inputmode="decimal" value="${esc(U.goal_target || '')}"></label>
    <button class="btn primary block">Save</button>
  </form>`;
}
function adminScreen() {
  const d = S.data.admin; const head = topBar(h2('Admin'), '', true);
  if (!d) return head + loading();
  const link = location.origin + location.pathname;
  const pcard = (p, why, rid) => { if (!p) return ''; return `<div class="mod-item"><span class="why">${esc(why)}</span><div><b>${esc(handle(p.user_id))}</b> · ${esc(p.category)} · ${ago(p.created_at)}</div><div>${esc(p.caption || '(no caption)')}</div>
    <div class="acts"><button class="btn sm" data-act="open" data-id="${p.id}">View</button><button class="btn sm" data-act="modOk" data-id="${p.id}" data-r="${rid || ''}">${p.status === 'held' ? 'Approve' : 'Keep'}</button><button class="btn sm danger" data-act="modRm" data-id="${p.id}" data-r="${rid || ''}">Remove</button></div></div>`; };
  const pend = d.exercises.filter(x => x.status === 'pending');
  const added = d.exercises.filter(x => x.status === 'approved').slice(0, 30);
  const exRow = (x, acts) => `<div class="mod-item"><div><b>${esc(x.name)}</b> · ${esc(x.grp)}${x.added ? ' · added to bodyweight' : ''}</div>
    <div class="when" style="padding:0">Added by ${esc(handle(x.created_by))} · ${ago(x.created_at)}</div><div class="acts">${acts}</div></div>`;
  return head + schemaNotice() + `<div class="section-pad">
    <span class="label">Invite testers</span>
    <p class="when" style="padding:0">Anyone signing up needs this code. Change it any time; people already in keep their accounts.</p>
    <div class="code">${esc(d.code || '')}</div>
    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm primary" data-act="copyInvite">Copy invite message</button><button class="btn sm" data-act="changeCode">Change code</button></div>
    <textarea class="field" id="invite-msg" readonly style="min-height:90px">You're invited to try Vigor, a workout log and health-only social app. Open ${link} on your phone, add it to your home screen, and sign up with invite code ${d.code || ''}. There's a Feedback button on every screen.</textarea>
    <span class="label">Moderation (${d.held.length + d.reports.length})</span>
    ${d.held.map(p => pcard(p, 'Held by off-topic screen')).join('')}
    ${d.reports.map(r => pcard(d.reportPosts.find(p => p.id === r.post_id), `Reported by ${handle(r.user_id)}: ${r.reason}`, r.id)).join('')}
    ${!d.held.length && !d.reports.length ? '<p class="when" style="padding:0">Nothing to review.</p>' : ''}
    ${S.legacy ? '' : `<span class="label">New exercises to review (${pend.length})</span>
    <p class="when" style="padding:0">Names that clearly describe a movement join the shared list on their own. These didn't, so only the person who made them can use them until you approve.</p>
    ${pend.map(x => exRow(x, `<button class="btn sm" data-act="exReview" data-id="${x.id}" data-s="approved">Approve</button><button class="btn sm danger" data-act="exReview" data-id="${x.id}" data-s="rejected">Reject</button>`)).join('') || '<p class="when" style="padding:0">Nothing to review.</p>'}
    ${added.length ? `<span class="label">Exercises members added</span>
    ${added.map(x => exRow(x, `<button class="btn sm danger" data-act="exReview" data-id="${x.id}" data-s="rejected">Remove from list</button>`)).join('')}` : ''}`}
    <span class="label">Feedback (${d.feedback.filter(f => !f.done).length} open)</span>
    ${d.feedback.length ? `<button class="btn sm" data-act="copyFeedback">Copy all feedback</button>` : ''}
    ${d.feedback.map(f => `<div class="fb-item ${f.done ? 'done' : ''}"><div>${esc(f.body)}</div><div class="meta">${esc(handle(f.user_id))} · ${ago(f.created_at)} · on ${esc(f.screen)} · v${esc(f.app_version)}</div>
      <div><button class="btn sm" data-act="fbDone" data-id="${f.id}">${f.done ? 'Reopen' : 'Mark done'}</button></div></div>`).join('') || '<p class="when" style="padding:0">No feedback yet.</p>'}
    <span class="label">Members (${d.members.length})</span>
    ${d.members.map(m => `<div class="person" style="padding:6px 0"><button class="who" data-act="profile" data-id="${m.id}">${avatar(m.id)}<span><span class="nm">${esc(m.name)}${m.is_admin ? '<span class="cred">Admin</span>' : ''}</span><span class="hd">@${esc(m.handle)} · joined ${shortDate(m.created_at)}</span></span></button></div>`).join('')}
  </div>`;
}

function logScreen() {
  if (S.summary) return summaryScreen();
  const w = S.workout;
  if (!w) {
    const mine = store.get('vigor.templates', []);
    return topBar(h2('Log a workout'), fbBtn()) + `<div class="templates">
      <button class="btn primary block" data-act="startEmpty">Start an empty workout</button>
      ${v4() ? '<button class="btn block" data-act="startCardio">Log a run, walk, hike, ride or swim</button>' : ''}
      ${v4() && NATIVE() ? `<button class="btn block" data-act="healthImport">${ICON.heart}Import from ${esc(NATIVE().healthName)}</button>` : ''}
      <span class="label" style="margin-top:8px">Templates</span>
      ${[...mine.map((t, i) => ({ ...t, key: 'm' + i })), ...TEMPLATES.map((t, i) => ({ ...t, key: 'b' + i }))].map(t => `<button class="tpl" data-act="startTpl" data-id="${t.key}">
        <span class="tpl-top"><h4>${esc(t.name)}</h4>${t.from ? `<span class="from">From ${esc(t.from)}</span>` : ''}</span>
        <p>${t.ex.map(exName).map(esc).join(', ')}</p></button>`).join('')}
      <p class="when" style="padding:0">Weights fill in from your last session. Vigor flags a PR when you beat a lift you've logged before.</p>
    </div>`;
  }
  return `<header class="top"><input class="title-input" id="wtitle" value="${esc(w.title)}" aria-label="Workout name" maxlength="60"><span class="timer" id="elapsed">${elapsed()}</span><button class="btn primary sm" data-act="finish">Finish</button></header>
    ${!w.ex.length && !(w.cardio || []).length ? `<div class="empty">Add your first exercise${v4() ? ' or cardio' : ''} to start logging.</div>` : ''}
    ${w.ex.map((e, i) => {
      const h = S.hist[e.id] || []; const last = h[h.length - 1];
      const best = h.length ? h.reduce((a, s) => (+s.weight > +a.weight ? s : a), h[0]) : null;
      return `<section class="exblock"><div class="exblock-head"><h3>${esc(exName(e.id))}</h3>${best ? `<span class="best">Best ${wt(e.id, best.weight)} × ${best.reps}</span>` : '<span class="best">First time: sets your baseline</span>'}
        <button class="text-btn" data-act="rmEx" data-ex="${i}" style="color:var(--muted)">Remove</button></div>
        <table class="sets"><thead><tr><th>Set</th><th>Previous</th><th>${exAdded(e.id) ? '+lb' : 'lb'}</th><th>Reps</th><th><span class="sr">Done</span></th></tr></thead><tbody>
        ${e.sets.map((s, j) => `<tr class="${s.done ? 'done' : ''}"><td><button class="setno ${s.kind || ''}" data-act="setKind" data-ex="${i}" data-set="${j}" aria-label="Set ${j + 1}, ${KIND_NAME[s.kind || 'normal']}. Change set type">${setLabel(e.sets, j)}</button></td><td class="prev">${last ? wt(e.id, last.weight) + ' × ' + last.reps : '–'}</td>
          <td><input id="w-${i}-${j}" data-ex="${i}" data-set="${j}" data-f="w" inputmode="decimal" value="${esc(s.w)}" aria-label="Weight, set ${j + 1}"></td>
          <td><input id="r-${i}-${j}" data-ex="${i}" data-set="${j}" data-f="r" inputmode="numeric" value="${esc(s.r)}" aria-label="Reps, set ${j + 1}"></td>
          <td><button class="check" data-act="toggleSet" data-ex="${i}" data-set="${j}" aria-label="Mark set ${j + 1} done">${ICON.check}</button></td></tr>
          <tr class="pr-row"><td colspan="5"><div class="pr-live" id="prl-${i}-${j}">${prLive(e.id, s)}</div></td></tr>`).join('')}
        </tbody></table>
        <button class="add-set" data-act="addSet" data-ex="${i}">+ Add set</button></section>`;
    }).join('')}
    ${(w.cardio || []).map(cardioBlock).join('')}
    <div class="log-foot">${w.ex.length ? '<p class="when" style="padding:0">Tap a set number to mark it as a warm-up (W) or drop set (D). Warm-ups never count toward PRs.</p>' : ''}<button class="btn block" data-act="addEx">+ Add exercise</button>
      ${v4() ? '<button class="btn block" data-act="startCardio">+ Add cardio</button>' : ''}
      ${v4() && NATIVE() && !w.imported ? `<button class="btn block" data-act="healthImport">+ Import from ${esc(NATIVE().healthName)}</button>` : ''}
      <button class="btn danger block" data-act="discard">Discard workout</button></div>`;
}
const SOURCE_NAME = { apple_health: 'Apple Health', health_connect: 'Health Connect', garmin: 'Garmin', file: 'a file' };
function cardioBlock(c, i) {
  const k = CARDIO[c.kind] || CARDIO.other;
  const same = (S.ahist || []).filter(h => h.kind === c.kind && h.distance_m > 0);
  const longest = same.length ? same.reduce((a, h) => (+h.distance_m > +a.distance_m ? h : a), same[0]) : null;
  const note = SOURCE_NAME[c.source] ? 'From ' + SOURCE_NAME[c.source] : longest ? `Longest ${fmtDist(c.kind, longest.distance_m)}` : `First ${k.label.toLowerCase()}: sets your baseline`;
  const inp = (f, mode, label, extra = '') => `<input data-c="${i}" data-cf="${f}" inputmode="${mode}" value="${esc(c[f] || '')}" aria-label="${label}" ${extra}>`;
  return `<section class="exblock cblock"><div class="exblock-head"><h3>${esc(k.label)}</h3><span class="best">${esc(note)}</span>
      <button class="text-btn" data-act="rmCardio" data-c="${i}" style="color:var(--muted)">Remove</button></div>
    ${k.trail || c.kind === 'other' ? `<label class="cfield">${k.trail ? 'Trail name' : 'What was it?'}<input data-c="${i}" data-cf="title" value="${esc(c.title || '')}" maxlength="80" placeholder="${k.trail ? 'Optional' : 'Rowing class, elliptical…'}"></label>` : ''}
    <div class="cgrid">
      <label class="cfield">Distance (${k.unit})${inp('dist', 'decimal', 'Distance in ' + k.unit, 'placeholder="0"')}</label>
      <div class="cfield"><span>Time</span><div class="hms">${inp('h', 'numeric', 'Hours', 'placeholder="h" maxlength="2"')}<i>:</i>${inp('m', 'numeric', 'Minutes', 'placeholder="min" maxlength="3"')}<i>:</i>${inp('s', 'numeric', 'Seconds', 'placeholder="sec" maxlength="2"')}</div></div>
      ${k.elev ? `<label class="cfield">Elevation gain (ft)${inp('elev', 'numeric', 'Elevation gain in feet', 'placeholder="Optional"')}</label>` : ''}
      <label class="cfield">Avg heart rate${inp('hr', 'numeric', 'Average heart rate', 'placeholder="Optional" maxlength="3"')}</label>
    </div>
    <div class="cpace" id="cp-${i}">${cardioLive(c)}</div>
    <div class="effort"><span class="label">How it felt</span><div class="tagpick">${EFFORT.map((l, n) => `<button class="chip" data-act="cEffort" data-c="${i}" data-id="${n + 1}" aria-pressed="${c.effort === n + 1}">${l}</button>`).join('')}</div></div>
  </section>`;
}
// Pace (or speed) under a cardio block, plus any PR it would set, updated as you type.
function cardioLive(c) {
  const a = blockToActivity(c);
  if (!a.duration_s) return '<span class="muted">Enter the time to log this one.</span>';
  const pace = fmtPace(c.kind, a.distance_m, a.duration_s);
  return (pace ? `<span>${CARDIO[c.kind] && CARDIO[c.kind].speed ? 'Avg speed' : 'Pace'} <b>${pace}</b></span>` : '') +
    detectCardio(a, S.ahist || []).map(t => `<span class="pr">▲ PR · ${esc(t)}</span>`).join('');
}
const KIND_NAME = { normal: 'working set', warmup: 'warm-up', drop: 'drop set' };
// Warm-ups show W and drop sets D; working sets are numbered 1, 2, 3 without counting either.
function setLabel(sets, j) {
  const k = sets[j].kind;
  if (KIND_TAG[k]) return KIND_TAG[k];
  return sets.slice(0, j + 1).filter(x => !KIND_TAG[x.kind]).length;
}
function prLive(ex, s) { return s.done && s.kind !== 'warmup' ? detect(ex, s.w, s.r).map(t => `<span>▲ PR · ${esc(t)}</span>`).join('') : ''; }
function elapsed() {
  if (!S.workout || S.workout.imported) return '';
  const sec = Math.floor((Date.now() - S.workout.started) / 1000);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec % 60).padStart(2, '0');
}
function summaryScreen() {
  const s = S.summary; const w = S.workout;
  const onlyCardio = !s.sets && !s.warm && s.cardio.length;
  const mins = w.imported || onlyCardio ? s.cardio.reduce((t, x) => t + x.a.duration_s, 0) / 60 : (Date.now() - w.started) / 60000;
  const facts = [esc(w.title)];
  if (onlyCardio && s.cardio.length === 1) facts.push(...cardioStats(s.cardio[0].a).slice(0, 3).map(esc));
  else {
    facts.push(Math.max(1, Math.round(mins)) + ' min');
    if (s.sets || s.warm) facts.push(`${s.sets} set${s.sets === 1 ? '' : 's'}${s.warm ? ` + ${s.warm} warm-up` : ''}`, `${num(s.vol)} lb volume`);
    s.cardio.forEach(x => facts.push(esc([x.a.distance_m > 0 ? fmtDist(x.a.kind, x.a.distance_m) : fmtDur(x.a.duration_s), cLabel(x.a.kind).toLowerCase()].join(' '))));
  }
  const liftPr = s.groups.some(g => !g.cardio);
  return `<header class="top"><button class="icon-btn" data-act="unfinish" aria-label="Back to workout">${ICON.back}</button><h2>Share session</h2></header>
    <div class="done-hero"><h3>${s.prs ? `${s.prs} new PR${s.prs > 1 ? 's' : ''}` : onlyCardio && s.cardio.length === 1 ? cLabel(s.cardio[0].a.kind) + ' logged' : 'Workout logged'}</h3>
      <p>${facts.join(' · ')}</p></div>
    ${s.groups.length ? `<div class="found">${s.groups.map(g => g.cardio ? `<div class="found-item">
        <div class="found-top"><b>${esc(cLabel(g.a.kind))}${g.a.title ? ' · ' + esc(g.a.title) : ''}</b><span>${esc(cardioStats(g.a).slice(0, 2).join(' · '))}</span></div>
        <div class="types">${g.types.map(t => { const v = cardioPr(g.a, t); return `<span class="pr-badge">${ICON.trophy}${esc(t)} · ${esc(v.val)}${v.unit === 'mi' || v.unit === 'ft' ? ' ' + v.unit : ''}</span>`; }).join('')}</div></div>` : `<div class="found-item">
        <div class="found-top"><b>${esc(exName(g.ex))}</b><span>${wt(g.ex, g.w)} × ${g.r}</span></div>
        <div class="types">${g.types.map(t => `<span class="pr-badge">${ICON.trophy}${esc(t)}</span>`).join('')}</div></div>`).join('')}</div>` : ''}
    <div class="section-pad">
      <span class="label">${liftPr ? 'Proof: photo or video of the PR set' : s.groups.length ? 'Proof: a photo from it or a screenshot of your watch' : 'Photo or video (optional)'}</span>
      ${s.file ? `${s.file.kind === 'video' ? `<video class="media-preview" src="${s.file.preview}" controls playsinline></video>` : `<img class="media-preview" src="${s.file.preview}" alt="">`}
        <button class="btn sm" data-act="clearMedia">Remove</button>` : '<button class="btn primary" data-act="pickMedia">Add photo or video</button><span class="when" style="padding:0">Videos up to 60 seconds.</span>'}
      <span class="label">Post as</span>
      <div class="seg">${['PR', onlyCardio ? 'Cardio' : 'Workout'].map(c => `<button data-act="sumCat" data-id="${c}" aria-pressed="${s.cat === c}" ${c === 'PR' && !s.groups.length ? 'disabled' : ''}>${c} post</button>`).join('')}</div>
      <label class="label" for="sumcap">Caption</label>
      <textarea class="field" id="sumcap" maxlength="2000" placeholder="How did it feel?">${esc(s.caption)}</textarea>
      <span class="label">Who sees it</span>
      <div class="seg">${[['public', 'Followers and Explore'], ['private', 'Only me']].map(([k, l]) => `<button data-act="sumVis" data-id="${k}" aria-pressed="${s.vis === k}">${l}</button>`).join('')}</div>
      ${S.busy ? '<div class="upload-bar"><i></i></div>' : ''}
      <button class="btn primary block" data-act="save" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Saving…' : s.vis === 'public' ? 'Share' : 'Save to my log'}</button>
    </div>`;
}

/* ---------- Sheets ---------- */
function exListHtml(text) {
  const keys = searchEx(text); const t = text.trim();
  const inWk = new Set((S.workout ? S.workout.ex : []).map(e => e.id));
  const rows = keys.map(k => `<button data-act="pickEx" data-id="${esc(k)}"><b>${esc(exName(k))}</b><span>${EX[k].status === 'pending' ? 'Only you until approved · ' : ''}${inWk.has(k) ? 'In this workout · ' : ''}${esc(EX[k].grp)}</span></button>`).join('');
  const create = S.legacy || !t ? '' : `<button class="ex-create" data-act="newEx"><b>+ Create "${esc(t)}"</b><span>Not on the list? Add it and everyone can use it.</span></button>`;
  if (!keys.length) return `<p class="ex-none">No exercise matches "${esc(t)}".</p>` + create;
  // Offer "Create" under the results unless a name already starts with what was typed.
  return rows + (t && !keys.some(k => exIndex(k).key.startsWith(exKey(t))) ? create : '');
}
let lastSheet = null;
function sheetHtml() {
  const sh = S.sheet; if (!sh) { lastSheet = null; return ''; }
  let inner = '';
  if (sh.type === 'postMenu') {
    const p = findPost(sh.id); const own = p && p.user_id === S.me.id;
    inner = `<h3>Post</h3>${own || S.me.is_admin ? `<button class="opt" data-act="delPost" data-id="${sh.id}" style="color:var(--pr)">Delete post</button>` : ''}
      ${own ? '' : ['Off-topic: not about health or fitness', 'Unsafe health advice', 'Harassment or hate', 'Spam or selling'].map(r => `<button class="opt" data-act="doReport" data-id="${esc(r)}">Report: ${esc(r)}</button>`).join('')}
      <button class="btn block" data-act="closeSheet">Cancel</button>`;
  } else if (sh.type === 'compose') {
    const flagged = OFFTOPIC.test(sh.caption || '');
    inner = `<h3>New post</h3><p>Every post picks a health category. Workouts and PRs are posted from the Log tab so they carry your sets.</p>
      <div class="chips" style="padding:0">${POST_CATS.map(c => `<button class="chip" data-act="ccat" data-id="${c}" aria-pressed="${sh.cat === c}">${c}</button>`).join('')}</div>
      <label class="label" for="ccap">Caption</label>
      <textarea class="field" id="ccap" maxlength="2000" placeholder="Share a meal, a check-in, a tip…">${esc(sh.caption || '')}</textarea>
      <div class="warn" id="cwarn" ${flagged ? '' : 'hidden'}>This looks off-topic for Vigor. If you post it, it will be held for review before anyone sees it.</div>
      ${sh.file ? `${sh.file.kind === 'video' ? `<video class="media-preview" src="${sh.file.preview}" controls playsinline></video>` : `<img class="media-preview" src="${sh.file.preview}" alt="">`}<button class="btn sm" data-act="cclear">Remove</button>`
        : '<button class="btn" data-act="cpick">Add photo or video</button>'}
      ${S.busy ? '<div class="upload-bar"><i></i></div>' : ''}
      <button class="btn primary block" data-act="cpost" ${sh.cat && !S.busy ? '' : 'disabled'}>${S.busy ? 'Posting…' : sh.cat ? 'Post to ' + sh.cat : 'Pick a category to post'}</button>`;
  } else if (sh.type === 'addEx') {
    inner = `<div class="ex-top"><h3>Add exercise</h3>
      <div class="search-row"><input class="field" id="exq" type="search" placeholder="Search ${pickable().length} exercises" value="${esc(sh.q || '')}" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" aria-label="Search exercises">
      ${S.legacy ? '' : '<button class="btn sm" data-act="newEx">+ New</button>'}</div></div>
      <div class="exlist" id="exlist">${exListHtml(sh.q || '')}</div>`;
  } else if (sh.type === 'newEx') {
    inner = `<h3>New exercise</h3>
      <label class="label" for="nxname">Name</label>
      <input class="field" id="nxname" maxlength="40" value="${esc(sh.name)}" placeholder="For example: Cable lateral raise" autocomplete="off">
      <span class="label">Muscle group</span>
      <div class="tagpick">${EXGROUPS.map(g => `<button type="button" class="chip" data-act="nxGrp" data-id="${g}" aria-pressed="${sh.grp === g}">${g}</button>`).join('')}</div>
      <span class="label">How you enter weight</span>
      <div class="seg">${[['0', 'Weight lifted'], ['1', 'Added to bodyweight']].map(([k, l]) => `<button data-act="nxAdded" data-id="${k}" aria-pressed="${!!sh.added === (k === '1')}">${l}</button>`).join('')}</div>
      <p>Vigor checks every new name. Clear exercise names join the shared list for everyone right away. Anything unclear is yours to use now and joins the list once a moderator approves it.</p>
      ${sh.err ? `<p class="err">${esc(sh.err)}</p>` : ''}
      <button class="btn primary block" data-act="nxSave" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Adding…' : 'Add exercise'}</button>
      <button class="btn block" data-act="addEx">Back to the list</button>`;
  } else if (sh.type === 'setKind') {
    const set = S.workout && S.workout.ex[sh.ex] && S.workout.ex[sh.ex].sets[sh.set]; if (!set) { S.sheet = null; return ''; }
    const cur = set.kind || 'normal';
    inner = `<h3>Set type</h3>
      ${[['normal', 'Working set', 'Counts toward PRs and volume.'], ['warmup', 'Warm-up (W)', 'Logged, but never counts toward PRs, history or volume.'], ['drop', 'Drop set (D)', 'A lighter set straight after a working set. Counts like any other set.']]
        .map(([k, l, d]) => `<button class="opt kind-opt" data-act="setKindPick" data-id="${k}" aria-pressed="${cur === k}"><b>${l}</b><span>${d}</span></button>`).join('')}
      <button class="opt" data-act="rmSet" style="color:var(--pr)">Remove this set</button>`;
  } else if (sh.type === 'cardioKind') {
    inner = `<h3>Log cardio</h3><p>Type in the distance and time from your watch, treadmill or bike computer.</p>
      ${Object.entries(CARDIO).map(([k, c]) => `<button class="opt kind-opt" data-act="addCardio" data-id="${k}"><b>${c.label}</b><span>${CARDIO_HINT[k]}</span></button>`).join('')}
      ${NATIVE() ? `<button class="opt" data-act="healthImport">${ICON.heart} Import from ${esc(NATIVE().healthName)} instead</button>` : ''}`;
  } else if (sh.type === 'health') {
    const name = NATIVE() ? NATIVE().healthName : 'Health';
    const when = x => new Date(x.start).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    inner = `<h3>Import from ${esc(name)}</h3>${sh.err ? `<p class="err">${esc(sh.err)}</p>${sh.code === 'denied' ? `<button class="btn block" data-act="healthSettings">Open ${esc(name)} settings</button>` : ''}<button class="btn block" data-act="healthImport">Try again</button>`
      : !sh.list ? loading()
      : sh.list.length ? `<p>Workouts from the last 30 days. Tap one to add it, then check the numbers before you save.</p>
        <div class="exlist">${sh.list.map((x, i) => `<button data-act="healthPick" data-id="${i}" ${x.done ? 'disabled' : ''}><b>${esc([x.kind === 'other' && x.activityName ? x.activityName : cLabel(x.kind), x.distance_m > 0 ? fmtDist(x.kind, x.distance_m) : fmtDur(x.duration_s)].join(' · '))}</b>
          <span>${esc([when(x), x.distance_m > 0 ? fmtDur(x.duration_s) : '', x.done ? 'Already in Vigor' : x.sourceName || ''].filter(Boolean).join(' · '))}</span></button>`).join('')}</div>`
      : `<p>No workouts in ${esc(name)} from the last 30 days.</p>${sh.hint ? `<p>${esc(sh.hint)}</p><button class="btn block" data-act="healthSettings">Open settings</button>` : ''}`}`;
  } else if (sh.type === 'likers') {
    const p = findPost(sh.id);
    inner = `<h3>Likes</h3>${!p ? '' : sh.ready ? `<div class="sheet-people">${[...p.likers].reverse().map(peopleRow).join('')}</div>` : loading()}`;
  } else if (sh.type === 'noproof') {
    inner = `<h3>${esc(exName(sh.ex))}</h3><p>This PR has no photo or video yet. Next time you beat it, add proof when you share the session and the plate will link to that post.</p><button class="btn block" data-act="closeSheet">Close</button>`;
  } else if (sh.type === 'discard') {
    inner = `<h3>Discard workout?</h3><p>Your sets from this session will be deleted.</p>
      <button class="btn danger block" data-act="discardYes">Discard</button><button class="btn block" data-act="closeSheet">Keep logging</button>`;
  } else if (sh.type === 'delPost') {
    inner = `<h3>Delete post?</h3><p>The post, its reactions and comments are removed. Logged sets stay in your history.</p>
      <button class="btn danger block" data-act="delPostYes" data-id="${sh.id}">Delete</button><button class="btn block" data-act="closeSheet">Cancel</button>`;
  } else if (sh.type === 'feedback') {
    inner = `<h3>Send feedback</h3><p>What's confusing, broken or missing? It goes straight to the people building Vigor.</p>
      <textarea class="field" id="fbtext" maxlength="4000" placeholder="Tell us what happened or what you wish Vigor did" style="min-height:120px"></textarea>
      <button class="btn primary block" data-act="sendFeedback" ${S.busy ? 'disabled' : ''}>Send</button>`;
  } else if (sh.type === 'meMenu') {
    inner = `<h3>Account</h3><button class="opt" data-act="editProfile">Edit profile</button><button class="opt" data-act="feedback">Send feedback</button>
      ${S.me.is_admin ? '<button class="opt" data-act="admin">Admin: invites, moderation and feedback</button>' : ''}
      <button class="opt" data-act="signout">Sign out</button><p>Vigor trial v${VERSION}</p>`;
  } else if (sh.type === 'changeCode') {
    inner = `<h3>Change invite code</h3><input class="field" id="newcode" maxlength="40" value="${esc(S.data.admin && S.data.admin.code || '')}" autocapitalize="none">
      <button class="btn primary block" data-act="saveCode">Save code</button>`;
  }
  const anim = lastSheet !== sh; lastSheet = sh;
  return `<div class="sheet-wrap" data-act="closeSheet"><div class="sheet ${anim ? 'anim' : ''} ${sh.type === 'addEx' || sh.type === 'health' ? 'tall' : ''}" role="dialog" aria-modal="true"><span class="grab"></span>${inner}</div></div>`;
}
function postCopies(id) {
  const out = [];
  for (const k of ['feed', 'explore']) (S.data[k] || []).forEach(x => x.id === id && out.push(x));
  if (S.data['post:' + id]) out.push(S.data['post:' + id]);
  return out.filter(x => x.react);
}
function findPost(id) {
  for (const k of ['feed', 'explore']) { const p = (S.data[k] || []).find(x => x.id === id); if (p) return p; }
  if (S.data['post:' + id]) return S.data['post:' + id];
  for (const k of Object.keys(S.data)) if (k.startsWith('profile:')) { const p = S.data[k].posts.find(x => x.id === id); if (p) return p; }
  return null;
}

/* ---------- Render ---------- */
function currentScreen() {
  const t = S.stack[S.stack.length - 1];
  if (t) {
    if (t.type === 'post') return postScreen(t.id);
    if (t.type === 'profile') return profileScreen(t.id);
    if (t.type === 'people') return peopleScreen(t.id, t.which);
    if (t.type === 'editProfile') return editProfileScreen();
    if (t.type === 'admin') return adminScreen();
  }
  if (S.tab === 'feed') return feedScreen();
  if (S.tab === 'explore') return exploreScreen();
  if (S.tab === 'log') return logScreen();
  return profileScreen(S.me.id);
}
function screenName() { const t = S.stack[S.stack.length - 1]; return t ? t.type : S.tab; }
function render(keepScroll) {
  const y = window.scrollY;
  const app = $('#app');
  if (S.view === 'loading') { app.className = 'app no-tabs'; app.innerHTML = '<div class="auth"><span class="brand">VIGOR</span><p class="tagline">Loading…</p></div>'; }
  else if (S.view === 'setup') { app.className = 'app no-tabs'; app.innerHTML = `<div class="auth"><span class="brand">VIGOR</span><p class="tagline">This copy of Vigor isn't connected to a database yet. Add your Supabase project URL and anon key to config.js.</p></div>`; }
  else if (S.view === 'auth') { app.className = 'app no-tabs'; app.innerHTML = authScreen(); }
  else if (S.view === 'onboard') { app.className = 'app no-tabs'; app.innerHTML = onboardScreen(); }
  else {
    app.className = 'app';
    app.innerHTML = currentScreen() + `<nav class="tabbar">${[['feed', 'Feed', ICON.feed], ['explore', 'Explore', ICON.explore], ['log', 'Log', ICON.log], ['me', 'Profile', ICON.me]].map(([k, l, ic]) =>
      `<button data-act="tab" data-id="${k}" aria-current="${S.tab === k && !S.stack.length}">${ic}${l}${k === 'log' && S.workout ? '<span class="live"></span>' : ''}</button>`).join('')}</nav>`;
  }
  $('#sheet').innerHTML = S.view === 'app' ? sheetHtml() : '';
  renderRest();
  window.scrollTo(0, keepScroll ? y : 0);
}
function renderRest() {
  const el = $('#rest');
  if (!S.rest || S.view !== 'app' || S.tab !== 'log' || S.stack.length || S.summary) { el.innerHTML = ''; return; }
  const left = Math.max(0, Math.ceil((S.rest.end - Date.now()) / 1000));
  el.innerHTML = `<div class="rest"><span class="t">${left ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'Go'}</span>
    <span class="track"><i style="width:${left / S.rest.total * 100}%"></i></span>
    <button data-act="rest" data-id="-15">−15</button><button data-act="rest" data-id="15">+15</button><button data-act="rest" data-id="skip">Skip</button></div>`;
}
setInterval(() => {
  const el = document.getElementById('elapsed'); if (el) el.textContent = elapsed();
  if (S.rest) {
    const left = S.rest.end - Date.now();
    if (left <= 0 && !S.rest.buzzed) { S.rest.buzzed = true; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (_) {} }
    if (left < -3000) S.rest = null;
    renderRest();
  }
}, 1000);

/* ---------- Navigation ---------- */
async function show(fn) { render(true); try { await fn(); } catch (e) { fail(e); } render(true); }
function go(tab) {
  S.tab = tab; S.stack = []; S.sheet = null; S.gridFilter = 'All';
  render();
  const loaders = { feed: loadFeed, explore: loadExplore, me: () => loadProfile(S.me.id), log: async () => { if (S.workout) await Promise.all([...S.workout.ex.map(e => loadHist(e.id)), (S.workout.cardio || []).length ? loadCardioHist() : null]); } };
  if (loaders[tab]) loaders[tab]().then(() => render(true)).catch(fail);
}
function push(entry, loader) { S.stack.push(entry); S.sheet = null; render(); if (loader) loader().then(() => render(true)).catch(fail); }
function saveWorkout() { store.set('vigor.workout', S.workout); }
// Adds a cardio block to the open workout, starting one named after the time of day if none is open.
async function addCardioBlock(block, when, imported, name) {
  S.sheet = null;
  const fresh = !S.workout;
  if (fresh) S.workout = { title: `${dayPart(when)} ${(name || (block.kind === 'other' ? 'cardio' : cLabel(block.kind))).toLowerCase()}`, started: imported ? +when : Date.now(), ex: [], imported };
  (S.workout.cardio || (S.workout.cardio = [])).push(block);
  const i = S.workout.cardio.length - 1;
  saveWorkout(); render(!fresh);
  try { await loadCardioHist(); } catch (e) { fail(e); }
  render(true);
  if (!fresh) window.scrollTo(0, document.body.scrollHeight);
  if (!imported) { const f = document.querySelector(`[data-c="${i}"][data-cf="dist"]`); if (f) f.focus(); }
}

/* ---------- Media ---------- */
const filepick = document.createElement('input');
filepick.type = 'file'; filepick.accept = 'image/*,video/*'; filepick.hidden = true; document.body.appendChild(filepick);
let pickFor = null;
function pick(target) { pickFor = target; filepick.accept = target === 'avatar' ? 'image/*' : 'image/*,video/*'; filepick.value = ''; filepick.click(); }
filepick.addEventListener('change', async () => {
  const f = filepick.files[0]; if (!f) return;
  if (pickFor === 'avatar') { setAvatar(f); return; }
  try {
    const file = await prepareMedia(f);
    if (S.sheet && S.sheet.type === 'compose') S.sheet.file = file;
    else if (S.summary) S.summary.file = file;
    render(true);
  } catch (e) { fail(e); }
});
async function prepareMedia(f) {
  if (f.type.startsWith('video')) {
    if (f.size > 50 * 1024 * 1024) throw new Error('That video is over 50 MB. Trim it to 60 seconds or less and try again.');
    const url = URL.createObjectURL(f);
    const dur = await new Promise(res => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration); v.onerror = () => res(0); v.src = url; });
    if (dur > 61) throw new Error('Videos can be up to 60 seconds. Trim it in your Photos app and try again.');
    return { kind: 'video', blob: f, ext: (f.name.split('.').pop() || 'mp4').toLowerCase(), type: f.type || 'video/mp4', preview: url };
  }
  let blob = f, type = f.type || 'image/jpeg', ext = 'jpg';
  try {
    const bmp = await createImageBitmap(f);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85)); type = 'image/jpeg';
  } catch (_) { ext = (f.name.split('.').pop() || 'jpg').toLowerCase(); }
  if (blob.size > 50 * 1024 * 1024) throw new Error('That photo is too large. Try a smaller one.');
  return { kind: 'photo', blob, ext, type, preview: URL.createObjectURL(blob) };
}
// Profile photos: cropped to a centered square, 400px, JPEG, stored in the person's own media folder.
async function squarePhoto(f) {
  let img;
  try { img = await createImageBitmap(f); } catch (_) {
    img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That photo could not be read. Try a different one.')); i.src = URL.createObjectURL(f); });
  }
  const w = img.width, h = img.height, side = Math.min(w, h), out = Math.min(400, side);
  const c = document.createElement('canvas'); c.width = c.height = out;
  c.getContext('2d').drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out);
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
}
async function setAvatar(f) {
  if (!f.type.startsWith('image')) { toast('Pick a photo, not a video, for your profile picture'); return; }
  readEp(); S.avatarBusy = true; render(true);
  try {
    const blob = await squarePhoto(f);
    const path = `${S.me.id}/avatar-${Date.now()}.jpg`;
    const { error } = await sb.storage.from('media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const old = S.me.avatar_path;
    const rows = await q(sb.from('profiles').update({ avatar_path: path }).eq('id', S.me.id).select());
    S.me = rows[0]; S.profiles[S.me.id] = S.me;
    if (old) sb.storage.from('media').remove([old]).catch(() => {});
    toast('Profile photo updated');
  } catch (e) { fail(e); }
  S.avatarBusy = false; render(true);
}
function readEp() {
  const v = id => (document.getElementById(id) || {}).value;
  if (v('ep-name') === undefined) return;
  S.epDraft = { name: v('ep-name'), bio: v('ep-bio'), goal_label: v('ep-goal'), goal_ex: v('ep-goalex') || null, goal_target: v('ep-target') };
}
function findComment(id) {
  for (const k of Object.keys(S.data)) {
    if (!k.startsWith('post:') || !S.data[k] || !S.data[k].comments) continue;
    const c = S.data[k].comments.find(x => x.id === id); if (c) return [S.data[k], c];
  }
  return [null, null];
}
async function upload(file) {
  const path = `${S.me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.ext}`;
  const { error } = await sb.storage.from('media').upload(path, file.blob, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/* ---------- Reactions and likes ---------- */
async function setReaction(id, k, on) {
  const copies = postCopies(id); if (!copies.length || !!copies[0].mine[k] === on) return;
  const apply = v => copies.forEach(p => {
    p.mine[k] = v; p.react[k] += v ? 1 : -1;
    if (k === 'like') p.likers = v ? [...p.likers, S.me.id] : p.likers.filter(u => u !== S.me.id);
  });
  apply(on); render(true);
  try {
    if (on) await q(sb.from('reactions').insert({ post_id: id, user_id: S.me.id, kind: k }));
    else await q(sb.from('reactions').delete().match({ post_id: id, user_id: S.me.id, kind: k }));
  } catch (e) { apply(!on); render(true); fail(e); }
}
// Double-tap a post's photo to like it, like Instagram. A single tap still opens the post, a moment later.
const tap = { id: null, at: 0, timer: null };
function onTap(el, ev) {
  ev.preventDefault();
  const id = el.dataset.id, t = Date.now();
  if (tap.id === id && t - tap.at < 300) { clearTimeout(tap.timer); tap.id = null; likeBurst(id); return; }
  clearTimeout(tap.timer); tap.id = id; tap.at = t;
  const act = el.dataset.act;
  tap.timer = setTimeout(() => { tap.id = null; if (act && A[act]) A[act](id, el, ev); }, 300);
}
function likeBurst(id) {
  setReaction(id, 'like', true);
  const media = document.querySelector(`[data-dbl][data-id="${id}"]`); if (!media) return;
  const box = media.classList.contains('media') ? media : media.querySelector('.media'); if (!box) return;
  const b = document.createElement('span'); b.className = 'burst'; b.innerHTML = ICON.heart; box.appendChild(b);
  setTimeout(() => b.remove(), 900);
  try { navigator.vibrate && navigator.vibrate(12); } catch (_) {}
}

/* ---------- Actions ---------- */
const A = {
  authMode(id) { S.authMode = id; S.authMsg = ''; S.authErr = false; render(); },
  tab(id) { go(id); },
  back() { S.stack.pop(); render(); const t = S.stack[S.stack.length - 1]; if (!t && S.tab === 'me') loadProfile(S.me.id).then(() => render(true)).catch(fail); },
  open(id) { push({ type: 'post', id }, () => loadPost(id)); },
  profile(id) { if (id === S.me.id) { go('me'); return; } S.gridFilter = 'All'; push({ type: 'profile', id }, () => loadProfile(id)); },
  people(id, el) {
    const [u, which] = id.split(':'); const t = S.stack[S.stack.length - 1];
    const load = async () => { await loadFollows(); await ensureProfiles([...followersOf(u), ...followsOf(u)]); };
    if (el.dataset.swap && t && t.type === 'people') { t.which = which; render(true); } else push({ type: 'people', id: u, which }, load);
  },
  react(id, el) { const p = findPost(id); if (p) setReaction(id, el.dataset.k, !p.mine[el.dataset.k]); },
  like(id) { const p = findPost(id); if (p) setReaction(id, 'like', !p.mine.like); },
  async likers(id) {
    const p = findPost(id); if (!p) return;
    S.sheet = { type: 'likers', id, ready: false }; render(true);
    try { await ensureProfiles(p.likers); } catch (e) { fail(e); }
    if (S.sheet && S.sheet.type === 'likers') { S.sheet.ready = true; render(true); }
  },
  async follow(id) {
    const on = !iFollow(id);
    if (on) S.follows.push({ follower: S.me.id, followee: id }); else S.follows = S.follows.filter(f => !(f.follower === S.me.id && f.followee === id));
    render(true);
    try {
      if (on) await q(sb.from('follows').insert({ follower: S.me.id, followee: id }));
      else await q(sb.from('follows').delete().match({ follower: S.me.id, followee: id }));
      if (on) toast(`Following ${handle(id)}. Their posts now show in your feed.`);
    } catch (e) { await loadFollows(); render(true); fail(e); }
  },
  copy(id) {
    const p = findPost(id); if (!p) return;
    const ex = [...new Set(p.sets.map(s => s.ex))];
    const mine = store.get('vigor.templates', []); mine.unshift({ name: p.wtitle, ex, from: handle(p.user_id) }); store.set('vigor.templates', mine.slice(0, 20));
    toast(`Saved "${p.wtitle}" to your templates on this phone`);
  },
  postMenu(id) { S.sheet = { type: 'postMenu', id }; render(true); },
  async doReport(reason) {
    const id = S.sheet.id; S.sheet = null; render(true);
    try { await q(sb.from('reports').insert({ post_id: id, user_id: S.me.id, reason })); toast('Reported. A moderator will review it.'); } catch (e) { fail(e); }
  },
  delPost(id) { S.sheet = { type: 'delPost', id }; render(true); },
  async delPostYes(id) {
    S.sheet = null;
    try {
      const p = findPost(id);
      await q(sb.from('posts').delete().eq('id', id));
      if (p && p.media_path && p.user_id === S.me.id) await sb.storage.from('media').remove([p.media_path]);
      toast('Post deleted');
      if (S.stack.length && S.stack[S.stack.length - 1].id === id) S.stack.pop();
      go(S.tab);
    } catch (e) { fail(e); }
  },
  async vote(id, el) {
    const [, c] = findComment(id); if (!c) return;
    const v = +el.dataset.v, prev = c.vote, next = prev === v ? 0 : v;
    const apply = (from, to) => { if (from === 1) c.up--; if (from === -1) c.down--; if (to === 1) c.up++; if (to === -1) c.down++; c.vote = to; };
    apply(prev, next); render(true);
    try {
      if (!next) await q(sb.from('comment_votes').delete().match({ comment_id: id, user_id: S.me.id }));
      else await q(sb.from('comment_votes').upsert({ comment_id: id, user_id: S.me.id, value: next }, { onConflict: 'comment_id,user_id' }));
    } catch (e) { apply(next, prev); render(true); fail(e); }
  },
  replyTo(id) {
    const [p, c] = findComment(id); if (!c) return;
    const inp = $('#cmt'); const typed = inp ? inp.value.trim() : '';
    const tag = c.user_id === S.me.id ? '' : handle(c.user_id) + ' ';
    S.replyTo = { post: p.id, id, handle: handle(c.user_id) };
    S.cdraft = { post: p.id, text: typed && !/^@\S+\s*$/.test(typed) ? typed : tag };
    render(true);
    const f = $('#cmt'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
  },
  cancelReply() { S.replyTo = null; if (S.cdraft && /^@\S+\s*$/.test(S.cdraft.text)) S.cdraft = null; render(true); },
  async profileByHandle(h) {
    let u = Object.values(S.profiles).find(p => String(p.handle).toLowerCase() === h);
    if (!u) { try { const rows = await q(sb.from('profiles').select('*').eq('handle', h)); u = rows[0]; if (u) S.profiles[u.id] = u; } catch (e) { fail(e); return; } }
    if (u) A.profile(u.id); else toast(`No one is called @${h}`);
  },
  pickAvatar() { readEp(); pick('avatar'); },
  async rmAvatar() {
    readEp(); const old = S.me.avatar_path; if (!old) return;
    try {
      const rows = await q(sb.from('profiles').update({ avatar_path: null }).eq('id', S.me.id).select());
      S.me = rows[0]; S.profiles[S.me.id] = S.me; render(true);
      sb.storage.from('media').remove([old]).catch(() => {});
      toast('Profile photo removed');
    } catch (e) { fail(e); }
  },
  async delComment(id) {
    try { await q(sb.from('comments').delete().eq('id', id)); S.replyTo = null; const t = S.stack[S.stack.length - 1]; await loadPost(t.id); render(true); } catch (e) { fail(e); }
  },
  gridf(id) { S.gridFilter = id; render(true); },
  esort(id) { S.esort = id; render(true); },
  clearSearch() { S.pq = ''; S.presults = null; render(true); },
  ecat(id) { S.ecat = id; render(true); },
  noproof(ex) { S.sheet = { type: 'noproof', ex }; render(true); },
  feedback() { S.sheet = { type: 'feedback' }; render(true); setTimeout(() => $('#fbtext') && $('#fbtext').focus(), 60); },
  async sendFeedback() {
    const body = $('#fbtext').value.trim(); if (!body) { toast('Write something first'); return; }
    S.busy = true;
    try {
      await q(sb.from('feedback').insert({ user_id: S.me.id, body, screen: screenName(), app_version: VERSION, device: navigator.userAgent.slice(0, 300) }));
      S.sheet = null; toast('Thanks. Your feedback was sent.');
    } catch (e) { fail(e); }
    S.busy = false; render(true);
  },
  meMenu() { S.sheet = { type: 'meMenu' }; render(true); },
  editProfile() { S.epTags = null; S.epDraft = null; S.sheet = null; push({ type: 'editProfile' }); },
  epTag(t) { readEp(); const tags = S.epTags || [...S.me.tags]; S.epTags = tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]; render(true); },
  admin() { S.sheet = null; push({ type: 'admin' }, loadAdmin); },
  async copyInvite() {
    const t = $('#invite-msg');
    try { await navigator.clipboard.writeText(t.value); toast('Invite copied. Paste it into a text or email.'); } catch (_) { t.select(); toast('Selected. Copy it from the box.'); }
  },
  changeCode() { S.sheet = { type: 'changeCode' }; render(true); },
  async saveCode() {
    try { const code = await q(sb.rpc('set_invite_code', { p_code: $('#newcode').value })); S.data.admin.code = code; S.sheet = null; render(true); toast('Invite code changed'); } catch (e) { fail(e); }
  },
  async modOk(id, el) {
    try {
      const p = S.data.admin.held.find(x => x.id === id);
      if (p) await q(sb.from('posts').update({ status: 'visible' }).eq('id', id));
      if (el.dataset.r) await q(sb.from('reports').update({ resolved: true }).eq('id', el.dataset.r));
      await loadAdmin(); render(true); toast(p ? 'Approved and published' : 'Report closed, post kept');
    } catch (e) { fail(e); }
  },
  async modRm(id, el) {
    try {
      await q(sb.from('posts').update({ status: 'removed' }).eq('id', id));
      if (el.dataset.r) await q(sb.from('reports').update({ resolved: true }).eq('post_id', id));
      await loadAdmin(); render(true); toast('Post removed');
    } catch (e) { fail(e); }
  },
  async copyFeedback() {
    const d = S.data.admin;
    const txt = d.feedback.map(f => `[${new Date(f.created_at).toLocaleString()}] ${handle(f.user_id)} on ${f.screen} (v${f.app_version}${f.done ? ', done' : ''}): ${f.body}`).join('\n\n');
    try { await navigator.clipboard.writeText(txt); toast('All feedback copied'); } catch (_) { toast('Copy failed. Long-press to select the text instead.'); }
  },
  async fbDone(id) {
    const f = S.data.admin.feedback.find(x => x.id === id);
    try { await q(sb.from('feedback').update({ done: !f.done }).eq('id', id)); f.done = !f.done; render(true); } catch (e) { fail(e); }
  },
  install() { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; render(true); } },
  dismissInstall() { store.set('vigor.installDismissed', true); render(true); },
  async signout() { S.sheet = null; await sb.auth.signOut(); },
  obTag(t) { readOnboard(); const o = S.onboard; o.tags = o.tags.includes(t) ? o.tags.filter(x => x !== t) : [...o.tags, t]; render(true); },

  compose() { S.sheet = { type: 'compose', cat: null, caption: '', file: null }; render(true); },
  ccat(id) { S.sheet.caption = $('#ccap').value; S.sheet.cat = id; render(true); },
  cpick() { S.sheet.caption = $('#ccap').value; pick('compose'); },
  cclear() { S.sheet.caption = $('#ccap').value; S.sheet.file = null; render(true); },
  async cpost() {
    const sh = S.sheet; sh.caption = $('#ccap').value.trim(); if (!sh.cat || S.busy) return;
    if (!sh.caption && !sh.file) { toast('Add a caption or a photo first'); return; }
    S.busy = true; render(true);
    try {
      const path = sh.file ? await upload(sh.file) : null;
      const rows = await q(sb.from('posts').insert({ user_id: S.me.id, category: sh.cat, caption: sh.caption, media_path: path, media_kind: sh.file ? sh.file.kind : null }).select());
      S.sheet = null; S.busy = false;
      if (rows[0] && rows[0].status === 'held') toast('Held for review. It looks off-topic for Vigor.'); else toast('Posted');
      go('feed');
    } catch (e) { S.busy = false; render(true); fail(e); }
  },
  closeSheet(_, el, ev) { if (ev && el.classList.contains('sheet-wrap') && ev.target !== el) return; if (S.busy) return; S.sheet = null; render(true); },

  startEmpty() { S.workout = { title: 'Workout', started: Date.now(), ex: [] }; saveWorkout(); S.sheet = { type: 'addEx' }; render(); },
  async startTpl(key) {
    const t = key[0] === 'm' ? store.get('vigor.templates', [])[+key.slice(1)] : TEMPLATES[+key.slice(1)];
    S.workout = { title: t.name, started: Date.now(), ex: t.ex.map(id => ({ id, sets: [] })) };
    render();
    try { await Promise.all(t.ex.map(loadHist)); } catch (e) { fail(e); }
    S.workout.ex.forEach(e => { const h = S.hist[e.id] || []; const l = h[h.length - 1]; e.sets = [0, 1, 2].map(() => ({ w: l ? String(+l.weight) : '', r: l ? String(l.reps) : '', done: false })); });
    saveWorkout(); render();
  },
  addEx() {
    const back = S.sheet && S.sheet.type === 'newEx' ? S.sheet.name : '';
    S.sheet = { type: 'addEx', q: back }; render(true); setTimeout(() => $('#exq') && $('#exq').focus(), 60);
  },
  newEx() {
    const typed = S.sheet && S.sheet.type === 'addEx' ? (S.sheet.q || '').trim() : '';
    const name = typed ? typed.charAt(0).toUpperCase() + typed.slice(1) : '';
    S.sheet = { type: 'newEx', name, grp: null, added: false, err: '' }; render(true);
    setTimeout(() => { const f = $('#nxname'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 60);
  },
  nxGrp(g) { S.sheet.grp = g; S.sheet.err = ''; render(true); },
  nxAdded(v) { S.sheet.added = v === '1'; render(true); },
  async nxSave() {
    const sh = S.sheet; if (S.busy) return;
    const name = sh.name.replace(/\s+/g, ' ').trim(); sh.name = name;
    sh.err = screenExName(name) || (sh.grp ? '' : 'Pick the muscle group it works most.');
    if (sh.err) { render(true); return; }
    // Already on the list (built in, or added by someone): use that one instead of making a copy.
    const same = pickable().find(k => exIndex(k).key === exKey(name));
    if (same) { toast(`${exName(same)} is already on the list, so we added that.`); A.pickEx(same); return; }
    S.busy = true; render(true);
    try {
      const res = await q(sb.rpc('add_exercise', { p_name: name, p_group: sh.grp, p_added: !!sh.added }));
      const r = Array.isArray(res) ? res[0] : res;
      S.busy = false;
      if (r.status === 'rejected') { sh.err = 'A moderator already turned that name down. Pick one from the list or try a clearer name.'; render(true); return; }
      addCustomEx(r);
      if (r.status === 'pending') { const mine = store.get('vigor.myEx', []); if (!mine.includes(r.id)) store.set('vigor.myEx', [...mine, r.id]); }
      toast(r.status === 'pending' ? `${r.name} is ready for you to log. Everyone else sees it once a moderator approves it.`
        : r.created_by !== S.me.id ? `${r.name} is already on the list, so we added that.` : `${r.name} is now on the shared list for everyone.`);
      A.pickEx(r.id);
    } catch (e) { S.busy = false; sh.err = e.message || 'Could not add that exercise. Try again.'; render(true); }
  },
  async exReview(id, el) {
    const status = el.dataset.s;
    try {
      await q(sb.from('exercises').update({ status }).eq('id', id));
      if (EX[id]) EX[id].status = status;
      await loadAdmin(); render(true);
      toast(status === 'approved' ? 'Approved. It is on the shared list now.' : 'Removed from the shared list. Old posts still show its name.');
    } catch (e) { fail(e); }
  },
  setKind(_, el) { S.sheet = { type: 'setKind', ex: +el.dataset.ex, set: +el.dataset.set }; render(true); },
  setKindPick(k) {
    const sh = S.sheet; const set = S.workout.ex[sh.ex].sets[sh.set];
    if (k === 'normal') delete set.kind; else set.kind = k;
    S.sheet = null; saveWorkout(); render(true);
  },
  rmSet() { const sh = S.sheet; S.workout.ex[sh.ex].sets.splice(sh.set, 1); S.sheet = null; saveWorkout(); render(true); },
  async pickEx(id) {
    S.sheet = null; if (!S.workout) { render(true); return; }
    try { await loadHist(id); } catch (e) { fail(e); }
    const h = S.hist[id] || []; const l = h[h.length - 1];
    S.workout.ex.push({ id, sets: [0, 1, 2].map(() => ({ w: l ? String(+l.weight) : '', r: l ? String(l.reps) : '', done: false })) });
    saveWorkout(); render(true); window.scrollTo(0, document.body.scrollHeight);
  },
  rmEx(_, el) { S.workout.ex.splice(+el.dataset.ex, 1); saveWorkout(); render(true); },
  addSet(_, el) { const e = S.workout.ex[el.dataset.ex]; const l = e.sets[e.sets.length - 1] || { w: '', r: '' }; e.sets.push({ w: l.w, r: l.r, done: false }); saveWorkout(); render(true); },
  toggleSet(_, el) {
    const s = S.workout.ex[el.dataset.ex].sets[el.dataset.set];
    if (!s.done && !(+s.r > 0)) { toast('Enter reps first'); return; }
    s.done = !s.done;
    if (s.done) S.rest = { end: Date.now() + 120000, total: 120 };
    saveWorkout(); render(true);
  },
  rest(id) {
    if (id === 'skip') S.rest = null;
    else { S.rest.end += +id * 1000; S.rest.buzzed = false; S.rest.total = Math.max(S.rest.total, Math.ceil((S.rest.end - Date.now()) / 1000)); }
    renderRest();
  },
  discard() { S.sheet = { type: 'discard' }; render(true); },
  discardYes() { S.workout = null; S.rest = null; S.sheet = null; saveWorkout(); render(); toast('Workout discarded'); },
  startCardio() { S.sheet = { type: 'cardioKind' }; render(true); },
  addCardio(kind) { addCardioBlock({ kind }, new Date(), false); },
  rmCardio(_, el) { S.workout.cardio.splice(+el.dataset.c, 1); saveWorkout(); render(true); },
  cEffort(id, el) { const c = S.workout.cardio[+el.dataset.c]; c.effort = c.effort === +id ? null : +id; saveWorkout(); render(true); },
  async healthImport() {
    const nat = NATIVE(); if (!nat) return;
    S.sheet = { type: 'health' }; render(true);
    try {
      const src = nat.platform === 'ios' ? 'apple_health' : 'health_connect';
      const [res] = await Promise.all([nat.call('health.workouts', { days: 30 }), loadCardioHist()]);
      const have = new Set([...(S.ahist || []), ...((S.workout && S.workout.cardio) || [])].filter(h => h.source === src && h.external_id).map(h => h.external_id));
      const list = (res && res.workouts || []).filter(x => x && x.id && x.duration_s > 0)
        .map(x => ({ ...x, id: String(x.id), kind: CARDIO[x.kind] ? x.kind : 'other', done: have.has(String(x.id)) }))
        .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
      if (S.sheet && S.sheet.type === 'health') S.sheet = { type: 'health', list, src, hint: res && res.hint };
    } catch (e) { if (S.sheet && S.sheet.type === 'health') S.sheet = { type: 'health', err: (e && e.message) || 'Could not read your workouts.', code: e && e.code }; }
    render(true);
  },
  healthSettings() { if (NATIVE()) NATIVE().call('health.settings').catch(fail); },
  healthPick(i) {
    const sh = S.sheet; const x = sh && sh.list && sh.list[+i]; if (!x || x.done) return;
    const k = CARDIO[x.kind]; const d = Math.round(x.duration_s);
    const dist = x.distance_m > 0 ? x.distance_m / UNIT_M[k.unit] : 0;
    const txt = dist ? String(k.unit === 'mi' ? +dist.toFixed(2) : Math.round(dist)) : '';
    const elev = x.elevation_m > 0 ? String(Math.round(x.elevation_m / FT)) : '';
    addCardioBlock({
      kind: x.kind, title: k.trail || x.kind === 'other' ? String(x.title || (x.kind === 'other' && x.activityName) || '').slice(0, 80) : '',
      dist: txt, exact_m: x.distance_m > 0 ? x.distance_m : null, exact_txt: txt,
      h: d >= 3600 ? String(Math.floor(d / 3600)) : '', m: String(Math.floor(d / 60) % 60), s: String(d % 60).padStart(2, '0'),
      elev, exact_e: elev ? x.elevation_m : null, exact_etxt: elev, hr: x.avg_hr ? String(Math.round(x.avg_hr)) : '',
      calories: x.calories > 0 ? Math.round(x.calories) : null, source: sh.src, external_id: x.id, started_at: x.start
    }, new Date(x.start), true, x.kind === 'other' ? x.activityName : '');
  },
  async finish() {
    const w = S.workout; const cardio = (w.cardio || []).map(c => ({ c, a: blockToActivity(c) }));
    const untimed = cardio.find(x => !x.a.duration_s && (x.a.distance_m || x.a.elevation_m));
    if (untimed) { toast(`Add the time for your ${cLabel(untimed.a.kind).toLowerCase()} first`); return; }
    const bad = cardio.find(x => x.a.duration_s >= 172800 || x.a.distance_m >= 1000000 || x.a.elevation_m >= 20000);
    if (bad) { toast(`Check the numbers on your ${cLabel(bad.a.kind).toLowerCase()}. One of them looks too big.`); return; }
    if (!w.ex.some(e => e.sets.some(s => s.done)) && !cardio.some(x => x.a.duration_s)) { toast(cardio.length ? 'Enter the time for your cardio first' : 'Check off at least one set first'); return; }
    try { await loadCardioHist(); } catch (e) { fail(e); return; }
    const r = computePRs();
    S.summary = { ...r, cat: r.groups.length ? 'PR' : !r.sets && r.cardio.length ? 'Cardio' : 'Workout', vis: 'public', caption: '', file: null };
    S.rest = null; render();
  },
  unfinish() { S.summary = null; render(); },
  pickMedia() { S.summary.caption = $('#sumcap').value; pick('summary'); },
  clearMedia() { S.summary.caption = $('#sumcap').value; S.summary.file = null; render(true); },
  sumCat(id) { S.summary.caption = $('#sumcap').value; S.summary.cat = id; render(true); },
  sumVis(id) { S.summary.caption = $('#sumcap').value; S.summary.vis = id; render(true); },
  async save() {
    if (S.busy) return;
    const s = S.summary, w = S.workout; s.caption = $('#sumcap').value.trim();
    S.busy = true; render(true);
    let wk = null;
    try {
      // An imported session ends when its activities do. Cardio typed in afterwards ended just now and began its duration ago.
      const dur = s.cardio.reduce((t, x) => t + x.a.duration_s, 0) * 1000;
      const cardioOnly = !s.sets && !s.warm && s.cardio.length;
      const begin = !w.imported && cardioOnly ? Date.now() - dur : w.started;
      const end = w.imported ? w.started + dur : Date.now();
      const startIso = new Date(begin).toISOString();
      wk = (await q(sb.from('workouts').insert({ user_id: S.me.id, title: w.title || 'Workout', started_at: startIso, ended_at: new Date(end).toISOString() }).select()))[0];
      const rows = []; let idx = 0;
      w.ex.forEach(e => e.sets.forEach(x => {
        if (!x.done || !(+x.r > 0)) return;
        const g = s.groups.find(gr => gr.set === x);
        const row = { workout_id: wk.id, user_id: S.me.id, ex: e.id, idx: idx++, weight: +x.w || 0, reps: +x.r, is_pr: !!g, pr_types: g ? g.types : [] };
        if (!S.legacy) row.kind = x.kind || 'normal';
        rows.push(row);
      }));
      if (rows.length) await q(sb.from('sets').insert(rows));
      const acts = s.cardio.map((x, i) => ({ ...x.a, workout_id: wk.id, user_id: S.me.id, idx: i, started_at: x.a.started_at || startIso, is_pr: !!x.types.length, pr_types: x.types }));
      if (acts.length && v4()) await q(sb.from('activities').insert(acts));
      let held = false;
      if (s.vis === 'public') {
        const path = s.file ? await upload(s.file) : null;
        const p = await q(sb.from('posts').insert({ user_id: S.me.id, category: s.cat, caption: s.caption, media_path: path, media_kind: s.file ? s.file.kind : null, workout_id: wk.id }).select());
        held = p[0] && p[0].status === 'held';
      }
      const n = s.prs;
      S.workout = null; S.summary = null; S.rest = null; S.hist = {}; S.ahist = null; S.busy = false; saveWorkout();
      toast(held ? 'Saved. The post is held for review because it looks off-topic.' : s.vis === 'public' ? (n ? `Shared. ${n} PR${n > 1 ? 's' : ''} added to your wall.` : 'Shared') : (n ? `Saved. ${n} PR${n > 1 ? 's' : ''} added to your wall.` : 'Saved to your log'));
      go(n ? 'me' : 'feed');
    } catch (e) {
      // Don't leave half a session behind: removing the workout removes its sets and activities too.
      if (wk) await sb.from('workouts').delete().eq('id', wk.id).then(() => {}, () => {});
      S.busy = false; render(true);
      if (e && e.code === '23505') { S.ahist = null; toast('One of these workouts is already in your log, so nothing was saved. Remove it and try again.'); } else fail(e);
    }
  }
};

/* ---------- Forms ---------- */
function readOnboard() {
  const o = S.onboard || (S.onboard = { tags: [] });
  const v = id => (document.getElementById(id) || {}).value;
  if (v('ob-name') !== undefined) { o.name = v('ob-name'); o.handle = v('ob-handle'); o.bio = v('ob-bio'); o.code = v('ob-code'); }
}
const FORMS = {
  async signin() {
    S.busy = true; S.authMsg = '';
    const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#pw').value });
    S.busy = false;
    if (error) { S.authMsg = error.message === 'Email not confirmed' ? 'Confirm your email first: open the link we sent you, then sign in.' : error.message; S.authErr = true; render(); }
  },
  async signup() {
    const email = $('#email').value.trim(), password = $('#pw').value;
    S.busy = true; render(true);
    const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
    S.busy = false;
    if (error) { S.authMsg = error.message; S.authErr = true; render(); return; }
    if (!data.session) { S.authMode = 'signin'; S.authMsg = 'Check your email and tap the confirmation link, then sign in here.'; S.authErr = false; render(); }
  },
  async forgot() {
    const { error } = await sb.auth.resetPasswordForEmail($('#email').value.trim(), { redirectTo: location.origin + location.pathname });
    S.authMsg = error ? error.message : 'If that email has an account, a reset link is on its way.'; S.authErr = !!error; render();
  },
  async reset() {
    const { error } = await sb.auth.updateUser({ password: $('#pw').value });
    if (error) { S.authMsg = error.message; S.authErr = true; render(); return; }
    toast('Password saved'); await boot();
  },
  async onboard() {
    readOnboard(); const o = S.onboard;
    S.busy = true; S.obErr = ''; render(true);
    try {
      const row = await q(sb.rpc('create_profile', { p_handle: o.handle.trim().toLowerCase(), p_name: o.name.trim(), p_bio: o.bio || '', p_tags: o.tags, p_code: o.code || '' }));
      S.me = Array.isArray(row) ? row[0] : row; S.profiles[S.me.id] = S.me; S.busy = false;
      await checkSchema(); S.view = 'app';
      toast(S.me.is_admin ? 'Welcome. You are the admin; find invites under Profile.' : 'Welcome to Vigor');
      go(S.me.is_admin ? 'me' : 'explore');
    } catch (e) {
      S.busy = false;
      S.obErr = /duplicate|unique/i.test(e.message) ? 'That username is taken. Try another.' : /handle/i.test(e.message) ? 'Usernames use 3 to 24 lowercase letters, numbers, dots or underscores.' : e.message;
      render(true);
    }
  },
  async comment(f) {
    const inp = $('#cmt'); const body = inp.value.trim(); if (!body || S.busy) return;
    const row = { post_id: f.dataset.id, user_id: S.me.id, body };
    if (v3() && S.replyTo && S.replyTo.post === f.dataset.id) row.parent_id = S.replyTo.id;
    S.busy = true;
    try {
      await q(sb.from('comments').insert(row));
      S.replyTo = null; S.cdraft = null;
      await loadPost(f.dataset.id); render(true);
    } catch (e) { fail(e); }
    S.busy = false;
  },
  async editProfile() {
    const target = parseFloat($('#ep-target').value);
    const patch = { name: $('#ep-name').value.trim(), bio: $('#ep-bio').value.trim(), tags: S.epTags || S.me.tags, goal_label: $('#ep-goal').value.trim(), goal_ex: $('#ep-goalex').value || null, goal_target: isFinite(target) ? target : null };
    try {
      const rows = await q(sb.from('profiles').update(patch).eq('id', S.me.id).select());
      S.me = rows[0]; S.profiles[S.me.id] = S.me; S.epDraft = null; toast('Profile saved'); S.stack = []; go('me');
    } catch (e) { fail(e); }
  }
};

/* ---------- Events ---------- */
document.addEventListener('click', ev => {
  const dbl = ev.target.closest('[data-dbl]'); if (dbl) { onTap(dbl, ev); return; }
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (!fn) return;
  if (el.dataset.act === 'closeSheet') { fn(null, el, ev); return; }
  ev.preventDefault(); fn(el.dataset.id, el, ev);
});
document.addEventListener('submit', ev => {
  const f = ev.target; const fn = FORMS[f.dataset.form]; if (!fn) return;
  ev.preventDefault(); Promise.resolve(fn(f)).catch(fail);
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.f && S.workout) {
    const e = S.workout.ex[t.dataset.ex]; const s = e.sets[t.dataset.set];
    s[t.dataset.f] = t.value.replace(t.dataset.f === 'w' ? /[^\d.]/g : /\D/g, '');
    const box = document.getElementById(`prl-${t.dataset.ex}-${t.dataset.set}`); if (box) box.innerHTML = prLive(e.id, s);
    saveWorkout();
  } else if (t.dataset.cf && S.workout && S.workout.cardio) {
    const c = S.workout.cardio[+t.dataset.c]; if (!c) return; const f = t.dataset.cf;
    if (f === 'title') c.title = t.value;
    else { const v = f === 'dist' ? t.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1') : t.value.replace(/\D/g, ''); if (v !== t.value) t.value = v; c[f] = v; }
    const box = document.getElementById('cp-' + t.dataset.c); if (box) box.innerHTML = cardioLive(c);
    saveWorkout();
  } else if (t.id === 'wtitle' && S.workout) { S.workout.title = t.value; saveWorkout(); }
  else if (t.id === 'psearch') {
    S.pq = t.value; S.presults = null; clearTimeout(searchTimer);
    if (!S.pq.trim()) { paintSearch(); return; }
    paintSearch();
    searchTimer = setTimeout(() => searchPeople(S.pq).then(paintSearch).catch(fail), 250);
  }
  else if (t.id === 'exq' && S.sheet) { S.sheet.q = t.value; const list = $('#exlist'); if (list) list.innerHTML = exListHtml(t.value); }
  else if (t.id === 'nxname' && S.sheet) { S.sheet.name = t.value; }
  else if (t.id === 'cmt') { const f = t.closest('form'); S.cdraft = { post: f.dataset.id, text: t.value }; }
  else if (t.id === 'ccap' && S.sheet) { S.sheet.caption = t.value; const w = $('#cwarn'); if (w) w.hidden = !OFFTOPIC.test(t.value); }
});
// The phone app's Android back button: close a sheet, then step back, then go to Feed. False lets the app close.
window.__vigorBack = () => {
  if (S.view !== 'app') return false;
  if (S.sheet) { if (!S.busy) { S.sheet = null; render(true); } return true; }
  if (S.summary) { A.unfinish(); return true; }
  if (S.stack.length) { A.back(); return true; }
  if (S.tab !== 'feed') { go('feed'); return true; }
  return false;
};
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && S.sheet && !S.busy) { S.sheet = null; render(true); } });

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (S.view === 'app' && S.tab === 'feed') render(true); });

/* ---------- Boot ---------- */
async function boot() {
  const { data } = await sb.auth.getSession();
  S.session = data.session;
  if (!S.session) { S.view = 'auth'; render(); return; }
  try {
    const rows = await q(sb.from('profiles').select('*').eq('id', S.session.user.id));
    if (!rows.length) { S.view = 'onboard'; render(); return; }
    S.me = rows[0]; S.profiles[S.me.id] = S.me;
    await checkSchema();
    S.view = 'app';
    S.workout = store.get('vigor.workout', null);
    go(S.workout ? 'log' : 'feed');
  } catch (e) { S.view = 'auth'; S.authMsg = e.message; S.authErr = true; render(); }
}
function start() {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) { S.view = 'setup'; render(); return; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { S.view = 'auth'; S.authMode = 'reset'; S.authMsg = ''; render(); return; }
    if (event === 'SIGNED_OUT') { S.me = null; S.session = null; S.data = {}; S.profiles = {}; S.hist = {}; S.ahist = null; S.view = 'auth'; S.authMode = 'signin'; render(); return; }
    if (event === 'SIGNED_IN' && (!S.session || S.session.user.id !== session.user.id)) { setTimeout(boot, 0); }
  });
  boot();
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
start();
