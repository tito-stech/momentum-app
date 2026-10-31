# Momentum - Suivi personnel complet

App de développement personnel en PWA (Progressive Web App), 100% locale, zéro API, zéro dépendance externe. Installable sur Android, iOS, Windows et Mac depuis un simple navigateur.

## Fonctionnalités

**10 modules** couvrant tout le développement personnel :

- **Dashboard** - Vue d'ensemble, stats du jour, accès rapides, humeur sur 14j
- **Habitudes** - Habit tracker avec streaks, heatmap style GitHub (6 mois), compteur quotidien
- **Objectifs** - OKR avec Key Results cochables, deadlines, catégories, % de progression
- **Journal** - Humeur (5 niveaux), gratitude, tags, graph humeur 30j, top tags
- **Finances** - Revenus/dépenses, catégories visuelles, donut, évolution 12 mois, taux d'épargne
- **Fitness** - Séances muscu avec séries/reps/poids, volume hebdo, mesures corps, nutrition macros
- **Sommeil** - Durée + qualité + dette, ring de progression, historique 14 nuits
- **Apprentissage** - Pomodoro intégré, livres (en cours/lus/wishlist), compétences avec niveaux
- **Tâches** - Priorités P1-P4, échéances, projets, filtres (aujourd'hui/en retard/terminées)
- **Statistiques globales** - KPIs, heatmap d'activité tous modules, corrélations détectées

## Techno

- HTML + CSS + JS vanilla, **zéro dépendance** (pas de framework, pas de CDN)
- **IndexedDB** pour le stockage local (plus robuste que localStorage pour gros volume)
- **Service Worker** pour fonctionnement 100% hors ligne après premier chargement
- **Manifest PWA** pour installation sur écran d'accueil
- Graphs **SVG natifs** faits maison (line, bar, donut, ring, heatmap, sparkline)
- Thèmes clair / sombre / auto (suit le système)
- Export/import JSON pour backup

## Lancement en local

Un service worker ne marche pas en `file://`, il faut un serveur HTTP local.

**Option Python** :
```bash
cd livrables/app-momentum
python -m http.server 8000
```
Puis ouvrir http://localhost:8000

**Option VS Code** : extension "Live Server", clic droit sur `index.html` → "Open with Live Server".

## Déploiement sur GitHub Pages

1. Push le dossier dans ton dépôt (peut rester privé, Pages marche quand même).
2. Settings → Pages → Source : branche `main`, dossier racine `/`
3. L'URL apparaît en 1-2 min, du type `https://tito-stech.github.io/jarvis-starter-kit/livrables/app-momentum/`

## Installation PWA

- **Android (Chrome)** : ouvrir l'URL → menu `⋮` → "Installer l'application"
- **iOS (Safari obligatoire)** : ouvrir l'URL → bouton partage → "Sur l'écran d'accueil"
- **Desktop (Chrome / Edge)** : icône "Installer" dans la barre d'URL

Une fois installée, l'app se lance en plein écran, sans barre d'URL, comme une native.

## Export / Import des données

Dans **Paramètres → Données** :
- **Exporter** : télécharge `momentum-export-YYYY-MM-DD.json` avec tout
- **Importer** : charge un JSON, choix "fusionner" ou "tout remplacer"

Utile pour :
- Backup régulier (recommandé : 1x par mois)
- Changement de téléphone / ordinateur
- Partage d'un modèle à ton entourage

## Structure du projet

```
app-momentum/
├── index.html              # Shell principal
├── manifest.json           # PWA manifest
├── service-worker.js       # Cache offline
├── assets/
│   └── icon.svg
├── css/
│   ├── base.css            # Variables, reset, layout, thèmes
│   ├── components.css      # Cartes, boutons, inputs, modales
│   ├── views.css           # Styles par module
│   └── animations.css      # Keyframes, transitions
└── js/
    ├── utils.js            # DOM, dates, formatage, modal, toast
    ├── db.js               # IndexedDB wrapper (13 stores)
    ├── charts.js           # Lib SVG custom (7 types de charts)
    ├── components.js       # Composants réutilisables (statCard, form, chips)
    ├── router.js           # Routeur hash
    ├── app.js              # Bootstrap
    └── views/
        ├── dashboard.js
        ├── habits.js
        ├── goals.js
        ├── journal.js
        ├── finance.js
        ├── fitness.js
        ├── sleep.js
        ├── learning.js
        ├── tasks.js
        ├── stats.js
        └── settings.js
```

## Palette

- Accent : violet `#8b5cf6` → cyan `#06b6d4` (dégradé)
- Catégories : habitudes vert, objectifs orange, journal rose, finances vert, fitness rouge, sommeil indigo, apprentissage bleu, tâches purple

## Confidentialité

**Zéro traçage, zéro envoi, zéro serveur.** Tout vit dans IndexedDB de ton navigateur, sur ta machine. Pour partager l'URL à quelqu'un, il aura ses propres données en local, séparées des tiennes.
