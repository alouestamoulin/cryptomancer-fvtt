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
 * Inject the "check difficulty" selector into the chat controls.
 *
 * In Foundry v13+ the chat controls (`#chat-controls`) are a single persistent
 * element that Foundry relocates between the docked chat form and the floating
 * notifications area *after* the `renderChatLog` hook fires (in
 * `ChatLog#_onRender` → `_toggleNotifications`). Injecting on `renderChatLog`
 * therefore orphaned the selector in a hidden container, so it never worked and
 * every roll fell back to the default difficulty ("Ardue"). The `renderChatInput`
 * hook fires from `_toggleNotifications` with the controls already in their final
 * location, so we inject there instead, de-duplicating per chat instance.
 */
async function injectDifficultySelector(chatControls: HTMLElement, root?: HTMLElement | null): Promise<void> {
  const scope = root ?? chatControls.parentElement;
  if (!scope) return;

  // Remove any previously-injected selector for this chat instance to avoid
  // duplicates when the controls are relocated or the log is re-rendered.
  scope.querySelectorAll(".crypt-difficulty-selector").forEach((el) => el.remove());

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/cryptomancer/skill-check/difficulty-selector.hbs",
    {
      checkDifficulty: settings.getSetting("checkDifficulty") ?? CheckDifficulty.Challenging,
    }
  );
  chatControls.insertAdjacentHTML("beforebegin", content);

  const selector = chatControls.previousElementSibling;
  if (!(selector instanceof HTMLElement) || !selector.classList.contains("crypt-difficulty-selector")) {
    return;
  }

  // Wire the toggle boxes as a single-choice (radio-like) group.
  const toggles = Array.from(selector.querySelectorAll<HTMLInputElement>(".toggles input"));
  toggles.forEach((input) => {
    input.addEventListener("change", (event) => {
      const target = event.currentTarget as HTMLInputElement;
      const difficulty = target.closest<HTMLElement>(".difficulty")?.dataset.difficulty as
        | "trivial"
        | "challenging"
        | "tough"
        | undefined;
      // Keep exactly one option selected.
      toggles.forEach((el) => (el.checked = el === target));
      if (difficulty) SkillCheckService.setCheckDifficulty(difficulty);
    });
  });
}

// v13+: fired from `ChatLog#_toggleNotifications` with the controls in place.
Hooks.on("renderChatInput", (app: { element?: HTMLElement }, elements: Record<string, HTMLElement>) => {
  const chatControls = elements?.["#chat-controls"];
  if (chatControls) void injectDifficultySelector(chatControls, app?.element ?? null);
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
