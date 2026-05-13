const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders } = require('./helpers');

describe('📦 Inventario', () => {
  beforeEach(() => resetDb());

  let authUser, company;

  beforeEach(() => {
    authUser = createTestUser({ email: 'inventario@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
  });

  describe('GET /api/companies/:companyId/inventory', () => {
    it('debería devolver el inventario de la empresa', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/companies/${company.id}/inventory`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /api/companies/:companyId/inventory/movements', () => {
    it('debería devolver movimientos de inventario', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/companies/${company.id}/inventory/movements`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('movements');
      expect(Array.isArray(res.body.movements)).toBe(true);
    });
  });

  describe('POST /api/companies/:companyId/inventory/:productId/add-stock', () => {
    it('debería añadir stock a un producto', async () => {
      const app = require('../server');

      const db = require('../database').getDb();
      const result = db.prepare(
        'INSERT INTO products (company_id, name, price) VALUES (?, ?, ?)'
      ).run(company.id, 'Producto Test', 5.00);

      const res = await request(app)
        .post(`/api/companies/${company.id}/inventory/${result.lastInsertRowid}/add-stock`)
        .set(authHeaders(authUser))
        .send({ quantity: 50, notes: 'Stock inicial' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Stock actualizado');
      expect(res.body.newStock).toBe(50);
    });

    it('debería rechazar cantidad <= 0', async () => {
      const app = require('../server');

      const db = require('../database').getDb();
      const result = db.prepare(
        'INSERT INTO products (company_id, name, price) VALUES (?, ?, ?)'
      ).run(company.id, 'Producto Test 2', 5.00);

      const res = await request(app)
        .post(`/api/companies/${company.id}/inventory/${result.lastInsertRowid}/add-stock`)
        .set(authHeaders(authUser))
        .send({ quantity: -5 });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/companies/:companyId/inventory/:productId/remove-stock', () => {
    it('debería retirar stock de un producto', async () => {
      const app = require('../server');

      const db = require('../database').getDb();
      const result = db.prepare(
        'INSERT INTO products (company_id, name, price) VALUES (?, ?, ?)'
      ).run(company.id, 'Producto Retiro', 5.00);

      db.prepare('INSERT INTO inventory (company_id, product_id, stock) VALUES (?, ?, ?)')
        .run(company.id, result.lastInsertRowid, 100);

      const res = await request(app)
        .post(`/api/companies/${company.id}/inventory/${result.lastInsertRowid}/remove-stock`)
        .set(authHeaders(authUser))
        .send({ quantity: 30 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Stock actualizado');
      expect(res.body.newStock).toBe(70);
    });

    it('debería rechazar si stock insuficiente', async () => {
      const app = require('../server');

      const db = require('../database').getDb();
      const result = db.prepare(
        'INSERT INTO products (company_id, name, price) VALUES (?, ?, ?)'
      ).run(company.id, 'Producto Sin Stock', 5.00);

      db.prepare('INSERT INTO inventory (company_id, product_id, stock) VALUES (?, ?, ?)')
        .run(company.id, result.lastInsertRowid, 5);

      const res = await request(app)
        .post(`/api/companies/${company.id}/inventory/${result.lastInsertRowid}/remove-stock`)
        .set(authHeaders(authUser))
        .send({ quantity: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('insuficiente');
    });
  });

  describe('PUT /api/companies/:companyId/inventory/:productId/threshold', () => {
    it('debería establecer umbral mínimo de stock', async () => {
      const app = require('../server');

      const db = require('../database').getDb();
      const result = db.prepare(
        'INSERT INTO products (company_id, name, price) VALUES (?, ?, ?)'
      ).run(company.id, 'Producto Umbral', 5.00);

      db.prepare('INSERT INTO inventory (company_id, product_id, stock) VALUES (?, ?, ?)')
        .run(company.id, result.lastInsertRowid, 50);

      const res = await request(app)
        .put(`/api/companies/${company.id}/inventory/${result.lastInsertRowid}/threshold`)
        .set(authHeaders(authUser))
        .send({ minStock: 10 });

      expect(res.status).toBe(200);
    });
  });
});