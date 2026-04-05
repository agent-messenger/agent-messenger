import { type ContentType, type Location, type MessageReactionType, type SquareEvent, type SquareMessage as Message } from "@jsr/evex__linejs-types";
import type { Client } from "../../client.js";
import type { DecorationsData, MentionTarget, Mid } from "./types.js";
export interface SquareMessageInit {
  client: Client;
  raw: Message;
}
/**
 * A message for OpenChat.
 */ export declare class SquareMessage {
  raw: Message;
  readonly isSquare: true;
  readonly isTalk: false;
  constructor(init: SquareMessageInit);
  /**
	 * Replys to message.
	 */ reply(input: string | {
    text?: string;
    contentType?: ContentType;
    contentMetadata?: Record<string, string>;
  }): Promise<void>;
  /**
	 * Sends to message.
	 */ send(input: string | {
    text?: string;
    contentType?: ContentType;
    contentMetadata?: Record<string, string>;
    relatedMessageId?: string;
    location?: Location;
  }): Promise<void>;
  /**
	 * Reacts to message.
	 * @param type Reaction type
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
	 * Deletes the message.
	 */ delete(): Promise<void>;
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
	 */ getReplyTarget(): UnresolvedMessage | null;
  /**
	 * Get file info.
	 */ getFileInfo(): {
    size: number;
    expire: Date;
    name: string;
  };
  /**
	 * @return {Blob} message data
	 */ getData(preview?: boolean): Promise<Blob>;
  public isMyMessage(): Promise<boolean>;
  get to(): Mid;
  get from(): Mid;
  get text(): string;
  static fromSource(source: SquareEvent, client: Client): SquareMessage;
  static fromRawTalk(raw: Message, client: Client): SquareMessage;
}
export declare class UnresolvedMessage {
  readonly id: string;
  constructor(id: string, _client: Client);
}
//# sourceMappingURL=square.d.ts.map