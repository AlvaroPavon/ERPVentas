const express = require('express');
const webPush = require('web-push');
const { getDb } = require('../database');

const router = express.Router();

const VAPID_PUBLIC_KEY = 'BH4Nq5Rf56nzMxdioiEwIfoCh0OqoaTG6PoBVYOVGHggEplcD7LxvHfdXX0CUwRFKg0ugY0-zSk9-6OyB6qoOoQ';
const VAPID_PRIVATE_KEY = 'rEMOWo7IoiYdu_jqLtbWLZsvA6nIeqq7AhSSzF9j8OY';

webPush.setVapidDetails(
  'mailto:admin@notasventa.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe
router.post('/subscribe', (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'Datos de suscripción incompletos' });
    }
    const db = getDb();
    db.prepare(
      'INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, endpoint, keys.p256dh, keys.auth);
    res.json({ message: 'Suscripto correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al suscribir' });
  }
});

// Unsubscribe
router.post('/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body;
    const db = getDb();
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .run(endpoint, req.user.id);
    res.json({ message: 'Desuscrito' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desuscribir' });
  }
});

// Check if subscribed
router.get('/status', (req, res) => {
  try {
    const db = getDb();
    const sub = db.prepare('SELECT id FROM push_subscriptions WHERE user_id = ?').get(req.user.id);
    res.json({ subscribed: !!sub });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar estado' });
  }
});

// Send test notification
router.post('/test', async (req, res) => {
  try {
    const db = getDb();
    const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(req.user.id);
    if (subs.length === 0) return res.status(400).json({ error: 'No hay suscripciones' });

    const results = [];
    for (const sub of subs) {
      try {
        await webPush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, JSON.stringify({
          title: '📋 Notas de Venta',
          body: '¡No olvides registrar tus ventas de hoy!',
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          data: { url: '/#sales' }
        }));
        results.push({ endpoint: sub.endpoint.slice(-10), status: 'sent' });
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(sub.id);
          results.push({ endpoint: sub.endpoint.slice(-10), status: 'expired' });
        } else {
          results.push({ endpoint: sub.endpoint.slice(-10), status: 'error', message: err.message });
        }
      }
    }
    res.json({ message: 'Notificaciones enviadas', results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar notificación' });
  }
});

module.exports = router;
