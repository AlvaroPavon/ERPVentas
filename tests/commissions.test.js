const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('💵 Comisiones', () => {
  beforeEach(() => resetDb());

  let ownerUser, adminUser, company, session;

  beforeEach(() => {
    ownerUser = createTestUser({ email: 'comision-owner@test.com' });
    adminUser = createTestUser({ email: 'comision-admin@test.com' });
    company = createTestCompany({ ownerId: ownerUser.id });

    const db = require('../database').getDb();
    db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
      .run(adminUser.id, company.id, 'admin');

    // Configurar comisiones
    db.prepare('INSERT OR REPLACE INTO commission_config (company_id, role, commission_pct) VALUES (?, ?, ?)')
      .run(company.id, 'admin', 10);
    db.prepare('INSERT OR REPLACE INTO commission_config (company_id, role, commission_pct) VALUES (?, ?, ?)')
      .run(company.id, 'member', 5);

    // Crear sesión cerrada
    session = createTestSession(company.id, { created_by: adminUser.id });
    db.prepare('UPDATE sales_sessions SET is_closed = 1 WHERE id = ?').run(session.id);

    // Añadir ventas de adminUser
    db.prepare('INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)')
      .run(session.id, adminUser.id, 'Cerveza', 3.50, 10); // Total: 35
  });

  describe('GET /api/commissions/config/:companyId', () => {
    it('debería devolver config de comisiones', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/commissions/config/${company.id}`)
        .set(authHeaders(ownerUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PUT /api/commissions/config/:companyId/:role', () => {
    it('debería actualizar comisión (solo owner)', async () => {
      const app = require('../server');

      const res = await request(app)
        .put(`/api/commissions/config/${company.id}/admin`)
        .set(authHeaders(ownerUser))
        .send({ commission_pct: 15 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Comisión actualizada');
      expect(res.body.commission_pct).toBe(15);
    });

    it('debería rechazar si no es owner', async () => {
      const app = require('../server');

      const res = await request(app)
        .put(`/api/commissions/config/${company.id}/member`)
        .set(authHeaders(adminUser))
        .send({ commission_pct: 10 });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/commissions/session/:sessionId', () => {
    it('debería calcular comisiones de una sesión', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/commissions/session/${session.id}`)
        .set(authHeaders(ownerUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('commission_config');
      expect(res.body).toHaveProperty('grand_total_commission');
    });
  });

  describe('GET /api/commissions/summary/:companyId', () => {
    it('debería devolver resumen de comisiones', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/commissions/summary/${company.id}?months=6`)
        .set(authHeaders(ownerUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});