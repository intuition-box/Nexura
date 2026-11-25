/** Local forgot-password email test. Run from server dir: bun qa-otp-local-send.mjs
 * Creates officialbeebop@gmail.com as a project admin in the local DB (if missing),
 * then triggers forgot-password so the LOCAL backend sends the reset OTP email. */
import mongoose from 'mongoose';

const API = 'http://localhost:5600/api';
// Read from the environment, never hardcoded (this repo is public)
const EMAIL = process.env.QA_EMAIL;
const PASSWORD = process.env.QA_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("Set QA_EMAIL and QA_PASSWORD to run this script."); process.exit(1); }
const NAME = 'beebop';

async function call(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let raw = ''; try { raw = await r.text(); } catch {}
    return { status: r.status, raw };
  } catch (e) { return { status: 'ERR', raw: String(e.message || e) }; }
}
const otps = () => mongoose.connection.db.collection('otps');
const latestOtp = async (email) => (await otps().findOne({ email: email.toLowerCase() }, { sort: { _id: -1 } }));

async function main() {
  await mongoose.connect(process.env.DB_URI, { family: 4 });
  console.log('mongo connected -> DB:', mongoose.connection.name);

  const admins = mongoose.connection.db.collection('hubadmins');
  const exists = await admins.findOne({ email: EMAIL.toLowerCase() });
  console.log('officialbeebop admin already in this DB?', !!exists);

  if (!exists) {
    console.log('\n--- creating admin via signup flow ---');
    const v = await call('POST', `/hub-auth/validate-email?email=${encodeURIComponent(EMAIL)}&name=${encodeURIComponent(NAME)}&page=project`);
    console.log('validate-email:', v.status, v.raw);
    const code = (await latestOtp(EMAIL))?.code;
    console.log('signup OTP read from DB:', code);
    const c = await call('POST', '/auth/confirm-hub-email-validation', { body: { email: EMAIL, code } });
    console.log('confirm-email:', c.status, c.raw);
    const su = await call('POST', '/hub/sign-up', { body: { name: NAME, email: EMAIL, password: PASSWORD } });
    console.log('sign-up:', su.status, su.raw.slice(0, 140));
  }

  console.log('\n--- TRIGGER forgot-password (sends reset OTP email through localhost) ---');
  const fp = await call('POST', '/hub/forgot-password', { body: { email: EMAIL, role: 'project' } });
  console.log('FORGOT-PASSWORD ->', fp.status, fp.raw);
  const reset = await latestOtp(EMAIL);
  console.log('reset OTP now in DB:', reset?.code, '(page=' + reset?.page + ', role=' + reset?.role + ')');

  await mongoose.disconnect();
  console.log('\n=== done ===');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
