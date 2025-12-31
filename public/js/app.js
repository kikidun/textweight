// TextWeight Dashboard Module

(function() {
  let entries = [];
  let chart = null;
  let displayUnit = 'lbs';

  // Initialize
  async function init() {
    await loadSettings();
    await loadEntries();
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
      displayUnit = settings.display_unit || 'lbs';
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // Load entries
  async function loadEntries() {
    try {
      const response = await fetch('/api/entries');
      if (response.status === 401) {
        window.location.href = '/';
        return;
      }
      entries = await response.json();
      renderChart();
      renderTable();
    } catch (error) {
      console.error('Failed to load entries:', error);
    }
  }

  // Convert weight for display
  function convertWeight(weightLbs) {
    if (displayUnit === 'kg') {
      return (weightLbs * 0.453592).toFixed(1);
    }
    return weightLbs.toFixed(1);
  }

  // Render chart
  function renderChart() {
    const ctx = document.getElementById('weight-chart').getContext('2d');

    // Sort entries by date for chart
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

    const data = sorted.map(e => ({
      x: e.date,
      y: displayUnit === 'kg' ? e.weight * 0.453592 : e.weight
    }));

    if (chart) {
      chart.destroy();
    }

    chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: `Weight (${displayUnit})`,
          data: data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.1,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day',
              displayFormats: {
                day: 'MMM d'
              }
            },
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: false,
            grid: {
              color: '#e5e7eb'
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x'
            },
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              drag: {
                enabled: true,
                backgroundColor: 'rgba(37, 99, 235, 0.1)'
              },
              mode: 'x'
            }
          }
        }
      }
    });
  }

  // Render table
  function renderTable() {
    const tbody = document.getElementById('entries-body');
    tbody.innerHTML = '';

    for (const entry of entries) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(entry.date)}</td>
        <td>${convertWeight(entry.weight)} ${displayUnit}</td>
        <td>
          <button class="edit-btn" data-id="${entry.id}">Edit</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Add click handlers for edit buttons
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const entry = entries.find(e => e.id == id);
        if (entry) {
          openEditModal(entry);
        }
      });
    });
  }

  // Format date for display
  function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Open add modal
  function openAddModal() {
    document.getElementById('modal-title').textContent = 'Add Entry';
    document.getElementById('entry-id').value = '';
    document.getElementById('entry-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('entry-weight').value = '';
    document.getElementById('delete-btn').classList.add('hidden');
    document.getElementById('entry-modal').classList.remove('hidden');
    document.getElementById('entry-weight').focus();
  }

  // Open edit modal
  function openEditModal(entry) {
    document.getElementById('modal-title').textContent = 'Edit Entry';
    document.getElementById('entry-id').value = entry.id;
    document.getElementById('entry-date').value = entry.date;
    document.getElementById('entry-weight').value = displayUnit === 'kg'
      ? (entry.weight * 0.453592).toFixed(1)
      : entry.weight;
    document.getElementById('delete-btn').classList.remove('hidden');
    document.getElementById('entry-modal').classList.remove('hidden');
    document.getElementById('entry-weight').focus();
  }

  // Close modal
  function closeModal() {
    document.getElementById('entry-modal').classList.add('hidden');
  }

  // Save entry
  async function saveEntry(e) {
    e.preventDefault();

    const id = document.getElementById('entry-id').value;
    const date = document.getElementById('entry-date').value;
    let weight = parseFloat(document.getElementById('entry-weight').value);

    // Convert back to lbs if needed
    if (displayUnit === 'kg') {
      weight = weight / 0.453592;
    }

    try {
      let response;
      if (id) {
        // Update existing
        response = await fetch(`/api/entries/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weight })
        });
      } else {
        // Create new
        response = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, weight })
        });
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      closeModal();
      await loadEntries();
    } catch (error) {
      alert(error.message);
    }
  }

  // Delete entry
  async function deleteEntry() {
    const id = document.getElementById('entry-id').value;
    if (!id) return;

    try {
      const response = await fetch(`/api/entries/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }

      closeModal();
      await loadEntries();
    } catch (error) {
      alert(error.message);
    }
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

  // Setup event listeners
  function setupEventListeners() {
    // Add entry button
    document.getElementById('add-entry-btn').addEventListener('click', openAddModal);

    // Modal controls
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('delete-btn').addEventListener('click', deleteEntry);
    document.getElementById('entry-form').addEventListener('submit', saveEntry);

    // Close modal on backdrop click
    document.getElementById('entry-modal').addEventListener('click', (e) => {
      if (e.target.id === 'entry-modal') {
        closeModal();
      }
    });

    // Zoom controls
    document.getElementById('zoom-in').addEventListener('click', () => {
      chart.zoom(1.2);
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
      chart.zoom(0.8);
    });

    document.getElementById('zoom-reset').addEventListener('click', () => {
      chart.resetZoom();
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
