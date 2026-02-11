/**
 * ============================================================
 * ROTAS PUBLICAS
 * ============================================================
 * 
 * Endpoints publicos acessiveis sem autenticacao:
 * - Envio de mensagens de contato
 * - Solicitacoes de agendamento
 * - Consulta de conteudo do site
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('../db/sqlite-pg-compat').verbose();

// Importacao de validadores
const { contactValidation, bookingValidation, publicTestimonialValidation } = require('../utils/validators');

// Importacao de middleware de rate limiting
const { loginLimiter, logLoginAttempt, checkIpBlock } = require('../middleware/auth');
const bcrypt = require('bcrypt');

// ============================================================
// CONEXAO COM BANCO DE DADOS
// ============================================================

const DB_PATH = process.env.DATABASE_URL || 'postgres';

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

const DEFAULT_BOOKING_SETTINGS = {
  booking_work_start: '08:00',
  booking_work_end: '18:00',
  booking_slot_interval_minutes: '60',
  booking_max_per_slot: '1',
  booking_horizon_days: '90',
  booking_enabled_weekdays: '1,2,3,4,5',
  booking_blocked_dates: ''
};

function parseIntegerSetting(value, fallback) {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeDateValue(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeTimeValue(minutes) {
  const safeMinutes = Math.max(0, Math.floor(minutes));
  const hours = String(Math.floor(safeMinutes / 60)).padStart(2, '0');
  const mins = String(safeMinutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

function parseTimeToMinutes(time) {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return (hours * 60) + minutes;
}

function buildTimeSlots(config) {
  const startMinutes = parseTimeToMinutes(config.workStart);
  const endMinutes = parseTimeToMinutes(config.workEnd);
  const interval = config.slotIntervalMinutes;
  const slots = [];

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return slots;
  if (!Number.isInteger(interval) || interval <= 0) return slots;
  if (startMinutes >= endMinutes) return slots;

  for (let minute = startMinutes; minute < endMinutes; minute += interval) {
    if (minute + interval > endMinutes) break;
    slots.push(normalizeTimeValue(minute));
  }
  return slots;
}

async function getBookingRuntimeConfig(db) {
  const keys = Object.keys(DEFAULT_BOOKING_SETTINGS);
  const placeholders = keys.map(() => '?').join(',');

  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT key, value FROM site_settings WHERE key IN (${placeholders})`,
      keys,
      (err, resultRows) => {
        if (err) reject(err);
        else resolve(resultRows);
      }
    );
  });

  const values = { ...DEFAULT_BOOKING_SETTINGS };
  rows.forEach((row) => {
    if (row && row.key in values) {
      values[row.key] = String(row.value ?? '').trim();
    }
  });

  const enabledWeekdays = values.booking_enabled_weekdays
    .split(',')
    .map((value) => parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);

  const blockedDates = values.booking_blocked_dates
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));

  return {
    workStart: values.booking_work_start || DEFAULT_BOOKING_SETTINGS.booking_work_start,
    workEnd: values.booking_work_end || DEFAULT_BOOKING_SETTINGS.booking_work_end,
    slotIntervalMinutes: Math.min(180, Math.max(15, parseIntegerSetting(values.booking_slot_interval_minutes, 60))),
    maxPerSlot: Math.min(20, Math.max(1, parseIntegerSetting(values.booking_max_per_slot, 1))),
    horizonDays: Math.min(180, Math.max(7, parseIntegerSetting(values.booking_horizon_days, 90))),
    enabledWeekdays: enabledWeekdays.length ? enabledWeekdays : [1, 2, 3, 4, 5],
    blockedDates
  };
}

async function getActiveServiceTitles(db) {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      'SELECT title FROM services WHERE is_active = true ORDER BY order_index ASC',
      [],
      (err, resultRows) => {
        if (err) reject(err);
        else resolve(resultRows);
      }
    );
  });
  return rows.map((row) => row.title);
}

async function getBookedSlotsMap(db, fromDate, toDate) {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT preferred_date, preferred_time, COUNT(*) as total
       FROM booking_requests
       WHERE status IN (?, ?)
         AND preferred_date BETWEEN ? AND ?
         AND preferred_time IS NOT NULL
       GROUP BY preferred_date, preferred_time`,
      ['pending', 'confirmed', fromDate, toDate],
      (err, resultRows) => {
        if (err) reject(err);
        else resolve(resultRows);
      }
    );
  });

  const map = new Map();
  rows.forEach((row) => {
    const key = `${row.preferred_date}|${row.preferred_time}`;
    map.set(key, Number(row.total || 0));
  });
  return map;
}

function buildDateSummaries(config, bookedSlotsMap, timeSlots) {
  const dates = [];
  const blockedDateSet = new Set(config.blockedDates);
  const weekdaySet = new Set(config.enabledWeekdays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i <= config.horizonDays; i += 1) {
    const current = new Date(today);
    current.setDate(today.getDate() + i);
    const dateValue = normalizeDateValue(current);
    const weekday = current.getDay();

    const isDateAllowed = weekdaySet.has(weekday) && !blockedDateSet.has(dateValue);
    const totalSlots = isDateAllowed ? timeSlots.length : 0;
    let availableSlots = 0;

    if (isDateAllowed && totalSlots > 0) {
      availableSlots = timeSlots.reduce((total, timeValue) => {
        const booked = bookedSlotsMap.get(`${dateValue}|${timeValue}`) || 0;
        return total + (booked < config.maxPerSlot ? 1 : 0);
      }, 0);
    }

    dates.push({
      date: dateValue,
      available: availableSlots > 0,
      totalSlots,
      availableSlots
    });
  }

  return dates;
}

function buildSlotsForDate(dateValue, config, timeSlots, bookedSlotsMap) {
  const blockedDateSet = new Set(config.blockedDates);
  const weekdaySet = new Set(config.enabledWeekdays);
  const dateObj = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(dateObj.getTime())) return [];

  const isDateAllowed = weekdaySet.has(dateObj.getDay()) && !blockedDateSet.has(dateValue);
  if (!isDateAllowed) return [];

  return timeSlots.map((timeValue) => {
    const booked = bookedSlotsMap.get(`${dateValue}|${timeValue}`) || 0;
    return {
      time: timeValue,
      available: booked < config.maxPerSlot,
      booked,
      remaining: Math.max(0, config.maxPerSlot - booked)
    };
  });
}

// ============================================================
// ROTA: ENVIAR MENSAGEM DE CONTATO
// ============================================================
// POST /api/contact
// Recebe mensagens do formulario de contato da landing page

router.post('/contact', contactValidation, async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  
  const db = getDb();
  
  try {
    // Insere mensagem no banco de dados
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO messages (name, email, phone, subject, message, ip_address) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, phone || null, subject, message, ip],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    console.log(`[CONTACT] Nova mensagem recebida ID: ${result} de ${email}`);
    
    res.status(201).json({
      success: true,
      message: 'Mensagem enviada com sucesso! Entraremos em contato em breve.',
      data: { id: result }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao salvar mensagem:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem. Tente novamente mais tarde.'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: SOLICITAR AGENDAMENTO
// ============================================================
// POST /api/booking/request
// Recebe solicitacoes de agendamento de avaliacao

router.post('/booking/request', bookingValidation, async (req, res) => {
  const { name, email, phone, preferredDate, preferredTime, serviceType, notes } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  
  const db = getDb();
  
  try {
    const normalizedServiceType = String(serviceType || '').trim();
    const normalizedDate = String(preferredDate || '').trim();
    const normalizedTime = String(preferredTime || '').trim();

    if (!normalizedDate || !normalizedTime || !normalizedServiceType) {
      return res.status(400).json({
        success: false,
        message: 'Selecione data, horario e servico para continuar.'
      });
    }

    const config = await getBookingRuntimeConfig(db);
    const activeServiceTitles = await getActiveServiceTitles(db);

    if (!activeServiceTitles.includes(normalizedServiceType)) {
      return res.status(400).json({
        success: false,
        message: 'Servico invalido para agendamento.'
      });
    }

    const timeSlots = buildTimeSlots(config);
    if (!timeSlots.includes(normalizedTime)) {
      return res.status(400).json({
        success: false,
        message: 'Horario fora da janela de atendimento.'
      });
    }

    const toDate = normalizeDateValue(new Date(Date.now() + (config.horizonDays * 24 * 60 * 60 * 1000)));
    const fromDate = normalizeDateValue(new Date());
    if (normalizedDate < fromDate || normalizedDate > toDate) {
      return res.status(400).json({
        success: false,
        message: 'Data fora do periodo disponivel para agendamento.'
      });
    }
    const bookedSlotsMap = await getBookedSlotsMap(db, fromDate, toDate);
    const selectedDateSlots = buildSlotsForDate(normalizedDate, config, timeSlots, bookedSlotsMap);
    const selectedSlot = selectedDateSlots.find((slot) => slot.time === normalizedTime);

    if (!selectedSlot || !selectedSlot.available) {
      return res.status(409).json({
        success: false,
        message: 'Esse horario nao esta mais disponivel. Escolha outro.'
      });
    }

    // Insere solicitacao no banco de dados
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO booking_requests 
         (name, email, phone, preferred_date, preferred_time, service_type, notes, ip_address) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, phone, normalizedDate, normalizedTime, normalizedServiceType, notes || null, ip],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    console.log(`[BOOKING] Nova solicitacao de agendamento ID: ${result} de ${email}`);
    
    res.status(201).json({
      success: true,
      message: 'Solicitacao de agendamento enviada com sucesso! Entraremos em contato para confirmar.',
      data: { id: result }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao salvar agendamento:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar solicitacao. Tente novamente mais tarde.'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: DISPONIBILIDADE DE AGENDAMENTO
// ============================================================
// GET /api/booking/availability

router.get('/booking/availability', async (req, res) => {
  const db = getDb();

  try {
    const requestedDate = String(req.query.date || '').trim();
    const config = await getBookingRuntimeConfig(db);
    const services = await getActiveServiceTitles(db);
    const timeSlots = buildTimeSlots(config);

    const today = normalizeDateValue(new Date());
    const maxDate = normalizeDateValue(new Date(Date.now() + (config.horizonDays * 24 * 60 * 60 * 1000)));
    const bookedSlotsMap = await getBookedSlotsMap(db, today, maxDate);
    const dates = buildDateSummaries(config, bookedSlotsMap, timeSlots);

    let selectedDate = requestedDate;
    if (!selectedDate || !dates.find((item) => item.date === selectedDate)) {
      selectedDate = (dates.find((item) => item.available) || dates[0] || {}).date || '';
    }

    const slots = selectedDate
      ? buildSlotsForDate(selectedDate, config, timeSlots, bookedSlotsMap)
      : [];

    res.json({
      success: true,
      data: {
        services,
        config: {
          workStart: config.workStart,
          workEnd: config.workEnd,
          slotIntervalMinutes: config.slotIntervalMinutes,
          maxPerSlot: config.maxPerSlot,
          horizonDays: config.horizonDays,
          enabledWeekdays: config.enabledWeekdays,
          blockedDates: config.blockedDates
        },
        dates,
        selectedDate,
        slots
      }
    });
  } catch (error) {
    console.error('[ERROR] Erro ao buscar disponibilidade de agendamento:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar disponibilidade de agenda'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: OBTER CONTEUDO DO SITE
// ============================================================
// GET /api/content
// Retorna todas as informacoes dinamicas do site

router.get('/content', async (req, res) => {
  const db = getDb();
  
  try {
    // Busca configuracoes do site
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM site_settings', [], (err, rows) => {
        if (err) reject(err);
        else {
          // Converte array de settings para objeto
          const settingsObj = {};
          rows.forEach(row => {
            settingsObj[row.key] = row.value;
          });
          resolve(settingsObj);
        }
      });
    });
    
    // Busca servicos ativos ordenados
    const services = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, title, description, icon, order_index FROM services WHERE is_active = true ORDER BY order_index ASC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    // Busca depoimentos ativos (se habilitados)
    let testimonials = [];
    if (settings.show_testimonials === 'true') {
      testimonials = await new Promise((resolve, reject) => {
        db.all(
          'SELECT id, name, text, rating FROM testimonials WHERE is_active = true ORDER BY created_at DESC',
          [],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });
    }
    
    res.json({
      success: true,
      data: {
        settings,
        services,
        testimonials
      }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar conteudo:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar conteudo do site'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: OBTER SERVICOS
// ============================================================
// GET /api/services
// Retorna lista de servicos para exibicao publica

router.get('/services', async (req, res) => {
  const db = getDb();
  
  try {
    const services = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, title, description, icon FROM services WHERE is_active = true ORDER BY order_index ASC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    res.json({
      success: true,
      data: services
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar servicos:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar servicos'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: OBTER DEPOIMENTOS
// ============================================================
// GET /api/testimonials
// Retorna depoimentos aprovados para exibicao publica

router.get('/testimonials', async (req, res) => {
  const db = getDb();
  
  try {
    // Verifica se depoimentos estao habilitados
    const setting = await new Promise((resolve, reject) => {
      db.get(
        'SELECT value FROM site_settings WHERE key = ?',
        ['show_testimonials'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    if (setting?.value !== 'true') {
      return res.json({
        success: true,
        data: [],
        message: 'Depoimentos temporariamente indisponiveis'
      });
    }
    
    const testimonials = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, text, rating FROM testimonials WHERE is_active = true ORDER BY created_at DESC LIMIT 10',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    
    res.json({
      success: true,
      data: testimonials
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar depoimentos:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar depoimentos'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: ENVIAR DEPOIMENTO PUBLICO
// ============================================================
// POST /api/testimonials
// Recebe depoimentos enviados por clientes na landing page

router.post('/testimonials', publicTestimonialValidation, async (req, res) => {
  const { name, text, rating } = req.body;
  const ip = req.ip || req.connection.remoteAddress;

  const db = getDb();

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO testimonials (name, text, rating, is_active) 
         VALUES (?, ?, ?, ?)`,
        [name, text, parseInt(rating, 10), true],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    console.log(`[TESTIMONIAL] Novo depoimento ID: ${result} de ${name} (${ip})`);

    res.status(201).json({
      success: true,
      message: 'Depoimento enviado com sucesso! Obrigado pelo seu feedback.',
      data: { id: result }
    });
  } catch (error) {
    console.error('[ERROR] Erro ao salvar depoimento publico:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar depoimento. Tente novamente mais tarde.'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// EXPORTACAO DO ROUTER
// ============================================================

module.exports = router;
