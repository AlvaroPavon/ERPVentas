const { getDb } = require('../database');

/**
 * SummaryService — Aggregates daily sales data for email summaries.
 */
const summaryService = {
  /**
   * Get the daily sales summary for a company for the previous calendar day.
   * @param {number} companyId
   * @returns {object} summary data: companyName, date, metrics, topProducts, salesByUser
   */
  getDailySummary(companyId) {
    const db = getDb();

    const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(companyId);
    if (!company) return null;

    // Calculate previous day boundaries
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    // Get total metrics for yesterday
    const metrics = db.prepare(`
      SELECT
        COALESCE(SUM(s.price * s.quantity), 0) as totalAmount,
        COUNT(DISTINCT ss.id) as totalNotes
      FROM sales_sessions ss
      JOIN sales s ON s.session_id = ss.id
      WHERE ss.company_id = ? AND ss.session_date = ?
    `).get(companyId, dateStr);

    // Get top products
    const topProducts = db.prepare(`
      SELECT s.product_name as name, SUM(s.quantity) as quantity
      FROM sales s
      JOIN sales_sessions ss ON ss.id = s.session_id
      WHERE ss.company_id = ? AND ss.session_date = ?
      GROUP BY s.product_name
      ORDER BY quantity DESC
      LIMIT 10
    `).all(companyId, dateStr);

    // Get sales by user
    const salesByUser = db.prepare(`
      SELECT u.name, COALESCE(SUM(s.price * s.quantity), 0) as amount
      FROM sales s
      JOIN sales_sessions ss ON ss.id = s.session_id
      JOIN users u ON u.id = s.user_id
      WHERE ss.company_id = ? AND ss.session_date = ?
      GROUP BY u.id, u.name
      ORDER BY amount DESC
    `).all(companyId, dateStr);

    return {
      companyName: company.name,
      date: dateStr,
      metrics: {
        totalAmount: metrics.totalAmount,
        totalNotes: metrics.totalNotes
      },
      topProducts,
      salesByUser
    };
  }
};

module.exports = summaryService;
