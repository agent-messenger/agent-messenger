import type { BaseClient } from "../core/mod.js";
import type { ConnManager, ReadableStreamWriter } from "./connManager.js";
import type { LooseType } from "@jsr/evex__loose-types";
export declare class Conn {
  manager: ConnManager;
  h2Headers: Array<[string, string]>;
  isNotFinished: boolean;
  cacheData: Uint8Array;
  notFinPayloads: Record<number, Uint8Array>;
  reqStream?: ReadableStreamWriter<Uint8Array> & {
    abort: AbortController;
  };
  resStream?: ReadableStream<Uint8Array>;
  private _lastSendTime: any;
  private _closed: any;
  constructor(manager: ConnManager);
  get client(): BaseClient;
  createAsyncReadableStream(): {
    stream: ReadableStream<Uint8Array<ArrayBufferLike>>;
    enqueue(chunk: string | Uint8Array): void;
    close(): void;
    error(err: LooseType): void;
    renew(): void;
  };
  new(host: string, _port: number, path: string, headers?: Record<string, string>): Promise<void>;
  writeByte(data: Uint8Array): Promise<void>;
  writeRequest(requestType: number, data: Uint8Array): Promise<void>;
  read(): Promise<void>;
  isAble2Request(): boolean;
  readPacketHeader(data: Uint8Array): {
    dt: number;
    dd: Uint8Array;
    dl: number;
  };
  onDataReceived(data: Uint8Array): void;
  onPacketReceived(dt: number, dd: Uint8Array): void;
  close(): Promise<void>;
}
//# sourceMappingURL=conn.d.ts.map