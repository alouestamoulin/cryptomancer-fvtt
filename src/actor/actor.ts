// Foundry
import {
  Context,
  DocumentModificationOptions,
} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/document.mjs";
import {
  ActorData,
  ActorDataBaseProperties,
  ActorDataConstructorData,
} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/actorData";
import { PropertiesToSource } from "@league-of-foundry-developers/foundry-vtt-types/src/types/helperTypes";
import { CryptomancerItem } from "../item/item";
import { EquipmentType } from "../item/item.enum";
import { CheckDifficulty } from "../skill-check/skill-check.enum";
import { fromCompendium } from "../shared/util";

import { SkillCheckService } from "../skill-check/skill-check.service";
import { DEFAULT_CELL } from "./actor.constant";
import { AttributeKey, Cell, ResourceAttribute, RiskEvent, SkillKey } from "./actor.interface";

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class CryptomancerActor extends Actor {
  constructor(data?: ActorDataConstructorData, context?: Context<TokenDocument>) {
    super(data, context);
  }

  override _onCreate(
    data: PropertiesToSource<ActorDataBaseProperties>,
    options: DocumentModificationOptions,
    userId: string
  ) {
    super._onCreate(data, options, userId);
    this.addUnarmedStrike();
  }

  override prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  override prepareBaseData() {
    if (this.type !== "character") {
      return;
    }
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
    // Find equipped outfits that have DR rules
    let equippedOutfits = this.items.filter(
      (i) =>
        i.type === "equipment" &&
        i.system.type === EquipmentType.Outfit &&
        i.system.equipped &&
        Boolean(i.system.rules.damageReduction)
    );
    if (equippedOutfits.length > 1) {
      console.warn(`Cryptomancer FVTT | ${this.name} has multiple outfits equipped, only using the highest DR.`);
      equippedOutfits = [
        equippedOutfits.reduce((highest, current) => {
          if (
            current.type !== "equipment" ||
            highest.type !== "equipment" ||
            current.system.rules.damageReduction > highest.system.rules.damageReduction
          ) {
            return current;
          }
          return highest;
        }),
      ];
    }
    if (equippedOutfits.length > 0 && equippedOutfits[0].type === "equipment") {
      this.updateSource({ "system.damageReduction.value": equippedOutfits[0].system.rules.damageReduction.value || 0 });
    } else {
      this.updateSource({ "system.damageReduction.value": 0 });
    }
  }

  /**
   * Augment the basic actor data with additional dynamic data. Typically,
   * you'll want to handle most of your calculated/derived data in this step.
   * Data calculated in this step should generally not exist in template.json
   * (such as ability modifiers rather than ability scores) and should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  override prepareDerivedData(): void {
    this.prepareCharacterData();
  }

  /**
   * Prepare Character type specific data
   */
  private prepareCharacterData() {
    if (this.type !== "character") return;
    const system = this.system as any;
    system.talents = [];
    system.spells = [];
    system.consumables = [];
    system.equipment = [];
    system.outfits = [];
    system.weapons = [];

    this.items.forEach((i: CryptomancerItem) => {
      switch (i.type) {
        case "talent":
          system.talents.push(i);
          break;
        case "spell":
          system.spells.push(i);
          break;
        case "equipment":
          switch (i.system.type) {
            case EquipmentType.Consumable:
              system.consumables.push(i);
              break;
            case EquipmentType.Equipment:
              system.equipment.push(i);
              break;
            case EquipmentType.Outfit:
              system.outfits.push(i);
              break;
            case EquipmentType.Weapon:
              system.weapons.push(i);
              break;
          }
          break;
      }
    });
  }

  /**
   * Override getRollData() that's supplied to rolls.
   */
  override getRollData() {
    return super.getRollData();
  }

  async rollCellOperations(cell: Cell) {
    if (cell.operations === null) return;
    return SkillCheckService.skillCheck(
      cell.operations,
      "operations",
      CheckDifficulty.Challenging,
      "",
      cell.skillBreak,
      cell.skillPush
    );
  }

  async rollAttribute(
    attributeName: AttributeKey,
    skillName: SkillKey | "" = "",
    difficulty = CheckDifficulty.Challenging
  ) {
    if (this.type !== "character") {
      return;
    }
    const attribute = this.system.attributes[attributeName];
    const skill = skillName ? this.system.skills[skillName] : null;
    if (skill) {
      return SkillCheckService.skillCheck(
        attribute.value,
        attributeName,
        difficulty,
        skillName,
        skill.break,
        skill.push,
        this
      );
    } else {
      return SkillCheckService.skillCheck(
        attribute.value,
        attributeName,
        difficulty,
        undefined,
        Boolean((attribute as ResourceAttribute).break),
        Boolean((attribute as ResourceAttribute).push),
        this
      );
    }
  }

  async addCell(cell?: Cell): Promise<void> {
    if (this.type !== "party") {
      return;
    }

    if (!cell) {
      cell = { ...DEFAULT_CELL };
    }
    const newCells = [...this.system.cells, cell];
    await this.update({ system: { cells: newCells } });
  }

  async removeCell(index: number): Promise<void> {
    if (this.type !== "party") {
      return;
    }

    const newCells = [...this.system.cells];
    newCells.splice(index, 1);
    await this.update({ system: { cells: newCells } });
  }

  async addRiskEvent(eventText: string = ""): Promise<void> {
    if (this.type !== "party") {
      return;
    }
    const newRiskEvents: RiskEvent[] = [...this.system.riskEvents, { complete: false, eventText }];
    await this.update({ system: { riskEvents: newRiskEvents } });
  }

  async removeRiskEvent(index: number): Promise<void> {
    if (this.type !== "party") {
      return;
    }
    const newRiskEvents = [...this.system.riskEvents];
    newRiskEvents.splice(index, 1);
    await this.update({ system: { riskEvents: newRiskEvents } });
  }

  private async addUnarmedStrike(): Promise<void> {
    const storedUnarmedStrike = await fromCompendium<CryptomancerItem>("weapons", "nATp07dapVa5QDbu");
    if (!storedUnarmedStrike) {
      return;
    }
    await this.createEmbeddedDocuments("Item", [storedUnarmedStrike.toObject()]);
  }
}
