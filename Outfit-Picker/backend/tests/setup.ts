import dotenv from 'dotenv';

dotenv.config({ quiet: true });
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CLIENT_URL = 'http://localhost:5173';
