const request = require('supertest');
const app = require('../src/app');

describe('inventory-api', () => {
  test('GET /health reports ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /api/items lists the seed items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /api/items/:id returns 404 for an unknown id', async () => {
    const res = await request(app).get('/api/items/9999');
    expect(res.status).toBe(404);
  });

  test('POST /api/items creates an item', async () => {
    const res = await request(app).post('/api/items').send({ name: '  Desk mat ', stock: 10 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Desk mat', stock: 10 });

    const fetched = await request(app).get(`/api/items/${res.body.id}`);
    expect(fetched.body.name).toBe('Desk mat');
  });

  test.each([
    [{ stock: 5 }],
    [{ name: '', stock: 5 }],
    [{ name: 'Mat', stock: -1 }],
    [{ name: 'Mat', stock: 1.5 }],
  ])('POST /api/items rejects invalid body %j', async (body) => {
    const res = await request(app).post('/api/items').send(body);
    expect(res.status).toBe(400);
  });
});
