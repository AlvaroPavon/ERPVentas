const request = require('supertest');
const { resetDb } = require('../database');
const { createTestUser, generateAuthToken, authHeaders } = require('./helpers');

describe('🔔 Push Notifications', () => {
  beforeEach(() => resetDb());

  let authUser;

  beforeEach(() => {
    authUser = createTestUser({ email: 'push@test.com' });
  });

  describe('GET /api/push/vapid-public-key', () => {
    it('debería devolver la clave pública VAPID', async () => {
      const app = require('../server');

      const res = await request(app)
        .get('/api/push/vapid-public-key');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('publicKey');
      expect(typeof res.body.publicKey).toBe('string');
      expect(res.body.publicKey.length).toBeGreaterThan(20);
    });
  });

  describe('POST /api/push/subscribe', () => {
    it('debería suscribir al usuario a notificaciones push', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/push/subscribe')
        .set(authHeaders(authUser))
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint',
          keys: {
            p256dh: 'test-p256dh-key',
            auth: 'test-auth-key'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Suscripto correctamente');
    });

    it('debería rechazar suscripción incompleta', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/push/subscribe')
        .set(authHeaders(authUser))
        .send({
          endpoint: 'https://test.com'
        });

      expect(res.status).toBe(400);
    });

    it('debería sobrescribir suscripción existente', async () => {
      const app = require('../server');

      await request(app)
        .post('/api/push/subscribe')
        .set(authHeaders(authUser))
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test1',
          keys: { p256dh: 'key1', auth: 'auth1' }
        });

      const res = await request(app)
        .post('/api/push/subscribe')
        .set(authHeaders(authUser))
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test2',
          keys: { p256dh: 'key2', auth: 'auth2' }
        });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/push/unsubscribe', () => {
    it('debería desuscribir al usuario', async () => {
      const app = require('../server');

      await request(app)
        .post('/api/push/subscribe')
        .set(authHeaders(authUser))
        .send({
          endpoint: 'https://fcm.googleapis.com/fcm/send/test-unsub',
          keys: { p256dh: 'key', auth: 'auth' }
        });

      const res = await request(app)
        .post('/api/push/unsubscribe')
        .set(authHeaders(authUser))
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/test-unsub' });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/push/status', () => {
    it('debería devolver false si no está suscrito', async () => {
      const app = require('../server');

      const res = await request(app)
        .get('/api/push/status')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.subscribed).toBe(false);
    });

    it('debería devolver true si está suscrito', async () => {
      const app = require('../server');

      await request(app)
        .post('/api/push/subscribe')
        .set(authHeaders(authUser))
        .send({
          endpoint: 'https://test.com/status',
          keys: { p256dh: 'key', auth: 'auth' }
        });

      const res = await request(app)
        .get('/api/push/status')
        .set(authHeaders(authUser));

      expect(res.status).toBe(200);
      expect(res.body.subscribed).toBe(true);
    });
  });

  describe('POST /api/push/test', () => {
    it('debería fallar si no hay suscripciones', async () => {
      const app = require('../server');

      const res = await request(app)
        .post('/api/push/test')
        .set(authHeaders(authUser));

      expect(res.status).toBe(400);
    });
  });
});