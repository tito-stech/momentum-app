/* ==========================================================================
   MOMENTUM - IndexedDB wrapper
   Stores: habits, habitLogs, goals, journal, transactions, workouts,
           bodyMeasures, sleepLogs, books, skills, pomodoroSessions,
           tasks, settings
   ========================================================================== */

const DB = (() => {

  const NAME = 'momentum';
  const VERSION = 1;
  const STORES = [
    'habits', 'habitLogs',
    'goals',
    'journal',
    'transactions', 'budgets',
    'workouts', 'bodyMeasures', 'nutrition',
    'sleepLogs',
    'books', 'skills', 'pomodoroSessions',
    'tasks',
    'settings'
  ];

  let db;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = (e) => {
        const _db = e.target.result;
        STORES.forEach(s => {
          if (!_db.objectStoreNames.contains(s)) {
            const store = _db.createObjectStore(s, { keyPath: 'id' });
            if (s === 'habitLogs') store.createIndex('date', 'date');
            if (s === 'transactions') store.createIndex('date', 'date');
            if (s === 'journal') store.createIndex('date', 'date');
            if (s === 'workouts') store.createIndex('date', 'date');
            if (s === 'sleepLogs') store.createIndex('date', 'date');
            if (s === 'bodyMeasures') store.createIndex('date', 'date');
            if (s === 'nutrition') store.createIndex('date', 'date');
            if (s === 'pomodoroSessions') store.createIndex('date', 'date');
          }
        });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function tx(store, mode = 'readonly') {
    const d = await open();
    return d.transaction(store, mode).objectStore(store);
  }

  function run(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(store) {
    const s = await tx(store);
    return run(s.getAll());
  }

  async function get(store, id) {
    const s = await tx(store);
    return run(s.get(id));
  }

  async function put(store, obj) {
    if (!obj.id) obj.id = U.uid();
    if (!obj.createdAt) obj.createdAt = Date.now();
    obj.updatedAt = Date.now();
    const s = await tx(store, 'readwrite');
    await run(s.put(obj));
    return obj;
  }

  async function del(store, id) {
    const s = await tx(store, 'readwrite');
    return run(s.delete(id));
  }

  async function clear(store) {
    const s = await tx(store, 'readwrite');
    return run(s.clear());
  }

  async function clearAll() {
    for (const s of STORES) {
      await clear(s);
    }
  }

  async function count(store) {
    const s = await tx(store);
    return run(s.count());
  }

  // Settings helpers
  async function getSetting(key, def = null) {
    const s = await get('settings', key);
    return s ? s.value : def;
  }

  async function setSetting(key, value) {
    const s = await tx('settings', 'readwrite');
    return run(s.put({ id: key, value, updatedAt: Date.now() }));
  }

  // Export
  async function exportAll() {
    const data = { version: VERSION, exportedAt: new Date().toISOString(), stores: {} };
    for (const s of STORES) {
      data.stores[s] = await getAll(s);
    }
    return data;
  }

  async function importAll(data, { replace = false } = {}) {
    if (!data || !data.stores) throw new Error('Format invalide');
    if (replace) await clearAll();
    for (const s of STORES) {
      if (!data.stores[s]) continue;
      for (const item of data.stores[s]) {
        await put(s, item);
      }
    }
  }

  return { open, getAll, get, put, del, clear, clearAll, count, getSetting, setSetting, exportAll, importAll, STORES };
})();
