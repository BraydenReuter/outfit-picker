import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';

const topPayload = {
  name: 'Test Tee',
  category: 'TOP',
  type: 'T_SHIRT',
  color: 'WHITE',
  brand: 'Test Brand',
  size: 'M',
  imageUrl: 'https://example.com/tee.jpg',
  description: 'A test tee.',
};
const bottomPayload = {
  name: 'Test Jeans',
  category: 'BOTTOM',
  type: 'JEANS',
  color: 'BLUE',
  brand: 'Test Brand',
  size: '32',
  description: 'A test pair of jeans.',
};

beforeEach(async () => {
  await prisma.outfitItem.deleteMany();
  await prisma.outfit.deleteMany();
  await prisma.clothingItem.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('clothing API', () => {
  it('returns a healthy server response', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('creates, reads, updates, and deletes clothing', async () => {
    const created = await request(app).post('/api/clothing').send(topPayload);
    expect(created.status).toBe(201);
    expect(created.body.name).toBe(topPayload.name);
    expect(
      (await request(app).get(`/api/clothing/${created.body.id}`)).status,
    ).toBe(200);
    const updated = await request(app)
      .patch(`/api/clothing/${created.body.id}`)
      .send({ name: 'Updated Tee' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Updated Tee');
    expect(
      (await request(app).delete(`/api/clothing/${created.body.id}`)).status,
    ).toBe(204);
    expect(
      (await request(app).get(`/api/clothing/${created.body.id}`)).status,
    ).toBe(404);
  });

  it('rejects invalid payloads and category/type combinations', async () => {
    expect(
      (
        await request(app)
          .post('/api/clothing')
          .send({ name: '', category: 'INVALID' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/clothing')
          .send({ ...topPayload, category: 'BOTTOM', type: 'HOODIE' })
      ).status,
    ).toBe(400);
  });

  it('filters using database query parameters', async () => {
    await request(app).post('/api/clothing').send(topPayload);
    await request(app)
      .post('/api/clothing')
      .send({ ...bottomPayload, name: 'Blue Jeans' });
    await request(app)
      .post('/api/clothing')
      .send({
        ...topPayload,
        name: 'Black Hoodie',
        type: 'HOODIE',
        color: 'BLACK',
      });
    expect(
      (await request(app).get('/api/clothing?category=TOP')).body,
    ).toHaveLength(2);
    const search = await request(app).get('/api/clothing?search=jeans');
    expect(search.body).toHaveLength(1);
    expect(search.body[0].name).toBe('Blue Jeans');
  });

  it('returns 404 for missing clothing resources', async () => {
    expect((await request(app).get('/api/clothing/missing-item')).status).toBe(
      404,
    );
    expect(
      (
        await request(app)
          .patch('/api/clothing/missing-item')
          .send({ name: 'Updated' })
      ).status,
    ).toBe(404);
    expect(
      (await request(app).delete('/api/clothing/missing-item')).status,
    ).toBe(404);
  });

  it('rejects invalid category/type combinations on update', async () => {
    const created = await request(app).post('/api/clothing').send(topPayload);
    const response = await request(app)
      .patch(`/api/clothing/${created.body.id}`)
      .send({ category: 'BOTTOM', type: 'HOODIE' });
    expect(response.status).toBe(400);
  });
});

describe('outfit API', () => {
  it('creates and deletes an outfit with a top and bottom', async () => {
    const top = await request(app).post('/api/clothing').send(topPayload);
    const bottom = await request(app).post('/api/clothing').send(bottomPayload);
    const created = await request(app)
      .post('/api/outfits')
      .send({
        name: 'Test Look',
        topClothingItemId: top.body.id,
        bottomClothingItemId: bottom.body.id,
      });
    expect(created.status).toBe(201);
    expect(created.body.items).toHaveLength(2);
    expect((await request(app).get('/api/outfits')).body[0].name).toBe(
      'Test Look',
    );
    expect(
      (await request(app).delete(`/api/outfits/${created.body.id}`)).status,
    ).toBe(204);
    expect(
      (await request(app).get(`/api/outfits/${created.body.id}`)).status,
    ).toBe(404);
  });

  it('rejects a top used as the bottom item', async () => {
    const top = await request(app).post('/api/clothing').send(topPayload);
    const response = await request(app)
      .post('/api/outfits')
      .send({
        name: 'Invalid Look',
        topClothingItemId: top.body.id,
        bottomClothingItemId: top.body.id,
      });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a missing outfit', async () => {
    expect((await request(app).get('/api/outfits/missing-outfit')).status).toBe(
      404,
    );
    expect(
      (await request(app).delete('/api/outfits/missing-outfit')).status,
    ).toBe(404);
  });

  it('rejects outfits with nonexistent clothing IDs', async () => {
    const response = await request(app)
      .post('/api/outfits')
      .send({
        name: 'Missing Look',
        topClothingItemId: 'missing-top',
        bottomClothingItemId: 'missing-bottom',
      });
    expect(response.status).toBe(400);
  });

  it('updates an outfit and rejects invalid replacement pairs', async () => {
    const top = await request(app).post('/api/clothing').send(topPayload);
    const secondTop = await request(app)
      .post('/api/clothing')
      .send({ ...topPayload, name: 'Second Tee' });
    const bottom = await request(app).post('/api/clothing').send(bottomPayload);
    const created = await request(app)
      .post('/api/outfits')
      .send({
        name: 'Original Look',
        topClothingItemId: top.body.id,
        bottomClothingItemId: bottom.body.id,
      });

    const updated = await request(app)
      .patch(`/api/outfits/${created.body.id}`)
      .send({ name: 'Updated Look', topClothingItemId: secondTop.body.id });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Updated Look');
    expect(
      updated.body.items.find((item: { role: string }) => item.role === 'TOP')
        .clothingItemId,
    ).toBe(secondTop.body.id);

    const invalid = await request(app)
      .patch(`/api/outfits/${created.body.id}`)
      .send({ bottomClothingItemId: secondTop.body.id });
    expect(invalid.status).toBe(400);
  });

  it('deletes dependent outfits when clothing is deleted', async () => {
    const top = await request(app).post('/api/clothing').send(topPayload);
    const bottom = await request(app).post('/api/clothing').send(bottomPayload);
    const outfit = await request(app)
      .post('/api/outfits')
      .send({
        name: 'Cascade Look',
        topClothingItemId: top.body.id,
        bottomClothingItemId: bottom.body.id,
      });

    expect(
      (await request(app).delete(`/api/clothing/${top.body.id}`)).status,
    ).toBe(204);
    const persisted = await prisma.outfit.findUnique({
      where: { id: outfit.body.id },
      include: { items: true },
    });
    expect(persisted).toBeNull();
    expect((await request(app).get('/api/outfits')).body).toHaveLength(0);
    expect(
      (await request(app).get(`/api/clothing/${bottom.body.id}`)).status,
    ).toBe(200);
  });
});

describe('wardrobe regressions', () => {
  it.each(['white', 't shirt', 'test brand', 'M'])(
    'searches metadata using %s',
    async (search) => {
      await request(app).post('/api/clothing').send(topPayload);
      const response = await request(app)
        .get('/api/clothing')
        .query({ search });
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    },
  );

  it('combines filters including size and does not ignore them after an edit', async () => {
    const created = await request(app).post('/api/clothing').send(topPayload);
    await request(app)
      .post('/api/clothing')
      .send({ ...topPayload, size: 'L' });
    const query = {
      category: 'TOP',
      type: 'T_SHIRT',
      color: 'WHITE',
      brand: 'Test',
      size: 'M',
    };
    expect(
      (await request(app).get('/api/clothing').query(query)).body,
    ).toHaveLength(1);
    await request(app)
      .patch(`/api/clothing/${created.body.id}`)
      .send({ color: 'BLUE' });
    expect(
      (await request(app).get('/api/clothing').query(query)).body,
    ).toHaveLength(0);
    expect((await request(app).get('/api/clothing')).body).toHaveLength(2);
  });

  it('clears optional metadata without creating another record', async () => {
    const item = await request(app).post('/api/clothing').send(topPayload);
    const edited = await request(app)
      .patch(`/api/clothing/${item.body.id}`)
      .send({ brand: '', size: '', description: '' });
    expect(edited.status).toBe(200);
    expect(edited.body.id).toBe(item.body.id);
    expect(edited.body.brand).toBeNull();
    expect(edited.body.size).toBeNull();
    expect((await request(app).get('/api/clothing')).body).toHaveLength(1);
  });

  it('keeps a saved outfit valid when a category change is attempted', async () => {
    const top = await request(app).post('/api/clothing').send(topPayload);
    const bottom = await request(app).post('/api/clothing').send(bottomPayload);
    const outfit = await request(app)
      .post('/api/outfits')
      .send({
        name: 'Keep this pair',
        topClothingItemId: top.body.id,
        bottomClothingItemId: bottom.body.id,
      });
    const response = await request(app)
      .patch(`/api/clothing/${top.body.id}`)
      .send({ category: 'BOTTOM', type: 'SHORTS' });
    expect(response.status).toBe(409);
    expect(
      (await request(app).get(`/api/outfits/${outfit.body.id}`)).body.items,
    ).toHaveLength(2);
    expect(
      (await request(app).get(`/api/clothing/${top.body.id}`)).body.category,
    ).toBe('TOP');
  });

  it('rejects malformed JSON and empty updates as client errors', async () => {
    expect(
      (
        await request(app)
          .post('/api/clothing')
          .set('Content-Type', 'application/json')
          .send('{broken')
      ).status,
    ).toBe(400);
    const item = await request(app).post('/api/clothing').send(topPayload);
    expect(
      (await request(app).patch(`/api/clothing/${item.body.id}`).send({}))
        .status,
    ).toBe(400);
    expect(
      (await request(app).get('/api/clothing?category=SHOES')).status,
    ).toBe(400);
  });

  it('rejects unsafe image URLs and missing local files', async () => {
    for (const imageUrl of [
      'javascript:alert(1)',
      '/uploads/../secret.png',
      '/uploads/missing.png',
    ]) {
      expect(
        (
          await request(app)
            .post('/api/clothing')
            .send({ ...topPayload, imageUrl })
        ).status,
      ).toBe(400);
    }
  });
});
