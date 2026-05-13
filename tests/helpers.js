// Helpers compartidos para todos los tests
const { getDb, resetDb } = require('../database');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'notas-venta-secret-key-2026';

/**
 * Crea un usuario de prueba en la BD actual
 */
function createTestUser(overrides = {}) {
  const db = getDb();
  const user = {
    name: overrides.name || 'Test User',
    email: overrides.email || `test${Date.now()}@prueba.com`,
    password: overrides.password || 'Test1234!',
    avatar: overrides.avatar || null,
  };
  const hashed = require('bcryptjs').hashSync(user.password, 12);
  const result = db.prepare('INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)')
    .run(user.name, user.email.toLowerCase(), hashed, user.avatar);
  return { id: result.lastInsertRowid, ...user };
}

/**
 * Crea una empresa de prueba. El usuario creador (owner) por defecto es user 1.
 * Si se pasa userId, ese usuario será el owner.
 * Si se pasa members array [{userId, role}], se añaden como miembros.
 */
function createTestCompany(overrides = {}) {
  const db = getDb();
  const ownerId = overrides.ownerId || 1;
  const name = overrides.name || `Empresa Test ${Date.now()}`;
  const result = db.prepare('INSERT INTO companies (name, description, created_by) VALUES (?, ?, ?)')
    .run(name, overrides.description || '', ownerId);
  db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)')
    .run(ownerId, result.lastInsertRowid, 'owner');

  // Añadir miembros adicionales si se especifican
  if (overrides.members && Array.isArray(overrides.members)) {
    const insertMember = db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)');
    overrides.members.forEach(m => {
      insertMember.run(m.userId, result.lastInsertRowid, m.role || 'member');
    });
  }

  return { id: result.lastInsertRowid, name, created_by: ownerId };
}

/**
 * Genera un token JWT para un usuario
 */
function generateAuthToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Headers de autenticación para supertest
 */
function authHeaders(user) {
  return { Authorization: `Bearer ${generateAuthToken(user)}` };
}

/**
 * Crea una sesión de venta de prueba
 */
function createTestSession(companyId, overrides = {}) {
  const db = getDb();
  const name = overrides.name || `Sesión Test ${Date.now()}`;
  const sessionDate = overrides.session_date || new Date().toISOString().split('T')[0];
  const createdBy = overrides.created_by || 1;
  const result = db.prepare(
    'INSERT INTO sales_sessions (company_id, created_by, name, session_date, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(companyId, createdBy, name, sessionDate, overrides.notes || '');
  return { id: result.lastInsertRowid, company_id: companyId, name, session_date: sessionDate };
}

module.exports = { createTestUser, createTestCompany, generateAuthToken, authHeaders, createTestSession };