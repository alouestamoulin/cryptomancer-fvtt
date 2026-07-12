const partials: Record<string, string> = {
  attributeBar: "systems/cryptomancer/shared/components/attribute-bar.hbs",
  basicInfo: "systems/cryptomancer/actor-sheet/character/components/basic-info.hbs",
  defenses: "systems/cryptomancer/actor-sheet/character/components/defenses.hbs",
  miniTriad: "systems/cryptomancer/actor-sheet/character/components/mini-triad.hbs",
  skillList: "systems/cryptomancer/actor-sheet/character/components/skill-list.hbs",
  defense: "systems/cryptomancer/actor-sheet/character/components/defense.hbs",
  features: "systems/cryptomancer/actor-sheet/character/components/features.hbs",
  bio: "systems/cryptomancer/actor-sheet/character/components/bio.hbs",
  equipment: "systems/cryptomancer/actor-sheet/character/components/equipment.hbs",
  safehouseRoom: "systems/cryptomancer/actor-sheet/party/components/safehouse-room.hbs",
  cell: "systems/cryptomancer/actor-sheet/party/components/cell.hbs",
  formField: "systems/cryptomancer/shared/components/form-field.hbs",
  coreInput: "systems/cryptomancer/shared/components/core-input.hbs",
  toggle: "systems/cryptomancer/shared/components/toggle.hbs",
  toggleBox: "systems/cryptomancer/shared/components/toggle-box.hbs",
  skill: "systems/cryptomancer/actor-sheet/character/components/skill.hbs",
  armorIcon: "systems/cryptomancer/icons/armor.hbs",
  simpleArmorIcon: "systems/cryptomancer/icons/simpleArmor.hbs",
  // Alternative "PDF" (FR) sheet partials
  frField: "systems/cryptomancer/actor-sheet/character/components/fr-field.hbs",
  frDefenseRow: "systems/cryptomancer/actor-sheet/character/components/fr-defense-row.hbs",
  frAttrCol: "systems/cryptomancer/actor-sheet/character/components/fr-attr-col.hbs",
  frTriad: "systems/cryptomancer/actor-sheet/character/components/fr-triad.hbs",
  frEmblematic: "systems/cryptomancer/actor-sheet/character/components/fr-emblematic.hbs",
};

/**
 * Define a set of template paths to pre-load.
 * Pre-loaded templates are compiled and cached for fast access when rendering.
 * Passing an object to `loadTemplates` registers each entry as a named Handlebars
 * partial (Foundry v11+). The bare paths are simply compiled and cached.
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  const { loadTemplates } = foundry.applications.handlebars;

  // Register named partials (components + icons).
  await loadTemplates(partials);

  // Compile and cache the standalone templates.
  return loadTemplates([
    "systems/cryptomancer/skill-check/skill-check.hbs",
    "systems/cryptomancer/skill-check/risk-check.hbs",
    "systems/cryptomancer/item/chat-card.hbs",
    "systems/cryptomancer/actor-sheet/party/components/safehouse-room-chat-card.hbs",
  ]);
};
