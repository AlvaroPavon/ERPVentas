const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders } = require('./helpers');

describe('🔐 Permisos', () => {
  beforeEach(() => resetDb());

  let ownerUser, adminUser, memberUser, company;

  beforeEach(() => {
    ownerUser = createTestUser({ email: 'owner@test.com' });
    company = createTestCompany({ ownerId: ownerUser.id });
    adminUser = createTestUser({ email: 'admin@test.com' });
    memberUser = createTestUser({ email: 'member@test.com' });

    const db = require('../database').getDb();
    db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
      .run(adminUser.id, company.id, 'admin');
    db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
      .run(memberUser.id, company.id, 'member');
  });

  describe('GET /api/permissions/available', () => {
    it('debería devolver la lista de permisos disponibles', async () => {
      const app = require('../server');

      const res = await request(app)
        .get('/api/permissions/available')
        .set(authHeaders(ownerUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toContain('manage_company');
      expect(res.body).toContain('add_sales');
      expect(res.body).toContain('view_reports');
      expect(res.body).toContain('manage_inventory');
      expect(res.body).toContain('view_commissions');
      expect(res.body).toContain('export_catalog');
    });
  });

  describe('GET /api/permissions/:companyId', () => {
    it('debería devolver permisos por rol de la empresa', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/permissions/${company.id}`)
        .set(authHeaders(ownerUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('roles');
      expect(res.body).toHaveProperty('allRoles');
      expect(res.body.allRoles).toContain('owner');
      expect(res.body.allRoles).toContain('admin');
      expect(res.body.allRoles).toContain('member');
    });
  });

  describe('PUT /api/permissions/:companyId/:role', () => {
    it('debería actualizar permisos de un rol (owner)', async () => {
      const app = require('../server');

      const res = await request(app)
        .put(`/api/permissions/${company.id}/admin`)
        .set(authHeaders(ownerUser))
        .send({ permissions: ['manage_members', 'manage_products'] });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Permisos actualizados');
    });

    it('debería rechazar si no es owner', async () => {
      const app = require('../server');

      const res = await request(app)
        .put(`/api/permissions/${company.id}/member`)
        .set(authHeaders(adminUser))
        .send({ permissions: ['add_sales'] });

      expect(res.status).toBe(403);
    });

    it('debería rechazar modificar permisos del owner', async () => {
      const app = require('../server');

      const res = await request(app)
        .put(`/api/permissions/${company.id}/owner`)
        .set(authHeaders(ownerUser))
        .send({ permissions: ['add_sales'] });

      expect(res.status).toBe(400);
    });

    it('debería rechazar sin array de permisos', async () => {
      const app = require('../server');

      const res = await request(app)
        .put(`/api/permissions/${company.id}/admin`)
        .set(authHeaders(ownerUser))
        .send({ permissions: 'not-an-array' });

      expect(res.status).toBe(400);
    });
  });
});