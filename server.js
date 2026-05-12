const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./database');
const { authMiddleware } = require('./middleware/auth');
const { logActivity } = require('./routes/activity');

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
app.use('/api/push', authMiddleware, require('./routes/push'));
app.use('/api/companies/:companyId/products', authMiddleware, require('./routes/products'));
// Standalone product delete (uses companyId from the product itself)
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

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Auto-backup every 24 hours
function autoBackup() {
  const now = new Date();
  const filename = `backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.db`;
  const dest = path.join(BACKUP_DIR, filename);
  try {
    const db = getDb();
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    fs.copyFileSync(DB_PATH, dest);
    // Keep only last 7 backups
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('backup_')).sort().reverse();
    files.slice(7).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch(e) {}
    });
    console.log(`[Backup] Created: ${filename}`);
  } catch(err) {
    console.error('[Backup] Error:', err.message);
  }
}
// Run backup immediately on start, then every 24h
autoBackup();
setInterval(autoBackup, 24 * 60 * 60 * 1000);

// Download backup (authenticated users only)
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

// List backups info
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

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Accede desde tu móvil en la misma red con http://<tu-ip>:${PORT}`);
});
