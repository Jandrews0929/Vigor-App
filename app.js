/* Vigor trial app. Plain JavaScript, no build step. Data lives in Supabase (see supabase/schema.sql). */
'use strict';

const VERSION = '0.1.1';
const CFG = window.VIGOR_CONFIG || {};

/* ---------- Exercise library ---------- */
const EX = {
  squat: ['Back squat', 'red'], front: ['Front squat', 'red'], goblet: ['Goblet squat', 'red'], legpress: ['Leg press', 'red'],
  splitsq: ['Bulgarian split squat', 'red'], lunge: ['Walking lunge', 'red'], hacksq: ['Hack squat', 'red'], legext: ['Leg extension', 'red'],
  bench: ['Bench press', 'blue'], incline: ['Incline bench press', 'blue'], dbbench: ['Dumbbell bench press', 'blue'], inclinedb: ['Incline DB press', 'blue'],
  cgbench: ['Close-grip bench', 'blue'], dip: ['Weighted dip', 'green', 1], pushup: ['Push-up', 'blue'], flyes: ['Cable fly', 'blue'],
  dead: ['Deadlift', 'yellow'], sumo: ['Sumo deadlift', 'yellow'], rdl: ['Romanian deadlift', 'yellow'], trapbar: ['Trap bar deadlift', 'yellow'],
  hipthrust: ['Hip thrust', 'yellow'], legcurl: ['Lying leg curl', 'yellow'], goodmorning: ['Good morning', 'yellow'], kbswing: ['Kettlebell swing', 'yellow'],
  ohp: ['Overhead press', 'green'], pushpress: ['Push press', 'green'], dbpress: ['Seated DB press', 'green'], latraise: ['Lateral raise', 'green'],
  facepull: ['Cable face pull', 'green'], curl: ['Barbell curl', 'green'], dbcurl: ['Dumbbell curl', 'green'], hammer: ['Hammer curl', 'green'],
  triext: ['Triceps pushdown', 'green'], skull: ['Skull crusher', 'green'],
  pullup: ['Weighted pull-up', 'blue', 1], chinup: ['Weighted chin-up', 'blue', 1], latpd: ['Lat pulldown', 'blue'], row: ['Barbell row', 'green'],
  dbrow: ['Dumbbell row', 'green'], tbar: ['T-bar row', 'green'], cablerow: ['Seated cable row', 'green'], pendlay: ['Pendlay row', 'green'],
  shrug: ['Shrug', 'yellow'], calf: ['Standing calf raise', 'red'], abwheel: ['Ab wheel rollout', 'yellow'], hanging: ['Hanging leg raise', 'yellow'],
  clean: ['Power clean', 'yellow'], snatch: ['Power snatch', 'yellow'], farmer: ['Farmer carry', 'yellow'], sled: ['Sled push', 'red']
};
const exName = k => (EX[k] ? EX[k][0] : k);
const exColor = k => (EX[k] ? EX[k][1] : 'blue');
const exAdded = k => !!(EX[k] && EX[k][2]);
const TEMPLATES = [
  { name: 'Lower A', ex: ['squat', 'rdl', 'lunge'] },
  { name: 'Push A', ex: ['bench', 'ohp', 'inclinedb', 'triext'] },
  { name: 'Pull A', ex: ['pullup', 'row', 'latpd', 'curl'] },
  { name: 'Full body', ex: ['dead', 'bench', 'dbrow', 'splitsq'] }
];
const POST_CATS = ['Progress', 'Nutrition', 'Recovery', 'Mental health', 'Tip'];
const FOCUS = ['Powerlifting', 'Bodybuilding', 'Hybrid', 'Running', 'Calisthenics', 'CrossFit', 'Yoga', 'Mobility', 'Nutrition', 'Coaching', 'General fitness'];
const REACTS = [['strong', 'Strong'], ['form', 'Clean form'], ['inspired', 'Inspired']];
const ECATS = [['All', null], ['Strength', ['Workout', 'PR']], ['Progress', ['Progress']], ['Recovery', ['Recovery']], ['Nutrition', ['Nutrition']], ['Mind', ['Mental health']], ['Tips', ['Tip']]];
const OFFTOPIC = /\b(crypto|bitcoin|nft|forex|election|vote for|giveaway|promo code|dm me|onlyfans|politic\w*)\b/i;

/* ---------- State ---------- */
const S = {
  view: 'loading', authMode: 'signin', authMsg: '', session: null, me: null,
  tab: 'feed', stack: [], sheet: null, data: {}, profiles: {}, follows: [], hist: {},
  workout: null, summary: null, rest: null, esort: 'popular', ecat: 'All', pq: '', presults: null, gridFilter: 'All', busy: false
};
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
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>'
};
function hueOf(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function avatar(id, cls = '') {
  const p = S.profiles[id] || { name: '?' };
  const ini = (p.name || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  return `<span class="av ${cls}" style="background:hsl(${hueOf(id)} 55% 40%)">${esc(ini)}</span>`;
}
const handle = id => (S.profiles[id] ? '@' + S.profiles[id].handle : '@someone');

let toastT;
function toast(msg) {
  $('#toast').innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toastT); toastT = setTimeout(() => ($('#toast').innerHTML = ''), 3200);
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
    wids.length ? q(sb.from('sets').select('workout_id,ex,weight,reps,is_pr,pr_types,idx').in('workout_id', wids).order('idx')) : Promise.resolve([])
  ]);
  const titles = wids.length ? await q(sb.from('workouts').select('id,title').in('id', wids)) : [];
  await ensureProfiles(posts.map(p => p.user_id));
  posts.forEach(p => {
    p.react = { strong: 0, form: 0, inspired: 0 }; p.mine = {};
    reacts.filter(r => r.post_id === p.id).forEach(r => { p.react[r.kind]++; if (r.user_id === S.me.id) p.mine[r.kind] = true; });
    p.ncomments = comments.filter(c => c.post_id === p.id).length;
    p.sets = sets.filter(s => s.workout_id === p.workout_id);
    const t = titles.find(w => w.id === p.workout_id); p.wtitle = t ? t.title : 'Workout';
  });
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
  const [posts, prs, workouts, monthSets] = await Promise.all([
    q(visibleSelect().eq('user_id', uid).order('created_at', { ascending: false }).limit(90)),
    q(sb.from('sets').select('ex,weight,reps,workout_id,created_at').eq('user_id', uid).eq('is_pr', true).order('weight', { ascending: false })),
    q(sb.from('workouts').select('id,started_at').eq('user_id', uid).gte('started_at', new Date(Date.now() - 120 * 86400000).toISOString())),
    q(sb.from('sets').select('weight,reps').eq('user_id', uid).gte('created_at', monthStart.toISOString()))
  ]);
  const best = {};
  prs.forEach(s => { if (!best[s.ex] || +s.weight > +best[s.ex].weight) best[s.ex] = s; });
  const prWorkouts = Object.values(best).map(s => s.workout_id);
  const proof = prWorkouts.length ? await q(sb.from('posts').select('id,workout_id').in('workout_id', prWorkouts).eq('status', 'visible')) : [];
  const wall = Object.values(best).map(s => ({ ...s, post: (proof.find(p => p.workout_id === s.workout_id) || {}).id }))
    .sort((a, b) => +b.weight - +a.weight).slice(0, 9);
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
  await ensureProfiles(p.comments.map(c => c.user_id));
  const pr = p.sets.find(s => s.is_pr);
  if (pr) {
    const hist = await q(sb.from('sets').select('weight,workout_id,created_at').eq('user_id', p.user_id).eq('ex', pr.ex).order('created_at'));
    const byW = new Map();
    hist.forEach(h => { const b = byW.get(h.workout_id); if (!b || +h.weight > +b.w) byW.set(h.workout_id, { w: +h.weight, d: h.created_at, wid: h.workout_id }); });
    p.history = { ex: pr.ex, points: [...byW.values()].slice(-10) };
  }
  S.data['post:' + id] = p;
}
async function loadHist(ex) {
  if (S.hist[ex]) return;
  S.hist[ex] = await q(sb.from('sets').select('weight,reps,created_at').eq('user_id', S.me.id).eq('ex', ex).order('created_at'));
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

async function loadAdmin() {
  const [held, reports, feedback, code] = await Promise.all([
    q(sb.from('posts').select('*').eq('status', 'held').order('created_at', { ascending: false })),
    q(sb.from('reports').select('*').eq('resolved', false).order('created_at', { ascending: false })),
    q(sb.from('feedback').select('*').order('created_at', { ascending: false }).limit(200)),
    q(sb.rpc('get_invite_code'))
  ]);
  const rp = reports.length ? await q(sb.from('posts').select('*').in('id', reports.map(r => r.post_id))) : [];
  const members = await q(sb.from('profiles').select('*').order('created_at'));
  members.forEach(m => (S.profiles[m.id] = m));
  await ensureProfiles([...held, ...rp, ...reports, ...feedback].map(x => x.user_id));
  S.data.admin = { held, reports, reportPosts: rp, feedback, code, members };
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
  const groups = []; let sets = 0, vol = 0;
  S.workout.ex.forEach(e => {
    const done = e.sets.filter(s => s.done && +s.w >= 0 && +s.r > 0);
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
  return { groups, sets, vol };
}

/* ---------- Rendering: shared pieces ---------- */
function mediaHtml(p, full) {
  if (p.media_path) {
    const url = esc(mediaUrl(p.media_path));
    return `<div class="media">${p.media_kind === 'video'
      ? `<video src="${url}#t=0.1" playsinline preload="metadata" ${full ? 'controls' : 'muted'}></video>${full ? '' : `<span class="play">${ICON.play}</span>`}`
      : `<img src="${url}" alt="" loading="lazy">`}</div>`;
  }
  const h = hueOf(p.id); const pr = (p.sets || []).find(s => s.is_pr);
  const big = pr ? wt(pr.ex, pr.weight) : (p.category === 'Workout' ? (p.wtitle || 'WORKOUT') : p.category);
  const sub = pr ? `${exName(pr.ex)} · ${pr.reps} rep${pr.reps > 1 ? 's' : ''}` : (p.category === 'Workout' ? `${(p.sets || []).length} sets` : 'Text post');
  return `<div class="media"><div class="art" style="background:linear-gradient(160deg,hsl(${h} 45% 20%),hsl(${(h + 25) % 360} 55% 34%))">
    <span class="big">${esc(String(big).toUpperCase())}</span><span class="small">${esc(sub.toUpperCase())}</span></div></div>`;
}
function workoutSummary(p) {
  if (!p.sets || !p.sets.length) return '';
  const byEx = [];
  p.sets.forEach(s => { let g = byEx.find(x => x.ex === s.ex); if (!g) byEx.push(g = { ex: s.ex, sets: [] }); g.sets.push(s); });
  return `<div class="wk"><h4>${esc(p.wtitle)}<span>${byEx.length} exercise${byEx.length > 1 ? 's' : ''}</span></h4><ul>${byEx.map(g => {
    const top = g.sets.reduce((a, s) => (+s.weight > +a.weight ? s : a), g.sets[0]);
    return `<li><b>${esc(exName(g.ex))}</b><span>${wt(g.ex, top.weight)} × ${top.reps} · ${g.sets.length} set${g.sets.length > 1 ? 's' : ''}</span></li>`;
  }).join('')}</ul></div>`;
}
function postCard(p, full) {
  const U = S.profiles[p.user_id] || {};
  const prs = (p.sets || []).filter(s => s.is_pr);
  const media = (p.media_path || p.sets.length || !full) ? (full ? mediaHtml(p, true) : `<button class="media-btn" data-act="open" data-id="${p.id}" aria-label="Open post">${mediaHtml(p)}</button>`) : '';
  return `<article class="post">
    <div class="post-head">
      <button class="who" data-act="profile" data-id="${p.user_id}">${avatar(p.user_id)}<span><span class="nm">${esc(U.name)}</span><span class="hd">@${esc(U.handle)}</span></span></button>
      <span class="cat ${p.category === 'PR' ? 'is-pr' : ''}">${esc(p.category)}</span>
      <button class="icon-btn sm" data-act="postMenu" data-id="${p.id}" aria-label="Post options">${ICON.more}</button>
    </div>
    ${p.status === 'held' ? '<div class="hint" style="margin-top:0">Held for review. Only you and the moderators can see this post.</div>' : ''}
    ${media}
    ${prs.length ? `<div class="prs">${prs.map(s => `<span class="pr-badge">${ICON.trophy}${esc(exName(s.ex))} · ${wt(s.ex, s.weight)} × ${s.reps} · ${esc((s.pr_types || [])[0] || 'PR')}</span>`).join('')}</div>` : ''}
    ${workoutSummary(p)}
    ${p.caption ? `<p class="caption"><b>@${esc(U.handle)}</b> ${esc(p.caption)}</p>` : ''}
    <div class="react-row">
      ${REACTS.map(([k, l]) => `<button class="react" data-act="react" data-id="${p.id}" data-k="${k}" aria-pressed="${!!p.mine[k]}">${l}<span class="n">${p.react[k]}</span></button>`).join('')}
      ${full ? '' : `<button class="react ghost" data-act="open" data-id="${p.id}">${p.ncomments} comment${p.ncomments === 1 ? '' : 's'}</button>`}
      ${p.sets.length && p.user_id !== S.me.id ? `<button class="react ghost" data-act="copy" data-id="${p.id}">Copy workout</button>` : ''}
    </div>
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
  if (standalone || store.get('vigor.installDismissed', false)) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="notice"><b>Add Vigor to your home screen</b>
    <span>${ios ? 'In Safari, tap the Share button, then "Add to Home Screen". Vigor then opens full screen like any other app.' : (deferredInstall ? 'Install Vigor so it opens full screen like any other app.' : 'Open your browser menu and choose "Install app" or "Add to Home screen".')}</span>
    <div class="row">${!ios && deferredInstall ? '<button class="btn primary sm" data-act="install">Install</button>' : ''}<button class="btn sm" data-act="dismissInstall">Not now</button></div></div>`;
}
function feedScreen() {
  const list = S.data.feed;
  const head = topBar(`<span class="wordmark">VIGOR</span><span class="sub">Following</span>`, `${fbBtn()}<button class="icon-btn" data-act="compose" aria-label="New post">${ICON.plus}</button>`);
  if (!list) return head + loading();
  return head + installNotice() + (list.length ? list.map(p => postCard(p)).join('') + `<div class="caught"><span class="ring">${ICON.check.replace('<svg', '<svg width="20" height="20"')}</span><strong>You're caught up</strong><span>That's everything from people you follow.</span></div>`
    : `<div class="empty"><p>Your feed shows posts from people you follow.</p><button class="btn primary" data-act="tab" data-id="explore">Find people on Explore</button></div>`);
}
function score(p) { const r = p.react.strong + p.react.form + p.react.inspired + p.ncomments * 3; return (r + 1) / Math.pow((Date.now() - new Date(p.created_at)) / 3600000 + 2, 0.8); }
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
  let list = S.data.explore.filter(p => !cat || cat.includes(p.category));
  list = S.esort === 'new' ? list : [...list].sort((a, b) => score(b) - score(a));
  const creators = S.data.creators.filter(u => !iFollow(u));
  return head + `<div id="explore-body" ${S.pq.trim() ? 'hidden' : ''}>` + (creators.length ? `<div class="ex-sub label" style="padding-bottom:8px">People to follow</div>
    <div class="rising">${creators.map(u => { const U = S.profiles[u]; return `<div class="creator">
      <button data-act="profile" data-id="${u}" style="display:contents">${avatar(u)}<span class="nm">${esc(U.name)}</span></button>
      <span class="meta">${esc(U.tags[0] || 'Member')} · ${fmtCount(followersOf(u).length)} follower${followersOf(u).length === 1 ? '' : 's'}</span>${followBtn(u, true)}</div>`; }).join('')}</div>` : '') +
    `<div style="padding:0 16px"><div class="seg">${[['popular', 'Popular'], ['new', 'New']].map(([k, l]) => `<button data-act="esort" data-id="${k}" aria-pressed="${S.esort === k}">${l}</button>`).join('')}</div></div>
    <div class="chips" style="padding-bottom:0">${ECATS.map(([l]) => `<button class="chip" data-act="ecat" data-id="${l}" aria-pressed="${S.ecat === l}">${l}</button>`).join('')}</div>
    <p class="ex-sub">${S.esort === 'new' ? 'Newest posts from everyone, including people you don\'t follow yet.' : 'Ranked by reactions and comments, favoring recent posts.'}</p>
    ${list.length ? `<div class="egrid">${list.map(p => { const t = p.react.strong + p.react.form + p.react.inspired;
      return `<button class="etile" data-act="open" data-id="${p.id}" aria-label="Open post by ${esc(handle(p.user_id))}">${mediaHtml(p)}
        <span class="etile-foot">${avatar(p.user_id)}<span class="hn">${esc(handle(p.user_id))}</span></span>
        <span class="etile-rank">${S.esort === 'new' ? ago(p.created_at) : num(t) + ' reaction' + (t === 1 ? '' : 's')}</span></button>`; }).join('')}</div>`
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
function postScreen(id) {
  const p = S.data['post:' + id];
  if (p === undefined) return topBar(h2('Post'), '', true) + loading();
  if (p === null) return topBar(h2('Post'), '', true) + '<div class="empty">This post was removed.</div>';
  return topBar(h2(p.category === 'PR' ? 'PR proof' : 'Post'), '', true) + postCard(p, true) +
    `<div class="section-pad">
      ${p.history ? historyChart(p.history) : ''}
      <span class="label">Comments</span>
      ${p.comments.length ? p.comments.map(c => `<div class="comment">${avatar(c.user_id)}<p><b>${esc(handle(c.user_id))}</b> ${esc(c.body)}
        ${c.user_id === S.me.id || S.me.is_admin ? ` <button class="text-btn" data-act="delComment" data-id="${c.id}" style="color:var(--muted)">Delete</button>` : ''}</p></div>`).join('') : '<p class="when" style="padding:0">No comments yet.</p>'}
      <form class="cform" data-form="comment" data-id="${p.id}"><input class="field" id="cmt" placeholder="Add a comment" autocomplete="off" maxlength="1000"><button class="btn primary sm">Post</button></form>
    </div>`;
}
function profileScreen(u) {
  const mine = u === S.me.id; const U = S.profiles[u]; const d = S.data['profile:' + u];
  const right = mine ? `${fbBtn()}<button class="icon-btn" data-act="meMenu" aria-label="Profile options">${ICON.more}</button>` : '';
  const head = topBar(h2(U ? '@' + U.handle : 'Profile'), right, !mine);
  if (!U || !d) return head + loading();
  const filters = ['All', 'Workouts', 'Progress', 'Nutrition', 'Tips'];
  const match = p => S.gridFilter === 'All' || (S.gridFilter === 'Workouts' && (p.category === 'Workout' || p.category === 'PR')) ||
    (S.gridFilter === 'Progress' && p.category === 'Progress') || (S.gridFilter === 'Nutrition' && p.category === 'Nutrition') || (S.gridFilter === 'Tips' && p.category === 'Tip');
  const shown = d.posts.filter(match);
  let goal = '';
  if (U.goal_label && U.goal_ex && U.goal_target) {
    const best = d.wall.find(s => s.ex === U.goal_ex);
    const cur = best ? +best.weight : 0; const pct = Math.max(0, Math.min(100, cur / U.goal_target * 100));
    goal = `<div class="goal"><div class="row"><b>${esc(U.goal_label)}</b><span>${cur ? wt(U.goal_ex, cur) : 0} of ${wt(U.goal_ex, U.goal_target)} lb</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }
  return head + `<section class="prof">
      <div class="prof-head">${avatar(u, 'lg')}<div><h3>${esc(U.name)}${U.is_admin ? '<span class="cred">Team</span>' : ''}</h3><div class="hd">@${esc(U.handle)}</div>
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
      ${d.wall.length ? `<div class="plates">${d.wall.map(x => `<button class="plate-tile" data-act="${x.post ? 'open' : 'noproof'}" data-id="${x.post || x.ex}">
          <span class="plate c-${exColor(x.ex)}"><span class="plate-val">${wt(x.ex, x.weight)}</span><span class="plate-unit">lb × ${x.reps}</span></span>
          <span class="plate-name">${esc(exName(x.ex))}</span>
          ${x.post ? `<span class="plate-meta">▶ Proof · ${shortDate(x.created_at)}</span>` : `<span class="plate-meta none">No proof yet · ${shortDate(x.created_at)}</span>`}
        </button>`).join('')}</div>` : `<div class="empty" style="padding:8px">${mine ? 'Log a lift twice and beat it to earn your first PR plate.' : 'No PRs yet.'}</div>`}
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
  const U = S.me;
  return topBar(h2('Edit profile'), '', true) + `<form class="form" data-form="editProfile">
    <label>Name<input class="field" id="ep-name" required maxlength="60" value="${esc(U.name)}"></label>
    <label>Bio<textarea class="field" id="ep-bio" maxlength="200">${esc(U.bio)}</textarea></label>
    <div class="stack" style="gap:6px"><span class="label">Focus</span><div class="tagpick">${FOCUS.map(t => `<button type="button" class="chip" data-act="epTag" data-id="${t}" aria-pressed="${(S.epTags || U.tags).includes(t)}">${t}</button>`).join('')}</div></div>
    <span class="label">Goal (shows as a progress bar)</span>
    <label>Goal name<input class="field" id="ep-goal" maxlength="60" placeholder="Bench 300 by Dec 31" value="${esc(U.goal_label)}"></label>
    <label>Lift<select class="field" id="ep-goalex"><option value="">None</option>${Object.keys(EX).map(k => `<option value="${k}" ${U.goal_ex === k ? 'selected' : ''}>${esc(exName(k))}</option>`).join('')}</select></label>
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
  return head + `<div class="section-pad">
    <span class="label">Invite testers</span>
    <p class="when" style="padding:0">Anyone signing up needs this code. Change it any time; people already in keep their accounts.</p>
    <div class="code">${esc(d.code || '')}</div>
    <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm primary" data-act="copyInvite">Copy invite message</button><button class="btn sm" data-act="changeCode">Change code</button></div>
    <textarea class="field" id="invite-msg" readonly style="min-height:90px">You're invited to try Vigor, a workout log and health-only social app. Open ${link} on your phone, add it to your home screen, and sign up with invite code ${d.code || ''}. There's a Feedback button on every screen.</textarea>
    <span class="label">Moderation (${d.held.length + d.reports.length})</span>
    ${d.held.map(p => pcard(p, 'Held by off-topic screen')).join('')}
    ${d.reports.map(r => pcard(d.reportPosts.find(p => p.id === r.post_id), `Reported by ${handle(r.user_id)}: ${r.reason}`, r.id)).join('')}
    ${!d.held.length && !d.reports.length ? '<p class="when" style="padding:0">Nothing to review.</p>' : ''}
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
      <span class="label" style="margin-top:8px">Templates</span>
      ${[...mine.map((t, i) => ({ ...t, key: 'm' + i })), ...TEMPLATES.map((t, i) => ({ ...t, key: 'b' + i }))].map(t => `<button class="tpl" data-act="startTpl" data-id="${t.key}">
        <span class="tpl-top"><h4>${esc(t.name)}</h4>${t.from ? `<span class="from">From ${esc(t.from)}</span>` : ''}</span>
        <p>${t.ex.map(exName).map(esc).join(', ')}</p></button>`).join('')}
      <p class="when" style="padding:0">Weights fill in from your last session. Vigor flags a PR when you beat a lift you've logged before.</p>
    </div>`;
  }
  return `<header class="top"><input class="title-input" id="wtitle" value="${esc(w.title)}" aria-label="Workout name" maxlength="60"><span class="timer" id="elapsed">${elapsed()}</span><button class="btn primary sm" data-act="finish">Finish</button></header>
    ${!w.ex.length ? '<div class="empty">Add your first exercise to start logging.</div>' : ''}
    ${w.ex.map((e, i) => {
      const h = S.hist[e.id] || []; const last = h[h.length - 1];
      const best = h.length ? h.reduce((a, s) => (+s.weight > +a.weight ? s : a), h[0]) : null;
      return `<section class="exblock"><div class="exblock-head"><h3>${esc(exName(e.id))}</h3>${best ? `<span class="best">Best ${wt(e.id, best.weight)} × ${best.reps}</span>` : '<span class="best">First time: sets your baseline</span>'}
        <button class="text-btn" data-act="rmEx" data-ex="${i}" style="color:var(--muted)">Remove</button></div>
        <table class="sets"><thead><tr><th>Set</th><th>Previous</th><th>${exAdded(e.id) ? '+lb' : 'lb'}</th><th>Reps</th><th><span class="sr">Done</span></th></tr></thead><tbody>
        ${e.sets.map((s, j) => `<tr class="${s.done ? 'done' : ''}"><td>${j + 1}</td><td class="prev">${last ? wt(e.id, last.weight) + ' × ' + last.reps : '–'}</td>
          <td><input id="w-${i}-${j}" data-ex="${i}" data-set="${j}" data-f="w" inputmode="decimal" value="${esc(s.w)}" aria-label="Weight, set ${j + 1}"></td>
          <td><input id="r-${i}-${j}" data-ex="${i}" data-set="${j}" data-f="r" inputmode="numeric" value="${esc(s.r)}" aria-label="Reps, set ${j + 1}"></td>
          <td><button class="check" data-act="toggleSet" data-ex="${i}" data-set="${j}" aria-label="Mark set ${j + 1} done">${ICON.check}</button></td></tr>
          <tr class="pr-row"><td colspan="5"><div class="pr-live" id="prl-${i}-${j}">${prLive(e.id, s)}</div></td></tr>`).join('')}
        </tbody></table>
        <button class="add-set" data-act="addSet" data-ex="${i}">+ Add set</button></section>`;
    }).join('')}
    <div class="log-foot"><button class="btn block" data-act="addEx">+ Add exercise</button><button class="btn danger block" data-act="discard">Discard workout</button></div>`;
}
function prLive(ex, s) { return s.done ? detect(ex, s.w, s.r).map(t => `<span>▲ PR · ${esc(t)}</span>`).join('') : ''; }
function elapsed() {
  if (!S.workout) return '';
  const sec = Math.floor((Date.now() - S.workout.started) / 1000);
  const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec % 60).padStart(2, '0');
}
function summaryScreen() {
  const s = S.summary; const w = S.workout;
  return `<header class="top"><button class="icon-btn" data-act="unfinish" aria-label="Back to workout">${ICON.back}</button><h2>Share session</h2></header>
    <div class="done-hero"><h3>${s.groups.length ? `${s.groups.length} new PR${s.groups.length > 1 ? 's' : ''}` : 'Workout logged'}</h3>
      <p>${esc(w.title)} · ${Math.max(1, Math.round((Date.now() - w.started) / 60000))} min · ${s.sets} sets · ${num(s.vol)} lb volume</p></div>
    ${s.groups.length ? `<div class="found">${s.groups.map(g => `<div class="found-item">
        <div class="found-top"><b>${esc(exName(g.ex))}</b><span>${wt(g.ex, g.w)} × ${g.r}</span></div>
        <div class="types">${g.types.map(t => `<span class="pr-badge">${ICON.trophy}${esc(t)}</span>`).join('')}</div></div>`).join('')}</div>` : ''}
    <div class="section-pad">
      <span class="label">${s.groups.length ? 'Proof: photo or video of the PR set' : 'Photo or video (optional)'}</span>
      ${s.file ? `${s.file.kind === 'video' ? `<video class="media-preview" src="${s.file.preview}" controls playsinline></video>` : `<img class="media-preview" src="${s.file.preview}" alt="">`}
        <button class="btn sm" data-act="clearMedia">Remove</button>` : '<button class="btn primary" data-act="pickMedia">Add photo or video</button><span class="when" style="padding:0">Videos up to 60 seconds.</span>'}
      <span class="label">Post as</span>
      <div class="seg">${['PR', 'Workout'].map(c => `<button data-act="sumCat" data-id="${c}" aria-pressed="${s.cat === c}" ${c === 'PR' && !s.groups.length ? 'disabled' : ''}>${c === 'PR' ? 'PR post' : 'Workout post'}</button>`).join('')}</div>
      <label class="label" for="sumcap">Caption</label>
      <textarea class="field" id="sumcap" maxlength="2000" placeholder="How did it feel?">${esc(s.caption)}</textarea>
      <span class="label">Who sees it</span>
      <div class="seg">${[['public', 'Followers and Explore'], ['private', 'Only me']].map(([k, l]) => `<button data-act="sumVis" data-id="${k}" aria-pressed="${s.vis === k}">${l}</button>`).join('')}</div>
      ${S.busy ? '<div class="upload-bar"><i></i></div>' : ''}
      <button class="btn primary block" data-act="save" ${S.busy ? 'disabled' : ''}>${S.busy ? 'Saving…' : s.vis === 'public' ? 'Share' : 'Save to my log'}</button>
    </div>`;
}

/* ---------- Sheets ---------- */
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
    inner = `<h3>Add exercise</h3><input class="field" id="exq" placeholder="Search ${Object.keys(EX).length} exercises" autocomplete="off">
      <div class="exlist" id="exlist">${Object.keys(EX).sort((a, b) => exName(a).localeCompare(exName(b))).map(k => `<button data-act="pickEx" data-id="${k}" data-n="${esc(exName(k).toLowerCase())}">${esc(exName(k))}</button>`).join('')}</div>`;
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
  return `<div class="sheet-wrap" data-act="closeSheet"><div class="sheet ${anim ? 'anim' : ''}" role="dialog" aria-modal="true"><span class="grab"></span>${inner}</div></div>`;
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
  const loaders = { feed: loadFeed, explore: loadExplore, me: () => loadProfile(S.me.id), log: async () => { if (S.workout) await Promise.all(S.workout.ex.map(e => loadHist(e.id))); } };
  if (loaders[tab]) loaders[tab]().then(() => render(true)).catch(fail);
}
function push(entry, loader) { S.stack.push(entry); S.sheet = null; render(); if (loader) loader().then(() => render(true)).catch(fail); }
function saveWorkout() { store.set('vigor.workout', S.workout); }

/* ---------- Media ---------- */
const filepick = document.createElement('input');
filepick.type = 'file'; filepick.accept = 'image/*,video/*'; filepick.hidden = true; document.body.appendChild(filepick);
function pick() { filepick.value = ''; filepick.click(); }
filepick.addEventListener('change', async () => {
  const f = filepick.files[0]; if (!f) return;
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
async function upload(file) {
  const path = `${S.me.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.ext}`;
  const { error } = await sb.storage.from('media').upload(path, file.blob, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
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
  async react(id, el) {
    const p = findPost(id); const k = el.dataset.k; if (!p) return;
    const on = !p.mine[k]; p.mine[k] = on; p.react[k] += on ? 1 : -1; render(true);
    try {
      if (on) await q(sb.from('reactions').insert({ post_id: id, user_id: S.me.id, kind: k }));
      else await q(sb.from('reactions').delete().match({ post_id: id, user_id: S.me.id, kind: k }));
    } catch (e) { p.mine[k] = !on; p.react[k] += on ? -1 : 1; render(true); fail(e); }
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
  async delComment(id) {
    try { await q(sb.from('comments').delete().eq('id', id)); const t = S.stack[S.stack.length - 1]; await loadPost(t.id); render(true); } catch (e) { fail(e); }
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
  editProfile() { S.epTags = null; S.sheet = null; push({ type: 'editProfile' }); },
  epTag(t) { const tags = S.epTags || [...S.me.tags]; S.epTags = tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]; render(true); },
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
  addEx() { S.sheet = { type: 'addEx' }; render(true); setTimeout(() => $('#exq') && $('#exq').focus(), 60); },
  async pickEx(id) {
    S.sheet = null;
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
  finish() {
    if (!S.workout.ex.some(e => e.sets.some(s => s.done))) { toast('Check off at least one set first'); return; }
    const r = computePRs();
    S.summary = { ...r, cat: r.groups.length ? 'PR' : 'Workout', vis: 'public', caption: '', file: null };
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
    try {
      const wk = (await q(sb.from('workouts').insert({ user_id: S.me.id, title: w.title || 'Workout', started_at: new Date(w.started).toISOString(), ended_at: new Date().toISOString() }).select()))[0];
      const rows = []; let idx = 0;
      w.ex.forEach(e => e.sets.forEach(x => {
        if (!x.done || !(+x.r > 0)) return;
        const g = s.groups.find(gr => gr.set === x);
        rows.push({ workout_id: wk.id, user_id: S.me.id, ex: e.id, idx: idx++, weight: +x.w || 0, reps: +x.r, is_pr: !!g, pr_types: g ? g.types : [] });
      }));
      if (rows.length) await q(sb.from('sets').insert(rows));
      let held = false;
      if (s.vis === 'public') {
        const path = s.file ? await upload(s.file) : null;
        const p = await q(sb.from('posts').insert({ user_id: S.me.id, category: s.cat, caption: s.caption, media_path: path, media_kind: s.file ? s.file.kind : null, workout_id: wk.id }).select());
        held = p[0] && p[0].status === 'held';
      }
      const n = s.groups.length;
      S.workout = null; S.summary = null; S.rest = null; S.hist = {}; S.busy = false; saveWorkout();
      toast(held ? 'Saved. The post is held for review because it looks off-topic.' : s.vis === 'public' ? (n ? `Shared. ${n} PR${n > 1 ? 's' : ''} added to your wall.` : 'Shared') : (n ? `Saved. ${n} PR${n > 1 ? 's' : ''} added to your wall.` : 'Saved to your log'));
      go(n ? 'me' : 'feed');
    } catch (e) { S.busy = false; render(true); fail(e); }
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
      S.me = Array.isArray(row) ? row[0] : row; S.profiles[S.me.id] = S.me; S.busy = false; S.view = 'app';
      toast(S.me.is_admin ? 'Welcome. You are the admin; find invites under Profile.' : 'Welcome to Vigor');
      go(S.me.is_admin ? 'me' : 'explore');
    } catch (e) {
      S.busy = false;
      S.obErr = /duplicate|unique/i.test(e.message) ? 'That username is taken. Try another.' : /handle/i.test(e.message) ? 'Usernames use 3 to 24 lowercase letters, numbers, dots or underscores.' : e.message;
      render(true);
    }
  },
  async comment(f) {
    const inp = $('#cmt'); const body = inp.value.trim(); if (!body) return;
    try { await q(sb.from('comments').insert({ post_id: f.dataset.id, user_id: S.me.id, body })); await loadPost(f.dataset.id); render(true); } catch (e) { fail(e); }
  },
  async editProfile() {
    const target = parseFloat($('#ep-target').value);
    const patch = { name: $('#ep-name').value.trim(), bio: $('#ep-bio').value.trim(), tags: S.epTags || S.me.tags, goal_label: $('#ep-goal').value.trim(), goal_ex: $('#ep-goalex').value || null, goal_target: isFinite(target) ? target : null };
    try {
      const rows = await q(sb.from('profiles').update(patch).eq('id', S.me.id).select());
      S.me = rows[0]; S.profiles[S.me.id] = S.me; toast('Profile saved'); S.stack = []; go('me');
    } catch (e) { fail(e); }
  }
};

/* ---------- Events ---------- */
document.addEventListener('click', ev => {
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
  } else if (t.id === 'wtitle' && S.workout) { S.workout.title = t.value; saveWorkout(); }
  else if (t.id === 'psearch') {
    S.pq = t.value; S.presults = null; clearTimeout(searchTimer);
    if (!S.pq.trim()) { paintSearch(); return; }
    paintSearch();
    searchTimer = setTimeout(() => searchPeople(S.pq).then(paintSearch).catch(fail), 250);
  }
  else if (t.id === 'exq') { const v = t.value.toLowerCase(); document.querySelectorAll('#exlist button').forEach(b => (b.hidden = !b.dataset.n.includes(v))); }
  else if (t.id === 'ccap' && S.sheet) { S.sheet.caption = t.value; const w = $('#cwarn'); if (w) w.hidden = !OFFTOPIC.test(t.value); }
});
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
    S.me = rows[0]; S.profiles[S.me.id] = S.me; S.view = 'app';
    S.workout = store.get('vigor.workout', null);
    go(S.workout ? 'log' : 'feed');
  } catch (e) { S.view = 'auth'; S.authMsg = e.message; S.authErr = true; render(); }
}
function start() {
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) { S.view = 'setup'; render(); return; }
  sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { S.view = 'auth'; S.authMode = 'reset'; S.authMsg = ''; render(); return; }
    if (event === 'SIGNED_OUT') { S.me = null; S.session = null; S.data = {}; S.profiles = {}; S.view = 'auth'; S.authMode = 'signin'; render(); return; }
    if (event === 'SIGNED_IN' && (!S.session || S.session.user.id !== session.user.id)) { setTimeout(boot, 0); }
  });
  boot();
}
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
start();
