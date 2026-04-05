/**
 * linejs client.
 * @module
 */ import type { FetchLike } from "../base/mod.js";
import type { Device } from "../base/mod.js";
import type { BaseStorage } from "../base/storage/mod.js";
import { Client } from "./client.js";
export interface InitOptions {
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
export interface WithQROptions {
  onReceiveQRUrl(url: string): Promise<void> | void;
  onPincodeRequest(pin: string): void | Promise<void>;
}
export declare const loginWithQR: (opts: WithQROptions, init: InitOptions) => Promise<Client>;
export interface WithPasswordOptions {
  email: string;
  password: string;
  /** @default 114514 */ pincode?: string;
  onPincodeRequest(pin: string): void | Promise<void>;
}
export declare const loginWithPassword: (opts: WithPasswordOptions, init: InitOptions) => Promise<Client>;
export declare const loginWithAuthToken: (authToken: string, init: InitOptions) => Promise<Client>;
//# sourceMappingURL=login.d.ts.map