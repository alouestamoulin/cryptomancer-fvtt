import { PartySheet } from "./party-sheet";

/**
 * Alternative "PDF-style" party / safehouse sheet (French official layout).
 *
 * Reuses ALL the behaviour of {@link PartySheet} (risk check, cells, risk
 * events, safehouse chat cards, …) and only changes the presentation to a
 * single-page parchment layout mirroring the official French safehouse sheet.
 */
export class PartySheetFr extends PartySheet {
  static override get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/cryptomancer/actor-sheet/party/party-sheet-fr.hbs",
      classes: ["cryptomancer", "cryptomancer-fr", "sheet", "actor"],
      width: 800,
      height: 960,
      // Single page layout: no tab navigation.
      tabs: [],
    });
  }
}
