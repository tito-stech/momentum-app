/* ==========================================================================
   MOMENTUM - Access keys (controle d'acces par cle d'activation)
   ==========================================================================

   EDITE CE FICHIER pour ajouter / retirer des cles d'acces.

   Format : 'CLE_EN_MAJUSCULES': 'Nom de la personne (pour toi, invisible pour elle)'

   Pour generer une cle propre : nom + annee + 3 caracteres random, par exemple :
   - PAPA2026X7Q
   - MARIE2026ABC

   Chaque personne a besoin de SA cle unique pour activer l'app.
   Si tu retires une cle ici et republies, la personne perd l'acces au prochain
   lancement (sa cle sera refusee).
   ========================================================================== */

const ACCESS_KEYS = {

  // Ta cle maitre (ne la perd pas)
  'TITO2026ADMIN': 'Tito (admin)',

  // Cles d'exemple, remplace par de vraies cles pour tes proches
  'DEMO2026ESSAI': 'Essai libre',

  // Ajoute ici de nouvelles cles comme ceci :
  // 'PAPA2026X7Q': 'Papa',
  // 'MARIE2026ABC': 'Marie',

};

// Normalisation : on compare toujours en majuscules, sans espaces
function normalizeKey(k) {
  return String(k || '').trim().toUpperCase().replace(/\s/g, '');
}

function isValidKey(k) {
  return Object.prototype.hasOwnProperty.call(ACCESS_KEYS, normalizeKey(k));
}

function getKeyOwner(k) {
  return ACCESS_KEYS[normalizeKey(k)] || null;
}
