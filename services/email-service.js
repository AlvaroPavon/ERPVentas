const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

/**
 * EmailService — Handles sending daily summary emails via SMTP.
 */
const emailService = {
  /**
   * Generate an HTML email from a summary data object using the template.
   * Uses simple string replacement (no templating engine dependency).
   * @param {object} summary
   * @returns {string} HTML string
   */
  generateEmailHtml(summary) {
    const { companyName, date, metrics, topProducts, salesByUser } = summary;

    const formatCurrency = (n) => {
      return Number(n).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    let topProductsHtml = '';
    if (topProducts && topProducts.length > 0) {
      topProductsHtml = topProducts.map(p =>
        `<div class="list-item">
          <span>${p.name}</span>
          <span class="product-qty">${p.quantity} vendidos</span>
        </div>`
      ).join('\n      ');
    } else {
      topProductsHtml = '<div class="empty-state">Sin ventas registradas ayer</div>';
    }

    let salesByUserHtml = '';
    if (salesByUser && salesByUser.length > 0) {
      salesByUserHtml = salesByUser.map(u =>
        `<div class="list-item">
          <span>${u.name}</span>
          <span class="user-amount">$${formatCurrency(u.amount)}</span>
        </div>`
      ).join('\n      ');
    } else {
      salesByUserHtml = '<div class="empty-state">Sin actividad de vendedores ayer</div>';
    }

    const template = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen Diario - ${companyName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding: 32px 16px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      border-radius: 12px;
      color: white;
      margin-bottom: 16px;
    }
    .header h1 {
      margin: 0 0 4px 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
      font-size: 14px;
    }
    .metrics-grid {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .metric-box {
      flex: 1;
      text-align: center;
      padding: 20px 12px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .metric-value {
      font-size: 28px;
      font-weight: 700;
      color: #2563eb;
      margin-bottom: 4px;
    }
    .metric-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    .list-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
    }
    .list-item:last-child {
      border-bottom: none;
    }
    .product-qty {
      background: #dbeafe;
      color: #2563eb;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .user-amount {
      font-weight: 600;
      color: #059669;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
      margin-top: 24px;
      padding: 16px;
    }
    .empty-state {
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
      padding: 16px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${companyName}</h1>
      <p>Resumen diario — ${date}</p>
    </div>

    <div class="card">
      <div class="metrics-grid">
        <div class="metric-box">
          <div class="metric-value">$${formatCurrency(metrics.totalAmount)}</div>
          <div class="metric-label">Ventas totales</div>
        </div>
        <div class="metric-box">
          <div class="metric-value">${metrics.totalNotes}</div>
          <div class="metric-label">Notas de venta</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">🏆 Productos más vendidos</div>
      ${topProductsHtml}
    </div>

    <div class="card">
      <div class="section-title">👥 Rendimiento por vendedor</div>
      ${salesByUserHtml}
    </div>

    <div class="footer">
      <p>Notas de Venta — Tu ERP de mercadillos</p>
      <p>Recibís este correo porque tenés activado el resumen diario en tu empresa.</p>
    </div>
  </div>
</body>
</html>`;

    return template;
  },

  /**
   * Send a summary email to a recipient.
   * @param {string} to - recipient email
   * @param {object} summary - summary data object
   * @returns {Promise<boolean>} true if sent successfully, false if failed
   */
  async sendSummaryEmail(to, summary) {
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });

    const html = this.generateEmailHtml(summary);

    try {
      await transporter.sendMail({
        from: user || `"Notas de Venta" <noreply@${host}>`,
        to,
        subject: `📊 Resumen diario - ${summary.companyName} (${summary.date})`,
        html
      });
      return true;
    } catch (err) {
      console.error('[EmailService] Error sending email:', err.message);
      return false;
    }
  }
};

module.exports = emailService;
