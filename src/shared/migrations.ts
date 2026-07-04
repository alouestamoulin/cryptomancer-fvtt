import { CryptomancerActor } from "../actor/actor";
import { Cell, Core, ResourceAttribute, RiskEvent, Skill } from "../actor/actor.interface";
import { CryptomancerItem } from "../item/item";
import { EquipmentRule } from "../item/item.interface";
import { SCOPE } from "./constants";
import { getEquipmentRuleByName, getGame } from "./util";

type DeprecatedSkill = Skill & { skillBreak?: boolean; skillPush?: boolean };
type DeprecatedAttribute = ResourceAttribute & { skills: Record<string, DeprecatedSkill> };
type DeprecatedCore = Core & { attributes: Record<string, DeprecatedAttribute> };

export async function migrateWorld(): Promise<void> {
  const _game = getGame();
  const version = _game.system.version;
  ui.notifications?.info(_game.i18n.format("MIGRATION.Begin", { version }), { permanent: true });

  await migrateWorldItems();
  await migrateWorldActors();

  // Set the migration as complete
  _game.settings.set(SCOPE, "systemMigrationVersion", version);
  ui.notifications?.info(_game.i18n.format("MIGRATION.Complete", { version }), { permanent: true });
}

async function migrateWorldActors(): Promise<void> {
  const _game = getGame();
  for (let actor of _game.actors || []) {
    const migrationData: any = {};
    await migratePartyData(actor, migrationData);
    await migrateCharacterData(actor, migrationData);

    // Migrate owned items
    if (actor.items && actor.items.contents.length > 0) {
      const items = actor.items.reduce((migrated: CryptomancerItem[], item: CryptomancerItem) => {
        const itemUpdate: any = {};
        migrateItemData(item, itemUpdate);

        if (!foundry.utils.isEmpty(itemUpdate)) {
          itemUpdate._id = item.id;
          migrated.push(foundry.utils.expandObject(itemUpdate));
        }

        return migrated;
      }, []);
      if (items.length > 0) {
        migrationData.items = items;
      }
    }

    // Apply update
    if (!foundry.utils.isEmpty(migrationData)) {
      console.log(`Migrating actor ${actor.name}.`);
      await actor.update(migrationData, { enforceTypes: false });
    }
  }
}

async function migrateWorldItems(): Promise<void> {
  const _game = getGame();
  for (let item of _game.items || []) {
    const migrationData: any = {};
    migrateItemData(item, migrationData);
    // Apply update
    if (!foundry.utils.isEmpty(migrationData)) {
      await item.update(migrationData, { enforceTypes: false });
      console.log(`Migrated item ${item.name}.`);
    }
  }
}

function migrateItemData(item: CryptomancerItem, migrationData: any): void {
  // Migrate trademark items to equipment
  if (item.type === "trademarkItem") {
    console.log(`Migrating trademark item ${item.name} to equipment.`);
    migrationData["type"] = "equipment";
    migrationData["system.trademark"] = true;
  }

  migrateEquipmentQualitiesAndRules(item, migrationData);
}

function migrateEquipmentQualitiesAndRules(item: CryptomancerItem, updateData: any): void {
  if (item.type !== "trademarkItem" && item.type !== "equipment") {
    return;
  }
  const system = item.system as any;

  // Migrate equipment qualities to array
  if (!Array.isArray(system.qualities)) {
    console.log(`Migrating item ${item.name} qualities.`);
    // Migrate string data to array if possible
    if (typeof system.qualities === "string" && system.qualities !== "") {
      updateData["system.qualities"] = (system.qualities as string).split(",");
    } else {
      updateData["system.qualities"] = [];
    }
  }

  // Migrate equipment rules to EquipmentRules
  if (Array.isArray(system.rules) || typeof system.rules === "string") {
    console.log(`Migrating item ${item.name} rules.`);
    const newRules: Record<string, EquipmentRule> = {};
    let arrayRules: string[] = system.rules;
    // First migrate single string to array of rules
    if (typeof system.rules === "string") {
      arrayRules = (system.rules as string).split(",").map((rule) => rule.trim());
    }

    // Migrate rules by name
    arrayRules.forEach((ruleName) => {
      if (item.type !== "equipment" && item.type !== "trademarkItem") {
        return;
      }
      const rule = getEquipmentRuleByName(ruleName);
      newRules[rule.key] = rule;
    });
    updateData["system.rules"] = newRules;
  }
}

function migratePartyData(party: StoredDocument<CryptomancerActor>, migrationData: any): void {
  if (party.type !== "party") {
    return;
  }
  const system = party.system as any;

  // Migrate risk events from number indexed objects to array
  if (!Array.isArray(system.riskEvents)) {
    console.log(`Migrating party ${party.name} risk events.`);
    migrationData["system.riskEvents"] = Object.values(system.riskEvents) as RiskEvent[];
  }

  // Migrate cells from number indexed objects to array
  if (!Array.isArray(system.cells)) {
    console.log(`Migrating party ${party.name} cells.`);
    migrationData["system.cells"] = Object.values(system.cells) as Cell[];
  }
}

function migrateCharacterData(character: StoredDocument<CryptomancerActor>, migrationData: any): void {
  if (character.type !== "character") {
    return;
  }

  Object.values((character.system as any).core).forEach((core: any) => {
    if ((core as DeprecatedCore).attributes) {
      Object.values((core as DeprecatedCore).attributes).forEach((attr) => {
        migrationData[`system.attributes.${attr.key}.value`] = attr.value;
        if (attr.break !== undefined) {
          migrationData[`system.attributes.${attr.key}.break`] = attr.break;
        }
        if (attr.push !== undefined) {
          migrationData[`system.attributes.${attr.key}.push`] = attr.push;
        }
        if (attr.skills) {
          Object.values(attr.skills).forEach((skill) => {
            // These might be really old deprecated skills, do those migrations first
            if ((skill.key as string) === "preciseMissile") {
              skill.key = "preciseMelee";
            }
            migrationData[`system.skills.${skill.key}.break`] = skill.break;
            migrationData[`system.skills.${skill.key}.push`] = skill.push;

            // These also might have skillBreak instead of break, skillPush instead of push
            // Favor those values
            if (skill.skillBreak !== undefined) {
              migrationData[`system.skills.${skill.key}.break`] = skill.skillBreak;
            }
            if (skill.skillPush !== undefined) {
              migrationData[`system.skills.${skill.key}.push`] = skill.skillPush;
            }
          });
        }
      });

      // Delete the old stuff
      migrationData[`system.core.${core.key}.-=attributes`] = null;
    }
  });
}
