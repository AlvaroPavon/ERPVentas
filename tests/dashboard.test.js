const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('📊 Dashboard', () => {
  beforeEach(() => resetDb());

  let authUser, company;

  beforeEach(() => {
    authUser = createTestUser({ email: 'dashboard@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
  });

  describe('GET /api/dashboard/monthly', () => {
    it('debería devolver estadísticas mensuales con ventas', async () => {
      const app = require('../server');
      const session = createTestSession(company.id, { session_date: '2026-05-10' });

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 10 });

      const res = await request(app)
        .get('/api/dashboard/monthly?year=2026&month=5')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('stats');
      expect(res.body.stats.total_amount).toBe(35);
      // COUNT(s.id) cuenta filas, no cantidades
      expect(res.body.stats.total_items).toBe(1);
    });

    it('debería devolver array vacío si no hay ventas en ese mes', async () => {
      const app = require('../server');

      const res = await request(app)
        .get('/api/dashboard/monthly?year=2026&month=3')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.dailySales).toEqual([]);
    });
  });

  describe('GET /api/dashboard/top-products', () => {
    it('debería devolver top productos más vendidos', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 20 });

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Pincho', price: 2.00, quantity: 10 });

      const res = await request(app)
        .get('/api/dashboard/top-products?limit=5')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].product_name).toBe('Cerveza');
      expect(res.body[0].total_quantity).toBe(20);
    });
  });

  describe('GET /api/dashboard/daily-comparison', () => {
    it('debería devolver comparativa por días', async () => {
      const app = require('../server');
      const session = createTestSession(company.id, { session_date: '2026-05-01' });

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 5 });

      const res = await request(app)
        .get('/api/dashboard/daily-comparison?limit=10')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // price*quantity = 3.50 * 5 = 17.50
      expect(res.body[0].total_amount).toBe(17.5);
    });
  });

  describe('GET /api/dashboard/overview', () => {
    it('debería devolver resumen global del usuario', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 5 });

      const res = await request(app)
        .get('/api/dashboard/overview')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.totalSessions).toBe(1);
      // price*quantity = 3.50 * 5 = 17.50
      expect(res.body.totalSales).toBe(17.5);
      expect(res.body.totalItems).toBe(1); // COUNT(s.id) = 1 fila
    });
  });

  describe('GET /api/dashboard/company/:companyId', () => {
    it('debería devolver estadísticas de empresa', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 10 });

      const res = await request(app)
        .get(`/api/dashboard/company/${company.id}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.company_stats.session_count).toBe(1);
      expect(res.body.company_stats.total_amount).toBe(35);
    });

    it('debería rechazar si no pertenece a la empresa', async () => {
      const app = require('../server');
      const outsider = createTestUser({ email: 'outsider@test.com' });

      const res = await request(app)
        .get(`/api/dashboard/company/${company.id}`)
        .set(authHeaders(outsider));

      expect(res.status).toBe(403);
    });
  });
});