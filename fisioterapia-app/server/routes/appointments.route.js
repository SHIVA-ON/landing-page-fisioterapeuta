/**
 * Rotas de agendamento com fluxo de notificacao por e-mail.
 * Estrutura em camadas: route -> controller -> service.
 */

const express = require('express');
const { createAppointment } = require('../controllers/appointmentsController');

const router = express.Router();

// Rate limit simples em memoria por IP para reduzir spam.
const requestWindowMs = 60 * 1000;
const maxRequestsPerWindow = 5;
const requestBuckets = new Map();

function appointmentRateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();

  const entry = requestBuckets.get(ip) || { count: 0, resetAt: now + requestWindowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + requestWindowMs;
  }

  entry.count += 1;
  requestBuckets.set(ip, entry);

  if (entry.count > maxRequestsPerWindow) {
    return res.status(429).json({
      success: false,
      message: 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.'
    });
  }

  return next();
}

// Endpoint principal solicitado.
router.post('/appointments', appointmentRateLimit, createAppointment);

// Compatibilidade com o endpoint antigo usado pelo formulario atual.
router.post('/booking/request', appointmentRateLimit, createAppointment);

module.exports = router;

