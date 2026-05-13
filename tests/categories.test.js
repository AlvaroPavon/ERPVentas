const request = require('supertest');
const { resetDb, getDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders } = require('./helpers');

describe('🏷️ Categorías', () => {
  beforeEach(() => resetDb());

  let authUser, company, otherUser, otherCompany;

  beforeEach(() => {
    authUser = createTestUser({ email: 'categorias@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
    otherUser = createTestUser({ email: 'other-cat@test.com' });
    otherCompany = createTestCompany({ ownerId: otherUser.id });
  });

  describe('POST /api/companies/:companyId/categories', () => {
    it('debería crear una categoría', async () => {
      const app = require('../server');

      const res = await request(app)
        .post(`/api/companies/${company.id}/categories`)
        .set(authHeaders(authUser))
        .send({ name: 'Bebidas' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Bebidas');
      expect(res.body.company_id).toBe(company.id);
    });

    it('debería rechazar categoría con nombre vacío', async () => {
      const app = require('../server');

      const res = await request(app)
        .post(`/api/companies/${company.id}/categories`)
        .set(authHeaders(authUser))
        .send({ name: '' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/companies/:companyId/categories', () => {
    it('debería listar categorías ordenadas por nombre', async () => {
      const app = require('../server');
      const db = getDb();

      // Insert categories directly
      db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Zumo');
      db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Bebidas');
      db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Comida');

      const res = await request(app)
        .get(`/api/companies/${company.id}/categories`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(3);
      // Should be sorted by name: Bebidas, Comida, Zumo
      expect(res.body[0].name).toBe('Bebidas');
      expect(res.body[1].name).toBe('Comida');
      expect(res.body[2].name).toBe('Zumo');
    });

    it('debería respetar aislamiento entre empresas', async () => {
      const app = require('../server');
      const db = getDb();

      db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Comida');
      db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(otherCompany.id, 'Bebidas');

      const res = await request(app)
        .get(`/api/companies/${company.id}/categories`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Comida');

      const res2 = await request(app)
        .get(`/api/companies/${otherCompany.id}/categories`)
        .set(authHeaders(otherUser));

      expect(res2.status).toBe(200);
      expect(res2.body).toHaveLength(1);
      expect(res2.body[0].name).toBe('Bebidas');
    });
  });

  describe('PATCH /api/companies/:companyId/categories/:categoryId', () => {
    it('debería renombrar una categoría', async () => {
      const app = require('../server');
      const db = getDb();

      const result = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Bebidas');

      const res = await request(app)
        .patch(`/api/companies/${company.id}/categories/${result.lastInsertRowid}`)
        .set(authHeaders(authUser))
        .send({ name: 'Bebidas Alcohólicas' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Bebidas Alcohólicas');

      // Verify persistence
      const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
      expect(cat.name).toBe('Bebidas Alcohólicas');
    });

    it('debería devolver 404 para categoría inexistente', async () => {
      const app = require('../server');

      const res = await request(app)
        .patch(`/api/companies/${company.id}/categories/99999`)
        .set(authHeaders(authUser))
        .send({ name: 'Nuevo' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/companies/:companyId/categories/:categoryId', () => {
    it('debería eliminar categoría sin productos vinculados', async () => {
      const app = require('../server');
      const db = getDb();

      const result = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Test');

      const res = await request(app)
        .delete(`/api/companies/${company.id}/categories/${result.lastInsertRowid}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);

      const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
      expect(cat).toBeUndefined();
    });

    it('debería eliminar categoría y poner category_id a NULL en productos vinculados', async () => {
      const app = require('../server');
      const db = getDb();

      const catResult = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Comida');
      const categoryId = catResult.lastInsertRowid;

      // Create two products linked to this category
      db.prepare('INSERT INTO products (company_id, name, price, category_id, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Producto 1', 10, categoryId, authUser.id);
      db.prepare('INSERT INTO products (company_id, name, price, category_id, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Producto 2', 20, categoryId, authUser.id);

      const res = await request(app)
        .delete(`/api/companies/${company.id}/categories/${categoryId}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);

      // Category should be gone
      const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(categoryId);
      expect(cat).toBeUndefined();

      // Products should have category_id = NULL
      const products = db.prepare('SELECT * FROM products WHERE company_id = ?').all(company.id);
      expect(products).toHaveLength(2);
      products.forEach(p => {
        expect(p.category_id).toBeNull();
      });
    });
  });
});
