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
    // Insere solicitacao no banco de dados
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO booking_requests 
         (name, email, phone, preferred_date, preferred_time, service_type, notes, ip_address) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, email, phone, preferredDate || null, preferredTime || null, serviceType || null, notes || null, ip],
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
