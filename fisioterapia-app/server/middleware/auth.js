/**
 * ============================================================
 * MIDDLEWARE DE AUTENTICACAO
 * ============================================================
 * 
 * Middleware para proteger rotas administrativas e gerenciar
 * sessoes de usuario. Inclui verificacao de autenticacao,
 * rate limiting para login e prevencao de ataques.
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

const rateLimit = require('express-rate-limit');
const sqlite3 = require('../db/sqlite-pg-compat').verbose();

// ============================================================
// CONEXAO COM BANCO DE DADOS
// ============================================================

const DB_PATH = process.env.DATABASE_URL || 'postgres';

function getDb() {
  return new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY);
}

// ============================================================
// MIDDLEWARE: VERIFICAR SE USUARIO ESTA AUTENTICADO
// ============================================================
// Usado para proteger rotas que requerem login

function requireAuth(req, res, next) {
  // Verifica se existe sessao valida com adminId
  if (req.session && req.session.adminId) {
    // Adiciona informacoes do admin ao request para uso posterior
    req.adminId = req.session.adminId;
    req.adminUsername = req.session.adminUsername;
    return next();
  }

  // Se for requisicao AJAX/API, retorna JSON
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      success: false,
      message: 'Autenticacao necessaria. Faca login para continuar.'
    });
  }

  // Se for navegacao normal, redireciona para login
  res.redirect('/admin/login');
}

// ============================================================
// MIDDLEWARE: VERIFICAR SE USUARIO NAO ESTA AUTENTICADO
// ============================================================
// Usado na pagina de login para redirecionar usuarios ja logados

function requireGuest(req, res, next) {
  if (req.session && req.session.adminId) {
    // Usuario ja logado, redireciona para dashboard
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Ja autenticado',
        redirect: '/admin/dashboard'
      });
    }
    return res.redirect('/admin/dashboard');
  }
  next();
}

// ============================================================
// RATE LIMITING ESPECIFICO PARA LOGIN
// ============================================================
// Limita tentativas de login para prevenir forca bruta

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // Maximo 5 tentativas por IP
  skipSuccessfulRequests: true, // Nao conta logins bem-sucedidos
  message: {
    success: false,
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    retryAfter: 900 // segundos
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Handler customizado para logging de tentativas
  handler: (req, res, next, options) => {
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[SECURITY] Tentativas de login excedidas para IP: ${ip}`);
    res.status(429).json(options.message);
  }
});

// ============================================================
// FUNCAO: REGISTRAR TENTATIVA DE LOGIN
// ============================================================
// Registra no banco para analise de seguranca

async function logLoginAttempt(ip, username, success = false) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    db.run(
      'INSERT INTO login_attempts (ip_address, username, success) VALUES (?, ?, ?)',
      [ip, username, !!success],
      function(err) {
        db.close();
        if (err) {
          console.error('Erro ao registrar tentativa de login:', err.message);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

// ============================================================
// FUNCAO: VERIFICAR SE IP ESTA BLOQUEADO
// ============================================================
// Verifica numero de tentativas falhas recentes

async function isIpBlocked(ip, maxAttempts = 5, windowMinutes = 15) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH);
    const windowTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    
    db.get(
      `SELECT COUNT(*) as count FROM login_attempts 
       WHERE ip_address = ? AND success = false AND attempted_at > ?`,
      [ip, windowTime],
      (err, row) => {
        db.close();
        if (err) {
          console.error('Erro ao verificar bloqueio de IP:', err.message);
          reject(err);
        } else {
          resolve(row.count >= maxAttempts);
        }
      }
    );
  });
}

// ============================================================
// MIDDLEWARE: VERIFICAR BLOQUEIO DE IP
// ============================================================

async function checkIpBlock(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  
  try {
    const blocked = await isIpBlocked(ip);
    if (blocked) {
      console.log(`[SECURITY] IP bloqueado tentando acesso: ${ip}`);
      return res.status(403).json({
        success: false,
        message: 'Acesso temporariamente bloqueado devido a multiplas tentativas falhas. Tente novamente em 15 minutos.'
      });
    }
    next();
  } catch (error) {
    console.error('Erro ao verificar bloqueio:', error);
    // Em caso de erro, permite continuar (fail open para nao travar usuarios)
    next();
  }
}

// ============================================================
// MIDDLEWARE: PREVINIR CACHE DE PAGINAS PROTEGIDAS
// ============================================================
// Evita que browsers cacheiem paginas admin

function preventCache(req, res, next) {
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '-1');
  next();
}

// ============================================================
// MIDDLEWARE: LOG DE ACESSO ADMIN
// ============================================================
// Registra acessos ao painel administrativo

function logAdminAccess(req, res, next) {
  if (req.session && req.session.adminId) {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[ADMIN ACCESS] ${timestamp} - User: ${req.session.adminUsername} - IP: ${ip} - Route: ${req.path}`);
  }
  next();
}

// ============================================================
// EXPORTACOES
// ============================================================

module.exports = {
  requireAuth,
  requireGuest,
  loginLimiter,
  logLoginAttempt,
  isIpBlocked,
  checkIpBlock,
  preventCache,
  logAdminAccess
};
