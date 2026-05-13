const express = require('express');
const { getDb } = require('../database');
const { logActivity } = require('./activity');

const router = express.Router();

// Get commission config for a company
router.get('/config/:companyId', (req, res) => {
  try {
    const db = getDb();
    const { companyId } = req.params;

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const configs = db.prepare(
      'SELECT id, role, commission_pct FROM commission_config WHERE company_id = ?'
    ).all(companyId);

    res.json(configs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener configuración de comisiones' });
  }
});

// Update commission config (owner only)
router.put('/config/:companyId/:role', (req, res) => {
  try {
    const db = getDb();
    const { companyId, role } = req.params;
    const { commission_pct } = req.body;

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership || membership.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario puede configurar comisiones' });
    }

    const allowedRoles = ['admin', 'member', 'cashier'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Rol no válido para comisiones' });
    }

    const pct = parseFloat(commission_pct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'Porcentaje debe estar entre 0 y 100' });
    }

    db.prepare('INSERT OR REPLACE INTO commission_config (company_id, role, commission_pct) VALUES (?, ?, ?)')
      .run(companyId, role, pct);

    logActivity(req.user.id, 'commission_update', `Actualizó comisión de ${role} a ${pct}%`, companyId);

    res.json({ message: 'Comisión actualizada', role, commission_pct: pct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar comisión' });
  }
});

// Get commission summary for a session
router.get('/session/:sessionId', (req, res) => {
  try {
    const db = getDb();
    const { sessionId } = req.params;

    const session = db.prepare('SELECT * FROM sales_sessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });

    // Check user belongs to company
    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(session.company_id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const sales = db.prepare(`
      SELECT s.*, u.name as sold_by_name, cu.role,
        COALESCE(cc.commission_pct, 0) as commission_pct
      FROM sales s
      JOIN users u ON u.id = s.user_id
      JOIN company_users cu ON cu.user_id = s.user_id AND cu.company_id = ?
      LEFT JOIN commission_config cc ON cc.company_id = cu.company_id AND cc.role = cu.role
      WHERE s.session_id = ?
    `).all(session.company_id, sessionId);

    const commissionConfig = db.prepare(
      'SELECT role, commission_pct FROM commission_config WHERE company_id = ?'
    ).all(session.company_id);

    let summary = [];
    const bySeller = {};

    sales.forEach(s => {
      const sellerName = s.sold_by_name || 'Desconocido';
      const saleTotal = s.price * s.quantity;
      const commission = saleTotal * (s.commission_pct / 100);

      if (!bySeller[sellerName]) {
        bySeller[sellerName] = {
          seller_name: sellerName,
          role: s.role,
          commission_pct: s.commission_pct,
          total_sales: 0,
          total_commission: 0,
          items: 0
        };
      }

      bySeller[sellerName].total_sales += saleTotal;
      bySeller[sellerName].total_commission += commission;
      bySeller[sellerName].items += 1;
    });

    summary = Object.values(bySeller).map(s => ({
      ...s,
      total_sales: parseFloat(s.total_sales.toFixed(2)),
      total_commission: parseFloat(s.total_commission.toFixed(2))
    }));

    const grandTotalCommission = summary.reduce((sum, s) => sum + s.total_commission, 0);

    res.json({
      session_id: sessionId,
      session_name: session.name,
      commission_config: commissionConfig,
      summary,
      grand_total_commission: parseFloat(grandTotalCommission.toFixed(2))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular comisiones' });
  }
});

// Get all commission summaries for dashboard (last 6 months by seller)
router.get('/summary/:companyId', (req, res) => {
  try {
    const db = getDb();
    const { companyId } = req.params;
    const months = parseInt(req.query.months) || 6;

    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    const data = db.prepare(`
      SELECT u.name as seller_name,
        cu.role,
        COALESCE(cc.commission_pct, 0) as commission_pct,
        COUNT(s.id) as items_sold,
        COALESCE(SUM(s.price * s.quantity), 0) as total_sales,
        COALESCE(SUM(s.price * s.quantity * cc.commission_pct / 100), 0) as total_commission
      FROM sales s
      JOIN sales_sessions ss ON ss.id = s.session_id
      JOIN users u ON u.id = s.user_id
      JOIN company_users cu ON cu.user_id = s.user_id AND cu.company_id = ss.company_id
      LEFT JOIN commission_config cc ON cc.company_id = cu.company_id AND cc.role = cu.role
      WHERE ss.company_id = ?
        AND ss.session_date >= date('now', ? || ' months')
        AND ss.is_closed = 1
      GROUP BY s.user_id
      ORDER BY total_commission DESC
    `).all(companyId, '-' + months);

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen de comisiones' });
  }
});

module.exports = router;