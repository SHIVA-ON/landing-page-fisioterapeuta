/**
 * ============================================================
 * JAVASCRIPT PRINCIPAL - LANDING PAGE
 * ============================================================
 * 
 * Funcionalidades:
 * - Navegação mobile (menu hamburger)
 * - Header scroll effect
 * - Carregamento dinamico de conteúdo
 * - Slider de depoimentos
 * - Validação e envio de formulários
 * - Smooth scroll para ancora
 * - Intersection Observer para animações
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
    apiUrl: '/api',
    scrollOffset: 80,
    animationThreshold: 0.1
  };

  const DEFAULT_IMAGES = {
    hero: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80',
    about: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80'
  };

  // ============================================================
  // UTILITARIOS
  // ============================================================

  /**
   * Debounce - limita frequencia de execucao de funcao
   * @param {Function} func - Funcao a ser executada
   * @param {number} wait - Tempo de espera em ms
   * @returns {Function}
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Formata numero de telefone para exibicao
   * @param {string} phone - Número de telefone
   * @returns {string}
   */
  function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  /**
   * Cria estrelas de avaliação
   * @param {number} rating - Número de estrelas (1-5)
   * @returns {string}
   */
  function createStars(rating) {
    if (!rating || rating <= 0) return '0';
    return '*'.repeat(rating);
  }

  function getServiceIconDisplay(icon) {
    const iconMap = {
      bone: '+',
      activity: '~',
      user: 'O',
      hand: 'H',
      align: '=',
      heart: '<3'
    };

    if (!icon) return '+';
    const normalized = String(icon).trim();
    if (!normalized) return '+';

    if (iconMap[normalized]) {
      return iconMap[normalized];
    }

    return normalized;
  }

  function isTruthySetting(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function normalizeUrl(value, fallback = '#') {
    if (!value || typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function normalizeImageUrl(value) {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return '';
  }

  function normalizeWhatsappNumber(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el && typeof value === 'string' && value.trim()) {
      el.textContent = value.trim();
    }
  }

  function setContactLink(selector, href, text) {
    document.querySelectorAll(selector).forEach((el) => {
      el.setAttribute('href', href);
      el.textContent = text;
    });
  }

  function setBusinessHours(value) {
    const el = document.getElementById('businessHoursText');
    if (!el || typeof value !== 'string' || !value.trim()) return;

    const normalized = value.replace(/\|/g, '\n');
    const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);

    el.innerHTML = '';
    lines.forEach((line, index) => {
      if (index > 0) el.appendChild(document.createElement('br'));
      el.appendChild(document.createTextNode(line));
    });
  }

  function updateSocialLinks(type, url) {
    document.querySelectorAll(`[data-social="${type}"]`).forEach((el) => {
      el.setAttribute('href', url);
    });
  }

  function setHeroImage(url) {
    const imageEl = document.getElementById('heroImage');
    if (!imageEl) return;

    const normalizedUrl = normalizeImageUrl(url) || DEFAULT_IMAGES.hero;
    imageEl.onerror = () => {
      if (imageEl.src !== DEFAULT_IMAGES.hero) {
        imageEl.src = DEFAULT_IMAGES.hero;
      }
    };
    imageEl.src = normalizedUrl;
  }

  function setAboutImage(url) {
    const imageEl = document.getElementById('aboutImage');
    if (!imageEl) return;

    const normalizedUrl = normalizeImageUrl(url) || DEFAULT_IMAGES.about;
    imageEl.onerror = () => {
      if (imageEl.src !== DEFAULT_IMAGES.about) {
        imageEl.src = DEFAULT_IMAGES.about;
      }
    };
    imageEl.src = normalizedUrl;
  }

  // ============================================================
  // NAVEGACAO MOBILE
  // ============================================================

  function initMobileNav() {
    const menuToggle = document.getElementById('menuToggle');
    const navMobile = document.getElementById('navMobile');
    
    if (!menuToggle || !navMobile) return;

    menuToggle.addEventListener('click', () => {
      const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', !isExpanded);
      navMobile.hidden = isExpanded;
      document.body.style.overflow = isExpanded ? '' : 'hidden';
    });

    // Fecha menu ao clicar em link
    const mobileLinks = navMobile.querySelectorAll('.nav-mobile-link');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.setAttribute('aria-expanded', 'false');
        navMobile.hidden = true;
        document.body.style.overflow = '';
      });
    });

    // Fecha menu ao redimensionar para desktop
    window.addEventListener('resize', debounce(() => {
      if (window.innerWidth >= 1024) {
        menuToggle.setAttribute('aria-expanded', 'false');
        navMobile.hidden = true;
        document.body.style.overflow = '';
      }
    }, 150));
  }

  // ============================================================
  // HEADER SCROLL EFFECT
  // ============================================================

  function initHeaderScroll() {
    const header = document.getElementById('header');
    if (!header) return;

    const handleScroll = debounce(() => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, 10);

    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  // ============================================================
  // SMOOTH SCROLL PARA ANCORAS
  // ============================================================

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        if (!targetElement) return;

        e.preventDefault();
        
        const headerHeight = document.getElementById('header')?.offsetHeight || 0;
        const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      });
    });
  }

  // ============================================================
  // CARREGAMENTO DE CONTEUDO DINAMICO
  // ============================================================

  /**
   * Carrega serviços da API
   */
  async function loadServices() {
    const servicesGrid = document.getElementById('servicesGrid');
    if (!servicesGrid) return;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/services`);
      const data = await response.json();

      if (!data.success || !data.data.length) {
        // Mantem conteúdo estatico do noscript
        return;
      }

      // Limpa conteúdo existente
      servicesGrid.innerHTML = '';

      data.data.forEach(service => {
        const iconDisplay = getServiceIconDisplay(service.icon);
        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `
          <div class="service-icon" aria-hidden="true">${escapeHtml(iconDisplay)}</div>
          <h3 class="service-title">${escapeHtml(service.title)}</h3>
          <p class="service-description">${escapeHtml(service.description)}</p>
        `;
        servicesGrid.appendChild(card);
      });

    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      // Mantem conteúdo estatico em caso de erro
    }
  }

  /**
   * Carrega depoimentos da API
   */
  async function loadTestimonials() {
    const slider = document.getElementById('testimonialsSlider');
    if (!slider) return;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/testimonials`);
      const data = await response.json();

      if (!data.success || !data.data.length) {
        slider.innerHTML = '<p class="text-center">Nenhum depoimento disponivel.</p>';
        return;
      }

      // Cria track do slider
      const track = document.createElement('div');
      track.className = 'testimonials-track';

      data.data.forEach(testimonial => {
        const card = document.createElement('div');
        card.className = 'testimonial-card';
        card.innerHTML = `
          <div class="testimonial-rating" aria-label="Avaliação ${testimonial.rating} estrelas">${createStars(testimonial.rating)}</div>
          <p class="testimonial-text">"${escapeHtml(testimonial.text)}"</p>
          <cite class="testimonial-author">${escapeHtml(testimonial.name)}</cite>
        `;
        track.appendChild(card);
      });

      slider.innerHTML = '';
      slider.appendChild(track);

      // Inicializa slider
      initTestimonialSlider(track, data.data.length);

    } catch (error) {
      console.error('Erro ao carregar depoimentos:', error);
      slider.innerHTML = '<p class="text-center">Erro ao carregar depoimentos.</p>';
    }
  }

  function initPublicTestimonialForm() {
    const form = document.getElementById('testimonialFormPublic');
    if (!form) return;

    const statusEl = document.getElementById('testimonialFormStatus');
    const submitBtn = document.getElementById('testimonialSubmitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        name: document.getElementById('testimonialNamePublic')?.value.trim(),
        text: document.getElementById('testimonialTextPublic')?.value.trim(),
        rating: parseInt(document.getElementById('testimonialRatingPublic')?.value || '0', 10)
      };

      statusEl.className = 'form-status';
      statusEl.textContent = '';

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        const response = await fetch(`${CONFIG.apiUrl}/testimonials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
          statusEl.className = 'form-status success';
          statusEl.textContent = result.message || 'Depoimento enviado com sucesso.';
          form.reset();
          loadTestimonials();
        } else {
          statusEl.className = 'form-status error';
          statusEl.textContent = result.message || 'Erro ao enviar depoimento.';
        }
      } catch (error) {
        console.error('Erro ao enviar depoimento:', error);
        statusEl.className = 'form-status error';
        statusEl.textContent = 'Erro de conexão. Tente novamente.';
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }

  async function loadSiteSettings() {
    try {
      const response = await fetch(`${CONFIG.apiUrl}/content/settings`);
      const result = await response.json();

      if (!result.success || !result.data) {
        return;
      }

      const settings = result.data;

      setElementText('hero-title', settings.hero_title);
      setElementText('heroSubtitleText', settings.hero_subtitle);
      setHeroImage(settings.hero_image_url);
      setAboutImage(settings.about_image_url);
      setElementText('therapistNameText', settings.therapist_name);
      setElementText('therapistCrefitoText', settings.therapist_crefito);
      setElementText('therapistBioText', settings.therapist_bio);

      if (settings.phone_contact && settings.phone_contact.trim()) {
        const telValue = settings.phone_contact.replace(/[^\d+]/g, '');
        setContactLink('[data-contact-phone-link]', `tel:${telValue}`, settings.phone_contact.trim());
        setElementText('footerPhoneText', settings.phone_contact);
      }

      if (settings.email_contact && settings.email_contact.trim()) {
        setContactLink('[data-contact-email-link]', `mailto:${settings.email_contact.trim()}`, settings.email_contact.trim());
        setElementText('footerEmailText', settings.email_contact);
      }

      setElementText('contactAddressText', settings.address);
      setElementText('footerAddressText', settings.address);
      setBusinessHours(settings.business_hours);

      const instagramUrl = normalizeUrl(settings.instagram_url, 'https://instagram.com');
      const facebookUrl = normalizeUrl(settings.facebook_url, 'https://facebook.com');
      updateSocialLinks('instagram', instagramUrl);
      updateSocialLinks('facebook', facebookUrl);

      const whatsappNumber = normalizeWhatsappNumber(settings.whatsapp_number);
      if (whatsappNumber) {
        updateSocialLinks('whatsapp', `https://wa.me/${whatsappNumber}`);
      }

      const testimonialsSection = document.getElementById('depoimentos');
      if (testimonialsSection && settings.show_testimonials !== undefined) {
        testimonialsSection.hidden = !isTruthySetting(settings.show_testimonials);
      }

      const gallerySection = document.getElementById('galeria');
      if (gallerySection && settings.show_gallery !== undefined) {
        gallerySection.hidden = !isTruthySetting(settings.show_gallery);
      }

    } catch (error) {
      console.error('Erro ao carregar configurações do site:', error);
    }
  }

  /**
   * Escapa HTML para prevenir XSS
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // SLIDER DE DEPOIMENTOS
  // ============================================================

  function initTestimonialSlider(track, totalSlides) {
    const prevBtn = document.getElementById('testimonialPrev');
    const nextBtn = document.getElementById('testimonialNext');
    const dotsContainer = document.getElementById('testimonialsDots');

    if (!prevBtn || !nextBtn || !dotsContainer) return;

    let currentSlide = 0;
    let slidesPerView = getSlidesPerView();
    let maxSlide = Math.max(0, totalSlides - slidesPerView);

    // Cria dots
    dotsContainer.innerHTML = '';
    for (let i = 0; i <= maxSlide; i++) {
      const dot = document.createElement('button');
      dot.className = 'testimonial-dot';
      dot.setAttribute('aria-label', `Ir para depoimento ${i + 1}`);
      dot.addEventListener('click', () => goToSlide(i));
      dotsContainer.appendChild(dot);
    }

    const dots = dotsContainer.querySelectorAll('.testimonial-dot');

    function getSlidesPerView() {
      if (window.innerWidth >= 1024) return 3;
      if (window.innerWidth >= 768) return 2;
      return 1;
    }

    function updateSlider() {
      const slideWidth = track.children[0]?.offsetWidth || 0;
      const gap = 24; // Espaco entre slides
      track.style.transform = `translateX(-${currentSlide * (slideWidth + gap)}px)`;

      // Atualiza dots
      dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
      });

      // Atualiza estado dos botoes
      prevBtn.disabled = currentSlide === 0;
      nextBtn.disabled = currentSlide >= maxSlide;
      prevBtn.style.opacity = currentSlide === 0 ? '0.5' : '1';
      nextBtn.style.opacity = currentSlide >= maxSlide ? '0.5' : '1';
    }

    function goToSlide(index) {
      currentSlide = Math.max(0, Math.min(index, maxSlide));
      updateSlider();
    }

    function nextSlide() {
      if (currentSlide < maxSlide) {
        currentSlide++;
        updateSlider();
      }
    }

    function prevSlide() {
      if (currentSlide > 0) {
        currentSlide--;
        updateSlider();
      }
    }

    // Event listeners
    prevBtn.addEventListener('click', prevSlide);
    nextBtn.addEventListener('click', nextSlide);

    // Atualiza em resize
    window.addEventListener('resize', debounce(() => {
      slidesPerView = getSlidesPerView();
      maxSlide = Math.max(0, totalSlides - slidesPerView);
      currentSlide = Math.min(currentSlide, maxSlide);
      
      // Recria dots
      dotsContainer.innerHTML = '';
      for (let i = 0; i <= maxSlide; i++) {
        const dot = document.createElement('button');
        dot.className = 'testimonial-dot';
        dot.setAttribute('aria-label', `Ir para depoimento ${i + 1}`);
        dot.addEventListener('click', () => goToSlide(i));
        dotsContainer.appendChild(dot);
      }
      
      updateSlider();
    }, 150));

    // Inicializa
    updateSlider();

    // Auto-play (opcional)
    let autoplayInterval;
    function startAutoplay() {
      autoplayInterval = setInterval(() => {
        if (currentSlide >= maxSlide) {
          currentSlide = 0;
        } else {
          currentSlide++;
        }
        updateSlider();
      }, 5000);
    }

    function stopAutoplay() {
      clearInterval(autoplayInterval);
    }

    // Pausa autoplay em hover
    track.addEventListener('mouseenter', stopAutoplay);
    track.addEventListener('mouseleave', startAutoplay);

    // Inicia autoplay
    startAutoplay();
  }

  // ============================================================
  // VALIDACAO DE FORMULARIO
  // ============================================================

  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const inputs = {
      name: document.getElementById('contactName'),
      email: document.getElementById('contactEmail'),
      phone: document.getElementById('contactPhone'),
      subject: document.getElementById('contactSubject'),
      message: document.getElementById('contactMessage')
    };

    const errors = {
      name: document.getElementById('nameError'),
      email: document.getElementById('emailError'),
      phone: document.getElementById('phoneError'),
      subject: document.getElementById('subjectError'),
      message: document.getElementById('messageError')
    };

    const submitBtn = document.getElementById('submitBtn');
    const formStatus = document.getElementById('formStatus');

    // Mascara de telefone
    inputs.phone?.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);
      
      if (value.length > 7) {
        value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
      } else if (value.length > 2) {
        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
      }
      
      e.target.value = value;
    });

    // Validação em tempo real
    Object.keys(inputs).forEach(field => {
      const input = inputs[field];
      if (!input) return;

      input.addEventListener('blur', () => validateField(field));
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) {
          validateField(field);
        }
      });
    });

    function validateField(field) {
      const input = inputs[field];
      const errorEl = errors[field];
      if (!input || !errorEl) return true;

      let isValid = true;
      let errorMessage = '';

      const value = input.value.trim();

      switch (field) {
        case 'name':
          if (!value) {
            isValid = false;
            errorMessage = 'Nome é obrigatório';
          } else if (value.length < 2) {
            isValid = false;
            errorMessage = 'Nome deve ter pelo menos 2 caracteres';
          } else if (!/^[a-zA-ZÀ-ÿ\s'-]+$/.test(value)) {
            isValid = false;
            errorMessage = 'Nome contém caracteres inválidos';
          }
          break;

        case 'email':
          if (!value) {
            isValid = false;
            errorMessage = 'E-mail é obrigatório';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            isValid = false;
            errorMessage = 'E-mail inválido';
          }
          break;

        case 'phone':
          if (value && value.replace(/\D/g, '').length < 10) {
            isValid = false;
            errorMessage = 'Telefone inválido';
          }
          break;

        case 'subject':
          if (!value) {
            isValid = false;
            errorMessage = 'Assunto é obrigatório';
          } else if (value.length < 3) {
            isValid = false;
            errorMessage = 'Assunto deve ter pelo menos 3 caracteres';
          }
          break;

        case 'message':
          if (!value) {
            isValid = false;
            errorMessage = 'Mensagem é obrigatória';
          } else if (value.length < 10) {
            isValid = false;
            errorMessage = 'Mensagem deve ter pelo menos 10 caracteres';
          }
          break;
      }

      // Atualiza UI
      if (isValid) {
        input.classList.remove('error');
        errorEl.textContent = '';
      } else {
        input.classList.add('error');
        errorEl.textContent = errorMessage;
      }

      return isValid;
    }

    function validateForm() {
      let isValid = true;
      ['name', 'email', 'subject', 'message'].forEach(field => {
        if (!validateField(field)) {
          isValid = false;
        }
      });
      return isValid;
    }

    // Envio do formulário
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Limpa mensagem anterior
      formStatus.className = 'form-status';
      formStatus.textContent = '';

      // Valida
      if (!validateForm()) {
        formStatus.className = 'form-status error';
        formStatus.textContent = 'Por favor, corrija os erros acima.';
        return;
      }

      // Prepara dados
      const formData = {
        name: inputs.name.value.trim(),
        email: inputs.email.value.trim(),
        phone: inputs.phone?.value.trim() || null,
        subject: inputs.subject.value.trim(),
        message: inputs.message.value.trim()
      };

      // Mostra loading
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        const response = await fetch(`${CONFIG.apiUrl}/contact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
          formStatus.className = 'form-status success';
          formStatus.textContent = data.message;
          form.reset();
          
          // Limpa erros
          Object.values(inputs).forEach(input => {
            if (input) input.classList.remove('error');
          });
          Object.values(errors).forEach(error => {
            if (error) error.textContent = '';
          });
        } else {
          formStatus.className = 'form-status error';
          formStatus.textContent = data.message || 'Erro ao enviar mensagem. Tente novamente.';
        }

      } catch (error) {
        console.error('Erro ao enviar formulário:', error);
        formStatus.className = 'form-status error';
        formStatus.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }

  // ============================================================
  // ANIMACOES COM INTERSECTION OBSERVER
  // ============================================================

  function initScrollAnimations() {
    // Verifica se usuário prefere reducao de movimento
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: CONFIG.animationThreshold
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observa elementos para animar
    const animateElements = document.querySelectorAll(
      '.service-card, .process-step, .testimonial-card, .gallery-item'
    );
    
    animateElements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`;
      observer.observe(el);
    });

    // Adiciona classe de animação
    const style = document.createElement('style');
    style.textContent = `
      .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // INICIALIZACAO
  // ============================================================

  function init() {
    // Inicializa componentes
    initMobileNav();
    initHeaderScroll();
    initSmoothScroll();
    initContactForm();
    initPublicTestimonialForm();
    initScrollAnimations();

    // Carrega conteúdo dinamico
    loadSiteSettings();
    loadServices();
    loadTestimonials();

    console.log('Landing page inicializada com sucesso');
  }

  // Inicia quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

