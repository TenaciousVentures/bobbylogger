// âââââââââââââââââââââââââââââââââââââââââââââââ
// LifeLogger PWA â Main Application
// âââââââââââââââââââââââââââââââââââââââââââââââ

const App = (() => {
  // âââ State âââ
  let logTypes = [];
  let prefs = {};
  let currentLocation = null;
  let selectedLogType = null;
  let editingTypeId = null;
  let historyFilter = 'all';
  let deferredInstallPrompt = null;

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // INITIALIZATION
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  async function init() {
    try {
      await DB.init();
      logTypes = await DB.getAllLogTypes();
      prefs = await DB.getAllPrefs();
      applyPrefs();
      renderLogTypeGrid();
      setupNavigation();
      updateHeaderDate();
      getLocation();
      registerServiceWorker();
      setupInstallPrompt();
    } catch (err) {
      console.error('Init error:', err);
    }
  }

  function updateHeaderDate() {
    const el = document.getElementById('header-date');
    if (el) {
      el.textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
      });
    }
  }

  function applyPrefs() {
    document.body.classList.toggle('large-text', !!prefs.largeText);
    document.body.classList.toggle('high-contrast', !!prefs.highContrast);
    document.getElementById('pref-gps').checked = !!prefs.gps;
    document.getElementById('pref-largetext').checked = !!prefs.largeText;
    document.getElementById('pref-contrast').checked = !!prefs.highContrast;
    document.getElementById('pref-caregiver').checked = !!prefs.caregiver;
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // SERVICE WORKER & INSTALL
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW registration failed:', err));
    }
  }

  function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      document.getElementById('install-banner').classList.remove('hidden');
    });

    document.getElementById('install-btn').addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        document.getElementById('install-banner').classList.add('hidden');
      }
    });

    document.getElementById('install-dismiss').addEventListener('click', () => {
      document.getElementById('install-banner').classList.add('hidden');
    });

    window.addEventListener('appinstalled', () => {
      document.getElementById('install-banner').classList.add('hidden');
      deferredInstallPrompt = null;
    });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // GPS LOCATION
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function getLocation() {
    const badge = document.getElementById('location-badge');
    const text = document.getElementById('loc-text');

    if (!prefs.gps) {
      badge.className = 'loc-badge';
      text.textContent = 'GPS off';
      return;
    }
    if (!navigator.geolocation) {
      badge.className = 'loc-badge error';
      text.textContent = 'No GPS';
      return;
    }

    badge.className = 'loc-badge loading';
    text.textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        currentLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        };
        badge.className = 'loc-badge success';
        text.textContent = currentLocation.lat.toFixed(4) + ', ' + currentLocation.lng.toFixed(4);
      },
      (err) => {
        badge.className = 'loc-badge error';
        text.textContent = 'No location';
        currentLocation = null;
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // NAVIGATION
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.page));
    });
  }

  function navigateTo(page) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
    if (btn) btn.classList.add('active');
    const pg = document.getElementById('page-' + page);
    if (pg) pg.classList.add('active');

    if (page === 'history') renderHistory();
    if (page === 'stats') renderStats();
    if (page === 'settings') renderSettingsTypes();
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // LOG TYPE GRID (Home Page)
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function renderLogTypeGrid() {
    const grid = document.getElementById('log-type-grid');
    grid.innerHTML = '';
    logTypes.forEach(lt => {
      const btn = document.createElement('button');
      btn.className = 'log-type-btn' + (selectedLogType === lt.id ? ' selected' : '');
      btn.innerHTML = '<span class="type-icon">' + lt.icon + '</span>' + esc(lt.name);
      if (selectedLogType === lt.id) {
        btn.style.borderColor = lt.color;
        btn.style.boxShadow = `0 0 0 3px ${lt.color}30`;
      }
      btn.addEventListener('click', () => selectLogType(lt.id));
      grid.appendChild(btn);
    });
  }

  async function selectLogType(id) {
    selectedLogType = id;
    renderLogTypeGrid();
    await renderEntryForm();
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // DYNAMIC ENTRY FORM
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  async function renderEntryForm() {
    const card = document.getElementById('entry-form-card');
    const fieldsDiv = document.getElementById('dynamic-fields');
    const title = document.getElementById('form-title');
    const gasInfo = document.getElementById('gas-last-fill');

    if (!selectedLogType) {
      card.classList.add('hidden');
      return;
    }

    const lt = logTypes.find(t => t.id === selectedLogType);
    if (!lt) return;

    card.classList.remove('hidden');
    title.textContent = lt.icon + ' New ' + lt.name + ' Entry';
    fieldsDiv.innerHTML = '';
    gasInfo.classList.add('hidden');

    // Show last gas fill info
    if (lt.id === 'gas') {
      const lastGas = await DB.getLastGasFill();
      if (lastGas) {
        gasInfo.classList.remove('hidden');
        gasInfo.innerHTML =
          '<div class="gas-info-title">\u26FD Last Fill-Up</div>' +
          '<div class="gas-info-row"><span>Odometer:</span><span>' + Number(lastGas.fields.odometer).toLocaleString() + ' mi</span></div>' +
          '<div class="gas-info-row"><span>Date:</span><span>' + new Date(lastGas.timestamp).toLocaleDateString() + '</span></div>';
      }
    }

    // Build dynamic fields
    lt.fields.forEach(field => {
      const group = document.createElement('div');
      group.className = 'form-group';

      const label = document.createElement('label');
      label.textContent = field.name + (field.required ? ' *' : '');
      label.setAttribute('for', 'field-' + field.key);
      group.appendChild(label);

      let input;
      if (field.type === 'select') {
        input = document.createElement('select');
        const defOpt = document.createElement('option');
        defOpt.value = '';
        defOpt.textContent = 'Select...';
        input.appendChild(defOpt);
        (field.options || '').split(',').forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.trim();
          o.textContent = opt.trim();
          input.appendChild(o);
        });
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
        input.placeholder = 'Enter ' + field.name.toLowerCase() + '...';
      } else {
        input = document.createElement('input');
        input.type = field.type === 'number' ? 'number' : 'text';
        if (field.type === 'number') input.step = 'any';
        input.placeholder = 'Enter ' + field.name.toLowerCase() + '...';
      }

      input.id = 'field-' + field.key;
      if (field.required) input.required = true;
      group.appendChild(input);
      fieldsDiv.appendChild(group);
    });

    // Auto-calculate gas total
    if (lt.id === 'gas') {
      const gallonsInput = document.getElementById('field-gallons');
      const priceInput = document.getElementById('field-pricePerGallon');
      const totalInput = document.getElementById('field-totalCost');

      const autoCalc = () => {
        const g = parseFloat(gallonsInput?.value);
        const p = parseFloat(priceInput?.value);
        if (g && p && totalInput && !totalInput.value) {
          totalInput.value = (g * p).toFixed(2);
        }
      };

      if (gallonsInput) gallonsInput.addEventListener('blur', autoCalc);
      if (priceInput) priceInput.addEventListener('blur', autoCalc);
    }
  }

  function cancelEntry() {
    selectedLogType = null;
    document.getElementById('entry-form-card').classList.add('hidden');
    document.getElementById('entry-notes').value = '';
    renderLogTypeGrid();
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // SAVE ENTRY
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  async function saveEntry() {
    if (!selectedLogType) return;

    const lt = logTypes.find(t => t.id === selectedLogType);
    if (!lt) return;

    // Collect field values
    const fields = {};
    lt.fields.forEach(f => {
      const el = document.getElementById('field-' + f.key);
      if (el) fields[f.key] = el.value;
    });

    // Check required fields
    for (const f of lt.fields) {
      if (f.required && !fields[f.key]) {
        toast(f.name + ' is required', 'warning');
        return;
      }
    }

    // Calculate MPG for gas entries
    let gasStats = null;
    if (lt.id === 'gas' && fields.odometer) {
      const lastGas = await DB.getLastGasFill();
      if (lastGas && lastGas.fields.odometer) {
        const miles = parseFloat(fields.odometer) - parseFloat(lastGas.fields.odometer);
        const gallons = parseFloat(fields.gallons);
        if (miles > 0 && gallons > 0) {
          gasStats = {
            milesDriven: miles.toFixed(1),
            mpg: (miles / gallons).toFixed(1),
            costPerMile: fields.totalCost ? (parseFloat(fields.totalCost) / miles).toFixed(2) : null
          };
        }
      }
    }

    const notes = document.getElementById('entry-notes').value.trim();

    const entry = {
      logType: lt.id,
      logTypeName: lt.name,
      logTypeIcon: lt.icon,
      fields,
      gasStats,
      notes,
      location: currentLocation ? { ...currentLocation } : null
    };

    await DB.addEntry(entry);

    // Show confirmation
    let msg = lt.icon + ' ' + lt.name + ' entry saved!';
    if (gasStats) {
      msg += ' \u26FD ' + gasStats.mpg + ' MPG \u2022 ' + gasStats.milesDriven + ' mi';
    }
    toast(msg);

    // Reset form
    cancelEntry();
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // HISTORY PAGE
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  async function renderHistory(searchTerm) {
    const container = document.getElementById('history-list');
    let entries = await DB.getAllEntries();

    if (historyFilter !== 'all') {
      entries = entries.filter(e => e.logType === historyFilter);
    }

    const search = searchTerm || document.getElementById('history-search')?.value?.toLowerCase();
    if (search) {
      entries = entries.filter(e => {
        const haystack = JSON.stringify(e).toLowerCase();
        return haystack.includes(search);
      });
    }

    // Render filter buttons
    const filterBar = document.getElementById('history-filters');
    filterBar.innerHTML = '<button class="filter-btn' + (historyFilter === 'all' ? ' active' : '') + '" onclick="historyFilter=\'all\';App.renderHistory()">All</button>';
    logTypes.forEach(lt => {
      filterBar.innerHTML += '<button class="filter-btn' + (historyFilter === lt.id ? ' active' : '') + '" onclick="historyFilter=\'' + lt.id + '\';App.renderHistory()">' + lt.icon + '</button>';
    });

    if (entries.length === 0) {
      container.innerHTML = '<div class="empty-state">No entries yet. Start logging!</div>';
      return;
    }

    let html = '';
    let lastDate = '';

    entries.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      if (dateStr !== lastDate) {
        html += '<div class="history-date-header">' + dateStr + '</div>';
        lastDate = dateStr;
      }

      let details = '';
      const lt = logTypes.find(t => t.id === entry.logType);
      if (lt) {
        lt.fields.forEach(f => {
          const val = entry.fields?.[f.key];
          if (val) details += '<div class="entry-field"><span class="field-label">' + esc(f.name) + ':</span> ' + esc(val) + '</div>';
        });
      }

      if (entry.gasStats) {
        details += '<div class="entry-gas-stats">' +
          '<span>\u26FD ' + entry.gasStats.mpg + ' MPG</span>' +
          '<span>\uD83D\uDEE3 ' + entry.gasStats.milesDriven + ' mi</span>' +
          (entry.gasStats.costPerMile ? '<span>\uD83D\uDCB0 $' + entry.gasStats.costPerMile + '/mi</span>' : '') +
          '</div>';
      }

      if (entry.notes) {
        details += '<div class="entry-notes">' + esc(entry.notes) + '</div>';
      }

      let locHtml = '';
      if (entry.location) {
        locHtml = '<a href="https://www.google.com/maps?q=' + entry.location.lat + ',' + entry.location.lng + '" target="_blank" class="entry-location">' +
          '\uD83D\uDCCD ' + entry.location.lat.toFixed(4) + ', ' + entry.location.lng.toFixed(4) + '</a>';
      }

      html +=
        '<div class="history-card">' +
          '<div class="entry-header">' +
            '<div><span class="entry-type-badge">' + (entry.logTypeIcon || '\uD83D\uDCCC') + ' ' + esc(entry.logTypeName || entry.logType) + '</span>' +
            '<span class="entry-time">' + timeStr + '</span></div>' +
            '<button class="delete-entry-btn" data-id="' + entry.id + '">\u00D7</button>' +
          '</div>' +
          details +
          locHtml +
        '</div>';
    });

    container.innerHTML = html;

    // Attach delete handlers
    container.querySelectorAll('.delete-entry-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        if (confirm('Delete this entry?')) {
          await DB.deleteEntry(this.dataset.id);
          renderHistory();
          toast('Entry deleted');
        }
      });
    });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // STATS PAGE
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  async function renderStats() {
    const div = document.getElementById('stats-content');
    const entries = await DB.getAllEntries();

    if (entries.length === 0) {
      div.innerHTML = '<div class="empty-state">No data yet. Start logging to see stats!</div>';
      return;
    }

    // Overall stats
    const total = entries.length;
    const typeCounts = {};
    entries.forEach(e => { typeCounts[e.logType] = (typeCounts[e.logType] || 0) + 1; });

    // Streak calculation
    const daysWithEntries = new Set(
      entries.map(e => new Date(e.timestamp).toDateString())
    );
    let streak = 0;
    let checkDate = new Date();
    while (daysWithEntries.has(checkDate.toDateString())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    let html = '<div class="card"><h3>\uD83D\uDCCA Overview</h3><div class="stat-grid">' +
      '<div class="stat-card"><div class="stat-value">' + total + '</div><div class="stat-label">Total Entries</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + streak + '</div><div class="stat-label">Day Streak \uD83D\uDD25</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + daysWithEntries.size + '</div><div class="stat-label">Active Days</div></div>' +
      '</div></div>';

    // Type breakdown
    html += '<div class="card"><h3>\uD83D\uDCCB Entries by Type</h3>';
    logTypes.forEach(lt => {
      const count = typeCounts[lt.id] || 0;
      const pct = total > 0 ? (count / total * 100).toFixed(0) : 0;
      html += '<div class="type-bar"><div class="type-bar-label">' + lt.icon + ' ' + esc(lt.name) + ' (' + count + ')</div>' +
        '<div class="type-bar-track"><div class="type-bar-fill" style="width:' + pct + '%;background:' + lt.color + '"></div></div></div>';
    });
    html += '</div>';

    // Gas stats
    const gasEntries = entries.filter(e => e.logType === 'gas');
    if (gasEntries.length > 0) {
      const withMpg = gasEntries.filter(e => e.gasStats?.mpg);
      const avgMpg = withMpg.length > 0 ? (withMpg.reduce((s, e) => s + parseFloat(e.gasStats.mpg), 0) / withMpg.length).toFixed(1) : 'N/A';
      const totalGallons = gasEntries.filter(e => e.fields?.gallons).reduce((s, e) => s + parseFloat(e.fields.gallons), 0;
    const DAY = 86400000;

    if (entries.length === 0) {
      div.innerHTML = '<div class="empty-state"><div class="empty-icon">\uD83D\uDCC8</div><p class="empty-text">Start logging to see your stats!</p></div>';
      return;
    }

    const thisWeek = entries.filter(e => (now - e.timestamp) < 7 * DAY).length;
    const thisMonth = entries.filter(e => (now - e.timestamp) < 30 * DAY).length;
    const uniqueDays = new Set(entries.map(e => new Date(e.timestamp).toDateString())).size;

    // Streak calculation
    const daySet = new Set(entries.map(e => {
      const d = new Date(e.timestamp);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const check = new Date(today);
      check.setDate(check.getDate() - i);
      const key = check.getFullYear() + '-' + String(check.getMonth() + 1).padStart(2, '0') + '-' + String(check.getDate()).padStart(2, '0');
      if (daySet.has(key)) streak++;
      else break;
    }

    let html = '<div class="stat-grid">' +
      '<div class="stat-card"><div class="stat-value">' + entries.length + '</div><div class="stat-label">Total Entries</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + streak + '</div><div class="stat-label">Day Streak</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + thisWeek + '</div><div class="stat-label">This Week</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + uniqueDays + '</div><div class="stat-label">Days Logged</div></div>' +
      '</div>';

    // Type breakdown bars
    html += '<div class="card"><h3>Entries by Type</h3>';
    const typeCounts = {};
    entries.forEach(e => { typeCounts[e.logType] = (typeCounts[e.logType] || 0) + 1; });
    const maxCount = Math.max(...Object.values(typeCounts));

    Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]).forEach(typeId => {
      const lt = logTypes.find(t => t.id === typeId);
      const pct = (typeCounts[typeId] / maxCount * 100).toFixed(0);
      html += '<div class="bar-item"><div class="bar-label"><span class="bar-label-name">' + (lt ? lt.icon + ' ' + lt.name : typeId) +
        '</span><span class="bar-label-count">' + typeCounts[typeId] + '</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + (lt ? lt.color : '#666') + '"></div></div></div>';
    });
    html += '</div>';

    // Gas stats
    const gasEntries = entries.filter(e => e.logType === 'gas');
    const gasWithCalc = gasEntries.filter(e => e.calculated && e.calculated.mpg);
    if (gasEntries.length > 0) {
      const avgMpg = gasWithCalc.length > 0 ? (gasWithCalc.reduce((s, e) => s + parseFloat(e.calculated.mpg), 0) / gasWithCalc.length).toFixed(1) : '--';
      const totalGallons = gasEntries.filter(e => e.fields?.gallons).reduce((s, e) => s + parseFloat(e.fields.gallons), 0);
      const totalGasCost = gasEntries.filter(e => e.fields?.totalCost).reduce((s, e) => s + parseFloat(e.fields.totalCost), 0);

      html += '<div class="card"><h3>\u26FD Gas Fill-Up Stats</h3><div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-value">' + avgMpg + '</div><div class="stat-label">Avg MPG</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + totalGallons.toFixed(1) + '</div><div class="stat-label">Total Gallons</div></div>' +
        '<div class="stat-card"><div class="stat-value">$' + totalGasCost.toFixed(0) + '</div><div class="stat-label">Total Gas Cost</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + gasEntries.length + '</div><div class="stat-label">Fill-Ups</div></div>' +
        '</div></div>';
    }

    // Meal spending
    const mealEntries = entries.filter(e => e.logType === 'meal' && e.fields?.cost);
    if (mealEntries.length > 0) {
      const total = mealEntries.reduce((s, e) => s + parseFloat(e.fields.cost || 0), 0);
      html += '<div class="card"><h3>\uD83C\uDF7D\uFE0F Meal Spending</h3><div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-value">$' + total.toFixed(0) + '</div><div class="stat-label">Total Spent</div></div>' +
        '<div class="stat-card"><div class="stat-value">$' + (total / mealEntries.length).toFixed(2) + '</div><div class="stat-label">Avg per Meal</div></div>' +
        '</div></div>';
    }

    // Shopping spending
    const shopEntries = entries.filter(e => e.logType === 'shopping' && e.fields?.totalSpent);
    if (shopEntries.length > 0) {
      const total = shopEntries.reduce((s, e) => s + parseFloat(e.fields.totalSpent || 0), 0);
      html += '<div class="card"><h3>\uD83D\uDED2 Shopping Spending</h3><div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-value">$' + total.toFixed(0) + '</div><div class="stat-label">Total Spent</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + shopEntries.length + '</div><div class="stat-label">Shopping Trips</div></div>' +
        '</div></div>';
    }

    div.innerHTML = html;
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // SETTINGS â LOG TYPE MANAGEMENT
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function renderSettingsTypes() {
    const list = document.getElementById('log-types-manager');
    list.innerHTML = '';

    logTypes.forEach(lt => {
      const row = document.createElement('div');
      row.className = 'type-manager-row';
      row.innerHTML =
        '<div class="type-info">' +
          '<span class="type-icon-display">' + lt.icon + '</span>' +
          '<div><div class="type-name">' + esc(lt.name) + '</div>' +
          '<div class="type-fields-count">' + lt.fields.length + ' custom field' + (lt.fields.length !== 1 ? 's' : '') + '</div></div>' +
        '</div>' +
        '<div class="type-actions">' +
          '<button class="edit-type-btn" data-id="' + lt.id + '">Edit</button>' +
          (lt.isDefault ? '' : '<button class="del-type-btn" data-id="' + lt.id + '">Delete</button>') +
        '</div>';

      row.querySelector('.edit-type-btn').addEventListener('click', function() {
        editLogType(this.dataset.id);
      });

      const delBtn = row.querySelector('.del-type-btn');
      if (delBtn) {
        delBtn.addEventListener('click', async function() {
          if (confirm('Delete "' + lt.name + '"? Existing entries of this type will remain in your history.')) {
            await DB.deleteLogType(this.dataset.id);
            logTypes = await DB.getAllLogTypes();
            renderSettingsTypes();
            renderLogTypeGrid();
            toast(lt.name + ' deleted');
          }
        });
      }

      list.appendChild(row);
    });
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // ADD / EDIT LOG TYPE MODAL
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function openAddTypeModal() {
    editingTypeId = null;
    document.getElementById('modal-title').textContent = 'Add New Log Type';
    document.getElementById('type-name').value = '';
    document.getElementById('type-icon').value = '';
    document.getElementById('type-color').value = '#2563eb';
    document.getElementById('fields-builder').innerHTML = '';
    document.getElementById('modal-save-btn').textContent = 'Save Log Type';
    document.getElementById('modal-overlay').classList.add('active');
  }

  function editLogType(id) {
    const lt = logTypes.find(t => t.id === id);
    if (!lt) return;
    editingTypeId = id;
    document.getElementById('modal-title').textContent = 'Edit ' + lt.name;
    document.getElementById('type-name').value = lt.name;
    document.getElementById('type-icon').value = lt.icon;
    document.getElementById('type-color').value = lt.color;
    document.getElementById('modal-save-btn').textContent = 'Update Log Type';

    const builder = document.getElementById('fields-builder');
    builder.innerHTML = '';
    lt.fields.forEach(f => addFieldRow(f));

    document.getElementById('modal-overlay').classList.add('active');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    editingTypeId = null;
  }

  function addFieldRow(existing) {
    const builder = document.getElementById('fields-builder');
    const row = document.createElement('div');
    row.className = 'field-builder-row';

    row.innerHTML =
      '<div class="fb-top">' +
        '<input type="text" placeholder="Field name" class="fb-name" value="' + (existing ? escAttr(existing.name) : '') + '">' +
        '<select class="fb-type">' +
          '<option value="text"' + (existing?.type === 'text' ? ' selected' : '') + '>Text</option>' +
          '<option value="number"' + (existing?.type === 'number' ? ' selected' : '') + '>Number</option>' +
          '<option value="textarea"' + (existing?.type === 'textarea' ? ' selected' : '') + '>Long Text</option>' +
          '<option value="select"' + (existing?.type === 'select' ? ' selected' : '') + '>Dropdown</option>' +
        '</select>' +
        '<button class="fb-remove">&times;</button>' +
      '</div>' +
      '<div class="fb-options' + (existing?.type === 'select' ? ' visible' : '') + '">' +
        '<input type="text" placeholder="Options (comma-separated)" class="fb-opts" value="' + (existing?.options ? escAttr(existing.options) : '') + '">' +
      '</div>';

    const typeSelect = row.querySelector('.fb-type');
    const optsDiv = row.querySelector('.fb-options');
    typeSelect.addEventListener('change', () => {
      optsDiv.classList.toggle('visible', typeSelect.value === 'select');
    });

    row.querySelector('.fb-remove').addEventListener('click', () => row.remove());

    builder.appendChild(row);
  }

  async function saveLogType() {
    const name = document.getElementById('type-name').value.trim();
    const icon = document.getElementById('type-icon').value.trim() || '\uD83D\uDCCC';
    const color = document.getElementById('type-color').value;

    if (!name) {
      toast('Please enter a name', 'warning');
      return;
    }

    // Collect fields
    const fields = [];
    document.querySelectorAll('#fields-builder .field-builder-row').forEach(row => {
      const fname = row.querySelector('.fb-name').value.trim();
      const ftype = row.querySelector('.fb-type').value;
      const fopts = row.querySelector('.fb-opts').value.trim();
      if (fname) {
        fields.push({
          name: fname,
          key: fname.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'field' + fields.length,
          type: ftype,
          options: ftype === 'select' ? fopts : undefined
        });
      }
    });

    if (editingTypeId) {
      // Update existing
      const lt = logTypes.find(t => t.id === editingTypeId);
      if (lt) {
        lt.name = name;
        lt.icon = icon;
        lt.color = color;
        lt.fields = fields;
        await DB.saveLogType(lt);
      }
    } else {
      // Create new
      const id = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + '_' + Date.now().toString(36);
      const newType = {
        id, name, icon, color, fields,
        isDefault: false,
        order: logTypes.length
      };
      await DB.saveLogType(newType);
    }

    logTypes = await DB.getAllLogTypes();
    closeModal();
    renderLogTypeGrid();
    renderSettingsTypes();
    toast(editingTypeId ? 'Log type updated!' : 'New log type added!');
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // PREFERENCES
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  async function savePref(key, value) {
    prefs[key] = value;
    await DB.setPref(key, value);
    applyPrefs();
    if (key === 'gps') getLocation();
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // EXPORT / IMPORT
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  async function exportData() {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifelogger-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exported!');
  }

  async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const data = JSON.parse(e.target.result);
        const result = await DB.importAll(data);
        logTypes = await DB.getAllLogTypes();
        renderLogTypeGrid();
        toast('Imported ' + result.importedEntries + ' entries and ' + result.importedTypes + ' types!');
      } catch (err) {
        toast('Error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // UTILITIES
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg, type) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => el.remove(), 3000);
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââ
  // PUBLIC API
  // âââââââââââââââââââââââââââââââââââââââââââââââ
  return {
    init,
    saveEntry,
    cancelEntry,
    renderHistory,
    openAddTypeModal,
    closeModal,
    addFieldRow,
    saveLogType,
    savePref,
    exportData,
    importData
  };
})();

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());
