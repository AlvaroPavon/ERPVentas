const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// Search users by name or email
router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) return res.json([]);

    const db = getDb();
    const users = db.prepare(`
      SELECT id, name, email, avatar FROM users
      WHERE (name LIKE ? OR email LIKE ?) AND id != ?
      ORDER BY name ASC LIMIT 20
    `).all(`%${q}%`, `%${q}%`, req.user.id);

    // Mark existing friends
    const friendIds = db.prepare(`
      SELECT DISTINCT CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS friend_id
      FROM friend_requests WHERE (sender_id = ? OR receiver_id = ?) AND status = 'accepted'
    `).all(req.user.id, req.user.id, req.user.id).map(r => r.friend_id);

    // Check pending requests
    const pendingSent = db.prepare(`
      SELECT receiver_id FROM friend_requests WHERE sender_id = ? AND status = 'pending'
    `).all(req.user.id).map(r => r.receiver_id);

    const pendingReceived = db.prepare(`
      SELECT sender_id FROM friend_requests WHERE receiver_id = ? AND status = 'pending'
    `).all(req.user.id).map(r => r.sender_id);

    res.json(users.map(u => ({
      ...u,
      is_friend: friendIds.includes(u.id),
      request_sent: pendingSent.includes(u.id),
      request_received: pendingReceived.includes(u.id)
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
});

// Send friend request
router.post('/request', (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id || user_id === req.user.id) {
      return res.status(400).json({ error: 'Usuario inválido' });
    }

    const db = getDb();
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Check existing request
    const existing = db.prepare(`
      SELECT id, status FROM friend_requests
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    `).get(req.user.id, user_id, user_id, req.user.id);

    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ error: 'Ya son amigos' });
      if (existing.status === 'pending') return res.status(400).json({ error: 'Ya hay una solicitud pendiente' });
      // If rejected before, update it
      db.prepare('UPDATE friend_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('pending', existing.id);
      return res.json({ message: 'Solicitud enviada' });
    }

    db.prepare('INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)')
      .run(req.user.id, user_id, 'pending');

    res.status(201).json({ message: 'Solicitud enviada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar solicitud' });
  }
});

// Get incoming friend requests
router.get('/requests/incoming', (req, res) => {
  try {
    const db = getDb();
    const requests = db.prepare(`
      SELECT fr.*, u.name, u.email, u.avatar
      FROM friend_requests fr
      JOIN users u ON u.id = fr.sender_id
      WHERE fr.receiver_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `).all(req.user.id);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Get sent friend requests
router.get('/requests/sent', (req, res) => {
  try {
    const db = getDb();
    const requests = db.prepare(`
      SELECT fr.*, u.name, u.email, u.avatar
      FROM friend_requests fr
      JOIN users u ON u.id = fr.receiver_id
      WHERE fr.sender_id = ? AND fr.status = 'pending'
      ORDER BY fr.created_at DESC
    `).all(req.user.id);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Accept friend request
router.post('/requests/:id/accept', (req, res) => {
  try {
    const db = getDb();
    const request = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = ?')
      .get(req.params.id, req.user.id, 'pending');

    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    db.prepare('UPDATE friend_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('accepted', request.id);

    res.json({ message: 'Solicitud aceptada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// Reject friend request
router.post('/requests/:id/reject', (req, res) => {
  try {
    const db = getDb();
    const request = db.prepare('SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ? AND status = ?')
      .get(req.params.id, req.user.id, 'pending');

    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    db.prepare('UPDATE friend_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('rejected', request.id);

    res.json({ message: 'Solicitud rechazada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// List friends
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const friends = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.email, u.avatar,
        fr.created_at as friends_since
      FROM friend_requests fr
      JOIN users u ON (CASE WHEN fr.sender_id = ? THEN u.id = fr.receiver_id ELSE u.id = fr.sender_id END)
      WHERE (fr.sender_id = ? OR fr.receiver_id = ?) AND fr.status = 'accepted'
      ORDER BY u.name ASC
    `).all(req.user.id, req.user.id, req.user.id);
    res.json(friends);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener amigos' });
  }
});

// Remove friend
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare(`
      DELETE FROM friend_requests
      WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
      AND status = 'accepted'
    `).run(req.user.id, req.params.id, req.params.id, req.user.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Amigo no encontrado' });
    res.json({ message: 'Amigo eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar amigo' });
  }
});

module.exports = router;
