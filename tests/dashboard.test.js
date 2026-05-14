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

  // ── Phase 3 tests ──────────────────────────────────────────────

  describe('3.1 Language persistence across sessions (integration)', () => {
    it('debería persistir el idioma después de actualizarlo', async () => {
      const app = require('../server');

      // Change language to English
      const putRes = await request(app)
        .put('/api/user/language')
        .set(authHeaders(authUser))
        .send({ language: 'en' });
      expect(putRes.status).toBe(200);
      expect(putRes.body.language).toBe('en');

      // Verify via GET endpoint
      const getRes = await request(app)
        .get('/api/user/language')
        .set(authHeaders(authUser));
      expect(getRes.status).toBe(200);
      expect(getRes.body.language).toBe('en');

      // Verify via /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set(authHeaders(authUser));
      expect(meRes.status).toBe(200);
      expect(meRes.body.language).toBe('en');
    });
  });

  describe('3.2 403 Forbidden on unauthorized companyId', () => {
    it('debería devolver 403 al acceder con companyId no autorizado', async () => {
      const app = require('../server');
      const outsider = createTestUser({ email: 'outsider403@test.com' });

      const res = await request(app)
        .get(`/api/dashboard/monthly?year=2026&month=5&companyId=${company.id}`)
        .set(authHeaders(outsider));

      expect(res.status).toBe(403);
    });

    it('debería devolver 200 al acceder con companyId autorizado (owner)', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/dashboard/monthly?year=2026&month=5&companyId=${company.id}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
    });
  });

  describe('3.4 PoP growth calculation', () => {
    it('debería calcular crecimiento positivo correctamente', async () => {
      const app = require('../server');

      // Previous month: $1000 in sales
      const prevSession = createTestSession(company.id, { session_date: '2026-04-15' });
      await request(app)
        .post(`/api/sales/session/${prevSession.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Producto A', price: 10, quantity: 100 });

      // Current month: $1200 in sales
      const currSession = createTestSession(company.id, { session_date: '2026-05-15' });
      await request(app)
        .post(`/api/sales/session/${currSession.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Producto B', price: 12, quantity: 100 });

      const res = await request(app)
        .get('/api/dashboard/monthly?year=2026&month=5')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.stats.growth).toBeCloseTo(20, 0); // +20% growth
      expect(res.body.stats.trend).toBe('up');
    });

    it('debería calcular crecimiento negativo correctamente', async () => {
      const app = require('../server');

      // Previous month: $1000
      const prevSession = createTestSession(company.id, { session_date: '2026-04-15' });
      await request(app)
        .post(`/api/sales/session/${prevSession.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Producto A', price: 10, quantity: 100 });

      // Current month: $800
      const currSession = createTestSession(company.id, { session_date: '2026-05-15' });
      await request(app)
        .post(`/api/sales/session/${currSession.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Producto B', price: 8, quantity: 100 });

      const res = await request(app)
        .get('/api/dashboard/monthly?year=2026&month=5')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.stats.growth).toBeCloseTo(-20, 0); // -20% growth
      expect(res.body.stats.trend).toBe('down');
    });

    it('debería devolver growth=null cuando no hay datos del periodo anterior (nuevo)', async () => {
      const app = require('../server');

      // Only current month, no previous month data
      const currSession = createTestSession(company.id, { session_date: '2026-05-15' });
      await request(app)
        .post(`/api/sales/session/${currSession.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Producto', price: 10, quantity: 50 });

      const res = await request(app)
        .get('/api/dashboard/monthly?year=2026&month=5')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      // No previous period → growth is null (not 0)
      expect(res.body.stats.growth).toBeNull();
      expect(res.body.stats.trend).toBe('neutral');
    });
  });
});