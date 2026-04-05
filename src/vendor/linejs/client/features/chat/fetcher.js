import { TalkMessage } from "../message/mod.js";
export const createMessageFetcher = async (client, chat)=>{
  const boxes = await client.base.talk.getMessageBoxes({
    messageBoxListRequest: {}
  });
  const box = boxes.messageBoxes.find((box)=>box.id === chat.mid);
  if (!box) {
    throw new Error("Message box not found.");
  }
  let lastMessageId = box.lastDeliveredMessageId;
  return {
    async fetch (limit) {
      const messages = await client.base.talk.getPreviousMessagesV2WithRequest({
        request: {
          messageBoxId: box.id,
          endMessageId: lastMessageId,
          messagesCount: limit
        }
      });
      const lastMessage = messages.at(-1);
      lastMessageId = {
        deliveredTime: lastMessage.deliveredTime,
        messageId: parseInt(lastMessage.id)
      };
      return await Promise.all(messages.map((message)=>TalkMessage.fromRawTalk(message, client)));
    }
  };
};
//# sourceMappingURL=fetcher.js.map