const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// Log activity helper (exported for use by other routes)
function logActivity(userId, action, description, companyId = null, sessionId = null) {
  try {
    const db = getDb();
    db.prepare(
      'INSERT INTO activity_logs (user_id, action, description, company_id, session_id) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, action, description, companyId, sessionId);
  } catch (err) {
    console.error('Error logging activity:', err.message);
  }
}

// Get activity logs for the current user (their companies)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;

    const logs = db.prepare(`
      SELECT al.*, u.name as user_name
      FROM activity_logs al
      JOIN users u ON u.id = al.user_id
      WHERE al.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = ?
      )
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limit, offset);

    const count = db.prepare(`
      SELECT COUNT(*) as total FROM activity_logs
      WHERE company_id IN (SELECT company_id FROM company_users WHERE user_id = ?)
    `).get(req.user.id);

    res.json({ logs, total: count.total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener actividad' });
  }
});

module.exports = { router, logActivity };