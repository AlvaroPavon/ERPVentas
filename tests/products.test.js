const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('🏷️ Productos', () => {
  beforeEach(() => resetDb());

  let authUser, company;

  beforeEach(() => {
    authUser = createTestUser({ email: 'productos@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
  });

  describe('GET /api/companies/:companyId/products', () => {
    it('debería devolver catálogo de productos', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/companies/:companyId/products', () => {
    it('debería crear un producto', async () => {
      const app = require('../server');

      const res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({ name: 'Producto Test', price: 5.00, category: 'comida' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Producto Test');
    });

    it('debería crear producto con variantes de precio', async () => {
      const app = require('../server');

      const res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({
          name: 'Cerveza Premium',
          price: 4.00,
          prices: [
            { name: 'unidad', price: 4.00, quantity: 1 },
            { name: 'pack 6', price: 3.50, quantity: 6 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('DELETE /api/companies/:companyId/products/:productId', () => {
    it('debería eliminar un producto (admin)', async () => {
      const app = require('../server');

      let res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({ name: 'A Borrar', price: 1.00 });

      const productId = res.body.id;

      res = await request(app)
        .delete(`/api/companies/${company.id}/products/${productId}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Producto eliminado');
    });
  });
});

describe('📦 Exportar Catálogo', () => {
  beforeEach(() => resetDb());

  let authUser, company;

  beforeEach(() => {
    authUser = createTestUser({ email: 'export@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
  });

  it('debería exportar catálogo a CSV', async () => {
    const app = require('../server');

    await request(app)
      .post(`/api/companies/${company.id}/products`)
      .set(authHeaders(authUser))
      .send({ name: 'Producto CSV', price: 10.00, category: 'test' });

    const res = await request(app)
      .get(`/api/companies/${company.id}/products/export/csv`)
      .set(authHeaders(authUser));

    expect(res.status).toBe(200);
    expect(res.text).toContain('Producto CSV');
  });

  it('debería exportar catálogo a Excel', async () => {
    const app = require('../server');

    const res = await request(app)
      .get(`/api/companies/${company.id}/products/export/xlsx`)
      .set(authHeaders(authUser));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
  });
});