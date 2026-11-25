/** nexura E2E — performs real flows against LOCAL backend (DB_URI = nexura-dev, shared w/ staging).
 * users+referral, full lesson completion, campaign participate, studio (hub + user-hub) account
 * creation via real OTP-from-Mongo flow, analytics/claims. Run: bun qa-e2e.mjs */
import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';

const API = 'http://localhost:5600/api';
const R = {};
const log = (k, v) => { R[k] = v; console.log(k, '::', typeof v === 'string' ? v : JSON.stringify(v).slice(0, 240)); };
const SUF = Date.now().toString(16);
const ADDR_A = ('0x' + 'a'.repeat(40)).slice(0, 42 - SUF.length) + SUF;
const ADDR_B = ('0x' + 'b'.repeat(40)).slice(0, 42 - SUF.length) + SUF;

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data };
  } catch (e) { return { status: 'ERR', data: { error: String(e.message || e) } }; }
}
const m = (r) => r.data?.message || r.data?.error;

async function studioSignup(page, label) {
  // page: 'project' (hub admin) or 'user' (user hub). Returns {email, token, hubName}
  const email = `qa-${label}-${SUF}@nexura-qa.test`;
  const password = 'QaTest1234!';
  const name = `QA ${label} ${SUF}`;
  // 1. request OTP (writes to 'otps' collection)
  const v = await call('POST', `/hub-auth/validate-email?email=${encodeURIComponent(email)}&page=${page}`);
  // 2. read OTP straight from Mongo (instead of email inbox)
  let code = null;
  try {
    const doc = await mongoose.connection.db.collection('otps').findOne({ email: email.toLowerCase() }, { sort: { _id: -1 } });
    code = doc?.code;
  } catch (e) { log(`${label}.otpReadErr`, String(e.message)); }
  // 3. confirm -> creates verifiedEmail
  const c = await call('POST', '/auth/confirm-hub-email-validation', { body: { email, code } });
  // 4. sign up
  const signupPath = page === 'user' ? '/user-hub/sign-up' : '/hub/sign-up';
  const su = await call('POST', signupPath, { body: { name, email, password, hubName: name, projectName: name } });
  const token = su.data?.accessToken || su.data?.token;
  log(`${label}.signup`, { validate: v.status, gotOtp: !!code, confirm: c.status, signup: su.status, gotToken: !!token, msg: m(su) });
  return { email, password, token, name, signup: su.data };
}

async function main() {
  await mongoose.connect(process.env.DB_URI, { family: 4 });
  console.log('mongo connected\n');

  console.log('========== 1: USERS + REFERRAL ==========');
  const a = await call('POST', '/user/sign-in', { body: { address: ADDR_A } });
  const tokenA = a.data?.accessToken; const refA = a.data?.user?.referral?.code;
  log('userA.signin', { status: a.status, token: !!tokenA, refCode: refA });
  const b = await call('POST', '/user/sign-in', { body: { address: ADDR_B, referrer: refA } });
  const tokenB = b.data?.accessToken;
  log('userB.signin(referred by A)', { status: b.status, token: !!tokenB });
  log('userA.daily-signin', await call('POST', '/user/perform-daily-sign-in', { token: tokenA }).then(r => ({ status: r.status, msg: m(r) })));
  log('userA.referral-info', await call('GET', '/user/referral-info', { token: tokenA }).then(r => ({ status: r.status, referred: r.data?.usersReferred?.length })));

  console.log('\n========== 2: LESSON (start -> answer all -> claim xp) ==========');
  const lessons = await call('GET', '/lesson/get-lessons', { token: tokenA });
  const lArr = lessons.data?.data || lessons.data?.lessons || lessons.data;
  const lesson = Array.isArray(lArr) ? (lArr.find(l => l.status === 'published') || lArr[0]) : null;
  log('lessons.list', { status: lessons.status, count: lArr?.length, picked: lesson?.title });
  if (lesson?._id) {
    const det = await call('GET', `/lesson/get-lesson-details?id=${lesson._id}`, { token: tokenA });
    const questions = det.data?.questions || [];
    log('lesson.details', { status: det.status, questions: questions.length, hasSolutions: !!questions[0]?.solution });
    log('lesson.start', await call('POST', `/lesson/start-lesson?lessonId=${lesson._id}`, { token: tokenA }).then(r => ({ status: r.status, msg: m(r) })));
    let answered = 0, correct = 0;
    for (const q of questions) {
      const sol = q.solution ?? q.options?.[0];
      const r = await call('POST', '/lesson/answer-question', { token: tokenA, body: { question: q._id, lesson: lesson._id, answer: sol } });
      answered++; if (m(r) === 'correct answer') correct++;
    }
    log('lesson.answers', { answered, correct, note: questions[0]?.solution ? 'solutions present' : 'no solutions exposed' });
    log('lesson.reward-xp', await call('POST', `/lesson/reward-lesson-xp?id=${lesson._id}`, { token: tokenA }).then(r => ({ status: r.status, msg: m(r) })));
  }

  console.log('\n========== 3: CAMPAIGN PARTICIPATE (existing published) ==========');
  const camps = await call('GET', '/campaigns', { token: tokenA });
  const cArr = camps.data?.data || camps.data?.campaigns || camps.data;
  const camp = Array.isArray(cArr) ? (cArr.find(c => (c.status || '').toLowerCase() === 'active') || cArr[0]) : null;
  log('campaigns.list', { status: camps.status, count: cArr?.length, picked: camp?._id });
  if (camp?._id) {
    const cq = await call('GET', `/campaign/quests?id=${camp._id}`, { token: tokenA });
    const quests = cq.data?.campaignQuests || [];
    log('campaign.quests', { status: cq.status, quests: quests.length, tags: quests.map(q => q.tag) });
    log('campaign.join', await call('POST', `/campaign/join-campaign?id=${camp._id}`, { token: tokenA }).then(r => ({ status: r.status, msg: m(r) })));
  }

  console.log('\n========== 4: STUDIO PROJECT (hub admin) ACCOUNT ==========');
  const hub = await studioSignup('project', 'project');
  if (hub.token) log('hub.me', await call('GET', '/hub/me', { token: hub.token }).then(r => ({ status: r.status, name: r.data?.hub?.name || r.data?.name })));

  console.log('\n========== 5: STUDIO USER (user hub) ACCOUNT ==========');
  const uhub = await studioSignup('user', 'userhub');
  if (uhub.token) log('userhub.me', await call('GET', '/user-hub/me', { token: uhub.token }).then(r => ({ status: r.status })));

  console.log('\n========== 6: ANALYTICS + CLAIMS (local) ==========');
  log('analytics', await call('GET', '/get-analytics').then(r => ({ status: r.status, err: r.data?.error })));
  log('get-claims', await call('GET', '/get-claims', { token: tokenA }).then(r => ({ status: r.status, err: r.data?.error })));

  writeFileSync('qa-e2e-report.json', JSON.stringify(R, null, 2));
  console.log('\n=== done -> qa-e2e-report.json ===');
  await mongoose.disconnect();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
