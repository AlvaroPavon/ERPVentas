const express = require('express');
const { getDb } = require('../database');
const { logActivity } = require('./activity');

const router = express.Router();

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