/**
 * ============================================================
   JAVASCRIPT DO LOGIN ADMIN
 * ============================================================
 * 
 * Funcionalidades:
 * - Validação de formulário
 * - Toggle de visibilidade da senha
 * - Envio de credenciais
 * - Tratamento de erros
 * 
 * @author Desenvolvedor Full Stack
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================================
  // CONFIGURACOES
  // ============================================================
  
  const CONFIG = {
    apiUrl: '/api/admin'
  };

  // ============================================================
  // ELEMENTOS DOM
  // ============================================================
  
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('passwordToggle');
  const submitBtn = document.getElementById('submitBtn');
  const formStatus = document.getElementById('formStatus');

  // ============================================================
  // TOGGLE DE VISIBILIDADE DA SENHA
  // ============================================================
  
  if (passwordToggle) {
    passwordToggle.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      passwordToggle.setAttribute('aria-pressed', isPassword);
      
      // Toggle icones
      const eyeIcon = passwordToggle.querySelector('.icon-eye');
      const eyeOffIcon = passwordToggle.querySelector('.icon-eye-off');
      
      if (eyeIcon && eyeOffIcon) {
        eyeIcon.classList.toggle('hidden', isPassword);
        eyeOffIcon.classList.toggle('hidden', !isPassword);
      }
    });
  }

  // ============================================================
  // VALIDACAO DO FORMULARIO
  // ============================================================
  
  function validateForm() {
    let isValid = true;
    
    // Valida username
    const username = usernameInput.value.trim();
    if (!username) {
      showFieldError(usernameInput, 'Usuário é obrigatório');
      isValid = false;
    } else if (username.length < 3) {
      showFieldError(usernameInput, 'Usuário deve ter pelo menos 3 caracteres');
      isValid = false;
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      showFieldError(usernameInput, 'Usuário contém caracteres inválidos');
      isValid = false;
    } else {
      clearFieldError(usernameInput);
    }
    
    // Valida senha
    const password = passwordInput.value;
    if (!password) {
      showFieldError(passwordInput, 'Senha é obrigatória');
      isValid = false;
    } else if (password.length < 6) {
      showFieldError(passwordInput, 'Senha deve ter pelo menos 6 caracteres');
      isValid = false;
    } else {
      clearFieldError(passwordInput);
    }
    
    return isValid;
  }

  function showFieldError(input, message) {
    input.classList.add('error');
    
    // Procura ou cria elemento de erro
    let errorEl = input.parentElement.querySelector('.field-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'field-error';
      input.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  function clearFieldError(input) {
    input.classList.remove('error');
    const errorEl = input.parentElement.querySelector('.field-error');
    if (errorEl) {
      errorEl.remove();
    }
  }

  // ============================================================
  // ENVIO DO FORMULARIO
  // ============================================================
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Limpa mensagem anterior
      formStatus.className = 'form-status';
      formStatus.textContent = '';
      
      // Valida
      if (!validateForm()) {
        return;
      }
      
      // Prepara dados
      const formData = {
        username: usernameInput.value.trim(),
        password: passwordInput.value
      };
      
      // Mostra loading
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;
      
      try {
        const response = await fetch(`${CONFIG.apiUrl}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Login bem-sucedido
          formStatus.className = 'form-status success';
          formStatus.textContent = 'Login realizado com sucesso! Redirecionando...';
          
          // Redireciona para dashboard
          setTimeout(() => {
            window.location.href = data.data?.redirect || '/admin/dashboard';
          }, 500);
        } else {
          // Login falhou
          formStatus.className = 'form-status error';
          formStatus.textContent = data.message || 'Usuário ou senha inválidos';
          
          // Limpa senha
          passwordInput.value = '';
          passwordInput.focus();
        }
        
      } catch (error) {
        console.error('Erro no login:', error);
        formStatus.className = 'form-status error';
        formStatus.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }

  // ============================================================
  // LIMPA ERROS EM TEMPO REAL
  // ============================================================
  
  [usernameInput, passwordInput].forEach(input => {
    if (input) {
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) {
          clearFieldError(input);
        }
      });
    }
  });

  // ============================================================
  // VERIFICA SESSAO EXISTENTE
  // ============================================================
  
  async function checkSession() {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/session`);
      const data = await response.json();
      
      if (data.success && data.data?.isAuthenticated) {
        // Ja autenticado, redireciona
        window.location.href = '/admin/dashboard';
      }
    } catch (error) {
      // Silenciosamente ignora erro
      console.log('Sessão não encontrada');
    }
  }

  // Verifica sessão ao carregar
  checkSession();

  console.log('Login page inicializado');

})();

