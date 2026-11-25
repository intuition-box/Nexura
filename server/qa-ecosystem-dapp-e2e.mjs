// E2E Test: Ecosystem Dapp Creation + Public Verification
// Creates a dapp directly in MongoDB, then verifies it appears on the public ecosystem dapps page.

import { MongoClient } from 'mongodb';

const BASE = process.env.API_URL || 'http://localhost:5600';
// Read from the environment, never hardcoded (this repo is public)
const MONGO_URI = process.env.DB_URI;
if (!MONGO_URI) { console.error("Set DB_URI to run this script."); process.exit(1); }
const TEST_DAPP_NAME = `E2E Test Dapp ${Date.now()}`;

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

async function run() {
  console.log('═══════════════════════════════════════');
  console.log('  Ecosystem Dapp E2E Test (MongoDB Direct)');
  console.log('═══════════════════════════════════════\n');

  let allPassed = true;
  let createdDappId = null;

  // ── Step 1: Create dapp directly in MongoDB ──
  console.log('── Step 1: Create dapp directly in MongoDB ──');
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const logoUrl = 'https://placehold.co/256x256/7c3aed/ffffff?text=E2E';
    const dappDoc = {
      name: TEST_DAPP_NAME,
      description: 'E2E test dapp created via MongoDB direct insert',
      logo: logoUrl,
      websiteUrl: 'https://example.com/e2e-test',
      reward: 50,
      category: 'quests',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('ecosystem-quests').insertOne(dappDoc);
    createdDappId = result.insertedId.toString();
    console.log(`✅ Dapp created in MongoDB: ${createdDappId}`);
    console.log(`   Name: ${TEST_DAPP_NAME}`);
    console.log(`   Logo: ${logoUrl}`);
  } catch (err) {
    console.error('❌ MongoDB insert failed:', err.message);
    allPassed = false;
  } finally {
    await client.close();
  }

  // ── Step 2: Verify dapp appears in public ecosystem API ──
  console.log('\n── Step 2: Verify dapp appears in public API ──');
  const publicRes = await fetchJson(`${BASE}/api/ecosystem-quests`);
  if (publicRes.status === 200 && publicRes.body.ecosystemQuests) {
    const dapps = publicRes.body.ecosystemQuests;
    console.log(`✅ Public ecosystem has ${dapps.length} dapps`);

    const found = dapps.find(d => d.name === TEST_DAPP_NAME);
    if (found) {
      console.log('✅ Test dapp found in public list!');
      console.log(`   ID: ${found._id}`);
      console.log(`   Name: ${found.name}`);
      console.log(`   Logo: ${(found.logo || '').slice(0, 60)}...`);
      console.log(`   Category: ${found.category}`);
      console.log(`   Reward: ${found.reward} XP`);
      console.log(`   Fields: ${Object.keys(found).join(', ')}`);
    } else {
      console.log('❌ Test dapp NOT found in public list');
      console.log('   Dapps in list:', dapps.map(d => d.name).join(', '));
      allPassed = false;
    }
  } else {
    console.log('❌ Failed to fetch public dapps:', publicRes.status, JSON.stringify(publicRes.body).slice(0, 200));
    allPassed = false;
  }

  // ── Step 3: Clean up ──
  if (createdDappId) {
    console.log('\n── Step 3: Clean up test dapp ──');
    const client2 = new MongoClient(MONGO_URI);
    try {
      await client2.connect();
      const db = client2.db();
      const { ObjectId } = await import('mongodb');
      await db.collection('ecosystem-quests').deleteOne({ _id: new ObjectId(createdDappId) });
      console.log('✅ Test dapp deleted from MongoDB');
    } catch (err) {
      console.log('⚠️  Cleanup failed:', err.message);
    } finally {
      await client2.close();
    }
  }

  // ── Summary ──
  console.log('\n═══════════════════════════════════════');
  console.log(allPassed ? '  ✅ ALL TESTS PASSED' : '  ❌ SOME TESTS FAILED');
  console.log('═══════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
