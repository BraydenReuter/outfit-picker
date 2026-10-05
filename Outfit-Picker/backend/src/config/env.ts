import dotenv from 'dotenv';

dotenv.config();

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  imageProcessingTimeoutMs: Number(
    process.env.IMAGE_PROCESSING_TIMEOUT_MS ?? 180_000,
  ),
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  imageServiceUrl: process.env.IMAGE_SERVICE_URL ?? 'http://127.0.0.1:8001',
};
