// Limpieza global después de TODOS los tests
const { resetDb } = require('../database');

module.exports = async function globalTeardown() {
  resetDb();
  console.log('[Test Teardown] Base de datos limpiada');
};