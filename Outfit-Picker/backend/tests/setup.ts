import path from 'node:path';

process.env.DATABASE_URL = 'file:./test.db';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.IMAGE_SERVICE_URL = 'http://127.0.0.1:8001';
process.env.UPLOADS_DIRECTORY = path.resolve(__dirname, '../test-uploads');
