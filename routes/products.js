const express = require('express');
const { getDb } = require('../database');
const { logActivity } = require('./activity');

const router = express.Router({ mergeParams: true });

// List products for a company
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const products = db.prepare(
      'SELECT * FROM products WHERE company_id = ? ORDER BY name ASC'
    ).all(req.params.companyId);
    // Parse prices JSON for each product
    products.forEach(p => {
      if (p.prices) {
        try { p.prices = JSON.parse(p.prices); } catch { p.prices = null; }
      }
    });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// Create a product
router.post('/', (req, res) => {
  try {
    const { name, price, category, image_url, prices } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const db = getDb();
    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    let pricesJson = null;
    if (prices && Array.isArray(prices) && prices.length > 0) {
      pricesJson = JSON.stringify(prices);
    }

    const result = db.prepare(
      'INSERT INTO products (company_id, name, price, category, image_url, created_by, prices) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(req.params.companyId, name.trim(), parseFloat(price || 0), category || '', image_url || null, req.user.id, pricesJson);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    if (product.prices) { try { product.prices = JSON.parse(product.prices); } catch { product.prices = null; } }
    logActivity(req.user.id, 'create_product', `Creó el producto "${name.trim()}"`, req.params.companyId);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Delete product
router.delete('/:productId', (req, res) => {
  try {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(product.company_id, req.user.id);
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return res.status(403).json({ error: 'Solo admin/owner puede eliminar productos' });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.productId);
    logActivity(req.user.id, 'delete_product', `Eliminó el producto "${product.name}"`, product.company_id);
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
