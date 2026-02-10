(function() {
  'use strict';

  const form = document.getElementById('bookingForm');
  const statusEl = document.getElementById('bookingStatus');
  const submitBtn = document.getElementById('submitBtn');

  if (!form || !statusEl || !submitBtn) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    statusEl.textContent = '';
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

      statusEl.style.color = '#2a9d8f';
      statusEl.textContent = data.message || 'Agendamento enviado com sucesso.';
      form.reset();
    } catch (error) {
      statusEl.style.color = '#b42318';
      statusEl.textContent = error.message || 'Erro ao enviar agendamento.';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();

