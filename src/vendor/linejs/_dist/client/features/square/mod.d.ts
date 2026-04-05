import type { Square as SquareRaw, SquareChat as SquareChatRaw } from "@jsr/evex__linejs-types";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { Client } from "../../mod.js";
import { SquareMessage } from "../message/mod.js";
import { TypedEventEmitter } from "../../../base/core/typed-event-emitter/index.js";
export interface SquareInit {
  raw: SquareRaw;
  client: Client;
}
/**
 * Square(Openchat) (not a SquareChat)
 */ export declare class Square {
  raw: SquareRaw;
  constructor(init: SquareInit);
  /** Updates square information */ update(): Promise<void>;
  updateSquare(input: {
    updatedAttrs: LINETypes.SquareAttribute[];
    square: Partial<LINETypes.Square>;
  }): Promise<LINETypes.UpdateSquareResponse>;
  updateName(name: string): Promise<LINETypes.UpdateSquareResponse>;
  /** OpenChat mid */ get mid(): string;
  /** OpenChat Name */ get name(): string;
}
export interface SquareChatInit {
  raw: SquareChatRaw;
  client: Client;
}
export type SquareChatEvents = {
  message: (message: SquareMessage) => void;
  kick: (event: LINETypes.SquareEventNotifiedKickoutFromSquare) => void;
  leave: (event: LINETypes.SquareEventNotifiedLeaveSquareChat) => void;
  join: (event: LINETypes.SquareEventNotifiedJoinSquareChat) => void;
  mention: (message: SquareMessage) => void;
  destroy: (event: LINETypes.SquareEventNotifiedDestroyMessage) => void;
  event: (event: LINETypes.SquareEvent) => void;
  "update:syncToken": (syncToken: string) => void;
};
export declare class SquareChat extends TypedEventEmitter<SquareChatEvents> {
  raw: SquareChatRaw;
  constructor(init: SquareChatInit);
  /** Updates square information */ update(): Promise<void>;
  sendMessage(input: string | {
    text?: string;
    contentType?: LINETypes.ContentType;
    contentMetadata?: Record<string, string>;
    relatedMessageId?: string;
    location?: LINETypes.Location;
  }): Promise<LINETypes.SendMessageResponse>;
  updateSquareChat(input: {
    updatedAttrs: LINETypes.SquareChatAttribute[];
    squareChat: Partial<LINETypes.SquareChat>;
  }): Promise<LINETypes.UpdateSquareChatResponse>;
  updateName(name: string): Promise<LINETypes.UpdateSquareChatResponse>;
  getMembers(): Promise<LINETypes.SquareMember[]>;
  /**
	 * @description start listen (fetchSquareChatEvents)
	 */ public listen(param?: {
    signal?: AbortSignal;
    syncToken?: string;
    onError?: (error: unknown) => void;
  }): Promise<void>;
  /** OpenChat mid */ get mid(): string;
  /** OpenChat Name */ get name(): string;
}
//# sourceMappingURL=mod.d.ts.map