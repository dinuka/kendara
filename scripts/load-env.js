// Preloaded with `-r` by the package.json scripts so env vars are set before any module reads
// process.env at import time (db.ts, storage.ts). Mirrors Next.js: .env.local wins over .env, and
// variables already set in the shell are never overwritten.
const fs = require("fs");

for (const file of [".env.local", ".env"]) {
    if (fs.existsSync(file)) process.loadEnvFile(file);
}
