// Configuración global antes de TODOS los tests
process.env.TEST_DB = 'true';
process.env.JWT_SECRET = 'test-secret-for-testing-only';

const { resetDb } = require('../database');

module.exports = async function globalSetup() {
  // Forzamos DB en memoria
  resetDb();
  console.log('[Test Setup] Base de datos en memoria lista');
};