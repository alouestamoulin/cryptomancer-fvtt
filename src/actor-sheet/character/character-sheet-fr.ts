import { l } from "../../shared/util";
import { CharacterSheet } from "./character-sheet";
import { CharacterSheetData } from "../actor-sheet.interface";

/**
 * Alternative "PDF-style" character sheet (French official layout).
 *
 * Reuses ALL the behaviour of {@link CharacterSheet} (rolls, item management,
 * party linking, …) and only changes the presentation: a single-page parchment
 * layout that mirrors the official French character sheet, with skills grouped
 * under their attribute inside each triad.
 */
export class CharacterSheetFr extends CharacterSheet {
  static override get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/cryptomancer/actor-sheet/character/character-sheet-fr.hbs",
      classes: ["cryptomancer", "cryptomancer-fr", "sheet", "actor"],
      width: 900,
      height: 940,
      // Single page layout: no tab navigation.
      tabs: [],
    });
  }

  override async getData(): Promise<CharacterSheetData> {
    const context = await super.getData();
    if (this.actor.type !== "character") return context;

    const system = this.actor.system as any;
    const skills = (context as any).skills as Array<any>;
    const skillsFor = (attributeKey: string) => skills.filter((s) => s.attribute === attributeKey);
    const attr = (key: string) => ({ key, ...system.attributes[key] });

    // Build the four triads with their skills grouped under each attribute,
    // matching the paper sheet. Endurance/Willpower carry no skill; instead they
    // display the break/push toggles and the matching resource track (HP / mana).
    (context as any).frTriads = [
      {
        coreKey: "speed",
        coreValue: system.core.speed.value,
        left: { ...attr("agility"), skills: skillsFor("agility") },
        right: { ...attr("dexterity"), skills: skillsFor("dexterity") },
      },
      {
        coreKey: "power",
        coreValue: system.core.power.value,
        left: { ...attr("strength"), skills: skillsFor("strength") },
        right: { ...attr("endurance"), skills: [], noSkill: true },
        resourceBar: (context as any).hpAttributeBar,
        resourceLabel: l("healthPoints"),
      },
      {
        coreKey: "wits",
        coreValue: system.core.wits.value,
        left: { ...attr("knowledge"), skills: skillsFor("knowledge") },
        right: { ...attr("cunning"), skills: skillsFor("cunning") },
      },
      {
        coreKey: "resolve",
        coreValue: system.core.resolve.value,
        left: { ...attr("presence"), skills: skillsFor("presence") },
        right: { ...attr("willpower"), skills: [], noSkill: true },
        resourceBar: (context as any).manaAttributeBar,
        resourceLabel: l("manaPoints"),
      },
    ];

    return context;
  }
}
