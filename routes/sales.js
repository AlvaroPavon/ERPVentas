const express = require('express');
const { getDb } = require('../database');
const { logActivity } = require('./activity');

const router = express.Router();

// Obtener sesiones del usuario (de todas sus empresas)
router.get('/sessions', (req, res) => {
  try {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT ss.*, c.name as company_name, u.name as created_by_name,
        (SELECT COUNT(*) FROM sales WHERE session_id = ss.id) as item_count,
        (SELECT COALESCE(SUM(price * quantity), 0) FROM sales WHERE session_id = ss.id) as total_amount
      FROM sales_sessions ss
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      JOIN companies c ON c.id = ss.company_id
      JOIN users u ON u.id = ss.created_by
      ORDER BY ss.session_date DESC, ss.created_at DESC
      LIMIT 50
    `).all(req.user.id);
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// Obtener sesiones de una empresa
router.get('/sessions/:companyId', (req, res) => {
  try {
    const db = getDb();
    const sessions = db.prepare(`
      SELECT ss.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM sales WHERE session_id = ss.id) as item_count,
        (SELECT COALESCE(SUM(price * quantity), 0) FROM sales WHERE session_id = ss.id) as total_amount
      FROM sales_sessions ss
      JOIN users u ON u.id = ss.created_by
      WHERE ss.company_id = ?
      ORDER BY ss.session_date DESC
      LIMIT 50
    `).all(req.params.companyId);
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// Crear sesión de venta
router.post('/sessions', (req, res) => {
  try {
    const { company_id, name, session_date, notes } = req.body;
    if (!company_id || !name || !session_date) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const db = getDb();
    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(company_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const result = db.prepare(
      'INSERT INTO sales_sessions (company_id, created_by, name, session_date, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(company_id, req.user.id, name, session_date, notes || '');

    const session = db.prepare(`
      SELECT ss.*, u.name as created_by_name
      FROM sales_sessions ss
      JOIN users u ON u.id = ss.created_by
      WHERE ss.id = ?
    `).get(result.lastInsertRowid);

    logActivity(req.user.id, 'create_session', `Creó la sesión "${name}"`, company_id, session.id);
    res.status(201).json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear sesión' });
  }
});

// Obtener detalle de sesión con ventas
router.get('/session/:id', (req, res) => {
  try {
    const db = getDb();

    const session = db.prepare(`
      SELECT ss.*, c.name as company_name, u.name as created_by_name
      FROM sales_sessions ss
      JOIN companies c ON c.id = ss.company_id
      JOIN users u ON u.id = ss.created_by
      WHERE ss.id = ?
    `).get(req.params.id);

    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const sales = db.prepare(`
      SELECT s.*, u.name as sold_by_name
      FROM sales s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_id = ?
      ORDER BY s.created_at ASC
    `).all(req.params.id);

    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(price * quantity), 0) as total_amount,
        COUNT(DISTINCT product_name) as unique_products,
        COUNT(DISTINCT user_id) as unique_sellers
      FROM sales WHERE session_id = ?
    `).get(req.params.id);

    const bySeller = db.prepare(`
      SELECT u.name, COUNT(*) as items, COALESCE(SUM(s.price * s.quantity), 0) as total
      FROM sales s
      JOIN users u ON u.id = s.user_id
      WHERE s.session_id = ?
      GROUP BY s.user_id
    `).all(req.params.id);

    res.json({ session, sales, summary, bySeller });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sesión' });
  }
});

// Añadir producto vendido
router.post('/session/:id/items', (req, res) => {
  try {
    const { product_name, price, quantity, image_url } = req.body;
    if (!product_name || price === undefined || price === null) {
      return res.status(400).json({ error: 'Nombre y precio requeridos' });
    }

    const db = getDb();
    const session = db.prepare('SELECT * FROM sales_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(session.company_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const result = db.prepare(
      'INSERT INTO sales (session_id, user_id, product_name, price, quantity, image_url) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.params.id, req.user.id, product_name.trim(), parseFloat(price), parseInt(quantity || 1), image_url || null);

    const sale = db.prepare(`
      SELECT s.*, u.name as sold_by_name
      FROM sales s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    logActivity(req.user.id, 'add_sale', `Añadió "${product_name.trim()}" (${parseFloat(price).toFixed(2)}€ x${parseInt(quantity || 1)})`, session.company_id, session.id);
    res.status(201).json(sale);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir venta' });
  }
});

// Editar venta (cantidad, precio)
router.put('/items/:id', (req, res) => {
  try {
    const { product_name, price, quantity } = req.body;
    const db = getDb();
    const sale = db.prepare('SELECT s.*, ss.company_id FROM sales s JOIN sales_sessions ss ON ss.id = s.session_id WHERE s.id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(sale.company_id, req.user.id);
    if (sale.user_id !== req.user.id && (!membership || (membership.role !== 'admin' && membership.role !== 'owner'))) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta venta' });
    }

    const updates = [];
    const params = [];
    if (product_name !== undefined) { updates.push('product_name = ?'); params.push(product_name.trim()); }
    if (price !== undefined) { updates.push('price = ?'); params.push(parseFloat(price)); }
    if (quantity !== undefined) { updates.push('quantity = ?'); params.push(parseInt(quantity)); }
    if (updates.length === 0) return res.status(400).json({ error: 'Sin datos para actualizar' });

    params.push(req.params.id);
    db.prepare(`UPDATE sales SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare(`
      SELECT s.*, u.name as sold_by_name
      FROM sales s JOIN users u ON u.id = s.user_id WHERE s.id = ?
    `).get(req.params.id);

    logActivity(req.user.id, 'edit_sale', `Editó "${updated.product_name}" (${updated.price.toFixed(2)}€ x${updated.quantity})`, sale.company_id, sale.session_id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar venta' });
  }
});

// Eliminar venta
router.delete('/items/:id', (req, res) => {
  try {
    const db = getDb();
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Venta no encontrada' });

    const session = db.prepare('SELECT * FROM sales_sessions WHERE id = ?').get(sale.session_id);
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(session.company_id, req.user.id);

    if (sale.user_id !== req.user.id && (!membership || (membership.role !== 'admin' && membership.role !== 'owner'))) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta venta' });
    }

    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    res.json({ message: 'Venta eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar venta' });
  }
});

// Exportar CSV de una sesión
router.get('/session/:id/csv', (req, res) => {
  try {
    const db = getDb();
    const session = db.prepare(`SELECT ss.*, c.name as company_name FROM sales_sessions ss JOIN companies c ON c.id = ss.company_id WHERE ss.id = ?`).get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?').get(session.company_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No tienes acceso a esta sesión' });

    const sales = db.prepare(`
      SELECT s.product_name, s.quantity, s.price, (s.price * s.quantity) as total, u.name as seller, s.created_at
      FROM sales s JOIN users u ON u.id = s.user_id
      WHERE s.session_id = ? ORDER BY s.created_at ASC
    `).all(req.params.id);

    const total = sales.reduce((sum, s) => sum + s.total, 0);

    let csv = '\uFEFF'; // BOM for Excel UTF-8
    csv += `"Sesión","${session.name}","Fecha","${session.session_date}"\n`;
    csv += `"Empresa","${session.company_name}"\n\n`;
    csv += '"Producto","Cantidad","Precio","Total","Vendedor","Fecha"\n';
    sales.forEach(s => {
      csv += `"${s.product_name}",${s.quantity},${s.price.toFixed(2)},${s.total.toFixed(2)},"${s.seller}","${s.created_at}"\n`;
    });
    csv += `\n"Total General",,,${total.toFixed(2)}€\n`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${session.name.replace(/\s+/g, '_')}_${session.session_date}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar CSV' });
  }
});

// Exportar Excel (.xlsx) de una sesión
router.get('/session/:id/xlsx', async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const db = getDb();
    const session = db.prepare(`SELECT ss.*, c.name as company_name FROM sales_sessions ss JOIN companies c ON c.id = ss.company_id WHERE ss.id = ?`).get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?').get(session.company_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No tienes acceso a esta sesión' });

    const sales = db.prepare(`
      SELECT s.product_name, s.quantity, s.price, (s.price * s.quantity) as total, u.name as seller, s.created_at
      FROM sales s JOIN users u ON u.id = s.user_id
      WHERE s.session_id = ? ORDER BY s.created_at ASC
    `).all(req.params.id);

    const total = sales.reduce((sum, s) => sum + s.total, 0);

    // Group by seller
    const bySeller = {};
    sales.forEach(s => {
      bySeller[s.seller] = (bySeller[s.seller] || 0) + s.total;
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = req.user.name;
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Ventas');

    // Columns
    ws.columns = [
      { header: 'Producto', key: 'product_name', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Precio', key: 'price', width: 12 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Vendedor', key: 'seller', width: 20 },
      { header: 'Fecha', key: 'created_at', width: 20 },
    ];

    // Style header
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0381FE' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data
    sales.forEach(s => ws.addRow(s));

    // Total row
    const totalRow = ws.addRow({ product_name: 'TOTAL', total });
    totalRow.font = { bold: true };
    totalRow.getCell('total').numFmt = '#,##0.00€';

    // By seller section
    ws.addRow([]);
    ws.addRow({ product_name: 'Resumen por Vendedor' }).font = { bold: true, size: 12 };
    Object.entries(bySeller).forEach(([seller, amount]) => {
      ws.addRow({ product_name: seller, total: amount });
    });

    // Session info
    ws.addRow([]);
    ws.addRow({ product_name: `Sesión: ${session.name}` }).font = { italic: true };
    ws.addRow({ product_name: `Fecha: ${session.session_date}` }).font = { italic: true };
    ws.addRow({ product_name: `Empresa: ${session.company_name}` }).font = { italic: true };

    // Price format
    ws.eachRow((row, rowNum) => {
      if (row.getCell('price').value) row.getCell('price').numFmt = '#,##0.00€';
      if (row.getCell('total').value && typeof row.getCell('total').value === 'number') {
        row.getCell('total').numFmt = '#,##0.00€';
      }
    });

    const filename = `${session.name.replace(/\s+/g, '_')}_${session.session_date}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al exportar Excel' });
  }
});

// Editar sesión (nombre, fecha, notas)
router.put('/session/:id', (req, res) => {
  try {
    const { name, session_date, notes } = req.body;
    const db = getDb();
    const session = db.prepare('SELECT * FROM sales_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(session.company_id, req.user.id);
    if (session.created_by !== req.user.id && (!membership || (membership.role !== 'admin' && membership.role !== 'owner'))) {
      return res.status(403).json({ error: 'No tienes permiso para editar esta sesión' });
    }

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (session_date !== undefined) { updates.push('session_date = ?'); params.push(session_date); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
    if (updates.length === 0) return res.status(400).json({ error: 'Sin datos para actualizar' });

    params.push(req.params.id);
    db.prepare(`UPDATE sales_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare(`
      SELECT ss.*, u.name as created_by_name, c.name as company_name
      FROM sales_sessions ss
      JOIN users u ON u.id = ss.created_by
      JOIN companies c ON c.id = ss.company_id
      WHERE ss.id = ?
    `).get(req.params.id);

    logActivity(req.user.id, 'edit_session', `Editó la sesión "${updated.name}"`, updated.company_id, updated.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al editar sesión' });
  }
});

// Eliminar sesión (solo si está vacía o el usuario es owner/admin)
router.delete('/session/:id', (req, res) => {
  try {
    const db = getDb();
    const session = db.prepare(`
      SELECT ss.*, c.created_by as company_owner_id
      FROM sales_sessions ss
      JOIN companies c ON c.id = ss.company_id
      WHERE ss.id = ?
    `).get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(session.company_id, req.user.id);
    const isOwner = session.company_owner_id === req.user.id || (membership && (membership.role === 'owner' || membership.role === 'admin'));

    if (session.created_by !== req.user.id && !isOwner) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta sesión' });
    }

    const saleCount = db.prepare('SELECT COUNT(*) as cnt FROM sales WHERE session_id = ?').get(req.params.id);
    if (saleCount.cnt > 0 && !isOwner) {
      return res.status(400).json({ error: 'La sesión tiene productos. Solo admin/owner puede eliminarla.' });
    }

    db.prepare('DELETE FROM sales WHERE session_id = ?').run(req.params.id);
    db.prepare('DELETE FROM sales_sessions WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'delete_session', `Eliminó la sesión "${session.name}"`, session.company_id);
    res.json({ message: 'Sesión eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar sesión' });
  }
});

// Cerrar sesión
router.post('/session/:id/close', (req, res) => {
  try {
    const db = getDb();
    const session = db.prepare('SELECT * FROM sales_sessions WHERE id = ?').get(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(session.company_id, req.user.id);
    if (session.created_by !== req.user.id && (!membership || (membership.role !== 'admin' && membership.role !== 'owner'))) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    db.prepare('UPDATE sales_sessions SET is_closed = 1 WHERE id = ?').run(req.params.id);
    logActivity(req.user.id, 'close_session', `Cerró la sesión "${session.name}"`, session.company_id, session.id);
    res.json({ message: 'Sesión cerrada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

module.exports = router;
