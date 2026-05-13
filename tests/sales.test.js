const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('💰 Ventas', () => {
  beforeEach(() => resetDb());

  let authUser, company, user2;

  beforeEach(() => {
    authUser = createTestUser({ email: 'ventas@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
    // Añadir otro usuario como member de la empresa
    user2 = createTestUser({ email: 'vendedor2@test.com' });
    const db = require('../database').getDb();
    db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
      .run(user2.id, company.id, 'member');
  });

  describe('GET /api/sales/sessions', () => {
    it('debería devolver las sesiones del usuario', async () => {
      const app = require('../server');
      createTestSession(company.id);

      const res = await request(app)
        .get('/api/sales/sessions')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
    });

    it('debería devolver array vacío si no hay sesiones', async () => {
      const app = require('../server');
      const res = await request(app)
        .get('/api/sales/sessions')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /api/sales/sessions', () => {
    it('debería crear una sesión de venta', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/sales/sessions')
        .set(authHeaders(authUser))
        .send({
          company_id: company.id,
          name: 'Mercadillo Mayo 2026',
          session_date: '2026-05-15'
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Mercadillo Mayo 2026');
      expect(res.body.company_id).toBe(company.id);
    });

    it('debería impedir sesiones duplicadas (mismo nombre + fecha + empresa)', async () => {
      const app = require('../server');

      await request(app)
        .post('/api/sales/sessions')
        .set(authHeaders(authUser))
        .send({
          company_id: company.id,
          name: 'Mercadillo Mayo 2026',
          session_date: '2026-05-15'
        });

      const res = await request(app)
        .post('/api/sales/sessions')
        .set(authHeaders(authUser))
        .send({
          company_id: company.id,
          name: 'Mercadillo Mayo 2026',
          session_date: '2026-05-15'
        });

      expect(res.status).toBe(409);
    });

    it('debería rechazar si no pertenece a la empresa', async () => {
      const app = require('../server');
      const outsider = createTestUser({ email: 'otro@test.com' });

      const res = await request(app)
        .post('/api/sales/sessions')
        .set(authHeaders(outsider))
        .send({
          company_id: company.id,
          name: 'Intruso',
          session_date: '2026-05-15'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/sales/session/:id/items', () => {
    it('debería añadir un producto vendido', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const res = await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 6 });

      expect(res.status).toBe(201);
      expect(res.body.product_name).toBe('Cerveza');
      expect(res.body.price).toBe(3.50);
      expect(res.body.quantity).toBe(6);
    });

    it('debería asignar quantity por defecto a 1', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const res = await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Agua', price: 1.50 });

      expect(res.status).toBe(201);
      expect(res.body.quantity).toBe(1);
    });

    it('debería rechazar si la sesión no existe', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/sales/session/99999/items')
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50 });

      expect(res.status).toBe(404);
    });

    it('debería exigir nombre y precio', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const res = await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ quantity: 5 });

      expect(res.status).toBe(400);
    });

    it('debería calcular el total correctamente con múltiples productos', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 6 }); // 21.00

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Pincho', price: 2.00, quantity: 4 }); // 8.00

      const res = await request(app)
        .get(`/api/sales/session/${session.id}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      // COUNT(s.id) cuenta filas de venta, no cantidades
      expect(res.body.summary.total_items).toBe(2); // 2 filas de venta
      // SUM(price * quantity) = 21 + 8 = 29
      expect(res.body.summary.total_amount).toBe(29);
    });

    it('debería soportar multi-vendedor en la misma sesión', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 6 });

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(user2))
        .send({ product_name: 'Vino', price: 5.00, quantity: 2 });

      const res = await request(app)
        .get(`/api/sales/session/${session.id}`)
        .set(authHeaders(authUser));

      expect(res.body.bySeller).toHaveLength(2);
      expect(res.body.summary.unique_sellers).toBe(2);
    });
  });

  describe('PUT /api/sales/items/:id', () => {
    it('debería editar precio de una venta', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const createRes = await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Pincho', price: 2.00, quantity: 4 });

      const res = await request(app)
        .put(`/api/sales/items/${createRes.body.id}`)
        .set(authHeaders(authUser))
        .send({ price: 2.50 });

      expect(res.status).toBe(200);
      expect(res.body.price).toBe(2.50);
    });

    it('debería rechazar edición de venta ajena (sin permisos)', async () => {
      const app = require('../server');
      // Crear empresa donde authUser NO es admin/owner
      const outsiderCompany = createTestCompany({ ownerId: user2.id });
      const session = createTestSession(outsiderCompany.id, { created_by: user2.id });

      // Otro vendedor (no authUser) crea una venta en outsiderCompany
      const db = require('../database').getDb();
      const thirdUser = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
        .run('Tercero', 'tercero@test.com', require('bcryptjs').hashSync('Test1234!', 12));
      db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
        .run(thirdUser.lastInsertRowid, outsiderCompany.id, 'member');

      const saleRes = db.prepare(
        'INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(session.id, thirdUser.lastInsertRowid, 'Cerveza', 3.50, 5);

      // authUser intenta editar venta de tercero en outsiderCompany
      const res = await request(app)
        .put(`/api/sales/items/${saleRes.lastInsertRowid}`)
        .set(authHeaders(authUser))
        .send({ price: 1.00 });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/sales/items/:id', () => {
    it('debería eliminar una venta propia', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const createRes = await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 2 });

      const res = await request(app)
        .delete(`/api/sales/items/${createRes.body.id}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Venta eliminada');
    });
  });

  describe('PUT /api/sales/session/:id', () => {
    it('debería editar nombre/fecha/notas de sesión', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const res = await request(app)
        .put(`/api/sales/session/${session.id}`)
        .set(authHeaders(authUser))
        .send({ name: 'Nuevo Nombre', notes: 'Notas actualizadas' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Nuevo Nombre');
      expect(res.body.notes).toBe('Notas actualizadas');
    });

    it('debería rechazar edición por no creador y no admin', async () => {
      const app = require('../server');

      // Crear empresa donde authUser NO es miembro
      const outsider = createTestUser({ email: 'outsider2@test.com' });
      const outsiderCompany = createTestCompany({ ownerId: outsider.id });
      const session = createTestSession(outsiderCompany.id, { created_by: outsider.id });

      // authUser intenta editar sesión de outsiderCompany
      const res = await request(app)
        .put(`/api/sales/session/${session.id}`)
        .set(authHeaders(authUser))
        .send({ name: 'Hack' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/sales/session/:id', () => {
    it('debería eliminar sesión vacía (creador)', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const res = await request(app)
        .delete(`/api/sales/session/${session.id}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Sesión eliminada');
    });

    it('debería rechazar eliminar sesión ajena', async () => {
      const app = require('../server');

      const outsider = createTestUser({ email: 'outsider3@test.com' });
      const outsiderCompany = createTestCompany({ ownerId: outsider.id });
      const session = createTestSession(outsiderCompany.id, { created_by: outsider.id });

      // authUser intenta eliminar sesión de outsiderCompany
      const res = await request(app)
        .delete(`/api/sales/session/${session.id}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/sales/session/:id/close', () => {
    it('debería cerrar una sesión', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      const res = await request(app)
        .post(`/api/sales/session/${session.id}/close`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Sesión cerrada');
    });
  });

  describe('GET /api/sales/session/:id/csv', () => {
    it('debería exportar CSV correctamente', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 6 });

      const res = await request(app)
        .get(`/api/sales/session/${session.id}/csv`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Cerveza');
      expect(res.text).toContain('21.00');
    });
  });

  describe('GET /api/sales/session/:id/xlsx', () => {
    it('debería exportar Excel correctamente', async () => {
      const app = require('../server');
      const session = createTestSession(company.id);

      await request(app)
        .post(`/api/sales/session/${session.id}/items`)
        .set(authHeaders(authUser))
        .send({ product_name: 'Cerveza', price: 3.50, quantity: 10 });

      const res = await request(app)
        .get(`/api/sales/session/${session.id}/xlsx`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
    });
  });
});