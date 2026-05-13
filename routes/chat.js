const express = require('express');
const webPush = require('web-push');
const { getDb } = require('../database');
const { logActivity } = require('./activity');

const router = express.Router();

const VAPID_PUBLIC_KEY = 'BH4Nq5Rf56nzMxdioiEwIfoCh0OqoaTG6PoBVYOVGHggEplcD7LxvHfdXX0CUwRFKg0ugY0-zSk9-6OyB6qoOoQ';
const VAPID_PRIVATE_KEY = 'rEMOWo7IoiYdu_jqLtbWLZsvA6nIeqq7AhSSzF9j8OY';

// Set VAPID details if not already set
try { webPush.setVapidDetails('mailto:admin@notasventa.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY); } catch (e) {}

// Helper to send push notification to a user
async function sendPushToUser(userId, title, body, url) {
  try {
    const db = getDb();
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
    for (const sub of subs) {
      try {
        await webPush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, JSON.stringify({
          title,
          body,
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          data: { url: url || '/#chat' },
          vibrate: [200, 100, 200]
        }));
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
        }
      }
    }
  } catch (e) {}
}

// Check if a user is connected via WebSocket
function isUserOnline(userId) {
  if (!global.chatServer) return false;
  let online = false;
  global.chatServer.clients.forEach(client => {
    if (client.readyState === 1 && client.userData && client.userData.id === userId) {
      online = true;
    }
  });
  return online;
}

// Get user's chat conversations
router.get('/conversations', (req, res) => {
  try {
    const db = getDb();
    const conversations = db.prepare(`
      SELECT cc.*,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = cc.id) as message_count,
        (SELECT content FROM chat_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM chat_messages WHERE conversation_id = cc.id ORDER BY created_at DESC LIMIT 1) as last_message_at
      FROM chat_conversations cc
      JOIN chat_conversations_participants cp ON cp.conversation_id = cc.id
      WHERE cp.user_id = ?
      ORDER BY last_message_at DESC
    `).all(req.user.id);

    // Parse emoji reactions
    conversations.forEach(c => {
      if (c.emoji_reactions) {
        try { c.emoji_reactions = JSON.parse(c.emoji_reactions); } catch { c.emoji_reactions = null; }
      }
    });

    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener conversaciones' });
  }
});

// Create a new conversation
router.post('/conversations', (req, res) => {
  try {
    const db = getDb();
    const { name, type, company_id } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Nombre y tipo requeridos' });
    }

    if (type === 'channel' && !company_id) {
      return res.status(400).json({ error: 'company_id requerido para canal' });
    }

    // Verify user belongs to the company
    if (company_id) {
      const membership = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
        .get(company_id, req.user.id);
      if (!membership) return res.status(403).json({ error: 'No perteneces a esta empresa' });
    }

    const result = db.prepare(
      'INSERT INTO chat_conversations (company_id, name, type, created_by) VALUES (?, ?, ?, ?)'
    ).run(company_id || null, name.trim(), type, req.user.id);

    // Add creator as participant
    db.prepare('INSERT INTO chat_conversations_participants (conversation_id, user_id) VALUES (?, ?)')
      .run(result.lastInsertRowid, req.user.id);

    const conversation = db.prepare('SELECT * FROM chat_conversations WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(conversation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear conversación' });
  }
});

// Get messages from a conversation
router.get('/conversations/:id/messages', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Check user is participant
    const participant = db.prepare(
      'SELECT * FROM chat_conversations_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(id, req.user.id);

    if (!participant) return res.status(403).json({ error: 'No eres participante de esta conversación' });

    const messages = db.prepare(`
      SELECT m.*, u.name as user_name, u.avatar as user_avatar
      FROM chat_messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `).all(id, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM chat_messages WHERE conversation_id = ?')
      .get(id).count;

    res.json({ messages, total, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Send a message
router.post('/conversations/:id/messages', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { content, image_url, type } = req.body;

    if ((!content || !content.trim()) && !image_url) {
      return res.status(400).json({ error: 'Contenido o imagen requeridos' });
    }

    // Check user is participant
    const participant = db.prepare(
      'SELECT * FROM chat_conversations_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(id, req.user.id);

    if (!participant) return res.status(403).json({ error: 'No eres participante de esta conversación' });

    const result = db.prepare(
      'INSERT INTO chat_messages (conversation_id, user_id, content, type, image_url) VALUES (?, ?, ?, ?, ?)'
    ).run(id, req.user.id, content ? content.trim() : null, type || 'text', image_url || null);

    const message = db.prepare(`
      SELECT m.*, u.name as user_name, u.avatar as user_avatar
      FROM chat_messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    // Update last_read for the sender
    db.prepare('UPDATE chat_conversations_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?')
      .run(id, req.user.id);

    // Broadcast via WebSocket
    if (global.chatServer) {
      const conversation = db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(id);
      global.chatServer.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          try {
            const clientData = JSON.parse(client.conversationIds || '[]');
            if (clientData.includes(id)) {
              client.send(JSON.stringify({
                event: 'message',
                conversation_id: id,
                message: message
              }));
            }
          } catch (e) {}
        }
      });
    }

    // Send push notifications to offline participants
    const participants = db.prepare('SELECT user_id FROM chat_conversations_participants WHERE conversation_id = ? AND user_id != ?')
      .all(id, req.user.id);
    for (const p of participants) {
      if (!isUserOnline(p.user_id)) {
        sendPushToUser(
          p.user_id,
          `💬 ${message.user_name}`,
          message.content ? message.content.substring(0, 100) : '📷 Imagen',
          '/#chat'
        );
      }
    }

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Add participant to conversation
router.post('/conversations/:id/participants', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });

    // Check requester is participant
    const isParticipant = db.prepare(
      'SELECT id FROM chat_conversations_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(id, req.user.id);

    if (!isParticipant) return res.status(403).json({ error: 'No eres participante de esta conversación' });

    const result = db.prepare(
      'INSERT OR IGNORE INTO chat_conversations_participants (conversation_id, user_id) VALUES (?, ?)'
    ).run(id, user_id);

    res.status(201).json({ message: 'Participante añadido', participant_id: result.lastInsertRowid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir participante' });
  }
});

// Remove participant or leave
router.delete('/participants/:id', (req, res) => {
  try {
    const db = getDb();
    const participantId = parseInt(req.params.id);

    const participant = db.prepare('SELECT * FROM chat_conversations_participants WHERE id = ?')
      .get(participantId);

    if (!participant) return res.status(404).json({ error: 'Participante no encontrado' });

    // Can only remove yourself, or admin/owner can remove others
    if (participant.user_id !== req.user.id) {
      const conv = db.prepare('SELECT * FROM chat_conversations WHERE id = ?')
        .get(participant.conversation_id);
      if (conv.type !== 'company') {
        return res.status(403).json({ error: 'No tienes permiso para expulsar' });
      }
    }

    db.prepare('DELETE FROM chat_conversations_participants WHERE id = ?').run(participantId);
    res.json({ message: 'Participante eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar participante' });
  }
});

// Add emoji reaction to a message
router.post('/messages/:id/reaction', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) return res.status(400).json({ error: 'Emoji requerido' });

    const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
    if (!message) return res.status(404).json({ error: 'Mensaje no encontrado' });

    // Check user is participant in the conversation
    const participant = db.prepare(
      'SELECT id FROM chat_conversations_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(message.conversation_id, req.user.id);

    if (!participant) return res.status(403).json({ error: 'No eres participante' });

    // Parse existing reactions
    let reactions = [];
    if (message.emoji_reactions) {
      try { reactions = JSON.parse(message.emoji_reactions); } catch { reactions = []; }
    }

    // Find if user already reacted with this emoji
    const existingIndex = reactions.findIndex(r => r.emoji === emoji && r.user_id === req.user.id);
    if (existingIndex >= 0) {
      // Remove reaction
      reactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      reactions.push({ emoji, user_id: req.user.id, name: req.user.name || '' });
    }

    db.prepare('UPDATE chat_messages SET emoji_reactions = ? WHERE id = ?')
      .run(JSON.stringify(reactions), id);

    res.json({ emoji_reactions: reactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir reacción' });
  }
});

// Get conversation participants
router.get('/conversations/:id/participants', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const participants = db.prepare(`
      SELECT u.id, u.name, u.avatar, cp.joined_at, cp.last_read_at
      FROM chat_conversations_participants cp
      JOIN users u ON u.id = cp.user_id
      WHERE cp.conversation_id = ?
      ORDER BY u.name ASC
    `).all(id);

    res.json(participants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener participantes' });
  }
});

// Get friends that can be DM'd
router.get('/contacts', (req, res) => {
  try {
    const db = getDb();
    const contacts = db.prepare(`
      SELECT DISTINCT u.id, u.name, u.avatar, u.email
      FROM friend_requests fr
      JOIN users u ON (CASE WHEN fr.sender_id = ? THEN u.id = fr.receiver_id ELSE u.id = fr.sender_id END)
      WHERE (fr.sender_id = ? OR fr.receiver_id = ?) AND fr.status = 'accepted'
      ORDER BY u.name ASC
    `).all(req.user.id, req.user.id, req.user.id);

    const existingDMs = db.prepare(`
      SELECT cc.id, cp2.user_id as contact_id
      FROM chat_conversations_participants cp1
      JOIN chat_conversations_participants cp2 ON cp2.conversation_id = cp1.conversation_id
      JOIN chat_conversations cc ON cc.id = cp1.conversation_id
      WHERE cp1.user_id = ?
      AND cc.type = 'dm'
    `).all(req.user.id);

    const dmMap = {};
    existingDMs.forEach(dm => {
      dmMap[dm.contact_id] = dm.id;
    });

    const result = contacts.map(c => ({
      ...c,
      existing_dm_id: dmMap[c.id] || null
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener contactos' });
  }
});

// Delete conversation (only if user is participant)
router.delete('/conversations/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Check user is participant
    const participant = db.prepare(
      'SELECT id FROM chat_conversations_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(id, req.user.id);

    if (!participant) return res.status(403).json({ error: 'No eres participante' });

    // Remove user from participants
    db.prepare('DELETE FROM chat_conversations_participants WHERE conversation_id = ? AND user_id = ?')
      .run(id, req.user.id);

    // If no more participants, delete the conversation and its messages
    const remaining = db.prepare('SELECT COUNT(*) as count FROM chat_conversations_participants WHERE conversation_id = ?')
      .get(id).count;

    if (remaining === 0) {
      db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(id);
      db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(id);
    }

    res.json({ message: 'Conversación eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar conversación' });
  }
});

// Get online users in a conversation
router.get('/conversations/:id/online', (req, res) => {
  try {
    const onlineUsers = [];
    if (global.chatServer) {
      global.chatServer.clients.forEach(client => {
        if (client.readyState === 1 && client.userData) {
          const convIds = JSON.parse(client.conversationIds || '[]');
          if (convIds.includes(parseInt(req.params.id))) {
            onlineUsers.push(client.userData);
          }
        }
      });
    }
    res.json({ online: onlineUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios online' });
  }
});

module.exports = router;