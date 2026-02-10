/**
 * ============================================================
 * MIDDLEWARE DE TRATAMENTO DE ERROS
 * ============================================================
 * 
 * Handlers centralizados para erros da aplicacao.
 * Garante que erros nao exponham informacoes sensiveis
 * e retornam respostas apropriadas ao cliente.
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

// ============================================================
// HANDLER: ROTA NAO ENCONTRADA (404)
// ============================================================

function notFound(req, res, next) {
  const error = new Error(`Rota nao encontrada: ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

// ============================================================
// HANDLER: ERROS GLOBAIS
// ============================================================

function errorHandler(err, req, res, next) {
  // Define status code (padrao 500)
  const statusCode = err.status || err.statusCode || 500;
  
  // Determina se estamos em ambiente de desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Log do erro (sempre loga no servidor, nunca expoe ao cliente em producao)
  console.error(`[ERROR ${statusCode}] ${err.message}`);
  if (isDevelopment) {
    console.error(err.stack);
  }
  
  // Mensagem de erro para o cliente
  // Em producao, nao expoe detalhes do erro
  let message = err.message;
  if (statusCode === 500 && !isDevelopment) {
    message = 'Erro interno do servidor. Tente novamente mais tarde.';
  }
  
  // Resposta JSON para requisicoes AJAX/API
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(statusCode).json({
      success: false,
      message: message,
      // Apenas em desenvolvimento inclui detalhes
      ...(isDevelopment && {
        stack: err.stack,
        details: err.details || null
      })
    });
  }
  
  // Resposta HTML para navegacao normal
  // Em producao, renderiza pagina de erro generica
  res.status(statusCode).send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Erro ${statusCode} - Fisioterapia</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .error-container {
          background: white;
          border-radius: 16px;
          padding: 48px;
          text-align: center;
          max-width: 480px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .error-code {
          font-size: 96px;
          font-weight: 700;
          color: #2a9d8f;
          line-height: 1;
          margin-bottom: 16px;
        }
        .error-title {
          font-size: 24px;
          color: #264653;
          margin-bottom: 16px;
        }
        .error-message {
          color: #6c757d;
          margin-bottom: 32px;
          line-height: 1.6;
        }
        .error-button {
          display: inline-block;
          background: #2a9d8f;
          color: white;
          padding: 14px 32px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 500;
          transition: background 0.3s ease;
        }
        .error-button:hover {
          background: #21867a;
        }
        @media (max-width: 480px) {
          .error-container { padding: 32px 24px; }
          .error-code { font-size: 72px; }
          .error-title { font-size: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <div class="error-code">${statusCode}</div>
        <h1 class="error-title">${statusCode === 404 ? 'Pagina nao encontrada' : 'Ocorreu um erro'}</h1>
        <p class="error-message">${message}</p>
        <a href="/" class="error-button">Voltar para o inicio</a>
      </div>
    </body>
    </html>
  `);
}

// ============================================================
// HANDLER: ERROS DE VALIDACAO
// ============================================================
// Para erros do express-validator

function validationErrorHandler(err, req, res, next) {
  if (err.name === 'ValidationError' || err.array) {
    return res.status(400).json({
      success: false,
      message: 'Dados invalidos',
      errors: err.array ? err.array() : err.errors
    });
  }
  next(err);
}

// ============================================================
// HANDLER: ERROS CSRF
// ============================================================

function csrfErrorHandler(err, req, res, next) {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('[CSRF ERROR] Token CSRF invalido ou ausente');
    return res.status(403).json({
      success: false,
      message: 'Token de seguranca invalido. Recarregue a pagina e tente novamente.'
    });
  }
  next(err);
}

// ============================================================
// EXPORTACOES
// ============================================================

module.exports = {
  notFound,
  errorHandler,
  validationErrorHandler,
  csrfErrorHandler
};
