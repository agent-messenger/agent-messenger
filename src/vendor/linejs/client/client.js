import { Square, SquareChat } from "./features/square/mod.js";
import { continueRequest } from "../base/mod.js";
import { Chat } from "./features/chat/mod.js";
import { User } from "./features/user/mod.js";
import { TypedEventEmitter } from "../base/core/typed-event-emitter/index.js";
import { SquareMessage, TalkMessage } from "./features/message/mod.js";
export { Chat, Square, SquareChat, SquareMessage, TalkMessage, User };
export class Client extends TypedEventEmitter {
  base;
  constructor(base){
    super();
    this.base = base;
  }
  /**
	 * Listens events.
	 * @param opts Options
	 * @returns TypedEventEmitter
	 */ listen(opts = {
    talk: true,
    square: true
  }) {
    const polling = this.base.createPolling();
    const signal = opts.signal;
    signal && signal.addEventListener("abort", ()=>{
      this.base.push.opStream.close();
      this.base.push.sqStream.close();
    });
    if (opts.talk) {
      (async ()=>{
        for await (const event of polling.listenTalkEvents()){
          this.emit("event", event);
          if (event.type === "SEND_MESSAGE" || event.type === "RECEIVE_MESSAGE") {
            this.emit("message", new TalkMessage({
              raw: await this.base.e2ee.decryptE2EEMessage(event.message),
              client: this
            }));
          }
        }
      })();
    }
    if (opts.square) {
      (async ()=>{
        for await (const event of polling.listenSquareEvents()){
          this.emit("square:event", event);
          if (event.type === "NOTIFICATION_MESSAGE") {
            this.emit("square:message", new SquareMessage({
              raw: event.payload.notificationMessage.squareMessage,
              client: this
            }));
          }
        }
      })();
    }
  }
  /** Gets auth token for LINE. */ get authToken() {
    // NOTE: client is constructed when logined, so authToken is not undefined.
    return this.base.authToken;
  }
  /**
	 * Fetches all chat rooms the user joined.
	 */ async fetchJoinedChats() {
    const joined = await this.base.talk.getAllChatMids({
      request: {
        withMemberChats: true
      },
      syncReason: "INTERNAL"
    });
    const { chats } = await this.base.talk.getChats({
      chatMids: joined.memberChatMids
    });
    return chats.map((raw)=>new Chat({
        client: this,
        raw
      }));
  }
  /**
	 * Fetches all friend.
	 */ async fetchUsers() {
    await 0;
    throw new Error("fetchUsers is not implemented");
  /*
		const { userFriendMids } = await this.base.relation.getUserFriendIds({
			request: {
				blockStatus: "ALL",
			},
		});
		const res = await this.base.talk.getContactsV2({
			mids: userFriendMids,
		});
		const contacts = res.responses;
		return contacts.map((raw) =>
			new User({
				raw,
			})
		);
		*/ }
  /**
	 * Fetches all squares the user joined.
	 */ async fetchJoinedSquares() {
    const joined = await continueRequest({
      handler: (arg)=>this.base.square.getJoinedSquares(arg),
      arg: {
        limit: 100
      }
    });
    return joined.squares.map((raw)=>new Square({
        raw,
        client: this
      }));
  }
  /**
	 * Fetches all square chats the user joined.
	 */ async fetchJoinedSquareChats() {
    const response = await this.base.square.fetchMyEvents({
      limit: 200
    });
    const squareChats = [];
    for (const event of response.events){
      if (event.payload.notifiedCreateSquareChatMember) {
        squareChats.push(new SquareChat({
          client: this,
          raw: event.payload.notifiedCreateSquareChatMember.chat
        }));
      }
    }
    return squareChats;
  }
  /**
	 * Gets user by mid.
	 * @param mid User mid
	 * @returns User
	 */ async getUser(mid) {
    const res = await this.base.relation.getContactsV3({
      mids: [
        mid
      ]
    });
    const raw = res.responses[0];
    return new User({
      raw
    });
  }
  /**
	 * Gets chat by mid.
	 * @param chatMid Chat mid
	 * @returns Chat
	 */ async getChat(chatMid) {
    const raw = await this.base.talk.getChat({
      chatMid,
      withInvitees: true,
      withMembers: true
    });
    return new Chat({
      client: this,
      raw
    });
  }
  /**
	 * Gets square by mid.
	 * @param squareMid Square mid
	 * @returns Square
	 */ async getSquare(squareMid) {
    const raw = await this.base.square.getSquare({
      squareMid
    });
    return new Square({
      client: this,
      raw: raw.square
    });
  }
  /**
	 * Gets square by mid.
	 * @param squareChatMid Square chat mid
	 * @returns SquareChat
	 */ async getSquareChat(squareChatMid) {
    const raw = await this.base.square.getSquareChat({
      squareChatMid
    });
    return new SquareChat({
      client: this,
      raw: raw.squareChat
    });
  }
}
//# sourceMappingURL=client.js.map