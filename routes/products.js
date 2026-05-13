const express = require('express');
const { getDb } = require('../database');
const { logActivity } = require('./activity');
const ExcelJS = require('exceljs');

const router = express.Router({ mergeParams: true });

// List products for a company
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category, tags } = req.query;

    let sql = 'SELECT * FROM products WHERE company_id = ?';
    const params = [req.params.companyId];

    if (category) {
      sql += ' AND category_id = (SELECT id FROM categories WHERE name = ? AND company_id = ?)';
      params.push(category, req.params.companyId);
    }

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        const tagConditions = tagList.map(() =>
          "EXISTS (SELECT 1 FROM json_each(products.tags) WHERE value = ?)"
        );
        sql += ' AND (' + tagConditions.join(' OR ') + ')';
        params.push(...tagList);
      }
    }

    sql += ' ORDER BY name ASC';

    const products = db.prepare(sql).all(...params);
    // Parse JSON fields for each product
    products.forEach(p => {
      if (p.prices) {
        try { p.prices = JSON.parse(p.prices); } catch { p.prices = null; }
      }
      if (p.tags) {
        try { p.tags = JSON.parse(p.tags); } catch { p.tags = []; }
      } else {
        p.tags = [];
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
    const { name, price, category, category_id, tags, image_url, prices } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nombre requerido' });

    const db = getDb();
    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    let pricesJson = null;
    if (prices && Array.isArray(prices) && prices.length > 0) {
      pricesJson = JSON.stringify(prices);
    }

    let tagsJson = '[]';
    if (tags && Array.isArray(tags)) {
      tagsJson = JSON.stringify(tags);
    }

    const result = db.prepare(
      'INSERT INTO products (company_id, name, price, category, category_id, tags, image_url, created_by, prices) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      req.params.companyId, name.trim(), parseFloat(price || 0), category || '',
      category_id || null, tagsJson, image_url || null, req.user.id, pricesJson
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    if (product.prices) { try { product.prices = JSON.parse(product.prices); } catch { product.prices = null; } }
    if (product.tags) { try { product.tags = JSON.parse(product.tags); } catch { product.tags = []; } }
    logActivity(req.user.id, 'create_product', `Creó el producto "${name.trim()}"`, req.params.companyId);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Update a product
router.put('/:productId', (req, res) => {
  try {
    const { name, price, category, category_id, tags, image_url, prices } = req.body;
    const db = getDb();

    const product = db.prepare('SELECT * FROM products WHERE id = ? AND company_id = ?')
      .get(req.params.productId, req.params.companyId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    // Build update fields dynamically
    const fields = [];
    const values = [];

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Nombre requerido' });
      fields.push('name = ?');
      values.push(name.trim());
    }
    if (price !== undefined) {
      fields.push('price = ?');
      values.push(parseFloat(price));
    }
    if (category !== undefined) {
      fields.push('category = ?');
      values.push(category || '');
    }
    if (category_id !== undefined) {
      fields.push('category_id = ?');
      values.push(category_id || null);
    }
    if (tags !== undefined) {
      fields.push('tags = ?');
      values.push(Array.isArray(tags) ? JSON.stringify(tags) : '[]');
    }
    if (image_url !== undefined) {
      fields.push('image_url = ?');
      values.push(image_url || null);
    }
    if (prices !== undefined) {
      fields.push('prices = ?');
      values.push(Array.isArray(prices) && prices.length > 0 ? JSON.stringify(prices) : null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    values.push(req.params.productId);
    db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.productId);
    if (updated.prices) { try { updated.prices = JSON.parse(updated.prices); } catch { updated.prices = null; } }
    if (updated.tags) { try { updated.tags = JSON.parse(updated.tags); } catch { updated.tags = []; } }
    logActivity(req.user.id, 'update_product', `Actualizó el producto "${updated.name}"`, req.params.companyId);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar producto' });
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

// Exportar catálogo a CSV
router.get('/export/csv', (req, res) => {
  try {
    const db = getDb();
    const { companyId } = req.params;

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const products = db.prepare(
      'SELECT name, price, category, stock FROM products WHERE company_id = ? ORDER BY name ASC'
    ).all(companyId);

    const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(companyId);

    let csv = '\uFEFF';
    csv += `"Catálogo de Productos - ${company?.name || ''}"\n\n`;
    csv += '"Producto","Precio","Categoría","Stock"\n';
    products.forEach(p => {
      csv += `"${p.name}",${p.price.toFixed(2)}€,"${p.category || '—'}",${p.stock || 0}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="catalogo_${companyId}_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar catálogo' });
  }
});

// Exportar catálogo a Excel
router.get('/export/xlsx', async (req, res) => {
  try {
    const db = getDb();
    const { companyId } = req.params;

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const products = db.prepare(
      'SELECT name, price, category, stock, created_at FROM products WHERE company_id = ? ORDER BY name ASC'
    ).all(companyId);

    const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(companyId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Notas de Venta';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Catálogo');

    ws.columns = [
      { header: 'Producto', key: 'name', width: 30 },
      { header: 'Precio (€)', key: 'price', width: 12 },
      { header: 'Categoría', key: 'category', width: 15 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Creado', key: 'created_at', width: 18 },
    ];

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0381FE' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add company header
    ws.addRow([`Catálogo: ${company?.name || ''}`]).font = { bold: true, size: 14 };
    ws.addRow([]);

    products.forEach(p => {
      ws.addRow({
        name: p.name,
        price: parseFloat(p.price),
        category: p.category || '',
        stock: p.stock || 0,
        created_at: new Date(p.created_at).toLocaleDateString('es')
      });
    });

    // Total row
    const totalRow = ws.addRow({ name: 'TOTAL PRODUCTOS', category: products.length });
    totalRow.font = { bold: true };

    ws.eachRow((row, rowNum) => {
      if (row.getCell('price').value && typeof row.getCell('price').value === 'number') {
        row.getCell('price').numFmt = '#,##0.00€';
      }
    });

    const filename = `catalogo_${companyId}_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar catálogo' });
  }
});

module.exports = router;
