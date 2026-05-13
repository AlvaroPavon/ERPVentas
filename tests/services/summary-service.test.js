const { resetDb, getDb } = require('../../database');
const { createTestUser, createTestCompany } = require('../helpers');

describe('SummaryService', () => {
  let summaryService;
  let db;

  beforeAll(() => {
    summaryService = require('../../services/summary-service');
  });

  beforeEach(() => {
    db = resetDb();
  });

  /**
   * Create individual sales sessions each with a single sale for yesterday.
   * Returns array of created data.
   */
  function seedYesterdaySales(companyId, userId, count, amountPerSale) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    for (let i = 0; i < count; i++) {
      const session = db.prepare(
        "INSERT INTO sales_sessions (company_id, created_by, name, session_date) VALUES (?, ?, ?, ?)"
      ).run(companyId, userId, `Session ${i + 1}`, dateStr);

      db.prepare(
        'INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(session.lastInsertRowid, userId, `Product ${i + 1}`, amountPerSale, 1);
    }
  }

  function seedTodaySales(companyId, userId) {
    const today = new Date().toISOString().split('T')[0];
    const session = db.prepare(
      "INSERT INTO sales_sessions (company_id, created_by, name, session_date) VALUES (?, ?, ?, ?)"
    ).run(companyId, userId, 'Today Session', today);

    db.prepare(
      'INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)'
    ).run(session.lastInsertRowid, userId, 'Today Product', 999, 1);
  }

  describe('getDailySummary', () => {
    it('debería retornar métricas vacías cuando no hay ventas ayer', () => {
      const user = createTestUser({ email: 'summary-empty@test.com' });
      const company = createTestCompany({ ownerId: user.id });

      const summary = summaryService.getDailySummary(company.id);

      expect(summary).toBeDefined();
      expect(summary.companyName).toBe(company.name);
      expect(summary.metrics.totalAmount).toBe(0);
      expect(summary.metrics.totalNotes).toBe(0);
      expect(summary.topProducts).toEqual([]);
      expect(summary.salesByUser).toEqual([]);
    });

    it('debería calcular totales correctos para ventas de ayer', () => {
      const user = createTestUser({ email: 'summary-calc@test.com' });
      const company = createTestCompany({ ownerId: user.id, name: 'Calc Test Co' });
      // Each sale is in its own session (1 session = 1 nota de venta)
      seedYesterdaySales(company.id, user.id, 3, 100);

      const summary = summaryService.getDailySummary(company.id);

      expect(summary.companyName).toBe('Calc Test Co');
      expect(summary.metrics.totalAmount).toBe(300);
      // 3 sessions / notes
      expect(summary.metrics.totalNotes).toBe(3);
      expect(summary.date).toBeDefined();
    });

    it('debería excluir ventas de hoy y solo sumar las de ayer', () => {
      const user = createTestUser({ email: 'summary-exclude@test.com' });
      const company = createTestCompany({ ownerId: user.id });
      seedYesterdaySales(company.id, user.id, 2, 50);
      seedTodaySales(company.id, user.id);

      const summary = summaryService.getDailySummary(company.id);

      // Only yesterday's sales counted
      expect(summary.metrics.totalAmount).toBe(100);
      expect(summary.metrics.totalNotes).toBe(2);
    });

    it('debería ordenar topProducts por cantidad descendente', () => {
      const user = createTestUser({ email: 'summary-top@test.com' });
      const company = createTestCompany({ ownerId: user.id });
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const session = db.prepare(
        "INSERT INTO sales_sessions (company_id, created_by, name, session_date) VALUES (?, ?, ?, ?)"
      ).run(company.id, user.id, 'Top Session', dateStr);

      db.prepare(
        'INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(session.lastInsertRowid, user.id, 'Popular Item', 30, 5);
      db.prepare(
        'INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(session.lastInsertRowid, user.id, 'Rare Item', 100, 1);

      const summary = summaryService.getDailySummary(company.id);

      expect(summary.topProducts).toHaveLength(2);
      expect(summary.topProducts[0].name).toBe('Popular Item');
      expect(summary.topProducts[1].name).toBe('Rare Item');
    });

    it('debería retornar salesByUser agregado por usuario', () => {
      const owner = createTestUser({ email: 'summary-user1@test.com', name: 'Owner One' });
      const seller = createTestUser({ email: 'summary-user2@test.com', name: 'Seller Two' });
      const company = createTestCompany({ ownerId: owner.id });
      db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
        .run(seller.id, company.id, 'member');

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const session = db.prepare(
        "INSERT INTO sales_sessions (company_id, created_by, name, session_date) VALUES (?, ?, ?, ?)"
      ).run(company.id, owner.id, 'Session', dateStr);

      db.prepare(
        'INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(session.lastInsertRowid, owner.id, 'Item1', 200, 1);
      db.prepare(
        'INSERT INTO sales (session_id, user_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(session.lastInsertRowid, seller.id, 'Item2', 150, 1);

      const summary = summaryService.getDailySummary(company.id);

      expect(summary.salesByUser).toHaveLength(2);
      const ownerEntry = summary.salesByUser.find(u => u.name === owner.name);
      const sellerEntry = summary.salesByUser.find(u => u.name === seller.name);
      expect(ownerEntry).toBeDefined();
      expect(ownerEntry.amount).toBe(200);
      expect(sellerEntry).toBeDefined();
      expect(sellerEntry.amount).toBe(150);
    });
  });
});
