const express = require('express');
const { getDb } = require('../database');
const { logActivity } = require('./activity');
const { hasPermission } = require('./permissions');

const router = express.Router({ mergeParams: true });

// Get inventory for a company
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const companyId = req.params.companyId;

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const inventory = db.prepare(`
      SELECT i.*, p.name as product_name, p.category, p.image_url,
        COALESCE(
          (SELECT SUM(s.quantity) FROM sales s
           JOIN sales_sessions ss ON ss.id = s.session_id
           WHERE s.product_name = p.name AND ss.company_id = i.company_id AND ss.is_closed = 1), 0
        ) as total_sold
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.company_id = ?
      ORDER BY p.name ASC
    `).all(companyId);

    res.json(inventory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// Get inventory movements for a company
router.get('/movements', (req, res) => {
  try {
    const db = getDb();
    const companyId = req.params.companyId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const movements = db.prepare(`
      SELECT im.*, u.name as user_name, p.name as product_name, i.stock as current_stock
      FROM inventory_movements im
      JOIN inventory i ON i.id = im.inventory_id
      JOIN users u ON u.id = im.created_by
      JOIN products p ON p.id = i.product_id
      WHERE i.company_id = ?
      ORDER BY im.created_at DESC
      LIMIT ? OFFSET ?
    `).all(companyId, limit, offset);

    const count = db.prepare(`
      SELECT COUNT(*) as total FROM inventory_movements im
      JOIN inventory i ON i.id = im.inventory_id
      WHERE i.company_id = ?
    `).get(companyId);

    res.json({ movements, total: count.total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});

// Add stock (manual adjustment)
router.post('/:productId/add-stock', (req, res) => {
  try {
    const { quantity, notes } = req.body;
    const companyId = req.params.companyId;
    const productId = parseInt(req.params.productId);

    if (!quantity || parseInt(quantity) <= 0) {
      return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    }

    const db = getDb();

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    let inv = db.prepare('SELECT * FROM inventory WHERE company_id = ? AND product_id = ?')
      .get(companyId, productId);

    if (!inv) {
      const result = db.prepare('INSERT INTO inventory (company_id, product_id, stock) VALUES (?, ?, 0)')
        .run(companyId, productId);
      inv = { id: result.lastInsertRowid, stock: 0 };
    }

    const newStock = inv.stock + parseInt(quantity);
    db.prepare('UPDATE inventory SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStock, inv.id);

    db.prepare('INSERT INTO inventory_movements (inventory_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(inv.id, 'in', parseInt(quantity), notes || 'Ajuste manual', req.user.id);

    logActivity(req.user.id, 'inventory_add', `Añadió ${quantity} unidades al inventario (producto ${productId})`, companyId);

    res.json({ message: 'Stock actualizado', newStock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir stock' });
  }
});

// Remove stock (manual adjustment)
router.post('/:productId/remove-stock', (req, res) => {
  try {
    const { quantity, notes } = req.body;
    const companyId = req.params.companyId;
    const productId = parseInt(req.params.productId);

    if (!quantity || parseInt(quantity) <= 0) {
      return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    }

    const db = getDb();

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const inv = db.prepare('SELECT * FROM inventory WHERE company_id = ? AND product_id = ?')
      .get(companyId, productId);

    if (!inv) {
      return res.status(404).json({ error: 'Producto no encontrado en inventario' });
    }

    if (inv.stock < parseInt(quantity)) {
      return res.status(400).json({ error: `Stock insuficiente. Disponible: ${inv.stock}` });
    }

    const newStock = inv.stock - parseInt(quantity);
    db.prepare('UPDATE inventory SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStock, inv.id);

    db.prepare('INSERT INTO inventory_movements (inventory_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(inv.id, 'out', parseInt(quantity), notes || 'Ajuste manual', req.user.id);

    logActivity(req.user.id, 'inventory_remove', `Retiró ${quantity} unidades del inventario (producto ${productId})`, companyId);

    // Check low stock alert
    let alert = null;
    if (newStock <= inv.min_stock) {
      alert = `⚠️ Stock bajo: ${newStock} unidades de "${db.prepare('SELECT name FROM products WHERE id = ?').get(productId).name}" (mínimo: ${inv.min_stock})`;
    }

    res.json({ message: 'Stock actualizado', newStock, alert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al retirar stock' });
  }
});

// Set minimum stock threshold
router.put('/:productId/threshold', (req, res) => {
  try {
    const { minStock } = req.body;
    const companyId = req.params.companyId;
    const productId = parseInt(req.params.productId);

    const db = getDb();

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    let inv = db.prepare('SELECT * FROM inventory WHERE company_id = ? AND product_id = ?')
      .get(companyId, productId);

    if (!inv) {
      const result = db.prepare('INSERT INTO inventory (company_id, product_id, stock, min_stock) VALUES (?, ?, 0, ?)')
        .run(companyId, productId, minStock || 0);
      inv = { id: result.lastInsertRowid };
    } else {
      db.prepare('UPDATE inventory SET min_stock = ? WHERE id = ?')
        .run(minStock || 0, inv.id);
    }

    res.json({ message: 'Umbral mínimo actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar umbral' });
  }
});

// Update stock from sale (called when a sale is added)
function deductStock(db, companyId, productName, quantity) {
  try {
    const product = db.prepare('SELECT id FROM products WHERE company_id = ? AND name = ?')
      .get(companyId, productName);
    if (!product) return;

    let inv = db.prepare('SELECT * FROM inventory WHERE company_id = ? AND product_id = ?')
      .get(companyId, product.id);

    if (!inv) {
      const result = db.prepare('INSERT INTO inventory (company_id, product_id, stock) VALUES (?, ?, 0)')
        .run(companyId, product.id);
      inv = { id: result.lastInsertRowid, stock: 0 };
    }

    const newStock = inv.stock - quantity;
    db.prepare('UPDATE inventory SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStock, inv.id);

    db.prepare('INSERT INTO inventory_movements (inventory_id, type, quantity, notes, created_by) VALUES (?, ?, ?, ?, ?)')
      .run(inv.id, 'sale', quantity, 'Venta', 1); // system user for auto-deductions
  } catch (e) {
    // Silently fail - inventory is a helper feature
    console.error('Inventory deduction error:', e.message);
  }
}

module.exports = { router, deductStock };