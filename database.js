const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'ventas.db');

let db;

function getDb() {
  if (!db) {
    const dbPath = process.env.TEST_DB === 'true' ? ':memory:' : DB_PATH;
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function resetDb() {
  if (db) {
    db.close();
    db = undefined;
  }
  return getDb();
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      language TEXT DEFAULT 'es',
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

    CREATE INDEX IF NOT EXISTS idx_join_requests_company ON join_requests(company_id);
    CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(endpoint)
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      UNIQUE(company_id, role, permission)
    );
    CREATE INDEX IF NOT EXISTS idx_role_perms_company ON role_permissions(company_id);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3B82F6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_categories_company ON categories(company_id);

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      category TEXT DEFAULT '',
      category_id INTEGER DEFAULT NULL REFERENCES categories(id) ON DELETE SET NULL,
      tags TEXT DEFAULT '[]',
      image_url TEXT DEFAULT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);

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

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(company_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_company ON inventory(company_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);

    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_inv_movements_inv ON inventory_movements(inventory_id);
    CREATE INDEX IF NOT EXISTS idx_inv_movements_date ON inventory_movements(created_at);

    CREATE TABLE IF NOT EXISTS commission_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      commission_pct REAL NOT NULL DEFAULT 0,
      UNIQUE(company_id, role)
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      UNIQUE(sender_id, receiver_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
    CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
  `);

  // Migrate: add language column to users
  try { db.exec('ALTER TABLE users ADD COLUMN language TEXT DEFAULT \'es\''); } catch (e) {}
  // Migrate: add image_url column if missing
  try { db.exec('ALTER TABLE sales ADD COLUMN image_url TEXT DEFAULT NULL'); } catch (e) {}
  // Migrate: add prices JSON column to products
  try { db.exec('ALTER TABLE products ADD COLUMN prices TEXT DEFAULT NULL'); } catch (e) {}
  // Migrate: add invoice_number column to sales_sessions
  try { db.exec('ALTER TABLE sales_sessions ADD COLUMN invoice_number TEXT DEFAULT NULL'); } catch (e) {}
  // Migrate: add stock column to products
  try { db.exec('ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 0'); } catch (e) {}
  // Migrate: add profit column to sales
  try { db.exec('ALTER TABLE sales ADD COLUMN profit REAL DEFAULT 0'); } catch (e) {}
  // Migrate: add email summary columns to companies
  try { db.exec('ALTER TABLE companies ADD COLUMN email_summary_enabled INTEGER DEFAULT 0'); } catch (e) {}
  try { db.exec('ALTER TABLE companies ADD COLUMN email_summary_time TEXT DEFAULT NULL'); } catch (e) {}
  // Migrate: add category_id and tags columns to products
  try { db.exec('ALTER TABLE products ADD COLUMN category_id INTEGER DEFAULT NULL'); } catch (e) {}
  try { db.exec('ALTER TABLE products ADD COLUMN tags TEXT DEFAULT \'[]\''); } catch (e) {}
  // Index for category_id (must be after ALTER TABLE for existing DBs)
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)'); } catch (e) {}

  // Data migration: migrate existing category text to categories table and set category_id
  try {
    const catsToMigrate = db.prepare('SELECT DISTINCT company_id, category FROM products WHERE category IS NOT NULL AND category != \'\'').all();
    if (catsToMigrate.length > 0) {
      const insertCat = db.prepare('INSERT OR IGNORE INTO categories (company_id, name) VALUES (?, ?)');
      catsToMigrate.forEach(c => insertCat.run(c.company_id, c.category));
      db.prepare(`
        UPDATE products SET category_id = (
          SELECT id FROM categories
          WHERE categories.name = products.category
          AND categories.company_id = products.company_id
        ) WHERE category IS NOT NULL AND category != ''
      `).run();
    }
  } catch (e) {}
  // Set default empty tags array for products with NULL tags
  try { db.exec("UPDATE products SET tags = '[]' WHERE tags IS NULL"); } catch (e) {}
  // Friend requests table migration (for existing DBs)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        UNIQUE(sender_id, receiver_id)
      );
      CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
      CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
    `);
  } catch (e) {}

  // Chat tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'channel',
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_conv_company ON chat_conversations(company_id);

    CREATE TABLE IF NOT EXISTS chat_conversations_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_read_at DATETIME,
      UNIQUE(conversation_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_chat_part_conv ON chat_conversations_participants(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_chat_part_user ON chat_conversations_participants(user_id);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER REFERENCES chat_conversations(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      image_url TEXT DEFAULT NULL,
      emoji_reactions TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_chat_msgs_conv ON chat_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_chat_msgs_user ON chat_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_chat_msgs_created ON chat_messages(created_at);
  `);

  // Migrate existing admin creators to owner role
  db.exec(`
    UPDATE company_users
    SET role = 'owner'
    WHERE role = 'admin'
    AND user_id = (SELECT created_by FROM companies WHERE companies.id = company_users.company_id)
  `);

  // Auto-create general channel for each company
  db.prepare(`
    INSERT OR IGNORE INTO chat_conversations (company_id, name, type, created_by)
    SELECT id, 'general', 'company', created_by FROM companies
    WHERE id NOT IN (SELECT company_id FROM chat_conversations WHERE type = 'company')
  `).run();

  // Auto-add all company members to general channel
  const generalConvs = db.prepare(`
    SELECT cc.id as conv_id FROM chat_conversations cc
    WHERE cc.type = 'company' AND cc.name = 'general'
  `).all();

  const insertParticipant = db.prepare(
    'INSERT OR IGNORE INTO chat_conversations_participants (conversation_id, user_id) VALUES (?, ?)'
  );

  generalConvs.forEach(conv => {
    const companyId = db.prepare('SELECT company_id FROM chat_conversations WHERE id = ?').get(conv.conv_id).company_id;
    const members = db.prepare('SELECT user_id FROM company_users WHERE company_id = ?').all(companyId);
    members.forEach(m => insertParticipant.run(conv.conv_id, m.user_id));
  });

  // Seed default role permissions for existing companies
  const companies = db.prepare('SELECT id FROM companies').all();
  const defaultPerms = {
    owner: ['manage_company','manage_members','manage_roles','manage_products','manage_sessions','add_sales','delete_sales','view_reports','manage_inventory','view_commissions','export_catalog'],
    admin: ['manage_members','manage_products','manage_sessions','add_sales','delete_sales','view_reports','manage_inventory','view_commissions','export_catalog'],
    member: ['add_sales','view_reports'],
    cashier: ['add_sales'],
  };
  const insertPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (company_id, role, permission) VALUES (?, ?, ?)');
  companies.forEach(c => {
    Object.entries(defaultPerms).forEach(([role, perms]) => {
      perms.forEach(p => insertPerm.run(c.id, role, p));
    });
  });

  // Seed default commission configs for existing companies
  const companies2 = db.prepare('SELECT id FROM companies').all();
  const defaultCommissions = {
    owner: 0,
    admin: 0,
    member: 5,
    cashier: 3,
  };
  const insertComm = db.prepare('INSERT OR IGNORE INTO commission_config (company_id, role, commission_pct) VALUES (?, ?, ?)');
  companies2.forEach(c => {
    Object.entries(defaultCommissions).forEach(([role, pct]) => {
      insertComm.run(c.id, role, pct);
    });
  });
}

module.exports = { getDb, resetDb };