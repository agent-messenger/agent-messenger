import { getDeviceDetails } from "./utils/devices.js";
import { MemoryStorage } from "../storage/mod.js";
import { TypedEventEmitter } from "./typed-event-emitter/index.js";
import { InternalError } from "./utils/error.js";
import { continueRequest } from "./utils/continue.js";
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
import { Thrift as def } from "../../../linejs-types/thrift.js";
/**
 * LINE.js client, which is entry point.
 */ export class BaseClient extends TypedEventEmitter {
  authToken;
  device;
  loginProcess;
  thrift;
  request;
  storage;
  e2ee;
  obs;
  timeline;
  poll;
  push;
  auth;
  call;
  channel;
  liff;
  relation;
  livetalk;
  square;
  talk;
  #customFetch;
  profile;
  config;
  deviceDetails;
  endpoint;
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
	 */ constructor(init){
    super();
    const deviceDetails = getDeviceDetails(init.device, init.version);
    if (!deviceDetails) {
      throw new Error(`Unsupported device: ${init.device}.`);
    }
    if (init.fetch) {
      this.#customFetch = init.fetch;
    }
    this.deviceDetails = deviceDetails;
    this.endpoint = init.endpoint ?? "legy.line-apps.com";
    this.config = {
      timeout: 30_000,
      longTimeout: 180_000
    };
    this.device = init.device;
    this.storage = init.storage ?? new MemoryStorage();
    this.request = new RequestClient(this);
    this.loginProcess = new Login(this);
    this.thrift = new Thrift();
    this.thrift.def = def;
    this.e2ee = new E2EE(this);
    this.obs = new LineObs(this);
    this.timeline = new Timeline(this);
    this.poll = new Polling(this);
    this.push = new ConnManager(this);
    this.auth = new AuthService(this);
    this.call = new CallService(this);
    this.channel = new ChannelService(this);
    this.liff = new LiffService(this);
    this.livetalk = new SquareLiveTalkService(this);
    this.relation = new RelationService(this);
    this.square = new SquareService(this);
    this.talk = new TalkService(this);
  }
  log(type, data) {
    this.emit("log", {
      type,
      data
    });
  }
  getToType(mid) {
    const typeMapping = {
      u: 0,
      r: 1,
      c: 2,
      s: 3,
      m: 4,
      p: 5,
      v: 6,
      t: 7
    };
    return typeMapping[mid[0]] ?? null;
  }
  reqseqs;
  async getReqseq(name = "talk") {
    if (!this.reqseqs) {
      this.reqseqs = JSON.parse((await this.storage.get("reqseq") ?? "{}").toString());
    }
    if (!this.reqseqs[name]) {
      this.reqseqs[name] = 0;
    }
    const seq = this.reqseqs[name];
    this.reqseqs[name]++;
    await this.storage.set("reqseq", JSON.stringify(this.reqseqs));
    return seq;
  }
  // NOTE: use allow function.
  // `const { fetch } = base` is not working if you change to function decorations.
  fetch = async (info, init)=>{
    const req = new Request(info, init);
    const res = await (this.#customFetch ? this.#customFetch(req) : globalThis.fetch(req));
    return res;
  };
  /**
	 * returns polling client.
	 */ createPolling() {
    return this.poll;
  }
  /**
	 * JSON replacer to remove mid and authToken, parse bigint to number
	 *
	 * ```
	 * JSON.stringify(data, BaseClient.jsonReplacer);
	 * ```
	 */ static jsonReplacer(k, v) {
    if (typeof v === "bigint") {
      //@ts-expect-error https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/JSON/rawJSON
      return JSON.rawJSON(v.toString());
    }
    if (typeof v === "string") {
      const midType = v.match(/([ucrpmst])[0123456789abcdef]{32}/);
      if (midType && midType[1]) {
        return `[${midType[1].toUpperCase()} mid]`;
      }
      if (k === "x-line-access") {
        return `[AuthToken]`;
      }
    }
    if (typeof v === "object") {
      if (Array.isArray(v)) {
        return v.map((item)=>BaseClient.jsonReplacer("", item));
      }
      if (v instanceof Uint8Array) {
        return `Uint8Array[${v.length}]<${Array.from(v).map((e)=>e.toString(16).padStart(2, "0")).join(" ")}>`;
      }
      if (v.type === "Buffer" && Array.isArray(v.data)) {
        return `Buffer[${v.data.length}]<${Array.from(v.data).map((e)=>Number(e).toString(16).padStart(2, "0")).join(" ")}>`;
      }
      if (v instanceof Blob) {
        return `Blob[${v.size}]@${v.type}`;
      }
      const newObj = {};
      let midCount = 0;
      for(const key in v){
        if (Object.prototype.hasOwnProperty.call(v, key)) {
          const value = v[key];
          const midType = key.match(/(.)[0123456789abcdef]{32}/);
          if (midType && midType[1]) {
            midCount++;
            newObj[`[${midType[1].toUpperCase()} mid ${midCount}]`] = value;
          } else {
            newObj[key] = value;
          }
        }
      }
      return newObj;
    }
    return v;
  }
}
//# sourceMappingURL=mod.js.map
