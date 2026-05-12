const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');

const router = express.Router();

// Obtener perfil del usuario
router.get('/profile', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Actualizar perfil
router.put('/profile', (req, res) => {
  try {
    const { name, email } = req.body;
    const db = getDb();

    if (email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), req.user.id);
      if (existing) return res.status(409).json({ error: 'Email ya en uso' });
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email.toLowerCase(), req.user.id);
    }
    if (name && name.trim()) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), req.user.id);
    }

    const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

// Cambiar contraseña
router.put('/password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseñas requeridas' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    const pwErrors = [];
    if (newPassword.length < 8) pwErrors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(newPassword)) pwErrors.push('Debe tener una mayúscula');
    if (!/[a-z]/.test(newPassword)) pwErrors.push('Debe tener una minúscula');
    if (!/[0-9]/.test(newPassword)) pwErrors.push('Debe tener un número');
    if (!/[^A-Za-z0-9]/.test(newPassword)) pwErrors.push('Debe tener un carácter especial');
    if (pwErrors.length) return res.status(400).json({ error: 'Contraseña: ' + pwErrors.join(', ') });

    const hashed = bcrypt.hashSync(newPassword, 12);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// Actualizar avatar (base64)
router.put('/avatar', (req, res) => {
  try {
    const { avatar } = req.body;
    const db = getDb();
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar || null, req.user.id);
    res.json({ avatar });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar avatar' });
  }
});

// Perfil público de un usuario (sin auth)
router.get('/:id/public', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, avatar, created_at FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

module.exports = router;
