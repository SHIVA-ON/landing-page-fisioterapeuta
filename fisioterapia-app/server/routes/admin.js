/**
 * ============================================================
 * ROTAS ADMINISTRATIVAS
 * ============================================================
 * 
 * Endpoints protegidos para gerenciamento do site:
 * - Autenticacao (login/logout)
 * - Gerenciamento de mensagens
 * - Gerenciamento de agendamentos
 * - Gerenciamento de depoimentos
 * - Gerenciamento de servicos
 * - Configuracoes do site
 * 
 * Todas as rotas requerem autenticacao.
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

// Importacao de middlewares de autenticacao
const { 
  requireAuth, 
  requireGuest, 
  loginLimiter, 
  logLoginAttempt,
  checkIpBlock,
  preventCache,
  logAdminAccess
} = require('../middleware/auth');

// Importacao de validadores
const { 
  loginValidation, 
  testimonialValidation, 
  serviceValidation, 
  contentValidation,
  idParamValidation 
} = require('../utils/validators');

// ============================================================
// CONEXAO COM BANCO DE DADOS
// ============================================================

const DB_PATH = path.join(__dirname, '../../database/fisioterapia.db');

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

// ============================================================
// APLICAR MIDDLEWARES EM TODAS AS ROTAS ADMIN
// ============================================================

// Previne cache de paginas admin
router.use(preventCache);

// Log de acessos admin
router.use(logAdminAccess);

// ============================================================
// ROTA: LOGIN DO ADMIN
// ============================================================
// POST /api/admin/login
// Autentica usuario e cria sessao

router.post('/login', requireGuest, loginLimiter, checkIpBlock, loginValidation, async (req, res) => {
  const { username, password } = req.body;
  const ip = req.ip || req.connection.remoteAddress;
  
  const db = getDb();
  
  try {
    // Busca usuario no banco de dados
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, password_hash, is_active FROM admins WHERE username = ?',
        [username],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    // Verifica se usuario existe e esta ativo
    if (!admin || !admin.is_active) {
      await logLoginAttempt(ip, username, false);
      return res.status(401).json({
        success: false,
        message: 'Usuario ou senha invalidos'
      });
    }
    
    // Verifica senha usando bcrypt
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    
    if (!passwordMatch) {
      await logLoginAttempt(ip, username, false);
      return res.status(401).json({
        success: false,
        message: 'Usuario ou senha invalidos'
      });
    }
    
    // Login bem-sucedido - cria sessao
    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;
    
    // Atualiza ultimo login
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE admins SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [admin.id],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Registra login bem-sucedido
    await logLoginAttempt(ip, username, true);
    
    console.log(`[ADMIN LOGIN] Usuario ${username} logado de ${ip}`);
    
    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        username: admin.username,
        redirect: '/admin/dashboard'
      }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro no login:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao realizar login. Tente novamente.'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: VERIFICAR SESSAO
// ============================================================
// GET /api/admin/session
// Verifica se usuario esta autenticado

router.get('/session', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: {
      isAuthenticated: true,
      username: req.session.adminUsername
    }
  });
});

// ============================================================
// ROTA: LOGOUT
// ============================================================
// POST /api/admin/logout
// Encerra sessao do usuario

router.post('/logout', requireAuth, (req, res) => {
  const username = req.session.adminUsername;
  
  req.session.destroy((err) => {
    if (err) {
      console.error('[ERROR] Erro ao fazer logout:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Erro ao fazer logout'
      });
    }
    
    // Limpa cookie de sessao
    res.clearCookie('sessionId');
    
    console.log(`[ADMIN LOGOUT] Usuario ${username} deslogado`);
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso',
      redirect: '/admin/login'
    });
  });
});

// ============================================================
// ROTA: ALTERAR SENHA
// ============================================================
// PUT /api/admin/password
// Permite admin alterar sua propria senha

router.put('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const adminId = req.session.adminId;
  
  // Validacao basica da nova senha
  if (!newPassword || newPassword.length < 6 || newPassword.length > 128) {
    return res.status(400).json({
      success: false,
      message: 'Nova senha deve ter entre 6 e 128 caracteres'
    });
  }
  
  const db = getDb();
  
  try {
    // Busca hash atual
    const admin = await new Promise((resolve, reject) => {
      db.get(
        'SELECT password_hash FROM admins WHERE id = ?',
        [adminId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    // Verifica senha atual
    const passwordMatch = await bcrypt.compare(currentPassword, admin.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Senha atual incorreta'
      });
    }
    
    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    // Atualiza senha
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE admins SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newPasswordHash, adminId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    console.log(`[ADMIN] Senha alterada para usuario ID: ${adminId}`);
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao alterar senha:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao alterar senha'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: LISTAR MENSAGENS
// ============================================================
// GET /api/admin/messages
// Retorna todas as mensagens recebidas

router.get('/messages', requireAuth, async (req, res) => {
  const { page = 1, limit = 20, unreadOnly = false } = req.query;
  const offset = (page - 1) * limit;
  
  const db = getDb();
  
  try {
    let query = 'SELECT id, name, email, phone, subject, message, is_read, created_at FROM messages';
    let countQuery = 'SELECT COUNT(*) as total FROM messages';
    const params = [];
    
    if (unreadOnly === 'true') {
      query += ' WHERE is_read = 0';
      countQuery += ' WHERE is_read = 0';
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const messages = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const countResult = await new Promise((resolve, reject) => {
      db.get(countQuery, unreadOnly === 'true' ? [] : [], (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    });
    
    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult,
        totalPages: Math.ceil(countResult / limit)
      }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar mensagens:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar mensagens'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: MARCAR MENSAGEM COMO LIDA/NAO LIDA
// ============================================================
// PUT /api/admin/messages/:id/read

router.put('/messages/:id/read', requireAuth, idParamValidation, async (req, res) => {
  const { id } = req.params;
  const { isRead } = req.body;
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE messages SET is_read = ? WHERE id = ?',
        [isRead ? 1 : 0, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    res.json({
      success: true,
      message: isRead ? 'Mensagem marcada como lida' : 'Mensagem marcada como nao lida'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao atualizar mensagem:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar mensagem'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: EXCLUIR MENSAGEM
// ============================================================
// DELETE /api/admin/messages/:id

router.delete('/messages/:id', requireAuth, idParamValidation, async (req, res) => {
  const { id } = req.params;
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM messages WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    console.log(`[ADMIN] Mensagem ${id} excluida por ${req.session.adminUsername}`);
    
    res.json({
      success: true,
      message: 'Mensagem excluida com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao excluir mensagem:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir mensagem'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: LISTAR AGENDAMENTOS
// ============================================================
// GET /api/admin/bookings

router.get('/bookings', requireAuth, async (req, res) => {
  const { page = 1, limit = 20, status = 'all' } = req.query;
  const offset = (page - 1) * limit;
  
  const db = getDb();
  
  try {
    let query = `
      SELECT id, name, email, phone, preferred_date, preferred_time, 
             service_type, notes, status, created_at 
      FROM booking_requests
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM booking_requests';
    const params = [];
    
    if (status !== 'all') {
      query += ' WHERE status = ?';
      countQuery += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const bookings = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const countResult = await new Promise((resolve, reject) => {
      db.get(countQuery, status !== 'all' ? [status] : [], (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    });
    
    res.json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult,
        totalPages: Math.ceil(countResult / limit)
      }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar agendamentos:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar agendamentos'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: ATUALIZAR STATUS DO AGENDAMENTO
// ============================================================
// PUT /api/admin/bookings/:id/status

router.put('/bookings/:id/status', requireAuth, idParamValidation, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const validStatuses = ['pending', 'confirmed', 'cancelled', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status invalido'
    });
  }
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE booking_requests SET status = ? WHERE id = ?',
        [status, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    res.json({
      success: true,
      message: 'Status atualizado com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao atualizar status:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar status'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: LISTAR DEPOIMENTOS
// ============================================================
// GET /api/admin/testimonials

router.get('/testimonials', requireAuth, async (req, res) => {
  const db = getDb();
  
  try {
    const testimonials = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, text, rating, is_active, created_at FROM testimonials ORDER BY created_at DESC',
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
// ROTA: CRIAR DEPOIMENTO
// ============================================================
// POST /api/admin/testimonials

router.post('/testimonials', requireAuth, testimonialValidation, async (req, res) => {
  const { name, text, rating = 5, isActive = true } = req.body;
  
  const db = getDb();
  
  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO testimonials (name, text, rating, is_active) VALUES (?, ?, ?, ?)',
        [name, text, rating, isActive ? 1 : 0],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    console.log(`[ADMIN] Depoimento criado ID: ${result} por ${req.session.adminUsername}`);
    
    res.status(201).json({
      success: true,
      message: 'Depoimento criado com sucesso',
      data: { id: result }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao criar depoimento:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar depoimento'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: ATUALIZAR DEPOIMENTO
// ============================================================
// PUT /api/admin/testimonials/:id

router.put('/testimonials/:id', requireAuth, idParamValidation, testimonialValidation, async (req, res) => {
  const { id } = req.params;
  const { name, text, rating, isActive } = req.body;
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE testimonials 
         SET name = ?, text = ?, rating = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [name, text, rating, isActive ? 1 : 0, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    console.log(`[ADMIN] Depoimento ${id} atualizado por ${req.session.adminUsername}`);
    
    res.json({
      success: true,
      message: 'Depoimento atualizado com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao atualizar depoimento:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar depoimento'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: EXCLUIR DEPOIMENTO
// ============================================================
// DELETE /api/admin/testimonials/:id

router.delete('/testimonials/:id', requireAuth, idParamValidation, async (req, res) => {
  const { id } = req.params;
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM testimonials WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    console.log(`[ADMIN] Depoimento ${id} excluido por ${req.session.adminUsername}`);
    
    res.json({
      success: true,
      message: 'Depoimento excluido com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao excluir depoimento:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir depoimento'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: LISTAR SERVICOS
// ============================================================
// GET /api/admin/services

router.get('/services', requireAuth, async (req, res) => {
  const db = getDb();
  
  try {
    const services = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, title, description, icon, order_index, is_active FROM services ORDER BY order_index ASC',
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
// ROTA: CRIAR SERVICO
// ============================================================
// POST /api/admin/services

router.post('/services', requireAuth, serviceValidation, async (req, res) => {
  const { title, description, icon, orderIndex = 0, isActive = true } = req.body;
  
  const db = getDb();
  
  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO services (title, description, icon, order_index, is_active) VALUES (?, ?, ?, ?, ?)',
        [title, description, icon || null, orderIndex, isActive ? 1 : 0],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    console.log(`[ADMIN] Servico criado ID: ${result} por ${req.session.adminUsername}`);
    
    res.status(201).json({
      success: true,
      message: 'Servico criado com sucesso',
      data: { id: result }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao criar servico:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar servico'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: ATUALIZAR SERVICO
// ============================================================
// PUT /api/admin/services/:id

router.put('/services/:id', requireAuth, idParamValidation, serviceValidation, async (req, res) => {
  const { id } = req.params;
  const { title, description, icon, orderIndex, isActive } = req.body;
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE services 
         SET title = ?, description = ?, icon = ?, order_index = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [title, description, icon || null, orderIndex, isActive ? 1 : 0, id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    console.log(`[ADMIN] Servico ${id} atualizado por ${req.session.adminUsername}`);
    
    res.json({
      success: true,
      message: 'Servico atualizado com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao atualizar servico:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar servico'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: EXCLUIR SERVICO
// ============================================================
// DELETE /api/admin/services/:id

router.delete('/services/:id', requireAuth, idParamValidation, async (req, res) => {
  const { id } = req.params;
  
  const db = getDb();
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM services WHERE id = ?',
        [id],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
    
    console.log(`[ADMIN] Servico ${id} excluido por ${req.session.adminUsername}`);
    
    res.json({
      success: true,
      message: 'Servico excluido com sucesso'
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao excluir servico:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir servico'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// ROTA: OBTER ESTATISTICAS DO DASHBOARD
// ============================================================
// GET /api/admin/stats

router.get('/stats', requireAuth, async (req, res) => {
  const db = getDb();
  
  try {
    // Contagem de mensagens nao lidas
    const unreadMessages = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM messages WHERE is_read = 0',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    // Contagem de agendamentos pendentes
    const pendingBookings = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM booking_requests WHERE status = ?',
        ['pending'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Total de agendamentos recebidos
    const totalBookings = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM booking_requests',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    // Total de depoimentos ativos
    const activeTestimonials = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM testimonials WHERE is_active = 1',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    // Total de servicos ativos
    const activeServices = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM services WHERE is_active = 1',
        [],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    
    res.json({
      success: true,
      data: {
        unreadMessages,
        pendingBookings,
        totalBookings,
        activeTestimonials,
        activeServices
      }
    });
    
  } catch (error) {
    console.error('[ERROR] Erro ao buscar estatisticas:', error.message);
    res.status(500).json({
      success: false,
      message: 'Erro ao carregar estatisticas'
    });
  } finally {
    db.close();
  }
});

// ============================================================
// EXPORTACAO DO ROUTER
// ============================================================

module.exports = router;
