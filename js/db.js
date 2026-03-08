// âââââââââââââââââââââââââââââââââââââââââââââââ
// LifeLogger â IndexedDB Data Layer
// All data stays on-device for privacy
// âââââââââââââââââââââââââââââââââââââââââââââââ

const DB = (() => {
  const DB_NAME = 'LifeLoggerDB';
  const DB_VERSION = 1;
  let db = null;

  // âââ Default Log Types âââ
  const DEFAULT_LOG_TYPES = [
    {
      id: 'journal',
      name: 'Journal',
      icon: '\u270D\uFE0F',
      color: '#2563eb',
      fields: [],
      isDefault: true,
      order: 0
    },
    {
      id: 'meal',
      name: 'Meal',
      icon: '\uD83C\uDF7D\uFE0F',
      color: '#ea580c',
      fields: [
        { name: 'Meal Type', key: 'mealType', type: 'select', options: 'Breakfast,Lunch,Dinner,Snack' },
        { name: 'Restaurant / Location', key: 'restaurant', type: 'text' },
        { name: 'What I Ate', key: 'whatIAte', type: 'text' },
        { name: 'Cost ($)', key: 'cost', type: 'number' }
      ],
      isDefault: true,
      order: 1
    },
    {
      id: 'shopping',
      name: 'Shopping',
      icon: '\uD83D\uDED2',
      color: '#7c3aed',
      fields: [
        { name: 'Store Name', key: 'store', type: 'text' },
        { name: 'Items Bought', key: 'items', type: 'textarea' },
        { name: 'Total Spent ($)', key: 'totalSpent', type: 'number' }
      ],
      isDefault: true,
      order: 2
    },
    {
      id: 'gas',
      name: 'Gas Fill-Up',
      icon: '\u26FD',
      color: '#16a34a',
      fields: [
        { name: 'Odometer Reading', key: 'odometer', type: 'number', required: true },
        { name: 'Gallons', key: 'gallons', type: 'number', required: true },
        { name: 'Price per Gallon ($)', key: 'pricePerGallon', type: 'number' },
        { name: 'Total Cost ($)', key: 'totalCost', type: 'number' },
        { name: 'Station Name', key: 'station', type: 'text' }
      ],
      isDefault: true,
      order: 3
    },
    {
      id: 'errand',
      name: 'Errand',
      icon: '\uD83D\uDCCB',
      color: '#0891b2',
      fields: [
        { name: 'Errand Type', key: 'errandType', type: 'select', options: 'Pharmacy,Post Office,Bank,Dry Cleaning,Other' },
        { name: 'Details', key: 'details', type: 'text' }
      ],
      isDefault: true,
      order: 4
    },
    {
      id: 'health',
      name: 'Health',
      icon: '\uD83C\uDFE5',
      color: '#dc2626',
      fields: [
        { name: 'Type', key: 'healthType', type: 'select', options: 'Doctor Visit,Pharmacy,Exercise,Symptoms,Medication' },
        { name: 'Provider / Details', key: 'provider', type: 'text' },
        { name: 'Mood (1-10)', key: 'mood', type: 'number' }
      ],
      isDefault: true,
      order: 5
    }
  ];

  const DEFAULT_PREFS = {
    gps: true,
    largeText: false,
    highContrast: false,
    caregiver: false
  };

  // âââ Open Database âââ
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Entries store
        if (!db.objectStoreNames.contains('entries')) {
          const entryStore = db.createObjectStore('entries', { keyPath: 'id' });
          entryStore.createIndex('logType', 'logType', { unique: false });
          entryStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Log types store
        if (!db.objectStoreNames.contains('logTypes')) {
          db.createObjectStore('logTypes', { keyPath: 'id' });
        }

        // Preferences store (key-value)
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs', { keyPath: 'key' });
        }
      };

      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  // âââ Generic helpers âââ
  function tx(storeName, mode = 'readonly') {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // âââ Initialize defaults âââ
  async function init() {
    await open();

    // Seed log types if empty
    const existingTypes = await getAll('logTypes');
    if (existingTypes.length === 0) {
      for (const lt of DEFAULT_LOG_TYPES) {
        await put('logTypes', lt);
      }
    }

    // Seed prefs if empty
    const existingPrefs = await getAll('prefs');
    if (existingPrefs.length === 0) {
      for (const [key, value] of Object.entries(DEFAULT_PREFS)) {
        await put('prefs', { key, value });
      }
    }

    return true;
  }

  // âââ CRUD Operations âââ
  async function getAll(storeName) {
    return promisify(tx(storeName).getAll());
  }

  async function get(storeName, key) {
    return promisify(tx(storeName).get(key));
  }

  async function put(storeName, data) {
    return promisify(tx(storeName, 'readwrite').put(data));
  }

  async function del(storeName, key) {
    return promisify(tx(storeName, 'readwrite').delete(key));
  }

  // âââ Entries âââ
  async function getAllEntries() {
    const entries = await getAll('entries');
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  async function addEntry(entry) {
    entry.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    entry.timestamp = Date.now();
    await put('entries', entry);
    return entry;
  }

  async function deleteEntry(id) {
    return del('entries', id);
  }

  async function getEntriesByType(logType) {
    const all = await getAllEntries();
    return all.filter(e => e.logType === logType);
  }

  async function getLastGasFill() {
    const gasEntries = await getEntriesByType('gas');
    const withOdometer = gasEntries.filter(e => e.fields && e.fields.odometer);
    return withOdometer[0] || null; // Already sorted desc
  }

  // âââ Log Types âââ
  async function getAllLogTypes() {
    const types = await getAll('logTypes');
    return types.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async function saveLogType(logType) {
    return put('logTypes', logType);
  }

  async function deleteLogType(id) {
    return del('logTypes', id);
  }

  // âââ Preferences âââ
  async function getPref(key) {
    const p = await get('prefs', key);
    return p ? p.value : DEFAULT_PREFS[key];
  }

  async function setPref(key, value) {
    return put('prefs', { key, value });
  }

  async function getAllPrefs() {
    const prefs = await getAll('prefs');
    const result = { ...DEFAULT_PREFS };
    prefs.forEach(p => { result[p.key] = p.value; });
    return result;
  }

  // âââ Export / Import âââ
  async function exportAll() {
    return {
      entries: await getAll('entries'),
      logTypes: await getAll('logTypes'),
      prefs: await getAll('prefs'),
      exportDate: new Date().toISOString(),
      version: DB_VERSION
    };
  }

  async function importAll(data) {
    if (!data || !data.entries || !data.logTypes) {
      throw new Error('Invalid backup file');
    }

    // Get existing IDs to merge
    const existingEntryIds = new Set((await getAll('entries')).map(e => e.id));
    const existingTypeIds = new Set((await getAll('logTypes')).map(t => t.id));

    let importedEntries = 0;
    let importedTypes = 0;

    for (const entry of data.entries) {
      if (!existingEntryIds.has(entry.id)) {
        await put('entries', entry);
        importedEntries++;
      }
    }

    for (const lt of data.logTypes) {
      if (!existingTypeIds.has(lt.id)) {
        await put('logTypes', lt);
        importedTypes++;
      }
    }

    return { importedEntries, importedTypes };
  }

  // âââ Public API âââ
  return {
    init,
    getAllEntries,
    addEntry,
    deleteEntry,
    getEntriesByType,
    getLastGasFill,
    getAllLogTypes,
    saveLogType,
    deleteLogType,
    getPref,
    setPref,
    getAllPrefs,
    exportAll,
    importAll,
    DEFAULT_PREFS
  };
})();
