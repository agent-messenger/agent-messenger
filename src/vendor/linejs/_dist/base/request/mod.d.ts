import { type NestedArray, type ProtocolKey } from "../thrift/mod.js";
import { type BaseClient } from "../core/mod.js";
/**
 * Request Client
 */ /**
 * @class RequestClient
 * @description A client for making requests to the LINE API.
 *
 * @property {BaseClient} client - The base client instance.
 * @property {string} endpoint - The endpoint for the API requests.
 * @property {string} userAgent - The user agent string for the requests.
 * @property {string} systemType - The system type string for the requests.
 * @property {Record<string, string | undefined>} EXCEPTION_TYPES - A static record of exception types based on request paths.
 *
 * @constructor
 * @param {BaseClient} client - The base client instance.
 */ export declare class RequestClient {
  readonly client: BaseClient;
  endpoint: string;
  userAgent: string;
  /**
	 * x-line-application
	 */ systemType: string;
  static readonly EXCEPTION_TYPES: Record<string, string | undefined>;
  constructor(client: BaseClient);
  /**
	 * @description Request to LINE API.
	 *
	 * @param value - The thrift value(argument) to request.
	 * @param methodName - The method name of the request.
	 * @param protocolType - The protocol type of the request.
	 * @param parse - Whether to parse the response.
	 * @param path - The path of the request.
	 * @param headers - The headers of the request.
	 * @param timeout - The timeout milliseconds of the request.
	 * @returns The response.
	 */ public request<T = unknown>(value: NestedArray, methodName: string, protocolType?: ProtocolKey, parse?: boolean | string, path?: string, headers?: Record<string, string | undefined>, timeout?: any): Promise<T>;
  private requestCore: any;
  /**
	 * Get HTTP headers for a request.
	 * @param {string} [overrideMethod="POST"] The HTTP method to use in the `x-lhm` header.
	 * @returns {Record<string, string>} An object with the headers as key-value pairs.
	 */ public getHeader(overrideMethod?: string): Record<string, string>;
}
//# sourceMappingURL=mod.d.ts.map