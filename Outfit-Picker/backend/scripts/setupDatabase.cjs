const { mkdir, open } = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({ quiet: true });

async function setupDatabase() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  if (!url.startsWith('file:')) throw new Error('This app expects a SQLite file URL.');
  const databasePath = path.resolve(__dirname, '../prisma', url.slice(5));
  await mkdir(path.dirname(databasePath), { recursive: true });
  // Create a missing file without clearing anything that is already saved.
  const file = await open(databasePath, 'a');
  await file.close();
}

setupDatabase().catch((error) => { console.error(error); process.exitCode = 1; });
