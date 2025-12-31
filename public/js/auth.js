// TextWeight Auth Module

(function() {
  const phoneForm = document.getElementById('phone-form');
  const codeForm = document.getElementById('code-form');
  const stepPhone = document.getElementById('step-phone');
  const stepCode = document.getElementById('step-code');
  const backBtn = document.getElementById('back-btn');
  const errorMessage = document.getElementById('error-message');

  let currentPhone = '';

  // Show error message
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    setTimeout(() => {
      errorMessage.classList.add('hidden');
    }, 5000);
  }

  // Format phone number for display
  function formatPhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  // Request verification code
  phoneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('phone').value;

    const btn = document.getElementById('send-code-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send code');
      }

      currentPhone = phone;
      stepPhone.classList.add('hidden');
      stepCode.classList.remove('hidden');
      document.getElementById('code').focus();
    } catch (error) {
      showError(error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Code';
    }
  });

  // Verify code
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('code').value;

    const btn = document.getElementById('verify-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone, code })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      // Redirect to dashboard
      window.location.href = '/';
    } catch (error) {
      showError(error.message);
      btn.disabled = false;
      btn.textContent = 'Verify';
    }
  });

  // Go back to phone step
  backBtn.addEventListener('click', () => {
    stepCode.classList.add('hidden');
    stepPhone.classList.remove('hidden');
    document.getElementById('code').value = '';
  });
})();
