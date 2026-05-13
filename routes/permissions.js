const express = require('express');
const { getDb } = require('../database');

const router = express.Router();

// Get available permissions (all possible permissions)
router.get('/available', (req, res) => {
   res.json([
     'manage_company', 'manage_members', 'manage_roles',
     'manage_products', 'manage_sessions', 'manage_inventory',
     'add_sales', 'delete_sales', 'view_reports',
     'view_commissions', 'export_catalog'
   ]);
 });

// Get role permissions for a company
router.get('/:companyId', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT DISTINCT role, permission FROM role_permissions WHERE company_id = ? ORDER BY role, permission'
    ).all(req.params.companyId);

    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.role]) grouped[r.role] = [];
      grouped[r.role].push(r.permission);
    });

    // Get all roles present in the company (from actual users)
    const roles = db.prepare(
      'SELECT DISTINCT role FROM company_users WHERE company_id = ?'
    ).all(req.params.companyId).map(r => r.role);

    // Ensure all roles have permissions defined
    roles.forEach(role => {
      if (!grouped[role]) grouped[role] = [];
    });

    res.json({ roles: grouped, allRoles: roles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
});

// Update permissions for a role in a company
router.put('/:companyId/:role', (req, res) => {
  try {
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) return res.status(400).json({ error: 'Se requiere array de permisos' });

    const db = getDb();
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.companyId, req.user.id);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'No tienes permiso para gestionar roles' });
    }
    // Only owner can change roles
    if (membership.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el propietario puede modificar roles' });
    }

    const role = req.params.role;
    // Cannot modify owner permissions
    if (role === 'owner') return res.status(400).json({ error: 'No se pueden modificar los permisos del propietario' });

    const del = db.prepare('DELETE FROM role_permissions WHERE company_id = ? AND role = ?');
    const ins = db.prepare('INSERT INTO role_permissions (company_id, role, permission) VALUES (?, ?, ?)');

    del.run(req.params.companyId, role);
    permissions.forEach(p => ins.run(req.params.companyId, role, p));

    res.json({ message: 'Permisos actualizados', role, permissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar permisos' });
  }
});

// Check if user has a specific permission in a company (helper, used by other routes)
function hasPermission(userId, companyId, permission) {
  try {
    const db = getDb();
    const userRole = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?').get(companyId, userId);
    if (!userRole) return false;
    const perm = db.prepare(
      'SELECT id FROM role_permissions WHERE company_id = ? AND role = ? AND permission = ?'
    ).get(companyId, userRole.role, permission);
    return !!perm;
  } catch { return false; }
}

module.exports = { router, hasPermission };
