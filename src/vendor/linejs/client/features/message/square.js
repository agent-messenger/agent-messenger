import { enums } from "../../../../linejs-types/line_types.js";
const hasContents = [
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "FILE"
];
/**
 * A message for OpenChat.
 */ export class SquareMessage {
  #client;
  raw;
  isSquare = true;
  isTalk = false;
  #authorIsMe;
  constructor(init){
    this.#client = init.client;
    this.raw = init.raw;
  }
  /**
	 * Replys to message.
	 */ async reply(input) {
    if (typeof input === "string") {
      return this.reply({
        text: input
      });
    }
    await this.#client.base.square.sendMessage({
      ...input,
      relatedMessageId: this.raw.message.id,
      squareChatMid: this.raw.message.to
    });
  }
  /**
	 * Sends to message.
	 */ async send(input) {
    if (typeof input === "string") {
      return this.send({
        text: input
      });
    }
    await this.#client.base.square.sendMessage({
      relatedMessageId: this.raw.message.id,
      squareChatMid: this.raw.message.to,
      ...input
    });
  }
  /**
	 * Reacts to message.
	 * @param type Reaction type
	 */ async react(type) {
    if (typeof type === "string") {
      type = enums.MessageReactionType[type];
    }
    await this.#client.base.square.reactToMessage({
      request: {
        reqSeq: 0,
        reactionType: type,
        messageId: this.raw.message.id,
        squareChatMid: this.to.id
      }
    });
  }
  /**
	 * Read the message.
	 */ async read() {
    await this.#client.base.square.markAsRead({
      request: {
        messageId: this.raw.message.id,
        squareChatMid: this.to.id
      }
    });
  }
  /**
	 * Pins the message.
	 */ async announce() {
    if (!this.raw.message.text) {
      throw new TypeError("The message is not text message.");
    }
    await this.#client.base.square.createSquareChatAnnouncement({
      squareChatMid: this.to.id,
      senderMid: this.from.id,
      messageId: this.raw.message.id,
      text: this.raw.message.text,
      createdAt: this.raw.message.createdTime
    });
  }
  /**
	 * Unsends the message.
	 */ async unsend() {
    if (!this.isMyMessage) {
      throw new TypeError("Cannot unsend the message which is not yours.");
    }
    await this.#client.base.square.unsendMessage({
      messageId: this.raw.message.id,
      squareChatMid: this.to.id
    });
  }
  /**
	 * Deletes the message.
	 */ async delete() {
    await this.#client.base.square.destroyMessage({
      messageId: this.raw.message.id,
      squareChatMid: this.to.id
    });
  }
  /**
	 * Gets sticker URL.
	 * @returns Stamp URL
	 */ getStickerURL() {
    if (this.raw.message.contentType !== "STICKER") {
      throw new TypeError("The message is not sticker.");
    }
    const stickerMetadata = this.raw.message.contentMetadata;
    if (stickerMetadata.STKOPT === "A") {
      return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.STKID}/android/sticker_animation.png`;
    } else {
      return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${stickerMetadata.STKID}/android/sticker.png`;
    }
  }
  /**
	 * Collects emoji URLs in the message.
	 * @returns URLs of emoji
	 */ collectEmojiURLs() {
    if (this.raw.message.contentType !== "NONE") {
      throw new TypeError("The message is not text message.");
    }
    const emojiUrls = [];
    const emojiData = this.raw.message.contentMetadata;
    const replace = emojiData?.REPLACE ? JSON.parse(emojiData?.REPLACE) : undefined;
    const emojiResources = replace?.sticon?.resources ?? [];
    for (const emoji of emojiResources){
      emojiUrls.push(`https://stickershop.line-scdn.net/sticonshop/v1/sticon/${emoji.productId}/android/${emoji.sticonId}.png`);
    }
    return emojiUrls;
  }
  /**
	 * Gets mentions in the message.
	 */ getMentions() {
    const content = this.#content;
    if (content.type !== "NONE") {
      throw new TypeError("Message has no text.");
    }
    const mentionees = [];
    const mentionData = content.metadata;
    const mention = mentionData?.MENTION ? JSON.parse(mentionData.MENTION) : undefined;
    const mentions = mention?.MENTIONEES ?? [];
    for (const mention of mentions){
      mentionees.push(mention.A ? {
        all: true
      } : {
        all: false,
        mid: mention.M
      });
    }
    return mentionees;
  }
  /**
	 * Gets text decorations (emoji, mention)
	 */ getTextDecorations() {
    // TODO: refeactering is needed
    const content = this.#content;
    if (content.type !== "NONE") {
      throw new TypeError("Message has no text.");
    }
    const texts = [];
    const splits = [];
    const mentionData = content.metadata;
    const emojiData = content.metadata;
    const mention = mentionData?.MENTION ? JSON.parse(mentionData.MENTION) : undefined;
    const mentions = mention?.MENTIONEES ?? [];
    mentions.forEach((e, i)=>{
      splits.push({
        start: parseInt(e.S),
        end: parseInt(e.E),
        mention: i
      });
    });
    const replace = emojiData?.REPLACE ? JSON.parse(emojiData?.REPLACE) : undefined;
    const emojiResources = replace?.sticon?.resources ?? [];
    emojiResources.forEach((e, i)=>{
      splits.push({
        start: e.S,
        end: e.E,
        emoji: i
      });
    });
    let lastSplit = 0;
    splits.sort((a, b)=>a.start - b.start).forEach((e)=>{
      if (lastSplit - e.start) {
        texts.push({
          text: this.raw.message.text?.substring(lastSplit, e.start)
        });
      }
      const content = {
        text: this.raw.message.text?.substring(e.start, e.end)
      };
      if (typeof e.emoji === "number") {
        const emoji = emojiResources[e.emoji];
        const url = `https://stickershop.line-scdn.net/sticonshop/v1/sticon/${emoji.productId}/android/${emoji.sticonId}.png`;
        content.emoji = {
          ...emoji,
          url
        };
      } else if (typeof e.mention === "number") {
        const _mention = mentionData?.MENTION ? JSON.parse(mentionData.MENTION) : undefined;
        const mentions = _mention?.MENTIONEES ?? [];
        const mention = mentions[e.mention];
        content.mention = mention.M ? {
          mid: mention.M
        } : {
          all: !!mention.A
        };
      }
      texts.push(content);
      lastSplit = e.end;
    });
    texts.push({
      text: this.raw.message.text?.substring(lastSplit)
    });
    return texts;
  }
  /**
	 * Gets flex from the message.
	 */ getFlex() {
    const content = this.#content;
    if (content.type !== "FLEX") {
      throw new TypeError("The message has no flex items.");
    }
    const flexData = content.metadata;
    return {
      flexJson: flexData.FLEX_JSON,
      altText: flexData.ALT_TEXT,
      ver: flexData.FLEX_VER,
      tag: flexData.EFFECT_TAG
    };
  }
  /**
	 * Gets reply target.
	 * If the message is reply, returns reply target id.
	 */ getReplyTarget() {
    if (this.raw.message.relatedMessageId && (this.raw.message.messageRelationType === 3 || this.raw.message.messageRelationType === "REPLY")) {
      return new UnresolvedMessage(this.raw.message.relatedMessageId, this.#client);
    }
    return null;
  }
  /**
	 * Get file info.
	 */ getFileInfo() {
    const content = this.#content;
    if (content.type !== "FILE") {
      throw new TypeError("The message does not provide any files.");
    }
    const fileData = content.metadata;
    return {
      size: parseInt(fileData.FILE_SIZE),
      expire: new Date(parseInt(fileData.FILE_EXPIRE_TIMESTAMP) * 1000),
      name: fileData.FILE_NAME
    };
  }
  /**
	 * @return {Blob} message data
	 */ async getData(preview) {
    if (!hasContents.includes(this.raw.message.contentType)) {
      throw new TypeError("message have no contents");
    }
    if (this.raw.message.contentMetadata.DOWNLOAD_URL) {
      if (preview) {
        const r = await this.#client.base.fetch(this.raw.message.contentMetadata.PREVIEW_URL);
        return await r.blob();
      } else {
        const r_1 = await this.#client.base.fetch(this.raw.message.contentMetadata.DOWNLOAD_URL);
        return await r_1.blob();
      }
    }
    return this.#client.base.obs.downloadMessageData({
      messageId: this.raw.message.id,
      isPreview: preview,
      isSquare: true
    });
  }
  async isMyMessage() {
    if (typeof this.#authorIsMe === "boolean") {
      return this.#authorIsMe;
    }
    this.#authorIsMe = this.from.id === (await this.#client.base.square.getSquareChat({
      squareChatMid: this.to.id
    })).squareChatMember.squareMemberMid;
    return this.#authorIsMe;
  }
  get to() {
    const { message } = this.raw;
    return {
      type: message.toType,
      id: message.to
    };
  }
  get from() {
    const { message } = this.raw;
    return {
      type: this.raw.fromType,
      id: message.from
    };
  }
  get #content() {
    return {
      type: this.raw.message.contentType,
      metadata: this.raw.message.contentMetadata
    };
  }
  get text() {
    return this.raw.message.text;
  }
  static fromSource(source, client) {
    return new SquareMessage({
      client,
      raw: source.payload.notificationMessage.squareMessage
    });
  }
  static fromRawTalk(raw, client) {
    return new SquareMessage({
      client,
      raw
    });
  }
}
export class SquareThreadMessage extends SquareMessage {
  #client;
  #authorIsMe;
  constructor(init){
    super(init);
    this.#client = init.client;
    this.raw = init.raw;
  }
  /**
	 * Replys to message.
	 */ async reply(input) {
    if (typeof input === "string") {
      return this.reply({
        text: input
      });
    }
    await this.#sendSquareThreadMessage({
      ...input,
      relatedMessageId: this.raw.threadInfo.chatThreadMid
    });
  }
  /**
	 * Sends to message.
	 */ async send(input) {
    if (typeof input === "string") {
      return this.send({
        text: input
      });
    }
    await this.#sendSquareThreadMessage(input);
  }
  async #sendSquareThreadMessage(input) {
    await this.#client.base.square.sendSquareThreadMessage({
      request: {
        reqSeq: await this.#client.base.getReqseq("sq"),
        chatMid: this.raw.message.to,
        threadMid: this.raw.threadInfo.chatThreadMid,
        threadMessage: {
          message: {
            to: this.raw.message.to,
            text: input.text,
            contentType: "NONE",
            toType: "SQUARE_THREAD",
            ...input.relatedMessageId ? {
              relatedMessageId: input.relatedMessageId,
              relatedMessageServiceCode: "SQUARE",
              messageRelationType: "REPLY"
            } : {}
          }
        }
      }
    });
  }
  /**
	 * Reacts to message.
	 * @param type Reaction type
	 */ async react(type) {
    if (typeof type === "string") {
      type = enums.MessageReactionType[type];
    }
    await this.#client.base.square.reactToMessage({
      request: {
        reqSeq: 0,
        reactionType: type,
        messageId: this.raw.message.id,
        squareChatMid: this.raw.message.to,
        threadMid: this.raw.threadInfo.chatThreadMid
      }
    });
  }
  /**
	 * Read the message.
	 */ async read() {
    await this.#client.base.square.markAsRead({
      request: {
        messageId: this.raw.message.id,
        squareChatMid: this.raw.message.to,
        threadMid: this.raw.threadInfo.chatThreadMid
      }
    });
  }
  /**
	 * Pins the message.
	 */ async announce() {
    await 0;
    throw new Error("Method not implemented.");
  // if (!this.raw.squareMessage.message.text) {
  // 	throw new TypeError("The message is not text message.");
  // }
  // await this.#client.base.square.createSquareChatAnnouncement({
  // 	squareChatMid: this.to.id,
  // 	senderMid: this.from.id,
  // 	messageId: this.raw.squareMessage.message.id,
  // 	text: this.raw.squareMessage.message.text,
  // 	createdAt: this.raw.squareMessage.message.createdTime,
  // });
  }
  /**
	 * Unsends the message.
	 */ async unsend() {
    if (!this.isMyMessage) {
      throw new TypeError("Cannot unsend the message which is not yours.");
    }
    await this.#client.base.square.unsendMessage({
      messageId: this.raw.message.id,
      squareChatMid: this.raw.message.to,
      threadMid: this.raw.threadInfo.chatThreadMid
    });
  }
  /**
	 * Deletes the message.
	 */ async delete() {
    await this.#client.base.square.destroyMessage({
      messageId: this.raw.message.id,
      squareChatMid: this.raw.message.to,
      threadMid: this.raw.threadInfo.chatThreadMid
    });
  }
  static fromSource(source, client) {
    return new SquareThreadMessage({
      client,
      raw: source.payload.notificationThreadMessage.squareMessage
    });
  }
  static fromRawTalk(raw, client) {
    return new SquareThreadMessage({
      client,
      raw
    });
  }
}
export class UnresolvedMessage {
  id;
  constructor(id, _client){
    this.id = id;
  }
}
//# sourceMappingURL=square.js.map
