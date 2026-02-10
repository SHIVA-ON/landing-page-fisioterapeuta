/**
 * ============================================================
 * APLICACAO PRINCIPAL - SERVIDOR EXPRESS
 * ============================================================
 * 
 * Servidor Node.js + Express para landing page de fisioterapeuta
 * Inclui: seguranca, autenticacao, rate limiting, CSRF protection
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

// ============================================================
// IMPORTACOES DE DEPENDENCIAS
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
require('dotenv').config();

// Importacao de rotas
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const contentRoutes = require('./routes/content');

// Importacao de middlewares customizados
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ============================================================
// INICIALIZACAO DO APLICATIVO EXPRESS
// ============================================================

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, '../database');
const DB_PATH = path.join(DB_DIR, 'fisioterapia.db');

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(DB_PATH)) {
  console.warn('[WARN] Banco de dados nao encontrado. Execute: npm run init-db');
}

// ============================================================
// CONFIGURACAO DE SEGURANCA - HELMET
// ============================================================
// Helmet configura headers HTTP seguros para proteger contra
// vulnerabilidades comuns (XSS, clickjacking, sniffing, etc.)

app.use(helmet({
  // Content Security Policy - controla fontes de conteudo permitidas
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Permite estilos inline para animacoes
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"], // Previne clickjacking
      upgradeInsecureRequests: [],
    },
  },
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false,
  // HSTS - forca HTTPS em producao
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// ============================================================
// CONFIGURACAO DE CORS
// ============================================================
// Controla quais dominios podem acessar a API

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true, // Permite cookies de sessao
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'CSRF-Token']
}));

// ============================================================
// RATE LIMITING GLOBAL
// ============================================================
// Limita requisicoes para prevenir ataques de forca bruta

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Janela de 15 minutos
  max: 100, // Maximo 100 requisicoes por IP
  message: {
    success: false,
    message: 'Muitas requisicoes. Tente novamente mais tarde.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// ============================================================
// PARSING DE REQUISICOES
// ============================================================

// Parse JSON com limite de tamanho para prevenir ataques
app.use(express.json({ limit: '10mb' }));

// Parse dados de formularios
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// CONFIGURACAO DE SESSOES
// ============================================================
// Sessoes seguras armazenadas em SQLite

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, '../database'),
    concurrentDB: true
  }),
  secret: process.env.SESSION_SECRET || 'chave-secreta-muito-segura-2026',
  name: 'sessionId', // Nome customizado para nao revelar tecnologia
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS apenas em producao
    httpOnly: true, // Previne acesso via JavaScript
    sameSite: 'strict', // Protecao contra CSRF
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// ============================================================
// CSRF PROTECTION
// ============================================================
// Protecao contra Cross-Site Request Forgery para rotas admin

const csrfProtection = csrf({ cookie: true });

// Middleware para disponibilizar token CSRF nas views
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
  next();
});

// ============================================================
// SERVICOS DE ARQUIVOS ESTATICOS
// ============================================================

// Arquivos publicos (landing page)
app.use(express.static(path.join(__dirname, '../public')));

// Arquivos admin (protegidos por autenticacao posteriormente)
app.use('/admin', express.static(path.join(__dirname, '../admin'), {
  index: false,
  redirect: false
}));

// ============================================================
// ROTAS DA API
// ============================================================

// Rotas publicas (landing page, contato, etc.)
app.use('/api', publicRoutes);

// Rotas de conteudo dinamico
app.use('/api/content', contentRoutes);

// Rotas administrativas (protegidas)
app.use('/api/admin', adminRoutes);

// ============================================================
// ROTAS DE PAGINAS
// ============================================================

// Pagina principal (landing page)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Alias explicito para index
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Pagina publica de agendamento
app.get('/agendamento', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/agendamento.html'));
});

// Alias de compatibilidade para plural e nome de arquivo solicitado
app.get('/agendamentos.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/agendamento.html'));
});

// Pagina de login do admin
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});

// Dashboard admin (protegido por autenticacao)
function renderDashboard(req, res) {
  // Verifica se usuario esta autenticado
  if (req.session && req.session.adminId) {
    return res.sendFile(path.join(__dirname, '../admin/dashboard.html'));
  } else {
    return res.redirect('/admin/login');
  }
}

app.get('/admin', renderDashboard);
app.get('/admin/', renderDashboard);
app.get('/admin/dashboard', renderDashboard);
app.get('/admin/contatos', renderDashboard);

// ============================================================
// TRATAMENTO DE ERROS
// ============================================================

// Rota nao encontrada (404)
app.use(notFound);

// Handler de erros global
app.use(errorHandler);

// ============================================================
// INICIALIZACAO DO SERVIDOR
// ============================================================

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Servidor Fisioterapia rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`========================================`);
  console.log(`Acesse: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin/login`);
  console.log(`========================================`);
});

module.exports = app;
