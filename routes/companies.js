const express = require('express');
const { getDb } = require('../database');
const { logActivity } = require('./activity');

const router = express.Router();

// Obtener empresas del usuario
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const companies = db.prepare(`
      SELECT c.*, cu.role,
        (SELECT COUNT(*) FROM company_users WHERE company_id = c.id) as user_count
      FROM companies c
      JOIN company_users cu ON cu.company_id = c.id
      WHERE cu.user_id = ?
      ORDER BY c.created_at DESC
    `).all(req.user.id);
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empresas' });
  }
});

// Crear empresa
router.post('/', (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const db = getDb();

    const existing = db.prepare('SELECT id FROM companies WHERE name = ?').get(name.trim());
    if (existing) return res.status(409).json({ error: 'Ya existe una empresa con ese nombre' });

    const result = db.prepare('INSERT INTO companies (name, description, created_by) VALUES (?, ?, ?)').run(
      name.trim(), description || '', req.user.id
    );
    db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)').run(
      req.user.id, result.lastInsertRowid, 'owner'
    );

    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    logActivity(req.user.id, 'create_company', `Creó la empresa "${name.trim()}"`, company.id);
    res.status(201).json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear empresa' });
  }
});

// Buscar empresas
router.get('/search', (req, res) => {
  try {
    const q = req.query.q || '';
    const db = getDb();
    const companies = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM company_users WHERE company_id = c.id) as user_count
      FROM companies c
      WHERE c.name LIKE ?
      ORDER BY c.name ASC
      LIMIT 20
    `).all(`%${q}%`);
    res.json(companies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar empresas' });
  }
});

// Obtener solicitudes del usuario
router.get('/my-requests', (req, res) => {
  try {
    const db = getDb();
    const requests = db.prepare(`
      SELECT jr.*, c.name as company_name
      FROM join_requests jr
      JOIN companies c ON c.id = jr.company_id
      WHERE jr.user_id = ?
      ORDER BY jr.created_at DESC
    `).all(req.user.id);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Obtener solicitudes recibidas (para empresas donde soy admin/owner)
router.get('/incoming-requests', (req, res) => {
  try {
    const db = getDb();
    const requests = db.prepare(`
      SELECT jr.*, u.name as user_name, u.email, u.avatar as user_avatar, c.name as company_name
      FROM join_requests jr
      JOIN users u ON u.id = jr.user_id
      JOIN companies c ON c.id = jr.company_id
      WHERE jr.company_id IN (
        SELECT company_id FROM company_users WHERE user_id = ? AND (role = 'owner' OR role = 'admin')
      )
      ORDER BY jr.created_at DESC
    `).all(req.user.id);
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Obtener detalle de empresa
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const company = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM company_users WHERE company_id = c.id) as user_count
      FROM companies c WHERE c.id = ?
    `).get(req.params.id);

    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    const users = db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar, cu.role, cu.joined_at
      FROM company_users cu
      JOIN users u ON u.id = cu.user_id
      WHERE cu.company_id = ?
    `).all(req.params.id);

    const sessions = db.prepare(`
      SELECT ss.*, u.name as created_by_name,
        (SELECT COUNT(*) FROM sales WHERE session_id = ss.id) as item_count,
        (SELECT COALESCE(SUM(price * quantity), 0) FROM sales WHERE session_id = ss.id) as total_amount
      FROM sales_sessions ss
      JOIN users u ON u.id = ss.created_by
      WHERE ss.company_id = ?
      ORDER BY ss.session_date DESC
      LIMIT 30
    `).all(req.params.id);

    const joinRequest = db.prepare('SELECT id, status FROM join_requests WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    res.json({ ...company, users, sessions, joinRequest: joinRequest || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empresa' });
  }
});

// Añadir usuario a empresa
router.post('/:id/users', (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email del usuario requerido' });

    const db = getDb();

    // Verificar que el solicitante es admin
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return res.status(403).json({ error: 'No eres administrador de esta empresa' });
    }

    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado con ese email' });

    const existing = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, user.id);
    if (existing) return res.status(409).json({ error: 'El usuario ya pertenece a la empresa' });

    db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)').run(
      user.id, req.params.id, role || 'member'
    );

    res.status(201).json({ message: 'Usuario añadido correctamente', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al añadir usuario' });
  }
});

// Eliminar usuario de empresa
router.delete('/:id/users/:userId', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return res.status(403).json({ error: 'No eres administrador' });
    }

    db.prepare('DELETE FROM company_users WHERE company_id = ? AND user_id = ?')
      .run(req.params.id, req.params.userId);
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// Solicitar unirse a una empresa
router.post('/:id/join-request', (req, res) => {
  try {
    const db = getDb();
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    const existing = db.prepare('SELECT id FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (existing) return res.status(409).json({ error: 'Ya eres miembro de esta empresa' });

    const pending = db.prepare('SELECT id FROM join_requests WHERE company_id = ? AND user_id = ? AND status = ?')
      .get(req.params.id, req.user.id, 'pending');
    if (pending) return res.status(409).json({ error: 'Ya tienes una solicitud pendiente' });

    const result = db.prepare('INSERT INTO join_requests (company_id, user_id) VALUES (?, ?)').run(
      req.params.id, req.user.id
    );

    res.status(201).json({ id: result.lastInsertRowid, message: 'Solicitud enviada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al solicitar unirse' });
  }
});

// Obtener solicitudes pendientes de una empresa (owner/admin)
router.get('/:id/join-requests', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    const requests = db.prepare(`
      SELECT jr.*, u.name, u.email
      FROM join_requests jr
      JOIN users u ON u.id = jr.user_id
      WHERE jr.company_id = ? AND jr.status = 'pending'
      ORDER BY jr.created_at ASC
    `).all(req.params.id);

    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// Aceptar solicitud de unión
router.post('/:id/join-requests/:requestId/accept', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    const request = db.prepare('SELECT * FROM join_requests WHERE id = ? AND company_id = ? AND status = ?')
      .get(req.params.requestId, req.params.id, 'pending');
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    db.prepare('UPDATE join_requests SET status = ? WHERE id = ?').run('accepted', req.params.requestId);
    db.prepare('INSERT INTO company_users (user_id, company_id, role) VALUES (?, ?, ?)').run(
      request.user_id, req.params.id, 'member'
    );

    res.json({ message: 'Solicitud aceptada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al aceptar solicitud' });
  }
});

// Rechazar solicitud de unión
router.post('/:id/join-requests/:requestId/reject', (req, res) => {
  try {
    const db = getDb();
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'No tienes permiso' });
    }

    const request = db.prepare('SELECT * FROM join_requests WHERE id = ? AND company_id = ? AND status = ?')
      .get(req.params.requestId, req.params.id, 'pending');
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    db.prepare('UPDATE join_requests SET status = ? WHERE id = ?').run('rejected', req.params.requestId);

    res.json({ message: 'Solicitud rechazada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al rechazar solicitud' });
  }
});

// Actualizar configuración de resumen diario (owner/admin only)
router.patch('/:id/settings', (req, res) => {
  try {
    const db = getDb();

    // Verificar que la empresa existe
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    if (!company) return res.status(404).json({ error: 'Empresa no encontrada' });

    // Verificar que el usuario es owner o admin
    const membership = db.prepare('SELECT role FROM company_users WHERE company_id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return res.status(403).json({ error: 'Solo el owner o admin puede modificar la configuración' });
    }

    const { email_summary_enabled, email_summary_time } = req.body;

    // Validar formato de hora si se proporciona
    if (email_summary_time !== undefined && email_summary_time !== null) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(email_summary_time)) {
        return res.status(400).json({ error: 'Formato de hora inválido. Use HH:mm (ej: 08:00)' });
      }
    }

    const updates = [];
    const params = [];

    if (email_summary_enabled !== undefined) {
      updates.push('email_summary_enabled = ?');
      params.push(email_summary_enabled ? 1 : 0);
    }
    if (email_summary_time !== undefined) {
      updates.push('email_summary_time = ?');
      params.push(email_summary_time || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);
    db.prepare(`UPDATE companies SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id);
    logActivity(req.user.id, 'update_settings', 'Actualizó la configuración de resumen diario', company.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

module.exports = router;
