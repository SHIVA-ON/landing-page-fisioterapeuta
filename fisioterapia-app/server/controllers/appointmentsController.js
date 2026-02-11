/**
 * Controller de agendamentos.
 */

const { createAppointmentRecord } = require('../services/appointmentService');
const { isEmailNotificationsEnabled } = require('../services/settingsService');
const { sendAppointmentNotification } = require('../services/emailService');

function sanitizeValue(value, maxLen = 255) {
  return String(value ?? '')
    .replace(/[^\S\r\n]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function normalizeAppointmentPayload(body) {
  return {
    name: sanitizeValue(body.name, 100),
    email: sanitizeValue(body.email, 120),
    phone: sanitizeValue(body.phone, 25),
    service: sanitizeValue(body.service ?? body.serviceType, 120),
    date: sanitizeValue(body.date ?? body.preferredDate, 10),
    time: sanitizeValue(body.time ?? body.preferredTime, 5),
    notes: sanitizeValue(body.notes, 1000)
  };
}

function validateAppointmentData(data) {
  if (!data.name) return 'Nome e obrigatorio.';
  if (!data.phone) return 'Telefone e obrigatorio.';
  if (!data.service) return 'Servico e obrigatorio.';
  if (!data.date) return 'Data e obrigatoria.';
  if (!data.time) return 'Horario e obrigatorio.';

  if (!/^[\p{L}\s'-]+$/u.test(data.name)) return 'Nome contem caracteres invalidos.';
  if (!/^[\d\s()+-]{8,20}$/.test(data.phone)) return 'Telefone invalido.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return 'Data invalida. Use AAAA-MM-DD.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) return 'Horario invalido. Use HH:MM.';
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Email invalido.';

  return null;
}

async function createAppointment(req, res) {
  try {
    const payload = normalizeAppointmentPayload(req.body || {});
    const validationError = validateAppointmentData(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const ipAddress = req.ip || req.connection?.remoteAddress;
    const appointmentId = await createAppointmentRecord(payload, ipAddress);

    let emailNotificationsEnabled = false;
    try {
      emailNotificationsEnabled = await isEmailNotificationsEnabled();
    } catch (settingsError) {
      console.error('[SETTINGS] Falha ao ler email_notifications_enabled:', settingsError.message);
      emailNotificationsEnabled = false;
    }

    // Nao bloqueia a resposta do usuario aguardando SMTP.
    if (emailNotificationsEnabled) {
      setImmediate(async () => {
        try {
          await sendAppointmentNotification(payload);
        } catch (emailError) {
          // Mantem sucesso da solicitacao mesmo com falha de notificacao.
          console.error('[EMAIL] Falha ao processar notificacao de agendamento:', emailError.message);
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Solicitacao de agendamento enviada com sucesso! Entraremos em contato para confirmar.',
      data: {
        id: appointmentId,
        emailNotificationsEnabled,
        emailSent: false
      }
    });
  } catch (error) {
    console.error('[ERROR] Erro ao processar agendamento:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Erro ao enviar solicitacao. Tente novamente mais tarde.'
    });
  }
}

module.exports = {
  createAppointment
};
