import { type BaseClient } from "../core/mod.js";
import type { Message } from "@jsr/evex__linejs-types";
export type ObjType = "image" | "gif" | "video" | "audio" | "file";
export interface ObsMetadata {
  status: string;
  name: string;
  mime: string;
  type: string;
  hash: string;
  cksum: string;
  size: number | string;
  ctimeMillis: number;
  imageDetails?: {
    format: string;
    height: number;
    width: number;
    signature: string;
  };
  videoMp4Details?: {
    size: number;
    durationMillis: number;
    height: number;
    width: number;
    format: string;
    status: string;
  };
  audioM4aDetails?: {
    size: number;
    durationMillis: number;
    format: string;
    status: string;
  };
  svc: string;
  offset: number;
  ctime: string;
  oid: string;
  userid: string;
  sid: string;
}
export declare class LineObs {
  client: BaseClient;
  prefix: string;
  constructor(client: BaseClient);
  /**
	 * Gets a message image URI by appending the given message ID to the prefixSticker
	 * @param {string} [messageId] - The message ID to use in the URLSticker
	 * @param {boolean} [isPreview=false] - Whether to append '/preview' to the URL.
	 * @return {string} The getted message image
	 */ public getMessageDataUrl(messageId: string, isPreview?: boolean, square?: boolean): string;
  /**
	 * Gets a message image URI by appending the given message ID to the prefixSticker
	 * @param {string} [messageId] - The message ID to use in the URLSticker
	 * @return {string} The getted message image
	 */ public getMessageMetadataUrl(messageId: string, square?: boolean): string;
  /**
	 * @description Gets the message's data from LINE Obs.
	 */ public downloadMessageData(options: {
    messageId: string;
    isPreview?: boolean;
    isSquare?: boolean;
  }): Promise<File>;
  /**
	 * @description Gets the message's data from LINE Obs.
	 */ public getMessageObsMetadata(options: {
    messageId: string;
    isSquare?: boolean;
  }): Promise<ObsMetadata>;
  /**
	 * @description Upload obs message to talk.
	 */ public uploadObjTalk(to: string, type: ObjType, data: Blob, oid?: string, filename?: string): Promise<{
    objId: string;
    objHash: string;
    headers: Headers;
  }>;
  uploadObjectForService(options: {
    data: Blob;
    oType?: ObjType;
    obsPath?: string;
    params?: Record<string, string | undefined>;
    filename?: string;
    addHeaders?: Record<string, string>;
  }): Promise<{
    objId: string;
    objHash: string;
    headers: Headers;
  }>;
  downloadObjectForService(options: {
    obsPath: string;
    oid: string;
    addHeaders?: Record<string, string>;
  }): Promise<Blob>;
  public uploadMediaByE2EE(options: {
    data: Blob;
    oType: ObjType;
    to: string;
    filename?: string;
  }): Promise<Message>;
  public downloadMediaByE2EE(message: Message): Promise<File | null>;
}
//# sourceMappingURL=mod.d.ts.map