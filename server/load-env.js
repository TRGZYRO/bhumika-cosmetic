/**
 * Loads .env.local into process.env for local development.
 *
 * ES imports are hoisted and evaluated before any statement in the importing
 * module runs. API modules read process.env at module load time, so this file
 * MUST be the first import in server/dev.js. Importing it first guarantees the
 * environment is populated before the route handlers are evaluated.
 */
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
