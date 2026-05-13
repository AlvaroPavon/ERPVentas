const { resetDb, getDb } = require('../../database');

// Mock nodemailer for send tests
jest.mock('nodemailer', () => {
  const mockSendMail = jest.fn();

  return {
    createTransport: jest.fn(() => ({
      sendMail: mockSendMail
    })),
    _mockSendMail: mockSendMail
  };
});

describe('EmailService', () => {
  let emailService;

  beforeAll(() => {
    emailService = require('../../services/email-service');
  });

  beforeEach(() => {
    resetDb();
    // Reset mock behavior per test
    const nodemailer = require('nodemailer');
    nodemailer._mockSendMail.mockReset();
  });

  const mockSummary = {
    companyName: 'Mi Empresa Test',
    date: '2026-05-12',
    metrics: {
      totalAmount: 1500.50,
      totalNotes: 12
    },
    topProducts: [
      { name: 'Producto A', quantity: 5 },
      { name: 'Producto B', quantity: 3 }
    ],
    salesByUser: [
      { name: 'Juan Pérez', amount: 1000 },
      { name: 'María García', amount: 500.50 }
    ]
  };

  describe('generateEmailHtml', () => {
    it('debería generar HTML con los datos del resumen', () => {
      const html = emailService.generateEmailHtml(mockSummary);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html');
      expect(html).toContain('Mi Empresa Test');
      // Argentinian locale: 1.500,50 (dot = thousands separator, comma = decimal)
      expect(html).toContain('1.500,50');
      expect(html).toContain('12');
      expect(html).toContain('Producto A');
      expect(html).toContain('Producto B');
      expect(html).toContain('Juan Pérez');
      expect(html).toContain('María García');
    });

    it('debería manejar métricas en cero', () => {
      const emptySummary = {
        companyName: 'Empty Co',
        date: '2026-05-12',
        metrics: { totalAmount: 0, totalNotes: 0 },
        topProducts: [],
        salesByUser: []
      };

      const html = emailService.generateEmailHtml(emptySummary);

      expect(html).toContain('Empty Co');
      expect(html).toContain('$0,00');
      expect(html).toContain('Sin ventas registradas ayer');
      expect(html).toContain('Sin actividad de vendedores ayer');
    });
  });

  describe('sendSummaryEmail', () => {
    it('debería enviar un email y retornar true en éxito', async () => {
      const nodemailer = require('nodemailer');
      nodemailer._mockSendMail.mockResolvedValue({ accepted: ['test@example.com'] });

      const result = await emailService.sendSummaryEmail(
        'test@example.com',
        mockSummary
      );

      expect(result).toBe(true);
      expect(nodemailer._mockSendMail).toHaveBeenCalledTimes(1);
    });

    it('debería retornar false y no lanzar error si SMTP falla', async () => {
      const nodemailer = require('nodemailer');
      nodemailer._mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await emailService.sendSummaryEmail(
        'fail@test.com',
        mockSummary
      );

      expect(result).toBe(false);
    });
  });
});
