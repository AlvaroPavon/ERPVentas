const express = require('express');
const { getDb } = require('../database');

const router = express.Router({ mergeParams: true });

// GET / — list categories for a company
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const categories = db.prepare(
      'SELECT * FROM categories WHERE company_id = ? ORDER BY name ASC'
    ).all(req.params.companyId);
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// POST / — create category
router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nombre requerido' });
    }

    const db = getDb();
    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const result = db.prepare(
      'INSERT INTO categories (company_id, name, color) VALUES (?, ?, ?)'
    ).run(req.params.companyId, name.trim(), color || '#3B82F6');

    const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

// PATCH /:categoryId — rename category
router.patch('/:categoryId', (req, res) => {
  try {
    const { name, color } = req.body;
    const db = getDb();

    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND company_id = ?')
      .get(req.params.categoryId, req.params.companyId);
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), req.params.categoryId);
    }
    if (color !== undefined) {
      db.prepare('UPDATE categories SET color = ? WHERE id = ?').run(color, req.params.categoryId);
    }

    const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.categoryId);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

// DELETE /:categoryId — delete category
router.delete('/:categoryId', (req, res) => {
  try {
    const db = getDb();

    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND company_id = ?')
      .get(req.params.categoryId, req.params.companyId);
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });

    // Set category_id to NULL for linked products
    db.prepare('UPDATE products SET category_id = NULL WHERE category_id = ?').run(req.params.categoryId);
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.categoryId);

    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

module.exports = router;
