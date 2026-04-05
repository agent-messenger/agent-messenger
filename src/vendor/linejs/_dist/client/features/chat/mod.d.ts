import type { Client } from "../../mod.js";
import type * as line from "@jsr/evex__linejs-types";
import { TalkMessage } from "../message/talk.js";
import { type MessageFetcher } from "./fetcher.js";
interface ChatInit {
  client: Client;
  raw: line.Chat;
}
/**
 * Talk chat(group) class (not a OpenChat)
 */ export declare class Chat {
  raw: line.Chat;
  readonly mid: string;
  name: string;
  constructor(init: ChatInit);
  /**
	 * Sends message to the chat(group).
	 */ sendMessage(input: string | {
    text?: string;
    /**
			 * If true, end2end encryption will be enabled.
			 * @default true
			 */ e2ee?: boolean;
    /**
			 * Related message mid. This is used for reply.
			 */ relatedMessageId?: string;
    contentType?: line.ContentType;
    contentMetadata?: Record<string, string>;
    location?: line.Location;
    chunk?: string[];
  }): Promise<TalkMessage>;
  /**
	 * @description Update chat(group) status.
	 */ updateChat(options: {
    chat: Partial<line.Chat>;
    updatedAttribute: line.Pb1_O2;
  }): Promise<line.Pb1_Zc>;
  /**
	 * @description Update chat(group) name.
	 */ public updateName(name: string): Promise<line.Pb1_Zc>;
  /**
	 * @description Invite user.
	 */ public invite(mids: string[]): Promise<line.Pb1_J5>;
  /**
	 * @description Kickout user.
	 */ public kick(mid: string): Promise<line.Pb1_M3>;
  /**
	 * @description Leave chat.
	 */ public leave(): Promise<line.Pb1_M3>;
  /**
	 * Fetches messages from the chat(group).
	 *
	 * @param limit The number of messages to fetch. Defaults to 10.
	 * @returns A promise that resolves to an array of TalkMessage instances.
	 */ fetchMessages(limit?: number): Promise<TalkMessage[]>;
  messageFetcher(): Promise<MessageFetcher>;
}
//# sourceMappingURL=mod.d.ts.map