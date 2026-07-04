import { ChatMessageDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/chatMessageData";
import { CryptomancerActor } from "../actor/actor";
import { getGame } from "../shared/util";

export class CryptomancerItem extends Item {
  public async showChatMessage(): Promise<void> {
    const _game = getGame();
    const _actor: CryptomancerActor | undefined = this.actor || undefined;
    const _token = _actor?.token || undefined;

    const templateData: Record<string, any> = {
      title: this.name,
      avatar: this.img,
      description: this.system.description,
    };

    if (this.type === "equipment" && !foundry.utils.isEmpty(this.system.rules)) {
      templateData["rules"] = this.system.rules;
    }

    if (this.type === "spell") {
      templateData["castCost"] = this.system.castCost;
      templateData["type"] = this.system.type;
    }

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/cryptomancer/item/chat-card.hbs",
      templateData
    );
    const messageData: ChatMessageDataConstructorData = {
      user: _game.user?.id,
      speaker: ChatMessage.getSpeaker({ actor: _actor, token: _token }),
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      content,
    };

    ChatMessage.applyRollMode(messageData, _game.settings.get("core", "rollMode"));
    await ChatMessage.create(messageData);
  }
}
