/**
 * ============================================================
 * VALIDADORES DE ENTRADA
 * ============================================================
 * 
 * Validacoes de dados usando express-validator.
 * Previne injecao de codigo e garante dados consistentes.
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

const { body, param, validationResult } = require('express-validator');

// ============================================================
// HELPER: VERIFICAR RESULTADO DA VALIDACAO
// ============================================================

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Dados invalidos. Verifique os campos e tente novamente.',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
};

// ============================================================
// VALIDACOES DE CONTATO
// ============================================================

const contactValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome e obrigatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[\p{L}\s'-]+$/u).withMessage('Nome contem caracteres invalidos'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('E-mail e obrigatorio')
    .isEmail().withMessage('E-mail invalido')
    .normalizeEmail()
    .isLength({ max: 100 }).withMessage('E-mail muito longo'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\(\)\-\+]+$/).withMessage('Telefone contem caracteres invalidos')
    .isLength({ min: 10, max: 20 }).withMessage('Telefone deve ter entre 10 e 20 caracteres'),
  
  body('subject')
    .trim()
    .notEmpty().withMessage('Assunto e obrigatorio')
    .isLength({ min: 3, max: 100 }).withMessage('Assunto deve ter entre 3 e 100 caracteres')
    .escape(), // Escapa HTML para prevenir XSS
  
  body('message')
    .trim()
    .notEmpty().withMessage('Mensagem e obrigatoria')
    .isLength({ min: 10, max: 2000 }).withMessage('Mensagem deve ter entre 10 e 2000 caracteres')
    .escape(), // Escapa HTML para prevenir XSS
  
  handleValidationErrors
];

// ============================================================
// VALIDACOES DE AGENDAMENTO
// ============================================================

const bookingValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome e obrigatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[\p{L}\s'-]+$/u).withMessage('Nome contem caracteres invalidos'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('E-mail e obrigatorio')
    .isEmail().withMessage('E-mail invalido')
    .normalizeEmail()
    .isLength({ max: 100 }).withMessage('E-mail muito longo'),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Telefone e obrigatorio')
    .matches(/^[\d\s\(\)\-\+]+$/).withMessage('Telefone contem caracteres invalidos')
    .isLength({ min: 10, max: 20 }).withMessage('Telefone deve ter entre 10 e 20 caracteres'),
  
  body('preferredDate')
    .optional()
    .isISO8601().withMessage('Data invalida')
    .custom((value) => {
      // Parse local para evitar problema de fuso com string YYYY-MM-DD
      const parts = String(value).split('-').map(Number);
      if (parts.length !== 3 || parts.some(Number.isNaN)) {
        throw new Error('Data invalida');
      }
      const date = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        throw new Error('Data nao pode ser no passado');
      }
      // Limita agendamento a 90 dias no futuro
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      if (date > maxDate) {
        throw new Error('Agendamento permitido apenas ate 90 dias no futuro');
      }
      return true;
    }),
  
  body('preferredTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Horario invalido (use formato HH:MM)'),
  
  body('serviceType')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Tipo de servico muito longo')
    .escape(),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Observacoes devem ter no maximo 1000 caracteres')
    .escape(),
  
  handleValidationErrors
];

// ============================================================
// VALIDACOES DE LOGIN
// ============================================================

const loginValidation = [
  body('username')
    .trim()
    .notEmpty().withMessage('Usuario e obrigatorio')
    .isLength({ min: 3, max: 50 }).withMessage('Usuario deve ter entre 3 e 50 caracteres')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Usuario contem caracteres invalidos'),
  
  body('password')
    .notEmpty().withMessage('Senha e obrigatoria')
    .isLength({ min: 6, max: 128 }).withMessage('Senha deve ter entre 6 e 128 caracteres'),
  
  handleValidationErrors
];

// ============================================================
// VALIDACOES DE DEPOIMENTOS
// ============================================================

const testimonialValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome e obrigatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[\p{L}\s'-]+$/u).withMessage('Nome contem caracteres invalidos'),
  
  body('text')
    .trim()
    .notEmpty().withMessage('Texto do depoimento e obrigatorio')
    .isLength({ min: 10, max: 1000 }).withMessage('Depoimento deve ter entre 10 e 1000 caracteres')
    .escape(),
  
  body('rating')
    .optional()
    .isInt({ min: 0, max: 5 }).withMessage('Avaliacao deve ser entre 0 e 5'),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('Status ativo deve ser booleano'),
  
  handleValidationErrors
];

// ============================================================
// VALIDACOES DE DEPOIMENTO PUBLICO
// ============================================================

const publicTestimonialValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Nome e obrigatorio')
    .isLength({ min: 2, max: 100 }).withMessage('Nome deve ter entre 2 e 100 caracteres')
    .matches(/^[\p{L}\s'-]+$/u).withMessage('Nome contem caracteres invalidos'),
  
  body('text')
    .trim()
    .notEmpty().withMessage('Depoimento e obrigatorio')
    .isLength({ min: 10, max: 1000 }).withMessage('Depoimento deve ter entre 10 e 1000 caracteres')
    .escape(),
  
  body('rating')
    .notEmpty().withMessage('Avaliacao e obrigatoria')
    .isInt({ min: 0, max: 5 }).withMessage('Avaliacao deve ser entre 0 e 5'),
  
  handleValidationErrors
];

// ============================================================
// VALIDACOES DE SERVICOS
// ============================================================

const serviceValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Titulo e obrigatorio')
    .isLength({ min: 3, max: 100 }).withMessage('Titulo deve ter entre 3 e 100 caracteres')
    .escape(),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Descricao e obrigatoria')
    .isLength({ min: 10, max: 500 }).withMessage('Descricao deve ter entre 10 e 500 caracteres')
    .escape(),
  
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 16 }).withMessage('Icone muito longo')
    .escape(),
  
  body('orderIndex')
    .optional()
    .isInt({ min: 0, max: 999 }).withMessage('Ordem deve ser um numero inteiro positivo'),
  
  body('isActive')
    .optional()
    .isBoolean().withMessage('Status ativo deve ser booleano'),
  
  handleValidationErrors
];

// ============================================================
// VALIDACOES DE CONTEUDO DO SITE
// ============================================================

const contentValidation = [
  body('heroTitle')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Titulo do hero muito longo')
    .escape(),
  
  body('heroSubtitle')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Subtitulo do hero muito longo')
    .escape(),

  body('heroImageUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('URL da imagem do hero invalida')
    .isLength({ max: 500 }).withMessage('URL da imagem do hero muito longa'),

  body('aboutImageUrl')
    .optional()
    .trim()
    .isURL({ protocols: ['http', 'https'], require_protocol: true }).withMessage('URL da imagem do sobre invalida')
    .isLength({ max: 500 }).withMessage('URL da imagem do sobre muito longa'),
  
  body('whatsappNumber')
    .optional()
    .trim()
    .matches(/^\d{10,15}$/).withMessage('Numero do WhatsApp invalido (apenas numeros)'),
  
  body('instagramUrl')
    .optional()
    .trim()
    .isURL().withMessage('URL do Instagram invalida')
    .isLength({ max: 200 }).withMessage('URL muito longa'),
  
  body('facebookUrl')
    .optional()
    .trim()
    .isURL().withMessage('URL do Facebook invalida')
    .isLength({ max: 200 }).withMessage('URL muito longa'),
  
  body('emailContact')
    .optional()
    .trim()
    .isEmail().withMessage('E-mail de contato invalido')
    .normalizeEmail(),
  
  handleValidationErrors
];

// ============================================================
// VALIDACAO DE ID EM PARAMETROS
// ============================================================

const idParamValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID invalido'),
  
  handleValidationErrors
];

// ============================================================
// EXPORTACOES
// ============================================================

module.exports = {
  contactValidation,
  bookingValidation,
  loginValidation,
  testimonialValidation,
  publicTestimonialValidation,
  serviceValidation,
  contentValidation,
  idParamValidation,
  handleValidationErrors
};
