import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
const BASES = { local: 'http://localhost:5600/api', staging: 'https://staging-api.nexura.intuition.box/api' };
await mongoose.connect(process.env.DB_URI, { family: 4 });
const adminDoc = await mongoose.connection.db.collection('admins').findOne({});
const userDoc = await mongoose.connection.db.collection('users').findOne({ address: { $exists: true } });
if (!adminDoc || !userDoc) { console.log('missing admin or user', { admin: !!adminDoc, user: !!userDoc }); process.exit(0); }
const token = jwt.sign({ id: String(adminDoc._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log('admin:', adminDoc.email || adminDoc._id, '| target user:', userDoc.address);
for (const [name, API] of Object.entries(BASES)) {
  console.log(`\n--- ${name} (${API}) ---`);
  for (const type of ['wotw', 'spotlight', 'campaign', 'quest']) {
    try {
      const r = await fetch(`${API}/admin/reward-xp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ address: userDoc.address, xp: '5', type }) });
      let d = null; try { d = await r.json(); } catch {}
      console.log(`type=${type.padEnd(9)} -> ${r.status} ${JSON.stringify(d)}`);
    } catch (e) { console.log(`type=${type.padEnd(9)} -> ERR ${String(e.message).slice(0, 80)}`); }
  }
}
await mongoose.disconnect();
