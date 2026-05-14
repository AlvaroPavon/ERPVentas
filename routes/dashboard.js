const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

/**
 * Validates company access for a user.
 * Returns the membership record if valid, or sends a 403 response and returns null.
 */
function checkCompanyAccess(req, res, companyId) {
  if (!companyId) return true;
  const db = getDb();
  const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?').get(companyId, req.user.id);
  if (!membership) {
    res.status(403).json({ error: 'No tienes acceso a esta empresa' });
    return false;
  }
  return true;
}

// Estadísticas mensuales del usuario (de todas sus empresas)
router.get('/monthly', (req, res) => {
  try {
    const db = getDb();
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const companyId = req.query.companyId;

    if (!checkCompanyAccess(req, res, companyId)) return;

    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    // Previous period (previous month)
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;

    let stats, prevTotal, dailySales;

    if (companyId) {
      // Stats for the company
      stats = db.prepare(`
        SELECT 
          COUNT(DISTINCT ss.id) as session_count,
          COUNT(s.id) as total_items,
          COALESCE(SUM(s.price * s.quantity), 0) as total_amount,
          COUNT(DISTINCT s.product_name) as unique_products
        FROM sales_sessions ss
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE strftime('%Y-%m', ss.session_date) = ?
          AND ss.company_id = ?
      `).get(monthStr, companyId);

      // Previous period total for PoP calculation
      const prevResult = db.prepare(`
        SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
        FROM sales_sessions ss
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE strftime('%Y-%m', ss.session_date) = ?
          AND ss.company_id = ?
      `).get(prevMonthStr, companyId);
      prevTotal = prevResult.total;

      // Daily sales for the company
      dailySales = db.prepare(`
        SELECT ss.session_date,
          COUNT(s.id) as items,
          COALESCE(SUM(s.price * s.quantity), 0) as amount,
          ss.name as session_name,
          ss.id as session_id
        FROM sales_sessions ss
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE strftime('%Y-%m', ss.session_date) = ?
          AND ss.company_id = ?
        GROUP BY ss.id
        ORDER BY ss.session_date ASC
      `).all(monthStr, companyId);
    } else {
      // Stats across all user's companies
      stats = db.prepare(`
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

      // Previous period total
      const prevResult = db.prepare(`
        SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
        FROM sales_sessions ss
        JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE strftime('%Y-%m', ss.session_date) = ?
      `).get(req.user.id, prevMonthStr);
      prevTotal = prevResult.total;

      // Daily sales across all user's companies
      dailySales = db.prepare(`
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
    }

    // Calculate growth percentage and trend
    let growth = null;
    let trend = 'neutral';
    if (prevTotal > 0) {
      growth = Math.round((stats.total_amount - prevTotal) / prevTotal * 1000) / 10;
      trend = growth >= 0 ? 'up' : 'down';
    }

    res.json({
      stats: {
        session_count: stats.session_count,
        total_items: stats.total_items,
        total_amount: stats.total_amount,
        unique_products: stats.unique_products,
        growth: growth,
        trend: trend
      },
      dailySales,
      year,
      month
    });
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
    const companyId = req.query.companyId;

    if (!checkCompanyAccess(req, res, companyId)) return;

    let products;
    if (companyId) {
      products = db.prepare(`
        SELECT s.product_name,
          COUNT(*) as times_sold,
          SUM(s.quantity) as total_quantity,
          COALESCE(SUM(s.price * s.quantity), 0) as total_revenue,
          ROUND(AVG(s.price), 2) as avg_price
        FROM sales s
        JOIN sales_sessions ss ON ss.id = s.session_id
        WHERE ss.company_id = ?
        GROUP BY s.product_name
        ORDER BY total_quantity DESC
        LIMIT ?
      `).all(companyId, limit);
    } else {
      products = db.prepare(`
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
    }

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
    const companyId = req.query.companyId;

    if (!checkCompanyAccess(req, res, companyId)) return;

    let days;
    if (companyId) {
      days = db.prepare(`
        SELECT ss.session_date,
          ss.name as session_name,
          ss.id as session_id,
          c.name as company_name,
          COUNT(s.id) as items_sold,
          COALESCE(SUM(s.price * s.quantity), 0) as total_amount,
          COUNT(DISTINCT s.user_id) as sellers
        FROM sales_sessions ss
        JOIN companies c ON c.id = ss.company_id
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE ss.company_id = ?
        GROUP BY ss.id
        ORDER BY ss.session_date DESC
        LIMIT ?
      `).all(companyId, limit);
    } else {
      days = db.prepare(`
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
    }

    res.json(days);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener comparativa' });
  }
});

// Resumen de una empresa específica
router.get('/company/:companyId', (req, res) => {
  try {
    const db = getDb();
    const { companyId } = req.params;

    const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(companyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });

    // Estadísticas de la empresa
    const companyStats = db.prepare(`
      SELECT
        COUNT(DISTINCT ss.id) as session_count,
        COUNT(s.id) as total_items,
        COALESCE(SUM(s.price * s.quantity), 0) as total_amount,
        COUNT(DISTINCT s.product_name) as unique_products,
        COUNT(DISTINCT s.user_id) as unique_sellers
      FROM sales_sessions ss
      LEFT JOIN sales s ON s.session_id = ss.id
      WHERE ss.company_id = ?
    `).get(companyId);

    // Últimas sesiones de la empresa
    const recentSessions = db.prepare(`
      SELECT ss.*,
        COUNT(s.id) as item_count,
        COALESCE(SUM(s.price * s.quantity), 0) as total_amount
      FROM sales_sessions ss
      LEFT JOIN sales s ON s.session_id = ss.id
      WHERE ss.company_id = ?
      GROUP BY ss.id
      ORDER BY ss.session_date DESC
      LIMIT 10
    `).all(companyId);

    // Top productos de la empresa
    const topProducts = db.prepare(`
      SELECT s.product_name,
        COUNT(*) as times_sold,
        SUM(s.quantity) as total_quantity,
        COALESCE(SUM(s.price * s.quantity), 0) as total_revenue
      FROM sales s
      JOIN sales_sessions ss ON ss.id = s.session_id
      WHERE ss.company_id = ?
      GROUP BY s.product_name
      ORDER BY total_revenue DESC
      LIMIT 5
    `).all(companyId);

    // Ventas por vendedor en la empresa
    const bySeller = db.prepare(`
      SELECT u.name, u.id as user_id,
        COUNT(s.id) as items,
        COALESCE(SUM(s.price * s.quantity), 0) as total
      FROM sales s
      JOIN users u ON u.id = s.user_id
      JOIN sales_sessions ss ON ss.id = s.session_id
      WHERE ss.company_id = ?
      GROUP BY s.user_id
      ORDER BY total DESC
    `).all(companyId);

    // Ticket promedio de la empresa
    const avgTicket = db.prepare(`
      SELECT ROUND(AVG(t.total), 2) as avg_ticket
      FROM (
        SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
        FROM sales_sessions ss
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE ss.company_id = ?
        GROUP BY ss.id
      ) t
    `).get(companyId);

    res.json({
      company_stats: companyStats,
      recent_sessions: recentSessions,
      top_products: topProducts,
      by_seller: bySeller,
      avg_ticket: avgTicket.avg_ticket || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas de la empresa' });
  }
});

// Resumen global del usuario
router.get('/overview', (req, res) => {
  try {
    const db = getDb();
    const companyId = req.query.companyId;

    if (!checkCompanyAccess(req, res, companyId)) return;

    let totalSessions, totalSales, totalItems, companies;

    if (companyId) {
      totalSessions = db.prepare(`
        SELECT COUNT(DISTINCT ss.id) as count
        FROM sales_sessions ss
        WHERE ss.company_id = ?
      `).get(companyId).count;

      totalSales = db.prepare(`
        SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
        FROM sales s
        JOIN sales_sessions ss ON ss.id = s.session_id
        WHERE ss.company_id = ?
      `).get(companyId).total;

      totalItems = db.prepare(`
        SELECT COUNT(*) as count
        FROM sales s
        JOIN sales_sessions ss ON ss.id = s.session_id
        WHERE ss.company_id = ?
      `).get(companyId).count;

      companies = 1;
    } else {
      totalSessions = db.prepare(`
        SELECT COUNT(DISTINCT ss.id) as count
        FROM sales_sessions ss
        JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      `).get(req.user.id).count;

      totalSales = db.prepare(`
        SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
        FROM sales s
        JOIN sales_sessions ss ON ss.id = s.session_id
        JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      `).get(req.user.id).total;

      totalItems = db.prepare(`
        SELECT COUNT(*) as count
        FROM sales s
        JOIN sales_sessions ss ON ss.id = s.session_id
        JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
      `).get(req.user.id).count;

      companies = db.prepare(`
        SELECT COUNT(*) as count FROM company_users WHERE user_id = ?
      `).get(req.user.id).count;
    }

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
    const companyId = req.query.companyId;

    if (!checkCompanyAccess(req, res, companyId)) return;

    let thisWeek, lastWeek, bySeller, monthlyTrends, avgTicket;

    if (companyId) {
      // Weekly comparison
      const weekSales = db.prepare(`
        SELECT CASE
          WHEN strftime('%W', ss.session_date) = strftime('%W', 'now') THEN 'this_week'
          ELSE 'last_week'
        END as week,
        COALESCE(SUM(s.price * s.quantity), 0) as total,
        COUNT(DISTINCT ss.id) as sessions,
        COUNT(s.id) as items
        FROM sales_sessions ss
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE ss.session_date >= date('now', '-14 days')
          AND ss.company_id = ?
        GROUP BY week
      `).all(companyId);

      thisWeek = weekSales.find(w => w.week === 'this_week');
      lastWeek = weekSales.find(w => w.week === 'last_week');

      // Revenue by seller
      bySeller = db.prepare(`
        SELECT u.name,
          COUNT(s.id) as items,
          COALESCE(SUM(s.price * s.quantity), 0) as total
        FROM sales s
        JOIN users u ON u.id = s.user_id
        JOIN sales_sessions ss ON ss.id = s.session_id
        WHERE ss.company_id = ?
        GROUP BY s.user_id
        ORDER BY total DESC
      `).all(companyId);

      // Monthly trends
      monthlyTrends = db.prepare(`
        SELECT strftime('%Y-%m', ss.session_date) as month,
          COALESCE(SUM(s.price * s.quantity), 0) as total,
          COUNT(DISTINCT ss.id) as sessions,
          COUNT(s.id) as items
        FROM sales_sessions ss
        LEFT JOIN sales s ON s.session_id = ss.id
        WHERE ss.session_date >= date('now', '-6 months')
          AND ss.company_id = ?
        GROUP BY month
        ORDER BY month ASC
      `).all(companyId);

      // Average ticket
      const avgResult = db.prepare(`
        SELECT ROUND(AVG(t.total), 2) as avg_ticket
        FROM (
          SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
          FROM sales_sessions ss
          LEFT JOIN sales s ON s.session_id = ss.id
          WHERE ss.company_id = ?
          GROUP BY ss.id
        ) t
      `).get(companyId);
      avgTicket = avgResult ? (avgResult.avg_ticket || 0) : 0;
    } else {
      // Weekly comparison
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

      thisWeek = weekSales.find(w => w.week === 'this_week');
      lastWeek = weekSales.find(w => w.week === 'last_week');

      // Revenue by seller
      bySeller = db.prepare(`
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

      // Monthly trends
      monthlyTrends = db.prepare(`
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

      // Average ticket
      const avgResult = db.prepare(`
        SELECT ROUND(AVG(t.total), 2) as avg_ticket
        FROM (
          SELECT COALESCE(SUM(s.price * s.quantity), 0) as total
          FROM sales_sessions ss
          JOIN company_users cu ON cu.company_id = ss.company_id AND cu.user_id = ?
          LEFT JOIN sales s ON s.session_id = ss.id
          GROUP BY ss.id
        ) t
      `).get(req.user.id);
      avgTicket = avgResult ? (avgResult.avg_ticket || 0) : 0;
    }

    res.json({
      thisWeek: thisWeek ? { total: thisWeek.total, sessions: thisWeek.sessions, items: thisWeek.items } : { total: 0, sessions: 0, items: 0 },
      lastWeek: lastWeek ? { total: lastWeek.total, sessions: lastWeek.sessions, items: lastWeek.items } : { total: 0, sessions: 0, items: 0 },
      bySeller,
      monthlyTrends,
      avgTicket
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas avanzadas' });
  }
});

module.exports = router;
