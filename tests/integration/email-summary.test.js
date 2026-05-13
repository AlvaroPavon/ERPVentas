const request = require('supertest');
const { resetDb, getDb } = require('../../database');
const { createTestUser, createTestCompany, authHeaders } = require('../helpers');

describe('📧 Resumen Diario Email - Integration', () => {
  beforeEach(() => resetDb());

  describe('PATCH /api/companies/:id/settings', () => {
    it('debería actualizar la configuración de resumen diario', async () => {
      const app = require('../../server');
      const user = createTestUser({ email: 'settings@test.com' });
      const company = createTestCompany({ ownerId: user.id });

      const res = await request(app)
        .patch(`/api/companies/${company.id}/settings`)
        .set(authHeaders(user))
        .send({
          email_summary_enabled: true,
          email_summary_time: '08:00'
        });

      expect(res.status).toBe(200);
      expect(res.body.email_summary_enabled).toBe(1);
      expect(res.body.email_summary_time).toBe('08:00');
    });

    it('debería rechazar si el usuario no es owner/admin', async () => {
      const app = require('../../server');
      const owner = createTestUser({ email: 'owner-settings@test.com' });
      const member = createTestUser({ email: 'member-settings@test.com' });
      const company = createTestCompany({ ownerId: owner.id });
      const db = getDb();
      db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
        .run(member.id, company.id, 'member');

      const res = await request(app)
        .patch(`/api/companies/${company.id}/settings`)
        .set(authHeaders(member))
        .send({
          email_summary_enabled: true,
          email_summary_time: '08:00'
        });

      expect(res.status).toBe(403);
    });

    it('debería validar el formato de hora HH:mm', async () => {
      const app = require('../../server');
      const user = createTestUser({ email: 'time-validate@test.com' });
      const company = createTestCompany({ ownerId: user.id });

      const res = await request(app)
        .patch(`/api/companies/${company.id}/settings`)
        .set(authHeaders(user))
        .send({
          email_summary_enabled: true,
          email_summary_time: '25:00'
        });

      expect(res.status).toBe(400);
    });

    it('debería rechazar si la empresa no existe', async () => {
      const app = require('../../server');
      const user = createTestUser({ email: 'noexist@test.com' });

      const res = await request(app)
        .patch('/api/companies/99999/settings')
        .set(authHeaders(user))
        .send({
          email_summary_enabled: true,
          email_summary_time: '08:00'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('Resumen diario - datos BD', () => {
    it('debería persistir y leer la configuración de resumen', async () => {
      const app = require('../../server');
      const user = createTestUser({ email: 'persist@test.com' });
      const company = createTestCompany({ ownerId: user.id });

      await request(app)
        .patch(`/api/companies/${company.id}/settings`)
        .set(authHeaders(user))
        .send({
          email_summary_enabled: true,
          email_summary_time: '07:30'
        });

      const db = getDb();
      const saved = db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id);
      expect(saved.email_summary_enabled).toBe(1);
      expect(saved.email_summary_time).toBe('07:30');
    });
  });
});
