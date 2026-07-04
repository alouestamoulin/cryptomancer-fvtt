# Cryptomancer System

Cryptomancer RPG system for Foundry Virtual Tabletop

> traduction grossiere en Français

## Prerequisites

A [FoundryVTT](https://foundryvtt.com/) license and a copy of [Cryptomancer](http://cryptorpg.com/).

## Install

### In Foundry

Search for Cryptomancer in the "Install System" dialog in Foundry.

### Manifest URL

Paste the manifest path into the "Manifest URL" field on the install system dialog in Foundry.

`https://github.com/OfficerHalf/cryptomancer-fvtt/releases/latest/download/system.json`

### Manually

Unzip `system.zip` from the latest release into your Foundry `Data/systems/cryptomancer` folder.

## Use

### Supported Features (so far!)

- Player Character sheets
- Skill checks with skill break/skill push and configurable check difficulty
- Stuff (consumables, equipment, outfits, weapons)
  - Item skill checks
  - Automatic DR tracking
- Talents and Spells
- Compendia containing all the Talents, Spells, and Stuff included in the core rules as well as Code and Dagger 1
- Party and Safehouse sheet

Note that while the system still has a version less than 1.0.0 there will be some inherent instability. Migrations will be performed, please raise an issue if there are problems going between versions.

## Foundry VTT v13 / v14

À partir de la version `0.9.0`, le système cible **Foundry VTT v13 et v14** (`compatibility.minimum: "13"`).
Il n'est plus compatible avec Foundry v9–v12.

Principaux changements de la migration :

- Manifeste au format v13 (`id`, `compatibility`, `grid`, packs `system`/`ownership`).
- Passage de l'API `entity.data.data` à `entity.system` dans tout le code et les gabarits.
- Remplacement des globales dépréciées par leurs équivalents (`foundry.utils.*`,
  `foundry.applications.handlebars.*`, `CONST.CHAT_MESSAGE_STYLES`, hook `renderChatMessageHTML`).
- **Compendiums recompilés au format LevelDB** (les paquets NeDB `.db` ne sont plus lus par Foundry v11+).

> ⚠️ La migration a été validée par le build (`npm run build`) mais **doit encore être testée en jeu**
> dans une instance Foundry v14. Voir [`doc/MIGRATION_V14.md`](doc/MIGRATION_V14.md).

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

### Build

```bash
npm install
npm run build        # bundle JS/CSS (rollup) + compile les compendiums LevelDB
npm run build:packs  # (re)compile uniquement les compendiums depuis src/packs/*.db
```

Les sources des compendiums restent au format NeDB (`src/packs/*.db`) et sont compilées
en LevelDB (`dist/packs/<nom>/`) par `tools/compile-packs.mjs`.
