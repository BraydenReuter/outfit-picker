import request from 'supertest';
import app from '../src/app';
import { stat } from 'node:fs/promises';
import {
  deleteProcessedImage,
  saveProcessedImage,
  uploadsDirectory,
} from '../src/services/imageStorage';

import path from 'node:path';
import { prisma } from '../src/lib/prisma';
import { config } from '../src/config/env';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==',
  'base64',
);

beforeEach(async () => {
  await prisma.outfitItem.deleteMany();
  await prisma.outfit.deleteMany();
  await prisma.clothingItem.deleteMany();
});
afterAll(() => prisma.$disconnect());

const createdImageUrls: string[] = [];

afterEach(async () => {
  jest.restoreAllMocks();
  await prisma.clothingItem.deleteMany();
  await Promise.all(createdImageUrls.splice(0).map(deleteProcessedImage));
});

describe('image processing proxy', () => {
  it('rejects a request without an image', async () => {
    const response = await request(app).post('/api/images/remove-background');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('An image file is required.');
  });

  it('rejects unsupported file types', async () => {
    const response = await request(app)
      .post('/api/images/remove-background')
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('An image file is required.');
  });

  it('returns a clear error when the image service is unavailable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('connection refused'));

    const response = await request(app)
      .post('/api/images/remove-background')
      .attach('file', Buffer.from('image bytes'), {
        filename: 'shirt.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe(
      'The image processing service is unavailable.',
    );
  });

  it('proxies a successful processed PNG response', async () => {
    const processedPng = png;
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(processedPng, {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
      );

    const response = await request(app)
      .post('/api/images/remove-background')
      .attach('file', Buffer.from([1, 2, 3]), {
        filename: 'shirt.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(201);
    expect(response.body.imageUrl).toMatch(/^\/uploads\/[A-Za-z0-9-]+\.png$/);
    createdImageUrls.push(response.body.imageUrl);
    await expect(
      stat(
        path.join(uploadsDirectory, response.body.imageUrl.split('/').pop()),
      ),
    ).resolves.toBeDefined();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects oversized uploads', async () => {
    const response = await request(app)
      .post('/api/images/remove-background')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'large.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(413);
  });

  it('maps an image-service failure to a gateway error', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Inference failed' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const response = await request(app)
      .post('/api/images/remove-background')
      .attach('file', Buffer.from([1, 2, 3]), {
        filename: 'shirt.png',
        contentType: 'image/png',
      });

    expect(response.status).toBe(502);
    expect(response.body.message).toBe(
      'The image processing service rejected the image.',
    );
  });

  it('deletes local images safely and ignores external URLs', async () => {
    await expect(
      deleteProcessedImage('/uploads/missing.png'),
    ).resolves.toBeUndefined();
    await expect(
      deleteProcessedImage('https://example.com/image.png'),
    ).resolves.toBeUndefined();
  });
});

describe('photo persistence regressions', () => {
  it('serves a processed PNG and protects it while a clothing record uses it', async () => {
    const imageUrl = await saveProcessedImage(png);
    createdImageUrls.push(imageUrl);
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

  it('cleans up a discarded processed preview', async () => {
    const imageUrl = await saveProcessedImage(png);
    createdImageUrls.push(imageUrl);
    expect(
      (await request(app).delete(`/api/images/${imageUrl.split('/').pop()}`))
        .status,
    ).toBe(204);
    expect((await request(app).get(imageUrl)).status).toBe(404);
  });

  it('cleans up the old photo after a successful replacement', async () => {
    const oldImage = await saveProcessedImage(png);
    const newImage = await saveProcessedImage(png);
    createdImageUrls.push(oldImage, newImage);
    const created = await request(app)
      .post('/api/clothing')
      .send({
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

  it.each([Buffer.from('not a PNG'), png.subarray(0, 4)])(
    'does not save a malformed model response',
    async (bytes) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(bytes, { headers: { 'content-type': 'image/png' } }),
        );
      const result = await request(app)
        .post('/api/images/remove-background')
        .attach('file', png, {
          filename: 'shirt.png',
          contentType: 'image/png',
        });
      expect(result.status).toBe(502);
      expect(result.body.imageUrl).toBeUndefined();
    },
  );

  it('preserves validation errors from the image service', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 400 }));
    expect(
      (
        await request(app)
          .post('/api/images/remove-background')
          .attach('file', png, {
            filename: 'shirt.png',
            contentType: 'image/png',
          })
      ).status,
    ).toBe(400);
  });

  it('times out an unresponsive image service', async () => {
    const previous = config.imageProcessingTimeoutMs;
    config.imageProcessingTimeoutMs = 10;
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Timed out', 'AbortError')),
          );
        }),
    );
    try {
      const result = await request(app)
        .post('/api/images/remove-background')
        .attach('file', png, {
          filename: 'shirt.png',
          contentType: 'image/png',
        });
      expect(result.status).toBe(504);
    } finally {
      config.imageProcessingTimeoutMs = previous;
    }
  });
});
