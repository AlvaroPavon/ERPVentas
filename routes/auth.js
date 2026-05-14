const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

function validatePassword(pw) {
  const errors = [];
  if (pw.length < 8) errors.push('Mínimo 8 caracteres');
  if (!/[A-Z]/.test(pw)) errors.push('Debe tener una mayúscula');
  if (!/[a-z]/.test(pw)) errors.push('Debe tener una minúscula');
  if (!/[0-9]/.test(pw)) errors.push('Debe tener un número');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Debe tener un carácter especial');
  return errors;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/register', (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    if (!email) return res.status(400).json({ error: 'El email es obligatorio' });
    if (!validateEmail(email)) return res.status(400).json({ error: 'Email no válido' });
    if (!password) return res.status(400).json({ error: 'La contraseña es obligatoria' });

    const pwErrors = validatePassword(password);
    if (pwErrors.length) return res.status(400).json({ error: 'Contraseña: ' + pwErrors.join(', ') });

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'El email ya está registrado' });

    const hashed = bcrypt.hashSync(password, 12);
    const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(
      name.trim(),
      email.toLowerCase(),
      hashed
    );

    const user = { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase(), language: 'es' };
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, language: user.language || 'es' } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    const db = getDb();
    const user = db.prepare('SELECT id, name, email, avatar, language, created_at FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;
