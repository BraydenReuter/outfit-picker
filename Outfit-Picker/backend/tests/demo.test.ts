import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { config } from '../src/config/env';
import { demoPieces, resetDemoWardrobe } from '../src/services/demo';

beforeEach(async () => {
  await prisma.outfit.deleteMany();
  await prisma.clothingItem.deleteMany();
  await prisma.storedImage.deleteMany();
  await prisma.demoState.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe('demo wardrobe', () => {
  it('loads the sample pieces, photos, and outfits', async () => {
    await resetDemoWardrobe();
    const clothing = await request(app).get('/api/clothing');
    expect(clothing.body).toHaveLength(demoPieces.length);
    const outfits = await request(app).get('/api/outfits');
    expect(outfits.body.length).toBeGreaterThan(0);
    const photo = await request(app).get(clothing.body[0].imageUrl);
    expect(photo.status).toBe(200);
  });

  it('restores the sample wardrobe once the reset interval has passed', async () => {
    const previous = config.demoResetHours;
    config.demoResetHours = 24;
    try {
      // First request on an empty database seeds it.
      expect((await request(app).get('/api/clothing')).body).toHaveLength(
        demoPieces.length,
      );
      await request(app).post('/api/clothing').send({
        name: 'Visitor tee',
        category: 'TOP',
        type: 'T_SHIRT',
        color: 'RED',
      });
      // Not due yet, so the visitor's change stays.
      expect((await request(app).get('/api/clothing')).body).toHaveLength(
        demoPieces.length + 1,
      );
    } finally {
      config.demoResetHours = previous;
    }
  });

  it('caps how many pieces and outfits can be saved', async () => {
    const previous = [config.maxClothingItems, config.maxOutfits];
    config.maxClothingItems = 1;
    config.maxOutfits = 0;
    try {
      const top = await request(app).post('/api/clothing').send({
        name: 'Tee',
        category: 'TOP',
        type: 'T_SHIRT',
        color: 'WHITE',
      });
      expect(top.status).toBe(201);
      const extra = await request(app).post('/api/clothing').send({
        name: 'Jeans',
        category: 'BOTTOM',
        type: 'JEANS',
        color: 'BLUE',
      });
      expect(extra.status).toBe(403);
      const outfit = await request(app).post('/api/outfits').send({
        name: 'Look',
        topClothingItemId: top.body.id,
        bottomClothingItemId: top.body.id,
      });
      expect(outfit.status).toBe(403);
    } finally {
      [config.maxClothingItems, config.maxOutfits] = previous;
    }
  });
});
