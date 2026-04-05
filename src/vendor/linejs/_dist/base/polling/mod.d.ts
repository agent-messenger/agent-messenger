import type { BaseClient } from "../core/mod.js";
import type { Operation, SquareEvent } from "@jsr/evex__linejs-types";
export interface SyncData {
  square?: string;
  talk: {
    revision?: number | bigint;
    globalRev?: number | bigint;
    individualRev?: number | bigint;
  };
}
export declare class Polling {
  sync: SyncData;
  client: BaseClient;
  islisten: boolean;
  listenTarget: number[];
  constructor(client: BaseClient);
  /**
	 * Listens to square events and yields them as they are received.
	 *
	 * @param options - Configuration options for listening to square events.
	 * @param options.signal - An AbortSignal to cancel the polling.
	 * @param options.onError - A callback function to handle errors.
	 * @param options.pollingInterval - The interval in milliseconds between polling requests. Defaults to 1000ms.
	 *
	 * @yields {SquareEvent} - The events received from the square.
	 *
	 * @deprecated
	 */ _listenSquareEvents(options?: {
    signal?: AbortSignal;
    onError?: (error: unknown) => void;
    pollingInterval?: number;
  }): AsyncGenerator<SquareEvent, void, unknown>;
  /**
	 * Listens for talk events by polling the server at a specified interval.
	 *
	 * @param {Object} [options] - Configuration options for the polling.
	 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the polling.
	 * @param {(error: unknown) => void} [options.onError] - A callback function to handle errors.
	 * @param {number} [options.pollingInterval=1000] - The interval in milliseconds between each poll.
	 *
	 * @yields {Operation} - Yields each operation event received from the server.
	 *
	 * @returns {AsyncGenerator<Operation, void, unknown>} - An async generator that yields operation events.
	 *
	 * @deprecated
	 */ _listenTalkEvents(options?: {
    signal?: AbortSignal;
    onError?: (error: unknown) => void;
    pollingInterval?: number;
  }): AsyncGenerator<Operation, void, unknown>;
  initLegyPusher(cb?: () => void): Promise<void>;
  listenSquareEvents(): ReadableStream<SquareEvent>;
  listenTalkEvents(): ReadableStream<Operation>;
}
//# sourceMappingURL=mod.d.ts.map