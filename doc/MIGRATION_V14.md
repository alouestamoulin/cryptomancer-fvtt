# Migration Foundry VTT v9 → v13/v14 (0.9.0)

Ce document récapitule la migration du système de l'API Foundry **v9** vers **v13/v14**,
et liste les points à **vérifier en jeu** (la migration a été validée par le build, mais
n'a pas pu être testée dans une instance Foundry en cours d'exécution).

## Ce qui a été fait

### Manifeste (`src/system.json`)
- `name` → `id`.
- `minimumCoreVersion` / `compatibleCoreVersion` → objet `compatibility` (`minimum: 13`, `verified: 14`, `maximum: 14`).
- `author` (chaîne) → `authors` (tableau).
- `gridDistance` / `gridUnits` → objet `grid`.
- Paquets : `path` pointe désormais vers des répertoires LevelDB (`packs/<nom>`, sans `.db`),
  avec `system: "cryptomancer"` et `ownership`.
- Version portée à `0.9.0`.

### Compendiums (`src/packs/*.db` → `dist/packs/<nom>/`)
- Les entrées Item passent du conteneur `data` au conteneur `system`.
- Les entrées JournalEntry passent de `content` (v9) à `pages` (v10+).
- `permission` → `ownership`.
- Les sources restent en NeDB (`.db`) et sont **compilées en LevelDB** au build via
  `tools/compile-packs.mjs` (dépendance `@foundryvtt/foundryvtt-cli`). Foundry v11+ ne lit
  plus les paquets NeDB au runtime.

### Code (TypeScript) et gabarits (Handlebars)
- `document.data.data.X` → `document.system.X`, `document.data.type` → `document.type`,
  `document.data._id` → `document.id`, etc.
- Charges utiles de mise à jour : `{ data: {...} }` → `{ system: {...} }`, clés `"data.x"` → `"system.x"`.
- Gabarits : `data.data.X` → `system.X`, noms de champs `name="data.x"` → `name="system.x"`.
  Les feuilles exposent désormais `context.system = this.document.system` (données vivantes,
  incluant les tableaux dérivés).
- Globales dépréciées remplacées :
  - `mergeObject` / `isNewerVersion` / `expandObject` → `foundry.utils.*`
  - `isObjectEmpty` → `foundry.utils.isEmpty`
  - `renderTemplate` / `loadTemplates` → `foundry.applications.handlebars.*`
  - `CONST.CHAT_MESSAGE_TYPES` → `CONST.CHAT_MESSAGE_STYLES`
  - `message.data.speaker` → `message.speaker`, `message.user` → `message.author`
  - `ActiveEffect` : `label`/`icon` → `name`/`img`, `effect.data.disabled` → `effect.disabled`
- Hook `renderChatMessage` (jQuery) → `renderChatMessageHTML` (HTMLElement, ré-emballé en jQuery).
- `renderChatLog` : le paramètre HTML est ré-emballé via `$(html)` pour tolérer HTMLElement.
- Chargeur de gabarits (`shared/templates.ts`) : l'ancien mécanisme
  `socket.emit("template", …)` (supprimé en v12) est remplacé par `loadTemplates`.
- Création de macro d'objet : `data.data` → `Item.fromDropData(data)`.

### Build
- `foundry-vtt-types` reste épinglé à v9 : le typage ne connaît pas l'API v13/v14. Le build
  émet donc le JS **malgré les erreurs de types** (`noEmitOnError: false` dans `rollup.config.js`).
  Ces erreurs de types sont attendues et sans effet sur le JS produit.

## À vérifier en jeu (Foundry v14)

Ces éléments dépendent du runtime et n'ont pas pu être testés automatiquement :

1. **Feuilles de personnage / groupe / objet** : ouverture, affichage des cœurs, attributs,
   compétences, équipement, biographie ; édition des champs (les `name="system.*"` doivent
   enregistrer correctement).
2. **Éditeur de texte enrichi** `{{editor}}` (descriptions d'objets, background) : le helper
   `{{editor}}` est déprécié en v13. S'il ne fonctionne plus, le remplacer par l'élément
   `<prose-mirror>` / `foundry.applications.elements.HTMLProseMirrorElement`.
3. **Jets de compétence / risque** : rendu des cartes de chat, boutons +/- de difficulté,
   boutons d'action de compétence dans le chat.
4. **Sélecteur de difficulté** injecté dans le log de chat (`renderChatLog`).
5. **Compendiums** : ouverture des 9 paquets, import d'objets/talents/sorts, ouverture des
   entrées JournalEntry (règles) et de leurs pages.
6. **Effets actifs** (création/bascule/suppression) si utilisés.
7. **Migration de mondes existants** (`shared/migrations.ts`) sur un monde v9 mis à niveau.
8. **Glisser-déposer d'objet vers la barre de macros**.

## Étapes ultérieures possibles (hors périmètre de cette migration)

- Porter les feuilles vers **ApplicationV2** (les feuilles V1 `ActorSheet`/`ItemSheet` sont
  dépréciées et seront retirées vers v16).
- Définir un **DataModel** (`template.json` reste supporté mais déprécié à terme).
- Mettre à jour `foundry-vtt-types` vers une version compatible v13 pour rétablir le typage.
