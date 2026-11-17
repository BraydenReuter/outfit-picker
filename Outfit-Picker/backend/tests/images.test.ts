import request from 'supertest';
import app from '../src/app';
import {
  cleanupUnusedImages,
  deleteProcessedImage,
  saveProcessedImage,
} from '../src/services/imageStorage';
import { prisma } from '../src/lib/prisma';
import { config } from '../src/config/env';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==',
  'base64',
);
const missingUrl = '/uploads/00000000-0000-4000-8000-000000000000.png';

beforeEach(async () => {
  await prisma.outfit.deleteMany();
  await prisma.clothingItem.deleteMany();
  await prisma.storedImage.deleteMany();
});
afterAll(() => prisma.$disconnect());

const upload = (bytes: Buffer, contentType = 'image/png') =>
  request(app)
    .post('/api/images')
    .attach('file', bytes, { filename: 'shirt.png', contentType });

describe('processed photo uploads', () => {
  it('rejects a request without an image', async () => {
    const response = await request(app).post('/api/images');
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('A PNG image file is required.');
  });

  it('rejects files that are not labelled PNG', async () => {
    const response = await upload(Buffer.from('not an image'), 'text/plain');
    expect(response.status).toBe(400);
  });

  it.each([Buffer.from('not a PNG at all'), png.subarray(0, 20)])(
    'does not store bytes that are not really a PNG',
    async (bytes) => {
      const response = await upload(bytes);
      expect(response.status).toBe(400);
      expect(await prisma.storedImage.count()).toBe(0);
    },
  );

  it('rejects images with oversized dimensions', async () => {
    const huge = Buffer.from(png);
    huge.writeUInt32BE(5000, 16);
    expect((await upload(huge)).status).toBe(400);
  });

  it('rejects oversized uploads', async () => {
    const response = await upload(Buffer.alloc(4 * 1024 * 1024 + 1));
    expect(response.status).toBe(413);
  });

  it('stores a PNG and serves it back', async () => {
    const response = await upload(png);
    expect(response.status).toBe(201);
    expect(response.body.imageUrl).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/);
    const served = await request(app).get(response.body.imageUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/image\/png/);
    expect(Buffer.compare(served.body, png)).toBe(0);
  });

  it('refuses new photos when storage is full', async () => {
    const previous = config.maxStoredImages;
    config.maxStoredImages = 1;
    try {
      await saveProcessedImage(png);
      expect((await upload(png)).status).toBe(403);
    } finally {
      config.maxStoredImages = previous;
    }
  });

  it('returns 404 for missing or malformed photo paths', async () => {
    expect((await request(app).get(missingUrl)).status).toBe(404);
    expect((await request(app).get('/uploads/..%2Fsecret.png')).status).toBe(
      404,
    );
    await expect(deleteProcessedImage(missingUrl)).resolves.toBeUndefined();
    await expect(
      deleteProcessedImage('https://example.com/image.png'),
    ).resolves.toBeUndefined();
  });
});

describe('photo persistence', () => {
  it('protects a photo while a clothing record uses it', async () => {
    const imageUrl = await saveProcessedImage(png);
    const payload = {
      name: 'Photo tee',
      category: 'TOP',
      type: 'T_SHIRT',
      color: 'WHITE',
      imageUrl,
    };
    const first = await request(app).post('/api/clothing').send(payload);
    const second = await request(app).post('/api/clothing').send(payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    await request(app).delete(`/api/images/${imageUrl.split('/').pop()}`);
    expect((await request(app).get(imageUrl)).status).toBe(200);
    await request(app).delete(`/api/clothing/${first.body.id}`);
    expect((await request(app).get(imageUrl)).status).toBe(200);
    await request(app).delete(`/api/clothing/${second.body.id}`);
    expect((await request(app).get(imageUrl)).status).toBe(404);
  });

  it('cleans up a discarded preview', async () => {
    const imageUrl = await saveProcessedImage(png);
    expect(
      (await request(app).delete(`/api/images/${imageUrl.split('/').pop()}`))
        .status,
    ).toBe(204);
    expect((await request(app).get(imageUrl)).status).toBe(404);
  });

  it('cleans up the old photo after a replacement', async () => {
    const oldImage = await saveProcessedImage(png);
    const newImage = await saveProcessedImage(png);
    const created = await request(app).post('/api/clothing').send({
      name: 'Tee',
      category: 'TOP',
      type: 'T_SHIRT',
      color: 'WHITE',
      imageUrl: oldImage,
    });
    const response = await request(app)
      .patch(`/api/clothing/${created.body.id}`)
      .send({ imageUrl: newImage });
    expect(response.status).toBe(200);
    expect((await request(app).get(oldImage)).status).toBe(404);
    expect((await request(app).get(newImage)).status).toBe(200);
  });

  it('removes only old, unused photos during cleanup', async () => {
    const used = await saveProcessedImage(png);
    const fresh = await saveProcessedImage(png);
    const stale = await saveProcessedImage(png);
    await request(app).post('/api/clothing').send({
      name: 'Tee',
      category: 'TOP',
      type: 'T_SHIRT',
      color: 'WHITE',
      imageUrl: used,
    });
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    for (const url of [used, stale])
      await prisma.storedImage.update({
        where: { id: url.slice(9, -4) },
        data: { createdAt: twoDaysAgo },
      });
    expect(await cleanupUnusedImages()).toBe(1);
    expect((await request(app).get(used)).status).toBe(200);
    expect((await request(app).get(fresh)).status).toBe(200);
    expect((await request(app).get(stale)).status).toBe(404);
  });
});
