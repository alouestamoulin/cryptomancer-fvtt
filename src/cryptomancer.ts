import { DropData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/foundry.js/clientDocumentMixin";

import { CharacterSheet } from "./actor-sheet/character/character-sheet";
import { CharacterSheetFr } from "./actor-sheet/character/character-sheet-fr";
import { PartySheetFr } from "./actor-sheet/party/party-sheet-fr";
import { CheckDifficulty } from "./skill-check/skill-check.enum";
import { CryptomancerActor } from "./actor/actor";
import { CryptomancerItem } from "./item/item";
import { CryptomancerItemSheet } from "./item-sheet/item-sheet";
import { getGame } from "./shared/util";
import { migrateWorld } from "./shared/migrations";
import { PartySheet } from "./actor-sheet/party/party-sheet";
import { preloadHandlebarsTemplates } from "./shared/templates";
import { SCOPE } from "./shared/constants";
import { SettingsService } from "./settings/settings.service";
import { SkillCheckService } from "./skill-check/skill-check.service";

import "./cryptomancer.scss";
import { registerHandlebarsHelpers } from "./shared/handlebars";
import { bindChatActions, hideActionButtons } from "./shared/chat/chat";

const settings = new SettingsService();

registerHandlebarsHelpers();

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  const settingsService = new SettingsService();

  // Define custom Document classes
  CONFIG.Actor.documentClass = CryptomancerActor;
  CONFIG.Item.documentClass = CryptomancerItem;

  // Register settings
  settingsService.registerSettings();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  // "PDF" sheets (official French layout) are the DEFAULT. The original cyan
  // sheets remain registered and selectable from the sheet configuration.
  Actors.registerSheet(SCOPE, CharacterSheetFr, {
    makeDefault: true,
    label: "CRYPTOMANCER.SheetType.characterFr",
    types: ["character"],
  });
  Actors.registerSheet(SCOPE, PartySheetFr, {
    makeDefault: true,
    label: "CRYPTOMANCER.SheetType.partyFr",
    types: ["party"],
  });
  Actors.registerSheet(SCOPE, CharacterSheet, {
    makeDefault: false,
    label: "CRYPTOMANCER.SheetType.character",
    types: ["character"],
  });
  Actors.registerSheet(SCOPE, PartySheet, {
    makeDefault: false,
    label: "CRYPTOMANCER.SheetType.party",
    types: ["party"],
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet(SCOPE, CryptomancerItemSheet, {
    makeDefault: true,
    label: "CRYPTOMANCER.SheetType.talent",
    types: ["talent"],
  });
  Items.registerSheet(SCOPE, CryptomancerItemSheet, {
    makeDefault: true,
    label: "CRYPTOMANCER.SheetType.spell",
    types: ["spell"],
  });
  Items.registerSheet(SCOPE, CryptomancerItemSheet, {
    makeDefault: true,
    label: "CRYPTOMANCER.SheetType.equipment",
    types: ["equipment"],
  });

  // Preload Handlebars templates.
  await preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
  const _game = getGame();

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (_bar, data, slot) => createItemMacro(data, slot));

  // Determine whether a system migration is required and feasible
  if (!_game.user?.isGM) return;
  const alwaysMigrate = (_game.modules.get("_dev-mode") as any | undefined)?.api?.getPackageDebugValue("cryptomancer");
  const currentVersion = _game.settings.get(SCOPE, "systemMigrationVersion") as string;
  // Migrate if the last installed version is LESS than this value
  // So when updating this value, it should be set to the NEWEST version
  const NEEDS_MIGRATION_VERSION = "0.8.1";
  const COMPATIBLE_MIGRATION_VERSION = "0.1.0";
  const needsMigration = !currentVersion || foundry.utils.isNewerVersion(NEEDS_MIGRATION_VERSION, currentVersion);
  if (!needsMigration && !alwaysMigrate) return;

  // Perform the migration
  if (currentVersion && foundry.utils.isNewerVersion(COMPATIBLE_MIGRATION_VERSION, currentVersion)) {
    ui.notifications?.error(_game.i18n.localize("MIGRATION.VersionTooOldWarning"), { permanent: true });
  }
  migrateWorld();
});

/**
 * Chat log render hook. Binds the delegated chat-card actions (e.g. the per-roll
 * difficulty +/- buttons). The difficulty selector itself is injected via the
 * `renderChatInput` hook below — see that handler for the v13+ rationale.
 */
Hooks.on("renderChatLog", (_: unknown, htmlEl: JQuery<HTMLElement> | HTMLElement) => {
  bindChatActions($(htmlEl as HTMLElement));
});

/**
 * The "check difficulty" selector (trivial/ardue/coriace = 4/6/8) lives in the
 * chat controls and sets the default difficulty for new rolls.
 *
 * In Foundry v13+ the chat controls (`#chat-controls`) are relocated between the
 * docked chat form and the floating notifications area *after* the
 * `renderChatLog` hook fires (in `ChatLog#_onRender` → `_toggleNotifications`),
 * and can be re-rendered on tab activate/deactivate. To be robust against all of
 * that we:
 *   - inject on the `renderChatInput` hook, which fires with the controls in
 *     their final position, keeping a single, de-duplicated instance;
 *   - handle clicks with ONE document-level, capture-phase delegated listener
 *     bound once below, so it survives every re-injection and never stacks; and
 *   - drive the checked state ourselves (suppressing the native `<label>`→`<input>`
 *     toggle), which stays correct even if element ids get duplicated across chat
 *     instances — the previous per-input `change` binding could toggle a stale,
 *     hidden duplicate and so appeared "stuck".
 */
document.addEventListener(
  "click",
  (event) => {
    const target = event.target as HTMLElement | null;
    const difficultyEl = target?.closest?.(".crypt-difficulty-selector .difficulty") as HTMLElement | null;
    if (!difficultyEl) return;

    // Take over from the native label/checkbox toggle so a single click always
    // updates the visible selector (never a stale duplicate elsewhere).
    event.preventDefault();
    const selector = difficultyEl.closest(".crypt-difficulty-selector");
    const difficulty = difficultyEl.dataset.difficulty as "trivial" | "challenging" | "tough" | undefined;
    if (!selector || !difficulty) return;

    selector.querySelectorAll<HTMLElement>(".difficulty").forEach((span) => {
      const input = span.querySelector<HTMLInputElement>("input");
      if (input) input.checked = span === difficultyEl;
    });
    SkillCheckService.setCheckDifficulty(difficulty);
  },
  true
);

async function injectDifficultySelector(chatControls: HTMLElement): Promise<void> {
  // Already correctly placed? Leave it (and its state) alone — `renderChatInput`
  // can fire repeatedly (render, tab activate/deactivate) and recreating it each
  // time would churn the DOM and reset the current selection.
  const existing = chatControls.previousElementSibling;
  if (existing instanceof HTMLElement && existing.classList.contains("crypt-difficulty-selector")) return;

  // Otherwise remove every existing instance (guarantees a single selector, so no
  // duplicate element ids) and create a fresh one reflecting the current setting.
  document.querySelectorAll(".crypt-difficulty-selector").forEach((el) => el.remove());
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/cryptomancer/skill-check/difficulty-selector.hbs",
    {
      checkDifficulty: settings.getSetting("checkDifficulty") ?? CheckDifficulty.Challenging,
    }
  );
  chatControls.insertAdjacentHTML("beforebegin", content);
}

// v13+: fired from `ChatLog#_toggleNotifications` with the controls in place.
Hooks.on("renderChatInput", (_app: unknown, elements: Record<string, HTMLElement>) => {
  const chatControls = elements?.["#chat-controls"];
  if (chatControls) void injectDifficultySelector(chatControls);
});

Hooks.once("devModeReady", ({ registerPackageDebugFlag }: any) => {
  registerPackageDebugFlag("cryptomancer");
});

/**
 * Chat message render hook.
 */
// v13+ replaced `renderChatMessage` (jQuery) with `renderChatMessageHTML` (HTMLElement).
const onRenderChatMessage = (message: ChatMessage, htmlEl: JQuery<HTMLElement> | HTMLElement) => {
  const html = $(htmlEl as HTMLElement);
  hideActionButtons(message, html);

  // Apply a css class to the message if it is configured in a flag
  const cssClass = message.getFlag("cryptomancer", "cssClass") as string | null;
  if (cssClass) {
    html.addClass(cssClass);
  }
};
Hooks.on("renderChatMessageHTML", onRenderChatMessage);

/**
 * Don't allow the creation of trademark items.
 * DEPRECATED Remove this in 1.0.0
 */
Hooks.on("renderDialog", (_: Dialog, html: JQuery<HTMLElement>) => {
  Array.from(html.find<HTMLOptionElement>("#document-create option")).forEach((option) => {
    if (option.value === "trademarkItem") {
      option.remove();
    }
  });
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data: DropData<Macro>, slot: number) {
  if ((data as any).type !== "Item") return;
  const item = await (Item as any).fromDropData(data);
  if (!item) return ui?.notifications?.warn("You can only create macro buttons for owned Items");

  // Create the macro command
  const command = `game.cryptomancer.rollItemMacro("${item.name}");`;
  let macro = (game as any).macros.find((m: any) => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "cryptomancer.itemMacro": true },
    });
  }
  (game as any).user.assignHotbarMacro(macro, slot);
  return false;
}
