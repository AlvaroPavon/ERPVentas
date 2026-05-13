const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('🏢 Empresas', () => {
  beforeEach(() => resetDb());

  let authUser, authHeadersUser;

  beforeEach(() => {
    authUser = createTestUser({ email: 'empresa@test.com' });
    authHeadersUser = authHeaders(authUser);
  });

  describe('GET /api/companies', () => {
    it('debería devolver las empresas del usuario', async () => {
      const app = require('../server');
      await createTestCompany(); // ownerId=1 por defecto = authUser

      const res = await request(app)
        .get('/api/companies')
        .set(authHeadersUser);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it('debería devolver array vacío si no tiene empresas', async () => {
      const app = require('../server');
      // authUser no ha creado ninguna empresa (ya que otro test las creó)
      // Pero beforeEach crea authUser=user1, y la empresa del test anterior
      // se perdió con resetDb. Así que user1 no tiene empresas aquí.
      // Creemos un user2 con su propia empresa
      const user2 = createTestUser({ email: 'otro@test.com' });

      const res = await request(app)
        .get('/api/companies')
        .set(authHeaders(user2));

      // user2 no tiene empresas => vacío (no 403)
      // Pero user2 es miembro de ninguna empresa creada
      // Si user2 crea empresa... no lo hicimos.
      // user1 tiene empresas del test anterior? No, resetDb limpia todo.
      // Pero authUser es user1, y no creamos empresa para este test.
      // Debería devolver vacío.
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/companies', () => {
    it('debería crear una empresa nueva', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/companies')
        .set(authHeadersUser)
        .send({ name: 'Mi Empresa', description: 'Descripción de prueba' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Mi Empresa');
    });

    it('debería crear a quien la crea como owner', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/companies')
        .set(authHeadersUser)
        .send({ name: 'Empresa Owner' });

      const db = require('../database').getDb();
      const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
        .get(res.body.id, authUser.id);
      expect(membership.role).toBe('owner');
    });

    it('debería rechazar sin nombre', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/companies')
        .set(authHeadersUser)
        .send({ description: 'Sin nombre' });

      expect(res.status).toBe(400);
    });

    it('debería rechazar nombre duplicado', async () => {
      const app = require('../server');
      await createTestCompany({ name: 'Misma Empresa', ownerId: authUser.id });

      const res = await request(app)
        .post('/api/companies')
        .set(authHeadersUser)
        .send({ name: 'Misma Empresa' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/companies/:id', () => {
    it('debería devolver detalle de empresa', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });

      const res = await request(app)
        .get(`/api/companies/${company.id}`)
        .set(authHeadersUser);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(company.name);
      expect(res.body).toHaveProperty('users');
    });

    it('debería rechazar empresa inexistente', async () => {
      const app = require('../server');

      const res = await request(app)
        .get('/api/companies/99999')
        .set(authHeadersUser);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/companies/:id/users', () => {
    it('debería añadir un usuario a la empresa', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });
      const nuevoUser = await createTestUser({ email: 'nuevo@empresa.com' });

      const res = await request(app)
        .post(`/api/companies/${company.id}/users`)
        .set(authHeadersUser)
        .send({ email: 'nuevo@empresa.com', role: 'member' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Usuario añadido correctamente');
    });

    it('debería rechazar si no es admin/owner', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });
      const memberUser = createTestUser({ email: 'member@empresa.com' });

      // Hacer memberUser miembro (no admin) de la empresa
      const db = require('../database').getDb();
      db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
        .run(memberUser.id, company.id, 'member');

      const nuevoUser = await createTestUser({ email: 'otro@test.com' });

      const res = await request(app)
        .post(`/api/companies/${company.id}/users`)
        .set(authHeaders(memberUser))
        .send({ email: 'otro@test.com', role: 'member' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/companies/:id/users/:userId', () => {
    it('debería eliminar un usuario de la empresa', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });
      const userToDelete = createTestUser({ email: 'adelete@empresa.com' });

      const db = require('../database').getDb();
      db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
        .run(userToDelete.id, company.id, 'member');

      const res = await request(app)
        .delete(`/api/companies/${company.id}/users/${userToDelete.id}`)
        .set(authHeadersUser);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/companies/:id/join-request', () => {
    it('debería enviar solicitud de unión', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });
      const user2 = createTestUser({ email: 'solicitante@test.com' });

      const res = await request(app)
        .post(`/api/companies/${company.id}/join-request`)
        .set(authHeaders(user2));

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Solicitud enviada');
    });

    it('debería rechazar si ya es miembro', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });

      // authUser ya es owner de esta empresa
      const res = await request(app)
        .post(`/api/companies/${company.id}/join-request`)
        .set(authHeadersUser);

      expect(res.status).toBe(409);
    });
  });

  describe('/:id/join-requests - aceptar/rechazar', () => {
    it('debería aceptar una solicitud', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });
      const user2 = createTestUser({ email: 'aceptar@test.com' });

      const db = require('../database').getDb();
      db.prepare('INSERT INTO join_requests (company_id, user_id, status) VALUES (?, ?, ?)')
        .run(company.id, user2.id, 'pending');

      const res = await request(app)
        .post(`/api/companies/${company.id}/join-requests/1/accept`)
        .set(authHeadersUser);

      expect(res.status).toBe(200);

      const membership = db.prepare('SELECT * FROM company_users WHERE user_id = ? AND company_id = ?')
        .get(user2.id, company.id);
      expect(membership).toBeTruthy();
      expect(membership.role).toBe('member');
    });

    it('debería rechazar una solicitud', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });
      const user2 = createTestUser({ email: 'rechazar@test.com' });

      const db = require('../database').getDb();
      db.prepare('INSERT INTO join_requests (company_id, user_id, status) VALUES (?, ?, ?)')
        .run(company.id, user2.id, 'pending');

      const res = await request(app)
        .post(`/api/companies/${company.id}/join-requests/1/reject`)
        .set(authHeadersUser);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/companies/incoming-requests', () => {
    it('debería devolver solicitudes recibidas (owner)', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });
      const user2 = createTestUser({ email: 'incoming@test.com' });

      const db = require('../database').getDb();
      db.prepare('INSERT INTO join_requests (company_id, user_id, status) VALUES (?, ?, ?)')
        .run(company.id, user2.id, 'pending');

      const res = await request(app)
        .get('/api/companies/incoming-requests')
        .set(authHeadersUser);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it('debería devolver array vacío si no tiene solicitudes', async () => {
      const app = require('../server');
      const company = await createTestCompany({ ownerId: authUser.id });

      const res = await request(app)
        .get('/api/companies/incoming-requests')
        .set(authHeadersUser);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('debería devolver array vacío si el usuario no es admin/owner de ninguna empresa', async () => {
      const app = require('../server');
      // Crear otra empresa donde authUser NO es admin/owner
      const owner2 = createTestUser({ email: 'owner2@test.com' });
      const company2 = createTestCompany({ ownerId: owner2.id });

      const res = await request(app)
        .get('/api/companies/incoming-requests')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});