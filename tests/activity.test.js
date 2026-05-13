const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('📋 Actividad', () => {
  beforeEach(() => resetDb());

  let authUser, company;

  beforeEach(() => {
    authUser = createTestUser({ email: 'actividad@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
  });

  describe('GET /api/activity', () => {
    it('debería devolver logs de actividad paginados', async () => {
      const app = require('../server');

      // Crear sesión genera actividad
      await request(app)
        .post('/api/sales/sessions')
        .set(authHeaders(authUser))
        .send({
          company_id: company.id,
          name: 'Sesión Actividad',
          session_date: '2026-05-15'
        });

      const res = await request(app)
        .get('/api/activity')
        .set(authHeaders(authUser))
        .query({ page: 1, limit: 30 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it('debería devolver paginación correcta', async () => {
      const app = require('../server');

      // Crear varias sesiones
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/sales/sessions')
          .set(authHeaders(authUser))
          .send({
            company_id: company.id,
            name: `Sesión ${i}`,
            session_date: `2026-05-${String(10 + i).padStart(2, '0')}`
          });
      }

      const res = await request(app)
        .get('/api/activity?page=1&limit=2')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(2);
      expect(res.body.total).toBeGreaterThanOrEqual(3);
    });

    it('debería rechazar sin autenticación', async () => {
      const app = require('../server');
      const res = await request(app).get('/api/activity');
      expect(res.status).toBe(401);
    });
  });
});