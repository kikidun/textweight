// TextWeight Settings Module

(function() {
  let pendingImport = null;

  // Initialize
  async function init() {
    await loadSettings();
    setupEventListeners();
  }

  // Load settings
  async function loadSettings() {
    try {
      const response = await fetch('/api/settings');
      if (response.status === 401) {
        window.location.href = '/';
        return;
      }
      const settings = await response.json();

      document.getElementById('display-unit').value = settings.display_unit || 'lbs';
      document.getElementById('timezone').value = settings.timezone || 'America/Chicago';
      document.getElementById('current-phone').textContent = settings.phone_number || 'Not set';
    } catch (error) {
      console.error('Failed to load settings:', error);
      showMessage('Failed to load settings', true);
    }
  }

  // Save settings
  async function saveSettings(e) {
    e.preventDefault();

    const display_unit = document.getElementById('display-unit').value;
    const timezone = document.getElementById('timezone').value;

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_unit, timezone })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      showMessage('Settings saved');
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  // Phone change flow
  async function requestPhoneChange(e) {
    e.preventDefault();

    const new_phone = document.getElementById('new-phone').value;

    try {
      const response = await fetch('/api/settings/phone/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_phone })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send verification');
      }

      document.getElementById('phone-change-section').classList.add('hidden');
      document.getElementById('phone-verify-section').classList.remove('hidden');
      document.getElementById('verify-code').focus();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function verifyPhoneChange(e) {
    e.preventDefault();

    const code = document.getElementById('verify-code').value;

    try {
      const response = await fetch('/api/settings/phone/confirm-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      showMessage('Phone number updated');
      resetPhoneUI();
      await loadSettings();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  function resetPhoneUI() {
    document.getElementById('phone-change-section').classList.add('hidden');
    document.getElementById('phone-verify-section').classList.add('hidden');
    document.getElementById('change-phone-btn').classList.remove('hidden');
    document.getElementById('new-phone').value = '';
    document.getElementById('verify-code').value = '';
  }

  // CSV Import
  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target.result;
      const entries = parseCSV(csv);

      if (entries.length === 0) {
        showMessage('No valid entries found in CSV', true);
        return;
      }

      pendingImport = entries;
      renderImportPreview(entries);
    };
    reader.readAsText(file);
  }

  function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    const entries = [];

    // Skip header if present
    const startIndex = lines[0].toLowerCase().includes('date') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) continue;

      const date = normalizeDate(parts[0]);
      const weight = parseFloat(parts[1]);

      if (date && !isNaN(weight) && weight > 0) {
        entries.push({ date, weight });
      }
    }

    return entries;
  }

  function normalizeDate(dateStr) {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // MM/DD/YYYY
    const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdyMatch) {
      const month = mdyMatch[1].padStart(2, '0');
      const day = mdyMatch[2].padStart(2, '0');
      return `${mdyMatch[3]}-${month}-${day}`;
    }

    return null;
  }

  function renderImportPreview(entries) {
    const preview = document.getElementById('import-preview');
    const tbody = document.getElementById('preview-body');
    const count = document.getElementById('preview-count');

    tbody.innerHTML = '';
    count.textContent = entries.length;

    // Show first 10 entries
    const displayEntries = entries.slice(0, 10);
    for (const entry of displayEntries) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${entry.date}</td><td>${entry.weight}</td>`;
      tbody.appendChild(tr);
    }

    if (entries.length > 10) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="2">... and ${entries.length - 10} more</td>`;
      tbody.appendChild(tr);
    }

    preview.classList.remove('hidden');
  }

  async function confirmImport() {
    if (!pendingImport || pendingImport.length === 0) return;

    try {
      const response = await fetch('/api/entries/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: pendingImport })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      showMessage(`Imported ${data.imported} entries`);
      cancelImport();
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  function cancelImport() {
    pendingImport = null;
    document.getElementById('import-file').value = '';
    document.getElementById('import-preview').classList.add('hidden');
  }

  // Logout
  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    window.location.href = '/';
  }

  // Show message
  function showMessage(text, isError = false) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.className = isError ? 'message error' : 'message';
    msg.classList.remove('hidden');

    setTimeout(() => {
      msg.classList.add('hidden');
    }, 5000);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Settings form
    document.getElementById('settings-form').addEventListener('submit', saveSettings);

    // Phone change
    document.getElementById('change-phone-btn').addEventListener('click', () => {
      document.getElementById('change-phone-btn').classList.add('hidden');
      document.getElementById('phone-change-section').classList.remove('hidden');
      document.getElementById('new-phone').focus();
    });

    document.getElementById('phone-request-form').addEventListener('submit', requestPhoneChange);
    document.getElementById('phone-verify-form').addEventListener('submit', verifyPhoneChange);
    document.getElementById('phone-cancel-btn').addEventListener('click', resetPhoneUI);

    // Import
    document.getElementById('import-file').addEventListener('change', handleFileSelect);
    document.getElementById('import-confirm').addEventListener('click', confirmImport);
    document.getElementById('import-cancel').addEventListener('click', cancelImport);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
