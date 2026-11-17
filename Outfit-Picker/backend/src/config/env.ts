import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const optionalNumber = (value: string | undefined, fallback: number) =>
  value === undefined || value === '' ? fallback : Number(value);

export const config = {
  host: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  // When set, Express also serves the built frontend from this folder.
  staticDirectory: process.env.STATIC_DIRECTORY,
  // Public demo: restore the sample wardrobe every N hours. 0 turns it off.
  demoResetHours: optionalNumber(process.env.DEMO_RESET_HOURS, 0),
  // Caps that keep a shared, public database small.
  maxClothingItems: optionalNumber(process.env.MAX_CLOTHING_ITEMS, 500),
  maxOutfits: optionalNumber(process.env.MAX_OUTFITS, 500),
  maxStoredImages: optionalNumber(process.env.MAX_STORED_IMAGES, 1000),
  // Write requests (POST/PATCH/DELETE) allowed per visitor IP every 15 minutes.
  writeRateLimit: optionalNumber(process.env.WRITE_RATE_LIMIT, 0),
  // Number of reverse proxies in front of the app (1 on Render).
  trustProxy: optionalNumber(process.env.TRUST_PROXY, 0),
};
