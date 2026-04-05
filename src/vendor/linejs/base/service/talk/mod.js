import { InternalError } from "../../core/mod.js";
import { LINEStruct } from "../../thrift/mod.js";
import { ContentType } from "../../thrift/readwrite/struct.js";
export class TalkService {
  client;
  protocolType = 4;
  requestPath = "/S4";
  errorName = "TalkServiceError";
  constructor(client){
    this.client = client;
  }
  /**
	 * Retrieves LINE events from the server.
	 *
	 * @param options - Optional parameters for retrieving events.
	 * @param options.limit - The maximum number of events to retrieve. Default is 100.
	 * @param options.revision - The last known revision number. Default is 0.
	 * @param options.globalRev - The last known global revision number. Default is 0.
	 * @param options.individualRev - The last known individual revision number. Default is 0.
	 * @param options.timeout - The timeout for the request in milliseconds. Default is the client's long timeout configuration.
	 * @returns A promise that resolves to the success result of the event retrieval.
	 */ async sync(options = {}) {
    const { limit, revision, individualRev, globalRev, timeout } = {
      limit: 100,
      revision: 0,
      globalRev: 0,
      individualRev: 0,
      timeout: this.client.config.longTimeout,
      ...options
    };
    return await this.client.request.request(LINEStruct.sync_args({
      request: {
        lastRevision: revision,
        lastGlobalRevision: globalRev,
        lastIndividualRevision: individualRev,
        count: limit
      }
    }), "sync", 4, true, "/SYNC4", {}, timeout);
  }
  /**
	 * Sends a message to a specified recipient with various options.
	 *
	 * @param options - The options for sending the message.
	 * @param options.to - The recipient's ID.
	 * @param options.text - The text content of the message (optional).
	 * @param options.contentType - The type of content being sent (optional).
	 * @param options.contentMetadata - Additional metadata for the content (optional).
	 * @param options.relatedMessageId - The ID of a related message, if any (optional).
	 * @param options.location - The location information to be sent (optional).
	 * @param options.chunks - The message content in chunks, either as strings or buffers (optional).
	 * @param options.e2ee - Flag indicating whether to use end-to-end encryption (optional).
	 * @returns A promise that resolves to the sent message.
	 * @throws Will throw an error if the message sending fails.
	 */ async sendMessage(options) {
    const { to, text, contentType, contentMetadata, relatedMessageId, location, e2ee, chunks } = {
      contentType: "NONE",
      contentMetadata: {},
      ...options
    };
    if (e2ee && !chunks && location || e2ee && !chunks && text) {
      const chunks = await this.client.e2ee.encryptE2EEMessage(to, text || location || "invalid", contentType);
      const _contentMetadata = {
        ...contentMetadata,
        ...{
          e2eeVersion: "2",
          contentType: (ContentType(contentType) || 0).toString(),
          e2eeMark: "2"
        }
      };
      const options = {
        to,
        contentType,
        contentMetadata: _contentMetadata,
        relatedMessageId,
        e2ee,
        chunks
      };
      return this.sendMessage(options);
    }
    const message = LINEStruct.sendMessage_args({
      seq: await this.client.getReqseq(),
      message: {
        reactions: undefined,
        to,
        createdTime: 0,
        deliveredTime: 0,
        hasContent: false,
        contentType,
        contentMetadata,
        sessionId: 0,
        text,
        location,
        chunks,
        relatedMessageId,
        ...relatedMessageId ? {
          messageRelationType: "REPLY",
          relatedMessageServiceCode: "TALK"
        } : {}
      }
    });
    try {
      return await this.client.request.request(message, "sendMessage", this.protocolType, true, this.requestPath);
    } catch (error) {
      if (error instanceof InternalError && (error.data?.code.toString()).includes("E2EE") && typeof e2ee === "undefined") {
        options.e2ee = true;
        return this.sendMessage(options);
      } else {
        throw error;
      }
    }
  }
  async getProfile(...param) {
    return await this.client.request.request(LINEStruct.getProfile_args(...param), "getProfile", this.protocolType, "Profile", this.requestPath);
  }
  async getSettings(...param) {
    return await this.client.request.request(LINEStruct.getSettings_args(...param), "getSettings", this.protocolType, true, this.requestPath);
  }
  async sendChatChecked(...param) {
    return await this.client.request.request(LINEStruct.sendChatChecked_args(...param), "sendChatChecked", this.protocolType, true, this.requestPath);
  }
  async unsendMessage(...param) {
    return await this.client.request.request(LINEStruct.unsendMessage_args(...param), "unsendMessage", this.protocolType, true, this.requestPath);
  }
  async deleteOtherFromChat(...param) {
    return await this.client.request.request(LINEStruct.deleteOtherFromChat_args(...param), "deleteOtherFromChat", this.protocolType, true, this.requestPath);
  }
  async inviteIntoChat(options) {
    return await this.client.request.request(LINEStruct.inviteIntoChat_args({
      request: {
        targetUserMids: options.targetUserMids,
        chatMid: options.chatMid
      }
    }), "inviteIntoChat", this.protocolType, true, this.requestPath);
  }
  async cancelChatInvitation(...param) {
    return await this.client.request.request(LINEStruct.cancelChatInvitation_args(...param), "cancelChatInvitation", this.protocolType, true, this.requestPath);
  }
  async deleteSelfFromChat(...param) {
    return await this.client.request.request(LINEStruct.deleteSelfFromChat_args(...param), "deleteSelfFromChat", this.protocolType, true, this.requestPath);
  }
  async acceptChatInvitation(...param) {
    return await this.client.request.request(LINEStruct.acceptChatInvitation_args(...param), "acceptChatInvitation", this.protocolType, true, this.requestPath);
  }
  async reissueChatTicket(...param) {
    return await this.client.request.request(LINEStruct.reissueChatTicket_args(...param), "reissueChatTicket", this.protocolType, true, this.requestPath);
  }
  async findChatByTicket(...param) {
    return await this.client.request.request(LINEStruct.findChatByTicket_args(...param), "findChatByTicket", this.protocolType, true, this.requestPath);
  }
  async acceptChatInvitationByTicket(...param) {
    return await this.client.request.request(LINEStruct.acceptChatInvitationByTicket_args(...param), "acceptChatInvitationByTicket", this.protocolType, true, this.requestPath);
  }
  async updateChat(...param) {
    return await this.client.request.request(LINEStruct.updateChat_args(...param), "updateChat", this.protocolType, true, this.requestPath);
  }
  async getAllContactIds(...param) {
    return await this.client.request.request(LINEStruct.getAllContactIds_args(...param), "getAllContactIds", this.protocolType, true, this.requestPath);
  }
  async getBlockedContactIds(...param) {
    return await this.client.request.request(LINEStruct.getBlockedContactIds_args(...param), "getBlockedContactIds", this.protocolType, true, this.requestPath);
  }
  async getBlockedRecommendationIds(...param) {
    return await this.client.request.request(LINEStruct.getBlockedRecommendationIds_args(...param), "getBlockedRecommendationIds", this.protocolType, true, this.requestPath);
  }
  async sendPostback(...param) {
    return await this.client.request.request(LINEStruct.sendPostback_args(...param), "sendPostback", this.protocolType, true, this.requestPath);
  }
  async getMessageBoxes(...param) {
    return await this.client.request.request(LINEStruct.getMessageBoxes_args(...param), "getMessageBoxes", this.protocolType, true, this.requestPath);
  }
  async getChatRoomAnnouncementsBulk(...param) {
    return await this.client.request.request(LINEStruct.getChatRoomAnnouncementsBulk_args(...param), "getChatRoomAnnouncementsBulk", this.protocolType, true, this.requestPath);
  }
  async getChatRoomAnnouncements(...param) {
    return await this.client.request.request(LINEStruct.getChatRoomAnnouncements_args(...param), "getChatRoomAnnouncements", this.protocolType, true, this.requestPath);
  }
  async removeChatRoomAnnouncement(...param) {
    return await this.client.request.request(LINEStruct.removeChatRoomAnnouncement_args(...param), "removeChatRoomAnnouncement", this.protocolType, true, this.requestPath);
  }
  async createChatRoomAnnouncement(...param) {
    return await this.client.request.request(LINEStruct.createChatRoomAnnouncement_args(...param), "createChatRoomAnnouncement", this.protocolType, true, this.requestPath);
  }
  async leaveRoom(...param) {
    return await this.client.request.request(LINEStruct.leaveRoom_args(...param), "leaveRoom", this.protocolType, true, this.requestPath);
  }
  async getRoomsV2(...param) {
    return await this.client.request.request(LINEStruct.getRoomsV2_args(...param), "getRoomsV2", this.protocolType, true, this.requestPath);
  }
  async createRoomV2(...param) {
    return await this.client.request.request(LINEStruct.createRoomV2_args(...param), "createRoomV2", this.protocolType, true, this.requestPath);
  }
  async getCountries(...param) {
    return await this.client.request.request(LINEStruct.getCountries_args(...param), "getCountries", this.protocolType, true, this.requestPath);
  }
  async acquireEncryptedAccessToken(...param) {
    return await this.client.request.request(LINEStruct.acquireEncryptedAccessToken_args(...param), "acquireEncryptedAccessToken", this.protocolType, true, this.requestPath);
  }
  async blockContact(...param) {
    return await this.client.request.request(LINEStruct.blockContact_args(...param), "blockContact", this.protocolType, true, this.requestPath);
  }
  async unblockContact(...param) {
    return await this.client.request.request(LINEStruct.unblockContact_args(...param), "unblockContact", this.protocolType, true, this.requestPath);
  }
  async getConfigurations(...param) {
    return await this.client.request.request(LINEStruct.getConfigurations_args(...param), "getConfigurations", this.protocolType, true, this.requestPath);
  }
  async fetchOperations(...param) {
    return await this.client.request.request(LINEStruct.fetchOperations_args(...param), "fetchOperations", this.protocolType, true, this.requestPath);
  }
  async getRepairElements(...param) {
    return await this.client.request.request(LINEStruct.getRepairElements_args(...param), "getRepairElements", this.protocolType, true, this.requestPath);
  }
  async getSettingsAttributes2(...param) {
    return await this.client.request.request(LINEStruct.getSettingsAttributes2_args(...param), "getSettingsAttributes2", this.protocolType, true, this.requestPath);
  }
  async updateSettingsAttributes2(...param) {
    return await this.client.request.request(LINEStruct.updateSettingsAttributes2_args(...param), "updateSettingsAttributes2", this.protocolType, true, this.requestPath);
  }
  async rejectChatInvitation(...param) {
    return await this.client.request.request(LINEStruct.rejectChatInvitation_args(...param), "rejectChatInvitation", this.protocolType, true, this.requestPath);
  }
  async getE2EEPublicKey(...param) {
    return await this.client.request.request(LINEStruct.getE2EEPublicKey_args(...param), "getE2EEPublicKey", this.protocolType, true, this.requestPath);
  }
  async getE2EEPublicKeys() {
    return await this.client.request.request([], "getE2EEPublicKeys", this.protocolType, false, this.requestPath);
  }
  async registerE2EEPublicKey(...param) {
    return await this.client.request.request(LINEStruct.registerE2EEPublicKey_args(...param), "registerE2EEPublicKey", this.protocolType, true, this.requestPath);
  }
  async registerE2EEGroupKey(...param) {
    return await this.client.request.request(LINEStruct.registerE2EEGroupKey_args(...param), "registerE2EEGroupKey", this.protocolType, true, this.requestPath);
  }
  async getE2EEGroupSharedKey(...param) {
    return await this.client.request.request(LINEStruct.getE2EEGroupSharedKey_args(...param), "getE2EEGroupSharedKey", this.protocolType, true, this.requestPath);
  }
  async getLastE2EEGroupSharedKey(...param) {
    return await this.client.request.request(LINEStruct.getLastE2EEGroupSharedKey_args(...param), "getLastE2EEGroupSharedKey", this.protocolType, true, this.requestPath);
  }
  async getLastE2EEPublicKeys(...param) {
    return await this.client.request.request(LINEStruct.getLastE2EEPublicKeys_args(...param), "getLastE2EEPublicKeys", this.protocolType, true, this.requestPath);
  }
  async negotiateE2EEPublicKey(...param) {
    return await this.client.request.request(LINEStruct.negotiateE2EEPublicKey_args(...param), "negotiateE2EEPublicKey", this.protocolType, true, this.requestPath);
  }
  async react(options) {
    return await this.client.request.request(LINEStruct.react_args({
      reactRequest: {
        reqSeq: 0,
        messageId: options.id,
        reactionType: {
          predefinedReactionType: options.reaction
        }
      }
    }), "react", this.protocolType, true, this.requestPath);
  }
  async createChat(...param) {
    return await this.client.request.request(LINEStruct.createChat_args(...param), "createChat", this.protocolType, true, this.requestPath);
  }
  async setChatHiddenStatus(...param) {
    return await this.client.request.request(LINEStruct.setChatHiddenStatus_args(...param), "setChatHiddenStatus", this.protocolType, true, this.requestPath);
  }
  async getFollowers(...param) {
    return await this.client.request.request(LINEStruct.getFollowers_args(...param), "getFollowers", this.protocolType, true, this.requestPath);
  }
  async getFollowings(...param) {
    return await this.client.request.request(LINEStruct.getFollowings_args(...param), "getFollowings", this.protocolType, true, this.requestPath);
  }
  async removeFollower(...param) {
    return await this.client.request.request(LINEStruct.removeFollower_args(...param), "removeFollower", this.protocolType, true, this.requestPath);
  }
  async follow(...param) {
    return await this.client.request.request(LINEStruct.follow_args(...param), "follow", this.protocolType, true, this.requestPath);
  }
  async unfollow(...param) {
    return await this.client.request.request(LINEStruct.unfollow_args(...param), "unfollow", this.protocolType, true, this.requestPath);
  }
  async bulkFollow(...param) {
    return await this.client.request.request(LINEStruct.bulkFollow_args(...param), "bulkFollow", this.protocolType, true, this.requestPath);
  }
  async decryptFollowEMid(...param) {
    return await this.client.request.request(LINEStruct.decryptFollowEMid_args(...param), "decryptFollowEMid", this.protocolType, true, this.requestPath);
  }
  async getMessageReadRange(...param) {
    return await this.client.request.request(LINEStruct.getMessageReadRange_args(...param), "getMessageReadRange", this.protocolType, true, this.requestPath);
  }
  async getChatRoomBGMs(...param) {
    return await this.client.request.request(LINEStruct.getChatRoomBGMs_args(...param), "getChatRoomBGMs", this.protocolType, true, this.requestPath);
  }
  async updateChatRoomBGM(...param) {
    return await this.client.request.request(LINEStruct.updateChatRoomBGM_args(...param), "updateChatRoomBGM", this.protocolType, true, this.requestPath);
  }
  async blockRecommendation(...param) {
    return await this.client.request.request(LINEStruct.blockRecommendation_args(...param), "blockRecommendation", this.protocolType, true, this.requestPath);
  }
  async unblockRecommendation(...param) {
    return await this.client.request.request(LINEStruct.unblockRecommendation_args(...param), "unblockRecommendation", this.protocolType, true, this.requestPath);
  }
  async getRecommendationIds(...param) {
    return await this.client.request.request(LINEStruct.getRecommendationIds_args(...param), "getRecommendationIds", this.protocolType, true, this.requestPath);
  }
  async getExtendedProfile(...param) {
    return await this.client.request.request(LINEStruct.getExtendedProfile_args(...param), "getExtendedProfile", this.protocolType, true, this.requestPath);
  }
  async updateExtendedProfileAttribute(...param) {
    return await this.client.request.request(LINEStruct.updateExtendedProfileAttribute_args(...param), "updateExtendedProfileAttribute", this.protocolType, true, this.requestPath);
  }
  async setNotificationsEnabled(...param) {
    return await this.client.request.request(LINEStruct.setNotificationsEnabled_args(...param), "setNotificationsEnabled", this.protocolType, true, this.requestPath);
  }
  async syncContacts(...param) {
    return await this.client.request.request(LINEStruct.syncContacts_args(...param), "syncContacts", this.protocolType, true, this.requestPath);
  }
  async findContactsByPhone(...param) {
    return await this.client.request.request(LINEStruct.findContactsByPhone_args(...param), "findContactsByPhone", this.protocolType, true, this.requestPath);
  }
  async findContactByUserid(...param) {
    return await this.client.request.request(LINEStruct.findContactByUserid_args(...param), "findContactByUserid", this.protocolType, true, this.requestPath);
  }
  async updateContactSetting(...param) {
    return await this.client.request.request(LINEStruct.updateContactSetting_args(...param), "updateContactSetting", this.protocolType, true, this.requestPath);
  }
  async findContactByUserTicket(...param) {
    return await this.client.request.request(LINEStruct.findContactByUserTicket_args(...param), "findContactByUserTicket", this.protocolType, true, this.requestPath);
  }
  async verifyQrcode(...param) {
    return await this.client.request.request(LINEStruct.verifyQrcode_args(...param), "verifyQrcode", this.protocolType, true, this.requestPath);
  }
  async reportAbuseEx(...param) {
    return await this.client.request.request(LINEStruct.reportAbuseEx_args(...param), "reportAbuseEx", this.protocolType, true, this.requestPath);
  }
  async updateProfileAttributes(...param) {
    return await this.client.request.request(LINEStruct.updateProfileAttributes_args(...param), "updateProfileAttributes", this.protocolType, true, this.requestPath);
  }
  async updateNotificationToken(...param) {
    return await this.client.request.request(LINEStruct.updateNotificationToken_args(...param), "updateNotificationToken", this.protocolType, true, this.requestPath);
  }
  async tryFriendRequest(...param) {
    return await this.client.request.request(LINEStruct.tryFriendRequest_args(...param), "tryFriendRequest", this.protocolType, true, this.requestPath);
  }
  async generateUserTicket(...param) {
    return await this.client.request.request(LINEStruct.generateUserTicket_args(...param), "generateUserTicket", this.protocolType, true, this.requestPath);
  }
  async getRecentFriendRequests(...param) {
    return await this.client.request.request(LINEStruct.getRecentFriendRequests_args(...param), "getRecentFriendRequests", this.protocolType, true, this.requestPath);
  }
  async resendPinCode(...param) {
    return await this.client.request.request(LINEStruct.resendPinCode_args(...param), "resendPinCode", this.protocolType, true, this.requestPath);
  }
  async notifyRegistrationComplete(...param) {
    return await this.client.request.request(LINEStruct.notifyRegistrationComplete_args(...param), "notifyRegistrationComplete", this.protocolType, true, this.requestPath);
  }
  async getInstantNews(...param) {
    return await this.client.request.request(LINEStruct.getInstantNews_args(...param), "getInstantNews", this.protocolType, true, this.requestPath);
  }
  async changeVerificationMethod(...param) {
    return await this.client.request.request(LINEStruct.changeVerificationMethod_args(...param), "changeVerificationMethod", this.protocolType, true, this.requestPath);
  }
  async getChatEffectMetaList(...param) {
    return await this.client.request.request(LINEStruct.getChatEffectMetaList_args(...param), "getChatEffectMetaList", this.protocolType, true, this.requestPath);
  }
  async notifyInstalled(...param) {
    return await this.client.request.request(LINEStruct.notifyInstalled_args(...param), "notifyInstalled", this.protocolType, true, this.requestPath);
  }
  async reportDeviceState(...param) {
    return await this.client.request.request(LINEStruct.reportDeviceState_args(...param), "reportDeviceState", this.protocolType, true, this.requestPath);
  }
  async sendChatRemoved(...param) {
    return await this.client.request.request(LINEStruct.sendChatRemoved_args(...param), "sendChatRemoved", this.protocolType, true, this.requestPath);
  }
  async startUpdateVerification(...param) {
    return await this.client.request.request(LINEStruct.startUpdateVerification_args(...param), "startUpdateVerification", this.protocolType, true, this.requestPath);
  }
  async inviteIntoRoom(...param) {
    return await this.client.request.request(LINEStruct.inviteIntoRoom_args(...param), "inviteIntoRoom", this.protocolType, true, this.requestPath);
  }
  async removeFriendRequest(...param) {
    return await this.client.request.request(LINEStruct.removeFriendRequest_args(...param), "removeFriendRequest", this.protocolType, true, this.requestPath);
  }
  async reportProfile(...param) {
    return await this.client.request.request(LINEStruct.reportProfile_args(...param), "reportProfile", this.protocolType, true, this.requestPath);
  }
  async wakeUpLongPolling(...param) {
    return await this.client.request.request(LINEStruct.wakeUpLongPolling_args(...param), "wakeUpLongPolling", this.protocolType, true, this.requestPath);
  }
  async updateAndGetNearby(...param) {
    return await this.client.request.request(LINEStruct.updateAndGetNearby_args(...param), "updateAndGetNearby", this.protocolType, true, this.requestPath);
  }
  async reportSettings(...param) {
    return await this.client.request.request(LINEStruct.reportSettings_args(...param), "reportSettings", this.protocolType, true, this.requestPath);
  }
  async verifyPhoneNumber(...param) {
    return await this.client.request.request(LINEStruct.verifyPhoneNumber_args(...param), "verifyPhoneNumber", this.protocolType, true, this.requestPath);
  }
  async isUseridAvailable(...param) {
    return await this.client.request.request(LINEStruct.isUseridAvailable_args(...param), "isUseridAvailable", this.protocolType, true, this.requestPath);
  }
  async registerUserid(...param) {
    return await this.client.request.request(LINEStruct.registerUserid_args(...param), "registerUserid", this.protocolType, true, this.requestPath);
  }
  async finishUpdateVerification(...param) {
    return await this.client.request.request(LINEStruct.finishUpdateVerification_args(...param), "finishUpdateVerification", this.protocolType, true, this.requestPath);
  }
  async clearRingtone(...param) {
    return await this.client.request.request(LINEStruct.clearRingtone_args(...param), "clearRingtone", this.protocolType, true, this.requestPath);
  }
  async notifyUpdated(...param) {
    return await this.client.request.request(LINEStruct.notifyUpdated_args(...param), "notifyUpdated", this.protocolType, true, this.requestPath);
  }
  async reportPushRecvReports(...param) {
    return await this.client.request.request(LINEStruct.reportPushRecvReports_args(...param), "reportPushRecvReports", this.protocolType, true, this.requestPath);
  }
  async getFriendRequests(...param) {
    return await this.client.request.request(LINEStruct.getFriendRequests_args(...param), "getFriendRequests", this.protocolType, true, this.requestPath);
  }
  async addToFollowBlacklist(...param) {
    return await this.client.request.request(LINEStruct.addToFollowBlacklist_args(...param), "addToFollowBlacklist", this.protocolType, true, this.requestPath);
  }
  async removeFromFollowBlacklist(...param) {
    return await this.client.request.request(LINEStruct.removeFromFollowBlacklist_args(...param), "removeFromFollowBlacklist", this.protocolType, true, this.requestPath);
  }
  async getFollowBlacklist(...param) {
    return await this.client.request.request(LINEStruct.getFollowBlacklist_args(...param), "getFollowBlacklist", this.protocolType, true, this.requestPath);
  }
  async determineMediaMessageFlow(...param) {
    return await this.client.request.request(LINEStruct.determineMediaMessageFlow_args(...param), "determineMediaMessageFlow", this.protocolType, true, this.requestPath);
  }
  async createSession(...param) {
    return await this.client.request.request(LINEStruct.createSession_args(...param), "createSession", this.protocolType, true, this.requestPath);
  }
  async cancelReaction(...param) {
    return await this.client.request.request(LINEStruct.cancelReaction_args(...param), "cancelReaction", this.protocolType, true, this.requestPath);
  }
  async getNotificationSettings(...param) {
    return await this.client.request.request(LINEStruct.getNotificationSettings_args(...param), "getNotificationSettings", this.protocolType, true, this.requestPath);
  }
  async getChats(options) {
    return await this.client.request.request(LINEStruct.getChats_args({
      request: {
        withInvitees: true,
        withMembers: true,
        ...options
      },
      syncReason: "INTERNAL"
    }), "getChats", this.protocolType, true, this.requestPath);
  }
  async getChat(options) {
    const res = await this.getChats({
      chatMids: [
        options.chatMid
      ],
      withInvitees: options.withInvitees,
      withMembers: options.withMembers
    });
    return res.chats[0];
  }
  async getAllChatMids(...param) {
    return await this.client.request.request(LINEStruct.getAllChatMids_args(...param), "getAllChatMids", this.protocolType, true, this.requestPath);
  }
  async getPreviousMessagesV2WithRequest(...param) {
    return await this.client.request.request(LINEStruct.getPreviousMessagesV2WithRequest_args(...param), "getPreviousMessagesV2WithRequest", this.protocolType, true, this.requestPath);
  }
  /**
	 * @description Gets the server time
	 */ async getServerTime() {
    return await this.client.request.request([], "getServerTime", this.protocolType, true, this.requestPath);
  }
  /**
	 * @description Get user information from mid.
	 */ async getContact(options) {
    const { mid } = {
      ...options
    };
    return await this.client.request.request([
      [
        11,
        2,
        mid
      ]
    ], "getContact", this.protocolType, "Contact", this.requestPath);
  }
  /**
	 * @description Get users information from mids.
	 */ async getContacts(options) {
    const { mids } = {
      ...options
    };
    const response = (await this.client.request.request([
      [
        15,
        2,
        [
          11,
          mids
        ]
      ]
    ], "getContacts", this.protocolType, false, this.requestPath)).map((e)=>this.client.thrift.rename_thrift("Contact", e));
    return response;
  }
  async getContactsV2(options) {
    const { mids } = {
      ...options
    };
    return await this.client.request.request([
      [
        12,
        1,
        [
          [
            15,
            1,
            [
              11,
              mids
            ]
          ]
        ]
      ]
    ], "getContactsV2", this.protocolType, "GetContactsV2Response", this.requestPath);
  }
  async noop() {
    return await this.client.request.request([], "noop", this.protocolType, true, this.requestPath);
  }
}
//# sourceMappingURL=mod.js.map