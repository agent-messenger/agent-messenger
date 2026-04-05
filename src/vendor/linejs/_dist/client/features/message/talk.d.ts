import type { ContentType, Location, Message, MessageReactionType } from "@jsr/evex__linejs-types";
import type { Client } from "../../client.js";
import type { ContactMeta } from "./internal-types.js";
import type { DecorationsData, MentionTarget, Mid } from "./types.js";
export interface TalkMessageInit {
  client: Client;
  raw: Message;
}
export declare class TalkMessage {
  raw: Message;
  readonly isSquare: false;
  readonly isTalk: true;
  constructor(init: TalkMessageInit);
  /**
	 * Replys to message.
	 */ reply(input: string | {
    e2ee?: boolean;
    text?: string;
    contentType?: ContentType;
    contentMetadata?: Record<string, string>;
  }): Promise<void>;
  /**
	 * Sends to message.
	 */ send(input: string | {
    e2ee?: boolean;
    text?: string;
    contentType?: ContentType;
    contentMetadata?: Record<string, string>;
    relatedMessageId?: string;
    location?: Location;
  }): Promise<void>;
  /**
	 * Reacts to message.
	 */ react(type: MessageReactionType): Promise<void>;
  /**
	 * Read the message.
	 */ read(): Promise<void>;
  /**
	 * Pins the message.
	 */ announce(): Promise<void>;
  /**
	 * Unsends the message.
	 */ unsend(): Promise<void>;
  /**
	 * Gets sticker URL.
	 * @returns Stamp URL
	 */ getStickerURL(): string;
  /**
	 * Collects emoji URLs in the message.
	 * @returns URLs of emoji
	 */ collectEmojiURLs(): string[];
  /**
	 * Gets mentions in the message.
	 */ getMentions(): MentionTarget[];
  /**
	 * Gets text decorations (emoji, mention)
	 */ getTextDecorations(): DecorationsData[];
  /**
	 * Gets a shared contact infomation from the message.
	 */ getSharedContact(): ContactMeta;
  /**
	 * Gets flex from the message.
	 */ getFlex(): {
    flexJson: Record<string, unknown>;
    altText: string;
    ver: string;
    tag: string | undefined;
  };
  /**
	 * Gets reply target.
	 * If the message is reply, returns reply target id.
	 */ getReplyTarget(): UnresolvedTalkMessage | null;
  /**
	 * @return {Blob} message data
	 */ getData(preview?: boolean): Promise<Blob>;
  get isMyMessage(): boolean;
  get to(): Mid;
  get from(): Mid;
  get text(): string;
  static fromRawTalk(raw: Message, client: Client): Promise<TalkMessage>;
}
export declare class UnresolvedTalkMessage {
  readonly id: string;
  constructor(id: string, client: Client);
  then(_resolve: (value: TalkMessage) => void): void;
}
//# sourceMappingURL=talk.d.ts.map