const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { WebSocketServer } = require('ws');
const { getDb } = require('./database');
const { authMiddleware } = require('./middleware/auth');
const { logActivity } = require('./routes/activity');
const { deductStock } = require('./routes/inventory');
const { generateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar BD
getDb();

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', authMiddleware, require('./routes/companies'));
app.use('/api/sales', authMiddleware, require('./routes/sales'));
app.use('/api/dashboard', authMiddleware, require('./routes/dashboard'));
app.use('/api/users', authMiddleware, require('./routes/users'));
app.use('/api/activity', authMiddleware, require('./routes/activity').router);
app.use('/api/permissions', authMiddleware, require('./routes/permissions').router);
// Push VAPID public key (no auth needed)
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: 'BH4Nq5Rf56nzMxdioiEwIfoCh0OqoaTG6PoBVYOVGHggEplcD7LxvHfdXX0CUwRFKg0ugY0-zSk9-6OyB6qoOoQ' });
});
app.use('/api/push', authMiddleware, require('./routes/push'));
app.use('/api/chat', authMiddleware, require('./routes/chat'));
app.use('/api/commissions', authMiddleware, require('./routes/commissions'));
app.use('/api/companies/:companyId/inventory', authMiddleware, require('./routes/inventory').router);
app.use('/api/companies/:companyId/products', authMiddleware, require('./routes/products'));

// Standalone product delete
app.delete('/api/products/:productId', authMiddleware, (req, res) => {
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

// Backup endpoint
const DB_PATH = path.join(__dirname, 'ventas.db');
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function autoBackup() {
  const now = new Date();
  const filename = `backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.db`;
  const dest = path.join(BACKUP_DIR, filename);
  try {
    const db = getDb();
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(DB_PATH, dest);
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup_')).sort().reverse();
    files.slice(7).forEach(f => { try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch(e) {} });
    console.log(`[Backup] Created: ${filename}`);
  } catch(err) {
    console.error('[Backup] Error:', err.message);
  }
}
autoBackup();
setInterval(autoBackup, 24 * 60 * 60 * 1000);

app.get('/api/backup', authMiddleware, (req, res) => {
  try {
    const db = getDb();
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const filename = `notasventa_backup_${new Date().toISOString().slice(0,10)}.db`;
    res.download(DB_PATH, filename);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar backup' });
  }
});

app.get('/api/backup/info', authMiddleware, (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { name: f, size: stat.size, date: stat.mtime };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ backups: files, path: BACKUP_DIR });
  } catch(err) {
    res.status(500).json({ error: 'Error al listar backups' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for testing
module.exports = app;

if (require.main === module) {
  const server = http.createServer(app);

  // WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });
  global.chatServer = wss;

  wss.on('connection', (ws, req) => {
    const token = (req.url.split('?token=')[1] || '').split('&')[0];
    if (!token) { ws.close(4001, 'No token'); return; }

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'notas-venta-secret-key-2026';
      const decoded = require('jsonwebtoken').verify(token, JWT_SECRET);
      ws.userData = decoded;
      const convIdsParam = (req.url.split('conversations=')[1] || '').split('&')[0];
      ws.conversationIds = convIdsParam || '[]';

      broadcastOnline();

      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw);

          if (data.event === 'subscribe') {
            ws.conversationIds = JSON.stringify(data.conversationIds || []);
            return;
          }

          if (data.event === 'message' && data.conversation_id && data.content) {
            handleWsMessage(ws, data);
          }

          if (data.event === 'typing') {
            wss.clients.forEach(c => {
              if (c !== ws && c.readyState === 1) {
                try {
                  const cIds = JSON.parse(c.conversationIds || '[]');
                  if (cIds.includes(data.conversation_id)) {
                    c.send(JSON.stringify({
                      event: 'typing',
                      conversation_id: data.conversation_id,
                      user_id: decoded.id,
                      user_name: decoded.name
                    }));
                  }
                } catch (e) {}
              }
            });
          }
        } catch (e) {
          ws.send(JSON.stringify({ event: 'error', message: 'Invalid message' }));
        }
      });

      ws.on('close', () => { broadcastOnline(); });
      ws.send(JSON.stringify({ event: 'connected', user: decoded }));
    } catch (e) {
      ws.close(4001, 'Invalid token');
    }
  });

  function handleWsMessage(ws, data) {
    const db = getDb();
    const { conversation_id, content, image_url, type } = data;
    const userId = ws.userData.id;

    const participant = db.prepare(
      'SELECT id FROM chat_conversations_participants WHERE conversation_id = ? AND user_id = ?'
    ).get(conversation_id, userId);
    if (!participant) {
      ws.send(JSON.stringify({ event: 'error', message: 'No eres participante' }));
      return;
    }

    const result = db.prepare(
      'INSERT INTO chat_messages (conversation_id, user_id, content, type, image_url) VALUES (?, ?, ?, ?, ?)'
    ).run(conversation_id, userId, content.trim(), type || 'text', image_url || null);

    const message = db.prepare(`
      SELECT m.*, u.name as user_name, u.avatar as user_avatar
      FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?
    `).get(result.lastInsertRowid);

    db.prepare('UPDATE chat_conversations_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?')
      .run(conversation_id, userId);

    wss.clients.forEach(c => {
      if (c.readyState === 1) {
        try {
          const cIds = JSON.parse(c.conversationIds || '[]');
          if (cIds.includes(conversation_id)) {
            c.send(JSON.stringify({ event: 'message', conversation_id, message }));
          }
        } catch (e) {}
      }
    });
  }

  function broadcastOnline() {
    const online = [];
    wss.clients.forEach(c => {
      if (c.readyState === 1 && c.userData) {
        online.push({ id: c.userData.id, name: c.userData.name, avatar: c.userData.avatar });
      }
    });
    wss.clients.forEach(c => {
      if (c.readyState === 1) {
        c.send(JSON.stringify({ event: 'users_online', users: online }));
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`WebSocket en ws://localhost:${PORT}/ws`);
  });
}