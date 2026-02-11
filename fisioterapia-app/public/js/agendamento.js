(function() {
  'use strict';

  const form = document.getElementById('bookingForm');
  const statusEl = document.getElementById('bookingStatus');
  const submitBtn = document.getElementById('submitBtn');
  const dateSelect = document.getElementById('preferredDate');
  const timeSelect = document.getElementById('preferredTime');
  const serviceSelect = document.getElementById('serviceType');
  const dateHelper = document.getElementById('preferredDateHelper');
  const timeHelper = document.getElementById('preferredTimeHelper');

  if (!form || !statusEl || !submitBtn || !dateSelect || !timeSelect || !serviceSelect) {
    return;
  }

  let redirectTimer = null;

  function formatDatePtBr(dateValue) {
    const [year, month, day] = String(dateValue || '').split('-');
    if (!year || !month || !day) return dateValue;
    return `${day}/${month}/${year}`;
  }

  function setStatus(message, type) {
    statusEl.textContent = message || '';
    statusEl.style.color = type === 'error' ? '#b42318' : '#2a9d8f';
  }

  function resetSelect(selectEl, placeholder) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
  }

  function renderServices(services) {
    resetSelect(serviceSelect, 'Selecione');
    services.forEach((serviceTitle) => {
      const option = document.createElement('option');
      option.value = serviceTitle;
      option.textContent = serviceTitle;
      serviceSelect.appendChild(option);
    });
  }

  function renderDateOptions(dates, selectedDate) {
    dateSelect.innerHTML = '';

    if (!dates.length) {
      resetSelect(dateSelect, 'Sem datas disponiveis');
      dateSelect.disabled = true;
      return;
    }

    let selectedFound = false;

    dates.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.date;
      option.disabled = !item.available;
      const availabilityText = item.available
        ? `Disponivel (${item.availableSlots}/${item.totalSlots} horarios livres)`
        : 'Indisponivel';
      option.textContent = `${formatDatePtBr(item.date)} - ${availabilityText}`;
      if (item.date === selectedDate) {
        option.selected = true;
        selectedFound = true;
      }
      dateSelect.appendChild(option);
    });

    if (!selectedFound) {
      const firstAvailable = dates.find((item) => item.available);
      if (firstAvailable) {
        dateSelect.value = firstAvailable.date;
      }
    }

    dateSelect.disabled = false;
  }

  function renderTimeOptions(slots) {
    resetSelect(timeSelect, 'Selecione um horario');
    if (!Array.isArray(slots) || !slots.length) {
      timeSelect.disabled = true;
      timeHelper.textContent = 'Nenhum horario disponivel para essa data.';
      return;
    }

    slots.forEach((slot) => {
      const option = document.createElement('option');
      option.value = slot.time;
      option.disabled = !slot.available;
      option.textContent = slot.available
        ? `${slot.time} (${slot.remaining} vaga${slot.remaining === 1 ? '' : 's'})`
        : `${slot.time} (lotado)`;
      timeSelect.appendChild(option);
    });

    const firstAvailable = slots.find((slot) => slot.available);
    if (firstAvailable) {
      timeSelect.value = firstAvailable.time;
      timeSelect.disabled = false;
      timeHelper.textContent = 'Horarios atualizados automaticamente com base na agenda.';
    } else {
      timeSelect.disabled = true;
      timeHelper.textContent = 'Todos os horarios dessa data estao ocupados.';
    }
  }

  async function loadAvailability(selectedDate) {
    const params = new URLSearchParams();
    if (selectedDate) params.set('date', selectedDate);

    const response = await fetch(`/api/booking/availability${params.toString() ? `?${params.toString()}` : ''}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Nao foi possivel carregar disponibilidade.');
    }

    const payload = result.data || {};
    const services = Array.isArray(payload.services) ? payload.services : [];
    const dates = Array.isArray(payload.dates) ? payload.dates : [];
    const slots = Array.isArray(payload.slots) ? payload.slots : [];
    const config = payload.config || {};

    renderServices(services);
    renderDateOptions(dates, payload.selectedDate);
    renderTimeOptions(slots);

    const enabledDays = Array.isArray(config.enabledWeekdays) ? config.enabledWeekdays : [];
    dateHelper.textContent = `Agenda: ${config.workStart || '--:--'} as ${config.workEnd || '--:--'} | Intervalo: ${config.slotIntervalMinutes || '-'} min | Dias ativos: ${enabledDays.length}`;
  }

  dateSelect.addEventListener('change', async () => {
    try {
      setStatus('', 'success');
      await loadAvailability(dateSelect.value);
    } catch (error) {
      setStatus(error.message || 'Erro ao atualizar horarios.', 'error');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }

    setStatus('', 'success');
    submitBtn.disabled = true;

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      preferredDate: form.preferredDate.value || undefined,
      preferredTime: form.preferredTime.value || undefined,
      serviceType: form.serviceType.value || undefined,
      notes: form.notes.value.trim() || undefined
    };

    try {
      const response = await fetch('/api/booking/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Nao foi possivel enviar o agendamento.');
      }

      setStatus(data.message || 'Agendamento enviado com sucesso.', 'success');
      form.reset();
      await loadAvailability();
      redirectTimer = setTimeout(() => {
        window.location.href = '/';
      }, 30000);
    } catch (error) {
      setStatus(error.message || 'Erro ao enviar agendamento.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });

  loadAvailability().catch((error) => {
    setStatus(error.message || 'Erro ao carregar agenda.', 'error');
    resetSelect(dateSelect, 'Erro ao carregar datas');
    resetSelect(timeSelect, 'Erro ao carregar horarios');
    resetSelect(serviceSelect, 'Erro ao carregar servicos');
  });
})();
