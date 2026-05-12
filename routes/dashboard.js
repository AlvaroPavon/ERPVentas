const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// Estadísticas mensuales del usuario (de todas sus empresas)
router.get('/monthly', (req, res) => {
  try {
    const db = getDb();
    const year = req.query.year || new Date().getFullYear();
    const month = req.query.month || (new Date().getMonth() + 1);

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT ss.id) as session_count,
        COUNT(s.id) as total_items,
        COALESCE(SUM(s.price * s.quantity), 0) as total_amount,
        COUNT(DISTINCT s.product_name) as unique_products
      FROM sales_sessions ss
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      LEFT JOIN sales s ON s.session_id = ss.id
      WHERE strftime('%Y-%m', ss.session_date) = ?
    `).get(req.user.id, monthStr);

    // Ventas por día del mes
    const dailySales = db.prepare(`
      SELECT ss.session_date,
        COUNT(s.id) as items,
        COALESCE(SUM(s.price * s.quantity), 0) as amount,
        ss.name as session_name,
        ss.id as session_id
      FROM sales_sessions ss
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      LEFT JOIN sales s ON s.session_id = ss.id
      WHERE strftime('%Y-%m', ss.session_date) = ?
      GROUP BY ss.id
      ORDER BY ss.session_date ASC
    `).all(req.user.id, monthStr);

    res.json({ stats, dailySales, year, month });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Top productos más vendidos
router.get('/top-products', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 10;

    const products = db.prepare(`
      SELECT s.product_name,
        COUNT(*) as times_sold,
        SUM(s.quantity) as total_quantity,
        COALESCE(SUM(s.price * s.quantity), 0) as total_revenue,
        ROUND(AVG(s.price), 2) as avg_price
      FROM sales s
      JOIN sales_sessions ss ON ss.id = s.session_id
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      GROUP BY s.product_name
      ORDER BY total_quantity DESC
      LIMIT ?
    `).all(req.user.id, limit);

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener top productos' });
  }
});

// Comparativa por días
router.get('/daily-comparison', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 20;

    const days = db.prepare(`
      SELECT ss.session_date,
        ss.name as session_name,
        ss.id as session_id,
        c.name as company_name,
        COUNT(s.id) as items_sold,
        COALESCE(SUM(s.price * s.quantity), 0) as total_amount,
        COUNT(DISTINCT s.user_id) as sellers
      FROM sales_sessions ss
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      JOIN companies c ON c.id = ss.company_id
      LEFT JOIN sales s ON s.session_id = ss.id
      GROUP BY ss.id
      ORDER BY ss.session_date DESC
      LIMIT ?
    `).all(req.user.id, limit);

    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener comparativa' });
  }
});

// Resumen global del usuario
router.get('/overview', (req, res) => {
  try {
    const db = getDb();

    const totalSessions = db.prepare(`
      SELECT COUNT(DISTINCT ss.id) as count
      FROM sales_sessions ss
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
    `).get(req.user.id).count;

    const totalSales = db.prepare(`
      SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
      FROM sales s
      JOIN sales_sessions ss ON ss.id = s.session_id
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
    `).get(req.user.id).total;

    const totalItems = db.prepare(`
      SELECT COUNT(*) as count
      FROM sales s
      JOIN sales_sessions ss ON ss.id = s.session_id
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
    `).get(req.user.id).count;

    const companies = db.prepare(`
      SELECT COUNT(*) as count FROM company_users WHERE user_id = ?
    `).get(req.user.id).count;

    res.json({ totalSessions, totalSales, totalItems, companies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// Estadísticas avanzadas
router.get('/advanced', (req, res) => {
  try {
    const db = getDb();

    // Weekly comparison (current week vs previous week)
    const weekSales = db.prepare(`
      SELECT CASE
        WHEN strftime('%W', ss.session_date) = strftime('%W', 'now') THEN 'this_week'
        ELSE 'last_week'
      END as week,
      COALESCE(SUM(s.price * s.quantity), 0) as total,
      COUNT(DISTINCT ss.id) as sessions,
      COUNT(s.id) as items
      FROM sales_sessions ss
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      LEFT JOIN sales s ON s.session_id = ss.id
      WHERE ss.session_date >= date('now', '-14 days')
      GROUP BY week
    `).all(req.user.id);

    const thisWeek = weekSales.find(w => w.week === 'this_week');
    const lastWeek = weekSales.find(w => w.week === 'last_week');

    // Revenue by seller
    const bySeller = db.prepare(`
      SELECT u.name,
        COUNT(s.id) as items,
        COALESCE(SUM(s.price * s.quantity), 0) as total
      FROM sales s
      JOIN users u ON u.id = s.user_id
      JOIN sales_sessions ss ON ss.id = s.session_id
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      GROUP BY s.user_id
      ORDER BY total DESC
    `).all(req.user.id);

    // Monthly trends (last 6 months)
    const monthlyTrends = db.prepare(`
      SELECT strftime('%Y-%m', ss.session_date) as month,
        COALESCE(SUM(s.price * s.quantity), 0) as total,
        COUNT(DISTINCT ss.id) as sessions,
        COUNT(s.id) as items
      FROM sales_sessions ss
      JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      LEFT JOIN sales s ON s.session_id = ss.id
      WHERE ss.session_date >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `).all(req.user.id);

    // Average ticket per session
    const avgTicket = db.prepare(`
      SELECT ROUND(AVG(t.total), 2) as avg_ticket
      FROM (
        SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
        FROM sales_sessions ss
        JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
        LEFT JOIN sales s ON s.session_id = ss.id
        GROUP BY ss.id
      ) t
    `).get(req.user.id);

    res.json({
      thisWeek: thisWeek ? { total: thisWeek.total, sessions: thisWeek.sessions, items: thisWeek.items } : { total: 0, sessions: 0, items: 0 },
      lastWeek: lastWeek ? { total: lastWeek.total, sessions: lastWeek.sessions, items: lastWeek.items } : { total: 0, sessions: 0, items: 0 },
      bySeller,
      monthlyTrends,
      avgTicket: avgTicket.avg_ticket || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas avanzadas' });
  }
});

module.exports = router;
