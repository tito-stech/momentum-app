/* ==========================================================================
   MOMENTUM - Access keys loader

   Les cles valides sont dans access-keys.json a la racine du site.
   Ce fichier charge la liste au boot, la met en cache localStorage, et
   permet un fonctionnement offline une fois qu'elle est en cache.

   Pour inviter / revoquer : edite access-keys.json via GitHub, pas ce fichier.
   ========================================================================== */

const CACHE_KEY = 'momentum.accessKeys.cache';
const CACHE_META = 'momentum.accessKeys.cacheAt';

// Cle maitre toujours valide, meme si le JSON est inaccessible.
// A conserver pour pouvoir toujours entrer dans l'app en cas de pepin.
const FALLBACK_ADMIN_KEYS = {
  'TITO2026ADMIN': 'Tito (admin)'
};

async function loadAccessKeys() {
  // 1. Essayer de recuperer la version a jour sur le reseau
  try {
    const resp = await fetch('./access-keys.json?t=' + Date.now(), { cache: 'no-cache' });
    if (resp.ok) {
      const data = await resp.json();
      const keys = (data && data.keys) ? data.keys : {};
      // Cache pour mode offline futur
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(keys));
        localStorage.setItem(CACHE_META, new Date().toISOString());
      } catch {}
      return { ...FALLBACK_ADMIN_KEYS, ...keys };
    }
  } catch (err) {
    console.warn('[access-keys] Fetch impossible, bascule sur cache', err?.message);
  }

  // 2. Pas de reseau, essayer le cache local
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return { ...FALLBACK_ADMIN_KEYS, ...JSON.parse(cached) };
  } catch {}

  // 3. Dernier recours : juste la cle admin
  return { ...FALLBACK_ADMIN_KEYS };
}

function normalizeKey(k) {
  return String(k || '').trim().toUpperCase().replace(/\s/g, '');
}

function isValidKey(k) {
  const keys = window._accessKeys || FALLBACK_ADMIN_KEYS;
  return Object.prototype.hasOwnProperty.call(keys, normalizeKey(k));
}

function getKeyOwner(k) {
  const keys = window._accessKeys || FALLBACK_ADMIN_KEYS;
  return keys[normalizeKey(k)] || null;
}

function getKeysCacheAge() {
  try {
    const at = localStorage.getItem(CACHE_META);
    if (!at) return null;
    return Math.round((Date.now() - new Date(at).getTime()) / 60000);
  } catch { return null; }
}
