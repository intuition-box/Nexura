/** THROWAWAY OTP repro for lead diagnosis. Run: bun qa-otp-repro.mjs (from server dir so .env loads).
 * Reproduces the 4 OTP-send paths and reads the otps collection back from Mongo. Safe to delete. */
import mongoose from 'mongoose';

const API = 'http://localhost:5600/api';
const SUF = Date.now().toString(16);

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = null; let raw = '';
    try { raw = await r.text(); data = JSON.parse(raw); } catch { /* keep raw */ }
    return { status: r.status, data, raw };
  } catch (e) { return { status: 'ERR', data: { error: String(e.message || e) }, raw: '' }; }
}

const otps = () => mongoose.connection.db.collection('otps');

async function readOtp(email) {
  const doc = await otps().findOne({ email: email.toLowerCase() }, { sort: { _id: -1 } });
  if (!doc) return null;
  return { code: doc.code, page: doc.page, role: doc.role, hubId: doc.hubId, expiresAt: doc.expiresAt, _id: String(doc._id) };
}

async function signup(page, label) {
  const email = `qa-otp-${label}-${SUF}@nexura-qa.test`;
  const password = 'QaTest1234!';
  const name = `QA OTP ${label} ${SUF}`;
  const v = await call('POST', `/hub-auth/validate-email?email=${encodeURIComponent(email)}&page=${page}`);
  let code = null;
  try { const doc = await otps().findOne({ email: email.toLowerCase() }, { sort: { _id: -1 } }); code = doc?.code; } catch {}
  const c = await call('POST', '/auth/confirm-hub-email-validation', { body: { email, code } });
  const signupPath = page === 'user' ? '/user-hub/sign-up' : '/hub/sign-up';
  const su = await call('POST', signupPath, { body: { name, email, password, hubName: name, projectName: name } });
  const token = su.data?.accessToken || su.data?.token;
  console.log(`[signup ${label}] validate=${v.status} validateBody=${JSON.stringify(v.data)} gotOtpForSignup=${!!code} confirm=${c.status} confirmBody=${JSON.stringify(c.data)} signup=${su.status} gotToken=${!!token} signupBody=${JSON.stringify(su.data)?.slice(0,200)}`);
  return { email, password, token, name };
}

function header(t) { console.log('\n==================== ' + t + ' ===================='); }

async function main() {
  await mongoose.connect(process.env.DB_URI, { family: 4 });
  console.log('mongo connected. DB:', mongoose.connection.name, '\n');

  // ---------- PATH A: PROJECT-HUB forgot-password ----------
  header('PATH A: PROJECT-HUB forgot-password');
  const hub = await signup('project', 'projfp');
  const fpA = await call('POST', '/hub/forgot-password', { body: { email: hub.email } });
  console.log(`[A] POST /api/hub/forgot-password -> status=${fpA.status}`);
  console.log(`[A] body=${fpA.raw}`);
  const otpA = await readOtp(hub.email);
  console.log(`[A] otps doc for ${hub.email}:`, JSON.stringify(otpA));

  // ---------- PATH B: USER-HUB forgot-password ----------
  header('PATH B: USER-HUB forgot-password');
  const uhub = await signup('user', 'userfp');
  const fpB = await call('POST', '/user-hub/forgot-password', { body: { email: uhub.email } });
  console.log(`[B] POST /api/user-hub/forgot-password -> status=${fpB.status}`);
  console.log(`[B] body=${fpB.raw}`);
  const otpB = await readOtp(uhub.email);
  console.log(`[B] otps doc for ${uhub.email}:`, JSON.stringify(otpB));

  // ---------- PATH C: SIGNUP OTP (validate-email) both pages ----------
  header('PATH C: SIGNUP OTP validate-email (project + user)');
  const emailCp = `qa-otp-vproj-${SUF}@nexura-qa.test`;
  const cP = await call('POST', `/hub-auth/validate-email?email=${encodeURIComponent(emailCp)}&page=project`);
  console.log(`[C-project] POST /api/hub-auth/validate-email?page=project -> status=${cP.status}`);
  console.log(`[C-project] body=${cP.raw}`);
  console.log(`[C-project] otps doc:`, JSON.stringify(await readOtp(emailCp)));

  const emailCu = `qa-otp-vuser-${SUF}@nexura-qa.test`;
  const cU = await call('POST', `/hub-auth/validate-email?email=${encodeURIComponent(emailCu)}&page=user`);
  console.log(`[C-user] POST /api/hub-auth/validate-email?page=user -> status=${cU.status}`);
  console.log(`[C-user] body=${cU.raw}`);
  console.log(`[C-user] otps doc:`, JSON.stringify(await readOtp(emailCu)));

  // ---------- PATH D: INVITE add-admin (needs project superadmin token) ----------
  header('PATH D: INVITE /api/hub/add-admin (findOneAndUpdate WITHOUT page)');
  if (!hub.token) {
    console.log('[D] SKIPPED: no project-hub token from signup A');
  } else {
    const inviteEmail = `qa-otp-invite-${SUF}@nexura-qa.test`;
    const d = await call('POST', '/hub/add-admin', { token: hub.token, body: { email: inviteEmail, role: 'admin', clientUrl: 'http://localhost:5173' } });
    console.log(`[D] POST /api/hub/add-admin -> status=${d.status}`);
    console.log(`[D] body=${d.raw}`);
    console.log(`[D] otps doc for ${inviteEmail}:`, JSON.stringify(await readOtp(inviteEmail)));
  }

  // ---------- PATH D2: DIRECT MODEL TEST of the invite findOneAndUpdate (NO page) ----------
  header('PATH D2: direct OTP.findOneAndUpdate upsert WITHOUT page (replicates hub.controller.ts:283)');
  // Replicate the OTP schema exactly as server/src/models/otp.model.ts
  const OTPSchema = new mongoose.Schema({
    email: { type: String, required: true },
    hubId: { type: String },
    userId: { type: String },
    role: { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
    code: { type: String, required: true },
    page: { type: String, enum: ['user', 'project'], required: true },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 5 * 60 * 1000), expires: 0 },
  });
  const OTP = mongoose.models.OTPs || mongoose.model('OTPs', OTPSchema);
  const dEmail = `qa-otp-d2-${SUF}@nexura-qa.test`;
  const fakeHubId = '6a2b12be7450ac3d397fa800';
  // (a) default runValidators behavior (Mongoose default = false for findOneAndUpdate)
  try {
    const r = await OTP.findOneAndUpdate(
      { email: dEmail, hubId: fakeHubId },
      { email: dEmail, code: '999111', hubId: fakeHubId, role: 'admin', expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const back = await otps().findOne({ _id: r._id });
    console.log(`[D2-default] NO THROW. inserted doc page=${JSON.stringify(back?.page)} role=${JSON.stringify(back?.role)} code=${back?.code} _id=${String(r._id)}`);
  } catch (e) {
    console.log(`[D2-default] THREW: name=${e.name} message=${e.message}`);
  }
  // (b) with runValidators:true (what WOULD happen if validators were on)
  const dEmail2 = `qa-otp-d2b-${SUF}@nexura-qa.test`;
  try {
    const r = await OTP.findOneAndUpdate(
      { email: dEmail2, hubId: fakeHubId },
      { email: dEmail2, code: '999222', hubId: fakeHubId, role: 'admin', expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    console.log(`[D2-runValidators] NO THROW. _id=${String(r._id)}`);
  } catch (e) {
    console.log(`[D2-runValidators] THREW: name=${e.name} message=${e.message}`);
  }

  console.log('\n=== repro done ===');
  await mongoose.disconnect();
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
