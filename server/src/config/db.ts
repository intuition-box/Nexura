import mongoose from "mongoose";
import { DB_URI } from "@/utils/env.utils";
import logger from "./logger";

/** Drop legacy non-sparse unique indexes across all collections so current schema takes effect */
async function fixStaleIndexes() {
	const db = mongoose.connection;
	// Map: collection name → index names to drop if they exist
	const indexFixes: Record<string, string[]> = {
		projects: ["guildId_1", "verifiedId_1", "xUsername_1", "address_1", "email_1", "name_1"],
		"hub-admins": ["address_1", "xUsername_1"],
		users: ["email_1"],
		campaigns: ["email_1", "address_1"],
	};

	for (const [colName, toDrop] of Object.entries(indexFixes)) {
		try {
			const col = db.collection(colName);
			const indexes = await col.indexes();
			for (const name of toDrop) {
				const existing = indexes.find((i: any) => i.name === name);
				if (existing) {
					await col.dropIndex(name);
					logger.info(`DB: dropped stale index ${name} on ${colName}`);
				}
			}
		} catch (err: any) {
			// Non-fatal — collection may not exist yet
			logger.warn(`DB: fixStaleIndexes(${colName}) skipped: ${err.message}`);
		}
	}

	// Recreate projects.name_1 as binary (case-sensitive) unique index.
	// Prior index was created with locale collation which treated "Nexura" and
	// "nexura" as equal, blocking distinct-case hub names.
	try {
		const col = db.collection("projects");
		const idxs = await col.indexes();
		if (!idxs.find((i: any) => i.name === "name_1")) {
			await col.createIndex({ name: 1 }, { unique: true, name: "name_1" });
			logger.info(`DB: created case-sensitive unique index name_1 on projects`);
		}
	} catch (err: any) {
		logger.warn(`DB: recreate projects.name_1 skipped: ${err.message}`);
	}
}

const connectDB = async (attempt = 1): Promise<void> => {
	try {
		const connect = await mongoose.connect(DB_URI, { family: 4 });
		logger.info(
			`\x1b[36m%s\x1b[0m`,
			`DB: MongoDB Connected: ${connect.connection.host}`
		);
		await fixStaleIndexes();
	} catch (error: any) {
		// Do not exit: keep the server up and retry (2s, 4s … up to 30s apart) until the database is back.
		// Mongoose only reconnects by itself after a first successful connection
		const delay = Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
		logger.error(
			`\x1b[31m%s\x1b[0m`,
			`DB: MongoDB Connection Failure (attempt ${attempt}): ${error.message}. Retrying in ${delay / 1000}s`
		);
		setTimeout(() => { void connectDB(attempt + 1); }, delay);
	}
};

export default connectDB;
