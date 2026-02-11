/**
 * ============================================================
 * JAVASCRIPT DO DASHBOARD ADMIN
 * ============================================================
 * 
 * Funcionalidades:
 * - Navegação entre secoes
 * - Gerenciamento de mensagens
 * - Gerenciamento de agendamentos
 * - Gerenciamento de depoimentos (CRUD)
 * - Gerenciamento de serviços (CRUD)
 * - Edicao de conteúdo do site
 * - Modais e confirmações
 * - Toast notifications
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
    apiUrl: '/api/admin',
    contentApiUrl: '/api/content',
    itemsPerPage: 10
  };

  // ============================================================
  // ESTADO GLOBAL
  // ============================================================
  
  const state = {
    currentSection: 'dashboard',
    messages: [],
    bookings: [],
    testimonials: [],
    services: [],
    content: {},
    pagination: {
      messages: { page: 1, total: 0 },
      bookings: { page: 1, total: 0 }
    },
    deleteCallback: null
  };

  const SECTION_TITLES = {
    dashboard: 'Dashboard',
    messages: 'Mensagens',
    bookings: 'Agendamentos',
    testimonials: 'Depoimentos',
    services: 'Serviços',
    content: 'Conteúdo',
    contacts: 'Contatos'
  };

  // ============================================================
  // UTILITARIOS
  // ============================================================

  /**
   * Formata data para exibicao
   */
  function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatDateOnly(dateString) {
    if (!dateString) return '-';
    const [year, month, day] = String(dateString).split('-');
    if (!year || !month || !day) return formatDate(dateString).split(' ')[0] || '-';
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
  }

  /**
   * Escapa HTML para prevenir XSS
   */
  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Trunca texto
   */
  function truncate(text, length = 50) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }

  function isTruthySetting(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function setCheckboxValue(id, checked) {
    const el = document.getElementById(id);
    if (el) el.checked = !!checked;
  }

  function setFormStatus(statusId, message, type) {
    const el = document.getElementById(statusId);
    if (!el) return;
    el.className = `form-status ${type}`;
    el.textContent = message;
  }

  function parseWeekdaysCsv(value) {
    return String(value || '')
      .split(',')
      .map((item) => parseInt(item.trim(), 10))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
  }

  function setWeekdayCheckboxes(csvValue) {
    const selected = new Set(parseWeekdaysCsv(csvValue));
    document.querySelectorAll('.booking-weekday').forEach((checkbox) => {
      const weekday = parseInt(checkbox.value, 10);
      checkbox.checked = selected.has(weekday);
    });
  }

  function getSelectedWeekdaysCsv() {
    const values = Array.from(document.querySelectorAll('.booking-weekday:checked'))
      .map((checkbox) => parseInt(checkbox.value, 10))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      .sort((a, b) => a - b);

    return values.join(',');
  }

  function normalizeBlockedDates(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
      .join(',');
  }

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================

  function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        ${type === 'success' 
          ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
          : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
        }
      </svg>
      <div class="toast-content">
        <div class="toast-title">${type === 'success' ? 'Sucesso' : 'Erro'}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
      <button class="toast-close" aria-label="Fechar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    
    container.appendChild(toast);
    
    // Fecha ao clicar
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.remove();
    });
    
    // Remove automaticamente apos 5 segundos
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }

  // ============================================================
  // NAVEGACAO
  // ============================================================

  function activateSection(section, shouldLoadData = true) {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    const contentSections = document.querySelectorAll('.content-section');
    const pageTitle = document.getElementById('pageTitle');
    const targetSection = document.getElementById(`${section}Section`);
    if (!targetSection) return;

    state.currentSection = section;

    sidebarLinks.forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (activeLink) activeLink.classList.add('active');

    contentSections.forEach(s => s.classList.remove('active'));
    targetSection.classList.add('active');

    if (pageTitle) {
      pageTitle.textContent = SECTION_TITLES[section] || 'Dashboard';
    }

    closeSidebar();

    if (shouldLoadData) {
      loadSectionData(section);
    }
  }

  function resolveInitialSection() {
    const pathname = window.location.pathname.toLowerCase();
    if (pathname === '/admin/contatos' || pathname === '/admin/contatos/') {
      return 'contacts';
    }

    const hash = window.location.hash.replace('#', '').toLowerCase();
    const hashMap = {
      dashboard: 'dashboard',
      mensagens: 'messages',
      messages: 'messages',
      agendamentos: 'bookings',
      bookings: 'bookings',
      depoimentos: 'testimonials',
      testimonials: 'testimonials',
      serviços: 'services',
      services: 'services',
      conteúdo: 'content',
      content: 'content',
      contatos: 'contacts',
      contacts: 'contacts'
    };

    return hashMap[hash] || 'dashboard';
  }

  function initNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar-link');

    sidebarLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.dataset.section;
        activateSection(section);
      });
    });
    
    // Quick actions
    document.querySelectorAll('.quick-action').forEach(action => {
      action.addEventListener('click', (e) => {
        e.preventDefault();
        const section = action.dataset.section;
        activateSection(section);
      });
    });
  }

  // ============================================================
  // SIDEBAR MOBILE
  // ============================================================

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function initSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    function openSidebar() {
      sidebar.classList.add('open');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    
    window.closeSidebar = closeSidebar;
    
    menuToggle?.addEventListener('click', openSidebar);
    sidebarClose?.addEventListener('click', closeSidebar);
    overlay?.addEventListener('click', closeSidebar);
  }

  // ============================================================
  // CARREGAMENTO DE DADOS
  // ============================================================

  async function loadSectionData(section) {
    switch (section) {
      case 'dashboard':
        await loadStats();
        break;
      case 'messages':
        await loadMessages();
        break;
      case 'bookings':
        await loadBookings();
        await loadStats();
        break;
      case 'testimonials':
        await loadTestimonials();
        break;
      case 'services':
        await loadServices();
        break;
      case 'content':
        await loadContent();
        break;
      case 'contacts':
        await loadContacts();
        break;
    }
  }

  // ============================================================
  // ESTATISTICAS
  // ============================================================

  async function loadStats() {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/stats`);
      const data = await response.json();
      
      if (data.success) {
        document.getElementById('statMessages').textContent = data.data.unreadMessages;
        document.getElementById('statBookings').textContent = data.data.totalBookings ?? data.data.pendingBookings;
        document.getElementById('statTestimonials').textContent = data.data.activeTestimonials;
        document.getElementById('statServices').textContent = data.data.activeServices;
        
        // Atualiza badges da sidebar
        document.getElementById('messagesBadge').textContent = data.data.unreadMessages;
        document.getElementById('bookingsBadge').textContent = data.data.pendingBookings;
        renderDashboardChart(data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatisticas:', error);
    }
  }

  function renderDashboardChart(stats) {
    const dashboardLimit = Number(stats.dashboardLimit || 1000);
    const values = {
      messages: Number(stats.totalMessages ?? stats.unreadMessages ?? 0),
      bookings: Number(stats.totalBookings ?? stats.pendingBookings ?? 0),
      testimonials: Number(stats.activeTestimonials || 0)
    };

    const chartConfig = [
      { valueId: 'chartMessagesValue', fillId: 'chartMessagesFill', value: values.messages },
      { valueId: 'chartBookingsValue', fillId: 'chartBookingsFill', value: values.bookings },
      { valueId: 'chartCommentsValue', fillId: 'chartCommentsFill', value: values.testimonials }
    ];

    chartConfig.forEach((item) => {
      const valueEl = document.getElementById(item.valueId);
      const fillEl = document.getElementById(item.fillId);
      const percentage = dashboardLimit > 0
        ? Math.min(100, (item.value / dashboardLimit) * 100)
        : 0;
      const formattedPercent = percentage.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });
      if (valueEl) valueEl.textContent = `${item.value} / ${dashboardLimit} (${formattedPercent}%)`;
      if (fillEl) {
        fillEl.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
      }
    });
  }

  // ============================================================
  // MENSAGENS
  // ============================================================

  async function loadMessages(page = 1) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/messages?page=${page}&limit=${CONFIG.itemsPerPage}`);
      const data = await response.json();
      
      if (data.success) {
        state.messages = data.data;
        state.pagination.messages = data.pagination;
        renderMessages();
        renderPagination('messages', data.pagination, loadMessages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      showToast('Erro ao carregar mensagens', 'error');
    }
  }

  function renderMessages() {
    const tbody = document.querySelector('#messagesTable tbody');
    tbody.innerHTML = state.messages.map(msg => `
      <tr data-id="${msg.id}">
        <td>
          <span class="status-badge ${msg.is_read ? 'status-read' : 'status-unread'}">
            ${msg.is_read ? 'Lida' : 'Nova'}
          </span>
        </td>
        <td>${escapeHtml(msg.name)}</td>
        <td>${escapeHtml(truncate(msg.subject, 30))}</td>
        <td>${formatDate(msg.created_at)}</td>
        <td>
          <div class="table-actions">
            <button class="table-btn view-message" aria-label="Ver mensagem" data-id="${msg.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="table-btn delete-message" aria-label="Excluir" data-id="${msg.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    
    // Event listeners
    tbody.querySelectorAll('.view-message').forEach(btn => {
      btn.addEventListener('click', () => viewMessage(btn.dataset.id));
    });
    
    tbody.querySelectorAll('.delete-message').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteMessage(btn.dataset.id));
    });
  }

  async function viewMessage(id) {
    const msg = state.messages.find(m => m.id == id);
    if (!msg) return;
    
    // Marca como lida se não estiver
    if (!msg.is_read) {
      try {
        await fetch(`${CONFIG.apiUrl}/messages/${id}/read`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true })
        });
        msg.is_read = true;
        renderMessages();
        loadStats();
      } catch (error) {
        console.error('Erro ao marcar como lida:', error);
      }
    }
    
    // Preenche modal
    document.getElementById('messageDetails').innerHTML = `
      <div class="message-field">
        <span class="message-label">De</span>
        <span class="message-value">${escapeHtml(msg.name)} &lt;${escapeHtml(msg.email)}&gt;</span>
      </div>
      ${msg.phone ? `
      <div class="message-field">
        <span class="message-label">Telefone</span>
        <span class="message-value">${escapeHtml(msg.phone)}</span>
      </div>
      ` : ''}
      <div class="message-field">
        <span class="message-label">Assunto</span>
        <span class="message-value">${escapeHtml(msg.subject)}</span>
      </div>
      <div class="message-field">
        <span class="message-label">Data</span>
        <span class="message-value">${formatDate(msg.created_at)}</span>
      </div>
      <div class="message-field">
        <span class="message-label">Mensagem</span>
        <div class="message-value message-text">${escapeHtml(msg.message)}</div>
      </div>
    `;
    
    // Configura botao de exclusao
    document.getElementById('deleteMessageBtn').onclick = () => {
      closeModal('messageModal');
      confirmDeleteMessage(id);
    };
    
    openModal('messageModal');
  }

  function confirmDeleteMessage(id) {
    state.deleteCallback = () => deleteMessage(id);
    openModal('confirmModal');
  }

  async function deleteMessage(id) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/messages/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Mensagem excluida com sucesso');
        loadMessages(state.pagination.messages.page);
        loadStats();
      } else {
        showToast(data.message || 'Erro ao excluir mensagem', 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir mensagem:', error);
      showToast('Erro ao excluir mensagem', 'error');
    }
    
    closeModal('confirmModal');
  }

  // ============================================================
  // AGENDAMENTOS
  // ============================================================

  async function loadBookings(page = 1, status = 'all') {
    try {
      if (!state.services.length) {
        await loadServices(true);
      }
      const url = `${CONFIG.apiUrl}/bookings?page=${page}&limit=${CONFIG.itemsPerPage}&status=${status}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        state.bookings = data.data;
        state.pagination.bookings = data.pagination;
        renderBookings();
        renderPagination('bookings', data.pagination, (p) => loadBookings(p, status));
      }
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
      showToast('Erro ao carregar agendamentos', 'error');
    }
  }

  function renderBookings() {
    const tbody = document.querySelector('#bookingsTable tbody');
    const activeServiceTitles = state.services
      .filter((service) => service.is_active)
      .map((service) => service.title);

    const getServiceOptions = (currentService) => {
      const options = new Set(activeServiceTitles);
      if (currentService) options.add(currentService);
      const optionList = Array.from(options);
      if (!optionList.length) {
        return '<option value="">Sem servicos ativos</option>';
      }
      return optionList.map((title) => (
        `<option value="${escapeHtml(title)}" ${title === currentService ? 'selected' : ''}>${escapeHtml(title)}</option>`
      )).join('');
    };

    tbody.innerHTML = state.bookings.map(booking => `
      <tr data-id="${booking.id}">
        <td>
          <div><strong>${escapeHtml(booking.name)}</strong></div>
          ${booking.notes ? `<div class="table-subtext">${escapeHtml(truncate(booking.notes, 90))}</div>` : ''}
        </td>
        <td>
          <select class="filter-select booking-service-select" data-id="${booking.id}">
            ${getServiceOptions(booking.service_type)}
          </select>
        </td>
        <td>${booking.preferred_date ? formatDateOnly(booking.preferred_date) : '-'}</td>
        <td>
          <span class="status-badge status-${booking.status}">
            ${getStatusLabel(booking.status)}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <select class="filter-select status-select" data-id="${booking.id}">
              <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>Pendente</option>
              <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>Confirmado</option>
              <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>Concluido</option>
              <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>Cancelado</option>
            </select>
            ${['completed', 'cancelled'].includes(booking.status) ? `
              <button class="table-btn delete delete-booking" aria-label="Excluir agendamento" data-id="${booking.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
    
    // Event listeners para mudanca de status
    tbody.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', () => updateBookingStatus(select.dataset.id, select.value));
    });

    tbody.querySelectorAll('.booking-service-select').forEach((select) => {
      select.addEventListener('change', () => updateBookingService(select.dataset.id, select.value));
    });

    tbody.querySelectorAll('.delete-booking').forEach((btn) => {
      btn.addEventListener('click', () => confirmDeleteBooking(btn.dataset.id));
    });

    const pendingCount = state.bookings.filter((b) => b.status === 'pending').length;
    const bookingsBadge = document.getElementById('bookingsBadge');
    if (bookingsBadge) {
      bookingsBadge.textContent = String(pendingCount);
    }
  }

  function getStatusLabel(status) {
    const labels = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      completed: 'Concluido',
      cancelled: 'Cancelado'
    };
    return labels[status] || status;
  }

  async function updateBookingStatus(id, status) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/bookings/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Status atualizado com sucesso');
        loadBookings(state.pagination.bookings.page);
        loadStats();
      } else {
        showToast(data.message || 'Erro ao atualizar status', 'error');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showToast('Erro ao atualizar status', 'error');
    }
  }

  async function updateBookingService(id, serviceType) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/bookings/${id}/service`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType })
      });
      const data = await response.json();

      if (data.success) {
        showToast('Servico do agendamento atualizado com sucesso');
        loadBookings(state.pagination.bookings.page, document.getElementById('bookingFilter')?.value || 'all');
      } else {
        showToast(data.message || 'Erro ao atualizar servico do agendamento', 'error');
      }
    } catch (error) {
      console.error('Erro ao atualizar servico do agendamento:', error);
      showToast('Erro ao atualizar servico do agendamento', 'error');
    }
  }

  function confirmDeleteBooking(id) {
    state.deleteCallback = () => deleteBooking(id);
    openModal('confirmModal');
  }

  async function deleteBooking(id) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/bookings/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        showToast('Agendamento excluido com sucesso');
        loadBookings(state.pagination.bookings.page, document.getElementById('bookingFilter')?.value || 'all');
        loadStats();
      } else {
        showToast(data.message || 'Erro ao excluir agendamento', 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir agendamento:', error);
      showToast('Erro ao excluir agendamento', 'error');
    }

    closeModal('confirmModal');
  }

  // Filtro de agendamentos
  document.getElementById('bookingFilter')?.addEventListener('change', (e) => {
    loadBookings(1, e.target.value);
  });

  // ============================================================
  // DEPOIMENTOS
  // ============================================================

  async function loadTestimonials() {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/testimonials`);
      const data = await response.json();
      
      if (data.success) {
        state.testimonials = data.data;
        renderTestimonials();
      }
    } catch (error) {
      console.error('Erro ao carregar depoimentos:', error);
      showToast('Erro ao carregar depoimentos', 'error');
    }
  }

  function renderTestimonials() {
    const grid = document.getElementById('testimonialsGrid');
    grid.innerHTML = state.testimonials.map(t => `
      <div class="admin-card" data-id="${t.id}">
        <div class="admin-card-header">
          <h4 class="admin-card-title">${escapeHtml(t.name)}</h4>
          <div class="admin-card-actions">
            <button class="admin-card-btn edit-testimonial" data-id="${t.id}" aria-label="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="admin-card-btn delete delete-testimonial" data-id="${t.id}" aria-label="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="admin-card-content">${escapeHtml(truncate(t.text, 100))}</div>
        <div class="admin-card-meta">
          <span>${'*'.repeat(t.rating)}</span>
          <span>-</span>
          <span>${t.is_active ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
    `).join('');
    
    // Event listeners
    grid.querySelectorAll('.edit-testimonial').forEach(btn => {
      btn.addEventListener('click', () => openTestimonialModal(btn.dataset.id));
    });
    
    grid.querySelectorAll('.delete-testimonial').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteTestimonial(btn.dataset.id));
    });
  }

  function openTestimonialModal(id = null) {
    if (!id) return;
    const modal = document.getElementById('testimonialModal');
    const form = document.getElementById('testimonialForm');
    const title = document.getElementById('testimonialModalTitle');
    
    form.reset();
    document.getElementById('testimonialId').value = '';
    
    if (id) {
      const t = state.testimonials.find(item => item.id == id);
      if (t) {
        title.textContent = 'Editar Depoimento';
        document.getElementById('testimonialId').value = t.id;
        document.getElementById('testimonialName').value = t.name;
        document.getElementById('testimonialText').value = t.text;
        document.getElementById('testimonialRating').value = t.rating;
        document.getElementById('testimonialActive').checked = t.is_active;
      }
    }
    
    openModal('testimonialModal');
  }

  document.getElementById('testimonialForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('testimonialId').value;
    if (!id) {
      showToast('Não é permitido criar depoimentos manualmente no admin.', 'error');
      return;
    }
    const data = {
      name: document.getElementById('testimonialName').value,
      text: document.getElementById('testimonialText').value,
      rating: parseInt(document.getElementById('testimonialRating').value),
      isActive: document.getElementById('testimonialActive').checked
    };
    
    try {
      const url = `${CONFIG.apiUrl}/testimonials/${id}`;
      const method = 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast('Depoimento atualizado com sucesso');
        closeModal('testimonialModal');
        loadTestimonials();
        loadStats();
      } else {
        showToast(result.message || 'Erro ao salvar depoimento', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar depoimento:', error);
      showToast('Erro ao salvar depoimento', 'error');
    }
  });

  function confirmDeleteTestimonial(id) {
    state.deleteCallback = () => deleteTestimonial(id);
    openModal('confirmModal');
  }

  async function deleteTestimonial(id) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/testimonials/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Depoimento excluido com sucesso');
        loadTestimonials();
        loadStats();
      } else {
        showToast(data.message || 'Erro ao excluir depoimento', 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir depoimento:', error);
      showToast('Erro ao excluir depoimento', 'error');
    }
    
    closeModal('confirmModal');
  }

  // ============================================================
  // SERVICOS
  // ============================================================

  async function loadServices(silent = false) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/services`);
      const data = await response.json();
      
      if (data.success) {
        state.services = data.data;
        renderServices();
      }
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      if (!silent) {
        showToast('Erro ao carregar serviços', 'error');
      }
    }
  }

  function renderServices() {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = state.services.map(s => `
      <div class="admin-card" data-id="${s.id}">
        <div class="admin-card-header">
          <h4 class="admin-card-title">${escapeHtml(s.icon || '+')} ${escapeHtml(s.title)}</h4>
          <div class="admin-card-actions">
            <button class="admin-card-btn edit-service" data-id="${s.id}" aria-label="Editar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="admin-card-btn delete delete-service" data-id="${s.id}" aria-label="Excluir">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="admin-card-content">${escapeHtml(truncate(s.description, 100))}</div>
        <div class="admin-card-meta">
          <span>Ordem: ${s.order_index}</span>
          <span>-</span>
          <span>${s.is_active ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>
    `).join('');
    
    // Event listeners
    grid.querySelectorAll('.edit-service').forEach(btn => {
      btn.addEventListener('click', () => openServiceModal(btn.dataset.id));
    });
    
    grid.querySelectorAll('.delete-service').forEach(btn => {
      btn.addEventListener('click', () => confirmDeleteService(btn.dataset.id));
    });
  }

  function openServiceModal(id = null) {
    const modal = document.getElementById('serviceModal');
    const form = document.getElementById('serviceForm');
    const title = document.getElementById('serviceModalTitle');
    
    form.reset();
    document.getElementById('serviceId').value = '';
    
    if (id) {
      const s = state.services.find(item => item.id == id);
      if (s) {
        title.textContent = 'Editar Serviço';
        document.getElementById('serviceId').value = s.id;
        document.getElementById('serviceTitle').value = s.title;
        document.getElementById('serviceDescription').value = s.description;
        document.getElementById('serviceIcon').value = s.icon || '';
        document.getElementById('serviceOrder').value = s.order_index;
        document.getElementById('serviceActive').checked = s.is_active;
      }
    } else {
      title.textContent = 'Adicionar Serviço';
    }
    
    openModal('serviceModal');
  }

  document.getElementById('addServiceBtn')?.addEventListener('click', () => openServiceModal());

  document.getElementById('serviceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('serviceId').value;
    const data = {
      title: document.getElementById('serviceTitle').value,
      description: document.getElementById('serviceDescription').value,
      icon: document.getElementById('serviceIcon').value,
      orderIndex: parseInt(document.getElementById('serviceOrder').value) || 0,
      isActive: document.getElementById('serviceActive').checked
    };
    
    try {
      const url = id ? `${CONFIG.apiUrl}/services/${id}` : `${CONFIG.apiUrl}/services`;
      const method = id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        showToast(id ? 'Serviço atualizado com sucesso' : 'Serviço criado com sucesso');
        closeModal('serviceModal');
        loadServices();
        loadStats();
      } else {
        showToast(result.message || 'Erro ao salvar serviço', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      showToast('Erro ao salvar serviço', 'error');
    }
  });

  function confirmDeleteService(id) {
    state.deleteCallback = () => deleteService(id);
    openModal('confirmModal');
  }

  async function deleteService(id) {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/services/${id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showToast('Serviço excluido com sucesso');
        loadServices();
        loadStats();
      } else {
        showToast(data.message || 'Erro ao excluir serviço', 'error');
      }
    } catch (error) {
      console.error('Erro ao excluir serviço:', error);
      showToast('Erro ao excluir serviço', 'error');
    }
    
    closeModal('confirmModal');
  }

  // ============================================================
  // CONTEUDO DO SITE
  // ============================================================

  async function loadContent() {
    try {
      const response = await fetch(`${CONFIG.contentApiUrl}/settings`);
      const data = await response.json();
      
      if (data.success) {
        state.content = data.data;
        
        // Preenche formulário
        setInputValue('heroTitle', data.data.hero_title);
        setInputValue('heroSubtitle', data.data.hero_subtitle);
        setInputValue('heroImageUrl', data.data.hero_image_url);
        setInputValue('aboutImageUrl', data.data.about_image_url);
        setInputValue('therapistName', data.data.therapist_name);
        setInputValue('therapistCrefito', data.data.therapist_crefito);
        setInputValue('therapistBio', data.data.therapist_bio);
        setInputValue('bookingWorkStart', data.data.booking_work_start || '08:00');
        setInputValue('bookingWorkEnd', data.data.booking_work_end || '18:00');
        setInputValue('bookingSlotIntervalMinutes', data.data.booking_slot_interval_minutes || '60');
        setInputValue('bookingMaxPerSlot', data.data.booking_max_per_slot || '1');
        setInputValue('bookingHorizonDays', data.data.booking_horizon_days || '90');
        setInputValue('bookingBlockedDates', data.data.booking_blocked_dates || '');
        setWeekdayCheckboxes(data.data.booking_enabled_weekdays || '1,2,3,4,5');
        setCheckboxValue('showTestimonials', isTruthySetting(data.data.show_testimonials));
        setCheckboxValue('showGallery', isTruthySetting(data.data.show_gallery));
      }
    } catch (error) {
      console.error('Erro ao carregar conteúdo:', error);
      showToast('Erro ao carregar conteúdo', 'error');
    }
  }

  async function loadContacts() {
    try {
      const response = await fetch(`${CONFIG.contentApiUrl}/settings`);
      const data = await response.json();

      if (data.success) {
        state.content = data.data;

        setInputValue('whatsappNumber', data.data.whatsapp_number);
        setInputValue('phoneContact', data.data.phone_contact);
        setInputValue('emailContact', data.data.email_contact);
        setInputValue('address', data.data.address);
        setInputValue('businessHours', data.data.business_hours);
        setInputValue('instagramUrl', data.data.instagram_url);
        setInputValue('facebookUrl', data.data.facebook_url);
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      showToast('Erro ao carregar contatos', 'error');
    }
  }

  document.getElementById('contentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = document.getElementById('saveContentBtn');
    const workStart = document.getElementById('bookingWorkStart').value || '08:00';
    const workEnd = document.getElementById('bookingWorkEnd').value || '18:00';
    const selectedWeekdaysCsv = getSelectedWeekdaysCsv();

    if (!selectedWeekdaysCsv) {
      setFormStatus('contentStatus', 'Selecione pelo menos um dia da semana para agenda.', 'error');
      showToast('Selecione pelo menos um dia da semana para agenda.', 'error');
      return;
    }

    if (workStart >= workEnd) {
      setFormStatus('contentStatus', 'O fim do expediente deve ser maior que o inicio.', 'error');
      showToast('O fim do expediente deve ser maior que o inicio.', 'error');
      return;
    }
    
    const data = {
      heroTitle: document.getElementById('heroTitle').value,
      heroSubtitle: document.getElementById('heroSubtitle').value,
      heroImageUrl: document.getElementById('heroImageUrl').value,
      aboutImageUrl: document.getElementById('aboutImageUrl').value,
      therapistName: document.getElementById('therapistName').value,
      therapistCrefito: document.getElementById('therapistCrefito').value,
      therapistBio: document.getElementById('therapistBio').value,
      bookingWorkStart: workStart,
      bookingWorkEnd: workEnd,
      bookingSlotIntervalMinutes: parseInt(document.getElementById('bookingSlotIntervalMinutes').value, 10) || 60,
      bookingMaxPerSlot: parseInt(document.getElementById('bookingMaxPerSlot').value, 10) || 1,
      bookingHorizonDays: parseInt(document.getElementById('bookingHorizonDays').value, 10) || 90,
      bookingEnabledWeekdays: selectedWeekdaysCsv,
      bookingBlockedDates: normalizeBlockedDates(document.getElementById('bookingBlockedDates').value),
      showTestimonials: document.getElementById('showTestimonials').checked,
      showGallery: document.getElementById('showGallery').checked
    };
    
    btn.classList.add('loading');
    btn.disabled = true;
    
    try {
      const response = await fetch(`${CONFIG.contentApiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setFormStatus('contentStatus', 'Alterações salvas com sucesso!', 'success');
        showToast('Conteúdo atualizado com sucesso');
      } else {
        setFormStatus('contentStatus', result.message || 'Erro ao salvar alterações', 'error');
        showToast(result.message || 'Erro ao salvar alterações', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar conteúdo:', error);
      setFormStatus('contentStatus', 'Erro de conexão. Tente novamente.', 'error');
      showToast('Erro ao salvar conteúdo', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  document.getElementById('contactsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('saveContactsBtn');
    const data = {
      whatsappNumber: document.getElementById('whatsappNumber').value,
      phoneContact: document.getElementById('phoneContact').value,
      emailContact: document.getElementById('emailContact').value,
      address: document.getElementById('address').value,
      businessHours: document.getElementById('businessHours').value,
      instagramUrl: document.getElementById('instagramUrl').value,
      facebookUrl: document.getElementById('facebookUrl').value
    };

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const response = await fetch(`${CONFIG.contentApiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (result.success) {
        setFormStatus('contactsStatus', 'Contatos salvos com sucesso!', 'success');
        showToast('Contatos atualizados com sucesso');
      } else {
        setFormStatus('contactsStatus', result.message || 'Erro ao salvar contatos', 'error');
        showToast(result.message || 'Erro ao salvar contatos', 'error');
      }
    } catch (error) {
      console.error('Erro ao salvar contatos:', error);
      setFormStatus('contactsStatus', 'Erro de conexão. Tente novamente.', 'error');
      showToast('Erro ao salvar contatos', 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  // ============================================================
  // MODAIS
  // ============================================================

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    
    // Foca no primeiro input
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) firstInput.focus();
  }

  window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    modal.hidden = true;
    document.body.style.overflow = '';
  };

  // Fecha modal ao clicar no overlay ou botao de fechar
  document.querySelectorAll('.modal-overlay, .modal-close, .modal-cancel').forEach(el => {
    el.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });

  // Fecha modal com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal:not([hidden])').forEach(modal => {
        closeModal(modal.id);
      });
    }
  });

  // Confirmação de exclusao
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => {
    if (state.deleteCallback) {
      state.deleteCallback();
      state.deleteCallback = null;
    }
  });

  // ============================================================
  // PAGINACAO
  // ============================================================

  function renderPagination(type, pagination, callback) {
    const container = document.getElementById(`${type}Pagination`);
    if (!container || pagination.totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }
    
    let html = '';
    
    // Botao anterior
    html += `
      <button class="page-btn" ${pagination.page === 1 ? 'disabled' : ''} data-page="${pagination.page - 1}">
        Anterior
      </button>
    `;
    
    // Páginas
    for (let i = 1; i <= pagination.totalPages; i++) {
      html += `
        <button class="page-btn ${i === pagination.page ? 'active' : ''}" data-page="${i}">
          ${i}
        </button>
      `;
    }
    
    // Botao proximo
    html += `
      <button class="page-btn" ${pagination.page === pagination.totalPages ? 'disabled' : ''} data-page="${pagination.page + 1}">
        Proxima
      </button>
    `;
    
    container.innerHTML = html;
    
    // Event listeners
    container.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = parseInt(btn.dataset.page);
        if (page && page !== pagination.page) {
          callback(page);
        }
      });
    });
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/logout`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        window.location.href = data.redirect || '/admin/login';
      }
    } catch (error) {
      console.error('Erro no logout:', error);
      window.location.href = '/admin/login';
    }
  });

  // ============================================================
  // INICIALIZACAO
  // ============================================================

  function init() {
    initNavigation();
    initSidebar();
    const initialSection = resolveInitialSection();
    activateSection(initialSection);

    // Atualiza os contadores automaticamente para refletir novos agendamentos.
    setInterval(loadStats, 15000);
    
    console.log('Dashboard inicializado');
  }

  // Inicia quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

