/**
 * Servico de envio de e-mails de notificacao.
 * Credenciais sempre via variaveis de ambiente.
 */

const nodemailer = require('nodemailer');

let transporter;

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Variavel de ambiente ausente: ${name}`);
  }
  return String(value).trim();
}

function getTransporter() {
  if (transporter) return transporter;

  const host = getRequiredEnv('SMTP_HOST');
  const port = Number(getRequiredEnv('SMTP_PORT'));
  const user = getRequiredEnv('SMTP_USER');
  const pass = getRequiredEnv('SMTP_PASS');

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporter;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendAppointmentNotification(appointment) {
  const adminEmail = getRequiredEnv('ADMIN_EMAIL');
  const smtpUser = getRequiredEnv('SMTP_USER');
  const from = process.env.EMAIL_FROM || smtpUser;

  const subject = `Novo agendamento - ${appointment.service}`;
  const sentAt = new Date().toLocaleString('pt-BR', { hour12: false });

  const text = [
    'Nova solicitacao de agendamento recebida',
    '',
    `Nome: ${appointment.name}`,
    `Telefone: ${appointment.phone}`,
    `Email: ${appointment.email || '(nao informado)'}`,
    `Servico: ${appointment.service}`,
    `Data: ${appointment.date}`,
    `Horario: ${appointment.time}`,
    `Observacoes: ${appointment.notes || '(sem observacoes)'}`,
    '',
    `Recebido em: ${sentAt}`
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
      <h2 style="margin-bottom: 12px;">Nova solicitacao de agendamento</h2>
      <table style="border-collapse: collapse;">
        <tr><td><strong>Nome:</strong></td><td style="padding-left: 8px;">${escapeHtml(appointment.name)}</td></tr>
        <tr><td><strong>Telefone:</strong></td><td style="padding-left: 8px;">${escapeHtml(appointment.phone)}</td></tr>
        <tr><td><strong>Email:</strong></td><td style="padding-left: 8px;">${escapeHtml(appointment.email || '(nao informado)')}</td></tr>
        <tr><td><strong>Servico:</strong></td><td style="padding-left: 8px;">${escapeHtml(appointment.service)}</td></tr>
        <tr><td><strong>Data:</strong></td><td style="padding-left: 8px;">${escapeHtml(appointment.date)}</td></tr>
        <tr><td><strong>Horario:</strong></td><td style="padding-left: 8px;">${escapeHtml(appointment.time)}</td></tr>
      </table>
      <p style="margin-top: 12px;"><strong>Observacoes</strong><br>${escapeHtml(appointment.notes || '(sem observacoes)')}</p>
      <p style="margin-top: 16px; color: #6b7280; font-size: 12px;">Recebido em: ${escapeHtml(sentAt)}</p>
    </div>
  `;

  const mailer = getTransporter();
  return mailer.sendMail({
    from,
    to: adminEmail,
    subject,
    text,
    html
  });
}

module.exports = {
  sendAppointmentNotification
};

