import { type Device, type DeviceDetails } from "./utils/devices.js";
import { type BaseStorage } from "../storage/mod.js";
import { TypedEventEmitter } from "./typed-event-emitter/index.js";
import type { ClientEvents, Log } from "./utils/events.js";
import { InternalError } from "./utils/error.js";
import { type Continuable, continueRequest } from "./utils/continue.js";
export type { Continuable, Device, DeviceDetails, Log };
export { continueRequest, InternalError };
import { AuthService, CallService, ChannelService, LiffService, RelationService, SquareLiveTalkService, SquareService, TalkService } from "../service/mod.js";
import { Login } from "../login/mod.js";
import { Thrift } from "../thrift/mod.js";
import { RequestClient } from "../request/mod.js";
import { E2EE } from "../e2ee/mod.js";
import { LineObs } from "../obs/mod.js";
import { Timeline } from "../timeline/mod.js";
import { Polling } from "../polling/mod.js";
import { ConnManager } from "../push/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { Fetch, FetchLike } from "../types.js";
import type { LooseType } from "@jsr/evex__loose-types";
export interface LoginOption {
  email?: string;
  password?: string;
  pincode?: string;
  authToken?: string;
  qr?: boolean;
  e2ee?: boolean;
  v3?: boolean;
}
export interface ClientInit {
  /**
	 * version which LINE App to emulating
	 */ version?: string;
  /**
	 * API Endpoint
	 * @default "legy.line-apps.com"
	 */ endpoint?: string;
  /**
	 * Device
	 */ device: Device;
  /**
	 * Storage
	 * @default MemoryStorage
	 */ storage?: BaseStorage;
  /**
	 * Custom function to connect network.
	 * @default `globalThis.fetch`
	 */ fetch?: FetchLike;
}
export interface Config {
  /**
	 * Timeout
	 * @default 30_000
	 */ timeout: number;
  /**
	 * Long timeout
	 * @default 180_000
	 */ longTimeout: number;
}
/**
 * LINE.js client, which is entry point.
 */ export declare class BaseClient extends TypedEventEmitter<ClientEvents> {
  authToken?: string;
  readonly device: Device;
  readonly loginProcess: Login;
  readonly thrift: Thrift;
  readonly request: RequestClient;
  readonly storage: BaseStorage;
  readonly e2ee: E2EE;
  readonly obs: LineObs;
  readonly timeline: Timeline;
  readonly poll: Polling;
  readonly push: ConnManager;
  readonly auth: AuthService;
  readonly call: CallService;
  readonly channel: ChannelService;
  readonly liff: LiffService;
  readonly relation: RelationService;
  readonly livetalk: SquareLiveTalkService;
  readonly square: SquareService;
  readonly talk: TalkService;
  profile?: LINETypes.Profile;
  config: Config;
  readonly deviceDetails: DeviceDetails;
  readonly endpoint: string;
  /**
	 * Initializes a new instance of the class.
	 *
	 * @param init - The initialization parameters.
	 * @param init.device - The device type.
	 * @param init.version - The version of the device.
	 * @param init.fetch - Optional custom fetch function.
	 * @param init.endpoint - Optional endpoint URL.
	 * @param init.storage - Optional storage mechanism.
	 *
	 * @throws {Error} If the device is unsupported.
	 *
	 * @example
	 * ```typescript
	 * const client = new Client({
	 *   device: 'iOS',
	 *   version: '10.0',
	 *   fetch: customFetchFunction,
	 *   endpoint: 'custom-endpoint.com',
	 *   storage: new FileStorage("./storage.json"),
	 * });
	 * ```
	 */ constructor(init: ClientInit);
  log(type: string, data: Record<string, LooseType>): void;
  getToType(mid: string): number | null;
  reqseqs?: Record<string, number>;
  getReqseq(name?: string): Promise<number>;
  readonly fetch: Fetch;
  /**
	 * returns polling client.
	 */ createPolling(): Polling;
  /**
	 * JSON replacer to remove mid and authToken, parse bigint to number
	 *
	 * ```
	 * JSON.stringify(data, BaseClient.jsonReplacer);
	 * ```
	 */ static jsonReplacer(k: LooseType, v: LooseType): LooseType;
}
//# sourceMappingURL=mod.d.ts.map