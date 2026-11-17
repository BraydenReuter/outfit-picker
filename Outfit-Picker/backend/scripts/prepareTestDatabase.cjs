// Applies migrations to the separate test database before Jest runs.
// The tests clear the tables they use, so never point this at real data.
const { execSync } = require('node:child_process');
require('dotenv').config({ quiet: true });

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error('Set TEST_DATABASE_URL to an empty Postgres database used only for tests.');
  process.exit(1);
}
if (url === process.env.DATABASE_URL) {
  console.error('TEST_DATABASE_URL must differ from DATABASE_URL; tests delete its rows.');
  process.exit(1);
}
execSync('npx prisma migrate deploy', {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
