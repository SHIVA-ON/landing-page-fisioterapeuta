/**
 * ============================================================
 * ROTAS DE CONTEUDO
 * ============================================================
 * 
 * Endpoints para gerenciamento de conteudo do site:
 * - Configuracoes gerais (titulos, textos)
 * - Informacoes de contato
 * - Redes sociais
 * - Visibilidade de secoes
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('../db/sqlite-pg-compat').verbose();

// Importacao de middleware de autenticacao
const { requireAuth } = require('../middleware/auth');

// ============================================================
// CONEXAO COM BANCO DE DADOS
// ============================================================

const DB_PATH = process.env.DATABASE_URL || 'postgres';

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

function normalizeSettingValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim();
}

// ============================================================
// ROTA: OBTER TODAS AS CONFIGURACOES
// ============================================================
// GET /api/content/settings
// Retorna todas as configuracoes do site

router.get('/settings', async (req, res) => {
  const db = getDb();
  
  try {
    const settings = await new Promise((resolve, reject) => {
      db.all('SELECT key, value FROM site_settings', [], (err, rows) => {
        if (err) reject(err);
        else {
          // Converte array para objeto
          const settingsObj = {};
          rows.forEach(row => {
            settingsObj[row.key] = row.value;
          });
          resolve(settingsObj);
        }
      });
    });
    
    res.json({
      success: true,
      data: settings
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar configuracoes:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar configuracoes'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: ATUALIZAR CONFIGURACOES
// ============================================================
// PUT /api/content/settings
// Atualiza multiplas configuracoes de uma vez

router.put('/settings', requireAuth, async (req, res) => {
  const updates = req.body;
  
  // Lista de chaves permitidas para atualizacao
  const allowedKeys = [
    'hero_title',
    'hero_subtitle',
    'hero_image_url',
    'about_image_url',
    'site_name',
    'whatsapp_number',
    'instagram_url',
    'facebook_url',
    'email_contact',
    'phone_contact',
    'address',
    'business_hours',
    'show_testimonials',
    'show_gallery',
    'email_notifications_enabled',
    'therapist_name',
    'therapist_crefito',
    'therapist_bio',
    'booking_work_start',
    'booking_work_end',
    'booking_slot_interval_minutes',
    'booking_max_per_slot',
    'booking_horizon_days',
    'booking_enabled_weekdays',
    'booking_blocked_dates'
  ];
  
  // Filtra apenas chaves permitidas
  const validUpdates = {};
  Object.keys(updates).forEach(key => {
    const normalizedKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedKeys.includes(normalizedKey)) {
      validUpdates[normalizedKey] = normalizeSettingValue(updates[key]);
    }
  });
  
  if (Object.keys(validUpdates).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Nenhuma configuracao valida para atualizar'
    });
  }
  
  const db = getDb();
  
  try {
    // Inicia transacao
    await new Promise((resolve, reject) => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Atualiza cada configuracao
    for (const [key, value] of Object.entries(validUpdates)) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO site_settings (key, value, updated_at) 
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET 
           value = excluded.value, 
           updated_at = CURRENT_TIMESTAMP`,
          [key, value],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }
    
    // Commit da transacao
    await new Promise((resolve, reject) => {
      db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log(`[ADMIN] Configuracoes atualizadas por ${req.session.adminUsername}`);
    
    res.json({
      success: true,
      message: 'Configuracoes atualizadas com sucesso',
      data: validUpdates
    });
    
  } catch (error) {
    // Rollback em caso de erro
    await new Promise((resolve) => {
      db.run('ROLLBACK', () => resolve());
    });
    
    console.error('[ERROR] Erro ao atualizar configuracoes:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuracoes'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: ATUALIZAR CONFIGURACAO INDIVIDUAL
// ============================================================
// PUT /api/content/settings/:key

router.put('/settings/:key', requireAuth, async (req, res) => {
  const { key } = req.params;
  const normalizedValue = normalizeSettingValue(req.body.value);
  
  // Lista de chaves permitidas
  const allowedKeys = [
    'hero_title',
    'hero_subtitle',
    'hero_image_url',
    'about_image_url',
    'site_name',
    'whatsapp_number',
    'instagram_url',
    'facebook_url',
    'email_contact',
    'phone_contact',
    'address',
    'business_hours',
    'show_testimonials',
    'show_gallery',
    'email_notifications_enabled',
    'therapist_name',
    'therapist_crefito',
    'therapist_bio',
    'booking_work_start',
    'booking_work_end',
    'booking_slot_interval_minutes',
    'booking_max_per_slot',
    'booking_horizon_days',
    'booking_enabled_weekdays',
    'booking_blocked_dates'
  ];
  
  if (!allowedKeys.includes(key)) {
    return res.status(400).json({
      success: false,
      message: 'Chave de configuracao nao permitida'
    });
  }
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO site_settings (key, value, updated_at) 
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET 
         value = excluded.value, 
         updated_at = CURRENT_TIMESTAMP`,
        [key, normalizedValue],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log(`[ADMIN] Configuracao ${key} atualizada por ${req.session.adminUsername}`);
    
    res.json({
      success: true,
      message: 'Configuracao atualizada com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao atualizar configuracao:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar configuracao'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: OBTER INFORMACOES DO TERAPEUTA
// ============================================================
// GET /api/content/therapist
// Retorna informacoes publicas do fisioterapeuta

router.get('/therapist', async (req, res) => {
  const db = getDb();
  
  try {
    const settings = await new Promise((resolve, reject) => {
      db.all(
        "SELECT key, value FROM site_settings WHERE key LIKE 'therapist_%'",
        [],
        (err, rows) => {
          if (err) reject(err);
          else {
            const therapistObj = {};
            rows.forEach(row => {
              const keyWithoutPrefix = row.key.replace('therapist_', '');
              therapistObj[keyWithoutPrefix] = row.value;
            });
            resolve(therapistObj);
          }
        }
      );
    });
    
    res.json({
      success: true,
      data: settings
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar informacoes do terapeuta:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar informacoes'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: OBTER INFORMACOES DE CONTATO
// ============================================================
// GET /api/content/contact
// Retorna informacoes de contato para exibicao publica

router.get('/contact', async (req, res) => {
  const db = getDb();
  
  try {
    const contactKeys = [
      'whatsapp_number',
      'instagram_url',
      'facebook_url',
      'email_contact',
      'phone_contact',
      'address',
      'business_hours'
    ];
    
    const settings = await new Promise((resolve, reject) => {
      const placeholders = contactKeys.map(() => '?').join(',');
      db.all(
        `SELECT key, value FROM site_settings WHERE key IN (${placeholders})`,
        contactKeys,
        (err, rows) => {
          if (err) reject(err);
          else {
            const contactObj = {};
            rows.forEach(row => {
              contactObj[row.key] = row.value;
            });
            resolve(contactObj);
          }
        }
      );
    });
    
    res.json({
      success: true,
      data: settings
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar informacoes de contato:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar informacoes de contato'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// EXPORTACAO DO ROUTER
// ============================================================

module.exports = router;
