const request = require('supertest');
const { resetDb, getDb } = require('../database');
const { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession } = require('./helpers');

describe('🏷️ Productos', () => {
  beforeEach(() => resetDb());

  let authUser, company;

  beforeEach(() => {
    authUser = createTestUser({ email: 'productos@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
  });

  describe('GET /api/companies/:companyId/products', () => {
    it('debería devolver catálogo de productos', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/companies/:companyId/products', () => {
    it('debería crear un producto', async () => {
      const app = require('../server');

      const res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({ name: 'Producto Test', price: 5.00, category: 'comida' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Producto Test');
    });

    it('debería crear producto con variantes de precio', async () => {
      const app = require('../server');

      const res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({
          name: 'Cerveza Premium',
          price: 4.00,
          prices: [
            { name: 'unidad', price: 4.00, quantity: 1 },
            { name: 'pack 6', price: 3.50, quantity: 6 }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('debería crear producto con category_id y tags', async () => {
      const app = require('../server');
      const db = getDb();

      const catResult = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Comida');

      const res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({ name: 'Producto Cat', price: 10, category_id: catResult.lastInsertRowid, tags: ['organic', 'premium'] });

      expect(res.status).toBe(201);
      expect(res.body.category_id).toBe(catResult.lastInsertRowid);
      expect(Array.isArray(res.body.tags)).toBe(true);
      expect(res.body.tags).toEqual(['organic', 'premium']);
    });

    it('debería crear producto sin category_id ni tags', async () => {
      const app = require('../server');

      const res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({ name: 'Producto Simple', price: 5 });

      expect(res.status).toBe(201);
      expect(res.body.category_id).toBeNull();
      expect(Array.isArray(res.body.tags)).toBe(true);
      expect(res.body.tags).toEqual([]);
    });
  });

  describe('PUT /api/companies/:companyId/products/:productId', () => {
    it('debería actualizar el nombre y precio de un producto', async () => {
      const app = require('../server');
      const db = getDb();

      const result = db.prepare('INSERT INTO products (company_id, name, price, created_by) VALUES (?, ?, ?, ?)')
        .run(company.id, 'Original', 10, authUser.id);
      const productId = result.lastInsertRowid;

      const res = await request(app)
        .put(`/api/companies/${company.id}/products/${productId}`)
        .set(authHeaders(authUser))
        .send({ name: 'Actualizado', price: 20 });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Actualizado');
      expect(res.body.price).toBe(20);
    });

    it('debería actualizar category_id de un producto', async () => {
      const app = require('../server');
      const db = getDb();

      const catResult = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Bebidas');
      const catResult2 = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'Comida');

      const result = db.prepare('INSERT INTO products (company_id, name, price, category_id, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Producto', 10, catResult.lastInsertRowid, authUser.id);
      const productId = result.lastInsertRowid;

      const res = await request(app)
        .put(`/api/companies/${company.id}/products/${productId}`)
        .set(authHeaders(authUser))
        .send({ category_id: catResult2.lastInsertRowid });

      expect(res.status).toBe(200);
      expect(res.body.category_id).toBe(catResult2.lastInsertRowid);
    });

    it('debería actualizar tags de un producto', async () => {
      const app = require('../server');
      const db = getDb();

      const result = db.prepare('INSERT INTO products (company_id, name, price, tags, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Producto', 10, JSON.stringify(['old']), authUser.id);
      const productId = result.lastInsertRowid;

      const res = await request(app)
        .put(`/api/companies/${company.id}/products/${productId}`)
        .set(authHeaders(authUser))
        .send({ tags: ['new', 'updated'] });

      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual(['new', 'updated']);
    });

    it('debería eliminar todos los tags si se envía array vacío', async () => {
      const app = require('../server');
      const db = getDb();

      const result = db.prepare('INSERT INTO products (company_id, name, price, tags, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Producto', 10, JSON.stringify(['organic']), authUser.id);
      const productId = result.lastInsertRowid;

      const res = await request(app)
        .put(`/api/companies/${company.id}/products/${productId}`)
        .set(authHeaders(authUser))
        .send({ tags: [] });

      expect(res.status).toBe(200);
      expect(res.body.tags).toEqual([]);
    });
  });

  describe('DELETE /api/companies/:companyId/products/:productId', () => {
    it('debería eliminar un producto (admin)', async () => {
      const app = require('../server');

      let res = await request(app)
        .post(`/api/companies/${company.id}/products`)
        .set(authHeaders(authUser))
        .send({ name: 'A Borrar', price: 1.00 });

      const productId = res.body.id;

      res = await request(app)
        .delete(`/api/companies/${company.id}/products/${productId}`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Producto eliminado');
    });
  });

  describe('Filtrado de productos', () => {
    it('debería filtrar por nombre de categoría', async () => {
      const app = require('../server');
      const db = getDb();

      const catComida = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'comida');
      const catBebida = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'bebida');

      db.prepare('INSERT INTO products (company_id, name, price, category_id, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Manzana', 1, catComida.lastInsertRowid, authUser.id);
      db.prepare('INSERT INTO products (company_id, name, price, category_id, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Agua', 1, catBebida.lastInsertRowid, authUser.id);

      const res = await request(app)
        .get(`/api/companies/${company.id}/products?category=comida`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Manzana');
    });

    it('debería devolver lista vacía para categoría inexistente', async () => {
      const app = require('../server');

      const res = await request(app)
        .get(`/api/companies/${company.id}/products?category=nonexistent`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('debería filtrar por un tag', async () => {
      const app = require('../server');
      const db = getDb();

      db.prepare('INSERT INTO products (company_id, name, price, tags, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Orgánico', 10, JSON.stringify(['organic', 'local']), authUser.id);
      db.prepare('INSERT INTO products (company_id, name, price, tags, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Industrial', 10, JSON.stringify(['industrial']), authUser.id);

      const res = await request(app)
        .get(`/api/companies/${company.id}/products?tags=organic`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Orgánico');
    });

    it('debería filtrar por múltiples tags (OR)', async () => {
      const app = require('../server');
      const db = getDb();

      db.prepare('INSERT INTO products (company_id, name, price, tags, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Orgánico', 10, JSON.stringify(['organic']), authUser.id);
      db.prepare('INSERT INTO products (company_id, name, price, tags, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Local', 10, JSON.stringify(['local']), authUser.id);
      db.prepare('INSERT INTO products (company_id, name, price, tags, created_by) VALUES (?, ?, ?, ?, ?)')
        .run(company.id, 'Industrial', 10, JSON.stringify(['industrial']), authUser.id);

      const res = await request(app)
        .get(`/api/companies/${company.id}/products?tags=organic,local`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const names = res.body.map(p => p.name).sort();
      expect(names).toEqual(['Local', 'Orgánico']);
    });

    it('debería filtrar combinando categoría y tags', async () => {
      const app = require('../server');
      const db = getDb();

      const catComida = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'comida');
      const catBebida = db.prepare('INSERT INTO categories (company_id, name) VALUES (?, ?)').run(company.id, 'bebida');

      db.prepare('INSERT INTO products (company_id, name, price, category_id, tags, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .run(company.id, 'Manzana Orgánica', 10, catComida.lastInsertRowid, JSON.stringify(['organic', 'local']), authUser.id);
      db.prepare('INSERT INTO products (company_id, name, price, category_id, tags, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .run(company.id, 'Agua Mineral', 5, catBebida.lastInsertRowid, JSON.stringify(['organic']), authUser.id);

      const res = await request(app)
        .get(`/api/companies/${company.id}/products?category=comida&tags=organic`)
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Manzana Orgánica');
    });
  });
});

describe('📦 Exportar Catálogo', () => {
  beforeEach(() => resetDb());

  let authUser, company;

  beforeEach(() => {
    authUser = createTestUser({ email: 'export@test.com' });
    company = createTestCompany({ ownerId: authUser.id });
  });

  it('debería exportar catálogo a CSV', async () => {
    const app = require('../server');

    await request(app)
      .post(`/api/companies/${company.id}/products`)
      .set(authHeaders(authUser))
      .send({ name: 'Producto CSV', price: 10.00, category: 'test' });

    const res = await request(app)
      .get(`/api/companies/${company.id}/products/export/csv`)
      .set(authHeaders(authUser));

    expect(res.status).toBe(200);
    expect(res.text).toContain('Producto CSV');
  });

  it('debería exportar catálogo a Excel', async () => {
    const app = require('../server');

    const res = await request(app)
      .get(`/api/companies/${company.id}/products/export/xlsx`)
      .set(authHeaders(authUser));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
  });
});