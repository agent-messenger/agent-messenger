import { TalkMessage } from "../message/talk.js";
import { createMessageFetcher } from "./fetcher.js";
/**
 * Talk chat(group) class (not a OpenChat)
 */ export class Chat {
  #client;
  raw;
  mid;
  name;
  constructor(init){
    this.#client = init.client;
    this.mid = init.raw.chatMid;
    this.name = init.raw.chatName;
    this.raw = init.raw;
  }
  /**
	 * Sends message to the chat(group).
	 */ async sendMessage(input) {
    if (typeof input === "string") {
      return this.sendMessage({
        text: input
      });
    }
    const sent = await this.#client.base.talk.sendMessage({
      to: this.mid,
      text: input.text,
      e2ee: input.e2ee !== false,
      chunks: input.chunk,
      contentMetadata: input.contentMetadata,
      contentType: input.contentType,
      relatedMessageId: input.relatedMessageId,
      location: input.location
    });
    return TalkMessage.fromRawTalk({
      ...sent,
      to: this.mid
    }, this.#client);
  }
  /**
	 * @description Update chat(group) status.
	 */ async updateChat(options) {
    return await this.#client.base.talk.updateChat({
      request: {
        updatedAttribute: options.updatedAttribute,
        chat: options.chat,
        reqSeq: await this.#client.base.getReqseq()
      }
    });
  }
  /**
	 * @description Update chat(group) name.
	 */ async updateName(name) {
    return await this.updateChat({
      chat: {
        chatName: name
      },
      updatedAttribute: "NAME"
    });
  }
  /**
	 * @description Invite user.
	 */ async invite(mids) {
    return await this.#client.base.talk.inviteIntoChat({
      targetUserMids: mids,
      chatMid: this.mid
    });
  }
  /**
	 * @description Kickout user.
	 */ kick(mid) {
    return this.#client.base.talk.deleteOtherFromChat({
      request: {
        targetUserMids: [
          mid
        ],
        chatMid: this.mid
      }
    });
  }
  /**
	 * @description Leave chat.
	 */ leave() {
    return this.#client.base.talk.deleteSelfFromChat({
      request: {
        chatMid: this.mid
      }
    });
  }
  /**
	 * Fetches messages from the chat(group).
	 *
	 * @param limit The number of messages to fetch. Defaults to 10.
	 * @returns A promise that resolves to an array of TalkMessage instances.
	 */ async fetchMessages(limit = 10) {
    const boxes = await this.#client.base.talk.getMessageBoxes({
      messageBoxListRequest: {}
    });
    const box = boxes.messageBoxes.find((box)=>box.id === this.mid);
    if (!box) {
      throw new Error("Message box not found.");
    }
    const messages = await this.#client.base.talk.getPreviousMessagesV2WithRequest({
      request: {
        messageBoxId: box.id,
        endMessageId: {
          messageId: box.lastDeliveredMessageId.messageId,
          deliveredTime: box.lastDeliveredMessageId.deliveredTime
        },
        messagesCount: limit
      }
    });
    return await Promise.all(messages.map((message)=>TalkMessage.fromRawTalk(message, this.#client)));
  }
  messageFetcher() {
    return createMessageFetcher(this.#client, this);
  }
}
//# sourceMappingURL=mod.js.map