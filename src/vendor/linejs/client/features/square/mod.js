import { continueRequest } from "../../../base/mod.js";
import { SquareMessage } from "../message/mod.js";
import { TypedEventEmitter } from "../../../base/core/typed-event-emitter/index.js";
/**
 * Square(Openchat) (not a SquareChat)
 */ export class Square {
  raw;
  #client;
  constructor(init){
    this.raw = init.raw;
    this.#client = init.client;
  }
  /** Updates square information */ async update() {
    this.raw = (await this.#client.base.square.getSquare({
      squareMid: this.raw.mid
    })).square;
  }
  async updateSquare(input) {
    return await this.#client.base.square.updateSquare({
      request: {
        updatedAttrs: input.updatedAttrs,
        square: {
          ...this.raw,
          ...input.square
        }
      }
    });
  }
  async updateName(name) {
    return await this.updateSquare({
      updatedAttrs: [
        "NAME"
      ],
      square: {
        name
      }
    });
  }
  /** OpenChat mid */ get mid() {
    return this.raw.mid;
  }
  /** OpenChat Name */ get name() {
    return this.raw.name;
  }
}
export class SquareChat extends TypedEventEmitter {
  raw;
  #client;
  constructor(init){
    super();
    this.raw = init.raw;
    this.#client = init.client;
  }
  /** Updates square information */ async update() {
    this.raw = (await this.#client.base.square.getSquareChat({
      squareChatMid: this.raw.squareChatMid
    })).squareChat;
  }
  async sendMessage(input) {
    if (typeof input === "string") {
      return this.sendMessage({
        text: input
      });
    }
    return await this.#client.base.square.sendMessage({
      ...input,
      squareChatMid: this.raw.squareChatMid
    });
  }
  async updateSquareChat(input) {
    return await this.#client.base.square.updateSquareChat({
      request: {
        updatedAttrs: input.updatedAttrs,
        squareChat: {
          ...this.raw,
          ...input.squareChat
        }
      }
    });
  }
  async updateName(name) {
    return await this.updateSquareChat({
      updatedAttrs: [
        "NAME"
      ],
      squareChat: {
        name
      }
    });
  }
  async getMembers() {
    const res = await continueRequest({
      handler: (arg)=>this.#client.base.square.getSquareChatMembers(arg),
      arg: {
        squareChatMid: this.raw.squareChatMid
      }
    });
    return res.squareChatMembers;
  }
  #isPolling = false;
  /**
	 * @description start listen (fetchSquareChatEvents)
	 */ async listen(param = {}) {
    if (this.#isPolling) {
      throw new Error("Polling has already started");
    }
    this.#isPolling = true;
    let syncToken = param.syncToken;
    if (!syncToken) {
      while(true){
        const noneEvent = await this.#client.base.square.fetchSquareChatEvents({
          squareChatMid: this.raw.squareChatMid,
          syncToken
        });
        syncToken = noneEvent.syncToken;
        if (noneEvent.events.length === 0) {
          break;
        }
      }
    }
    this.emit("update:syncToken", syncToken);
    while(!param.signal?.aborted && this.#client.base.authToken){
      try {
        const response = await this.#client.base.square.fetchSquareChatEvents({
          squareChatMid: this.raw.squareChatMid,
          syncToken: syncToken
        });
        if (syncToken !== response.syncToken) {
          this.emit("update:syncToken", response.syncToken);
          syncToken = response.syncToken;
        }
        for (const event of response.events){
          this.emit("event", event);
          if (event.type === "SEND_MESSAGE" && event.payload.sendMessage) {
            const message = new SquareMessage({
              client: this.#client,
              raw: event.payload.sendMessage.squareMessage
            });
            this.emit("message", message);
          } else if (event.type === "RECEIVE_MESSAGE" && event.payload.receiveMessage) {
            const message = new SquareMessage({
              client: this.#client,
              raw: event.payload.receiveMessage.squareMessage
            });
            this.emit("message", message);
            if (message.getTextDecorations().some((e)=>e.mention && e.mention.mid === this.#client.base.profile?.mid)) {
              this.emit("mention", message);
            }
          } else if (event.type === "NOTIFIED_KICKOUT_FROM_SQUARE" && event.payload.notifiedKickoutFromSquare) {
            this.emit("kick", event.payload.notifiedKickoutFromSquare);
          } else if (event.type === "NOTIFIED_LEAVE_SQUARE_CHAT" && event.payload.notifiedLeaveSquareChat) {
            this.emit("leave", event.payload.notifiedLeaveSquareChat);
          } else if (event.type === "NOTIFIED_JOIN_SQUARE_CHAT" && event.payload.notifiedJoinSquareChat) {
            this.emit("join", event.payload.notifiedJoinSquareChat);
          } else if (event.type === "NOTIFIED_DESTROY_MESSAGE" && event.payload.notifiedDestroyMessage) {
            this.emit("destroy", event.payload.notifiedDestroyMessage);
          }
        }
        await new Promise((resolve)=>setTimeout(resolve, 1000));
      } catch (e) {
        if (param.onError) param.onError(e);
        await new Promise((resolve)=>setTimeout(resolve, 2000));
      }
    }
  }
  /** OpenChat mid */ get mid() {
    return this.raw.squareChatMid;
  }
  /** OpenChat Name */ get name() {
    return this.raw.name;
  }
}
//# sourceMappingURL=mod.js.map