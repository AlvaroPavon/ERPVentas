const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'ventas.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS company_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, company_id)
    );

    CREATE TABLE IF NOT EXISTS sales_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      created_by INTEGER REFERENCES users(id),
      name TEXT NOT NULL,
      session_date DATE NOT NULL,
      notes TEXT DEFAULT '',
      is_closed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sales_sessions(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER DEFAULT 1,
      image_url TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_sales_session ON sales(session_id);
    CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
    CREATE INDEX IF NOT EXISTS idx_sales_sessions_company ON sales_sessions(company_id);
    CREATE INDEX IF NOT EXISTS idx_sales_sessions_date ON sales_sessions(session_date);
    CREATE TABLE IF NOT EXISTS join_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users(user_id);
    CREATE INDEX IF NOT EXISTS idx_join_requests_company ON join_requests(company_id);
    CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);
  `);

  // Push subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(endpoint)
    );
  `);

  // Roles & Permissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      UNIQUE(company_id, role, permission)
    );
    CREATE INDEX IF NOT EXISTS idx_role_perms_company ON role_permissions(company_id);
  `);

  // Seed default role permissions for existing companies
  const companies = db.prepare('SELECT id FROM companies').all();
  const defaultPerms = {
    owner: ['manage_company','manage_members','manage_roles','manage_products','manage_sessions','add_sales','delete_sales','view_reports'],
    admin: ['manage_members','manage_products','manage_sessions','add_sales','delete_sales','view_reports'],
    member: ['add_sales','view_reports'],
    cashier: ['add_sales'],
  };
  const insertPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (company_id, role, permission) VALUES (?, ?, ?)');
  companies.forEach(c => {
    Object.entries(defaultPerms).forEach(([role, perms]) => {
      perms.forEach(p => insertPerm.run(c.id, role, p));
    });
  });

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT '',
      image_url TEXT DEFAULT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
  `);

  // Activity logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      company_id INTEGER REFERENCES companies(id),
      session_id INTEGER REFERENCES sales_sessions(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_activity_company ON activity_logs(company_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
  `);

  // Migrate: add image_url column if missing
  try { db.exec('ALTER TABLE sales ADD COLUMN image_url TEXT DEFAULT NULL'); } catch (e) {}

  // Migrate: add prices JSON column to products
  try { db.exec('ALTER TABLE products ADD COLUMN prices TEXT DEFAULT NULL'); } catch (e) {}

  // Migrate existing admin creators to owner role
  db.exec(`
    UPDATE company_users
    SET role = 'owner'
    WHERE role = 'admin'
    AND user_id = (SELECT created_by FROM companies WHERE companies.id = company_users.company_id)
  `);
}

module.exports = { getDb };
