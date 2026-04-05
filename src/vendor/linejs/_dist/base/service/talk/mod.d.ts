import { type BaseClient } from "../../core/mod.js";
import type { ProtocolKey } from "../../thrift/mod.js";
import type { BaseService } from "../types.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import { LINEStruct } from "../../thrift/mod.js";
import type { Buffer } from "node:buffer";
export declare class TalkService implements BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
  constructor(client: BaseClient);
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
	 */ sync(options?: {
    limit?: number;
    revision?: number | bigint;
    globalRev?: number | bigint;
    individualRev?: number | bigint;
    timeout?: number;
  }): Promise<LINETypes.sync_result["success"]>;
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
	 */ sendMessage(options: {
    to: string;
    text?: string;
    contentType?: LINETypes.ContentType;
    contentMetadata?: Record<string, string>;
    relatedMessageId?: string;
    location?: LINETypes.Location;
    chunks?: string[] | Buffer[];
    e2ee?: boolean;
  }): Promise<LINETypes.Message>;
  getProfile(...param: Parameters<typeof LINEStruct.getProfile_args>): Promise<LINETypes.getProfile_result["success"]>;
  getSettings(...param: Parameters<typeof LINEStruct.getSettings_args>): Promise<LINETypes.getSettings_result["success"]>;
  sendChatChecked(...param: Parameters<typeof LINEStruct.sendChatChecked_args>): Promise<void>;
  unsendMessage(...param: Parameters<typeof LINEStruct.unsendMessage_args>): Promise<void>;
  deleteOtherFromChat(...param: Parameters<typeof LINEStruct.deleteOtherFromChat_args>): Promise<LINETypes.deleteOtherFromChat_result["success"]>;
  inviteIntoChat(options: {
    chatMid: string;
    targetUserMids: string[];
  }): Promise<LINETypes.inviteIntoChat_result["success"]>;
  cancelChatInvitation(...param: Parameters<typeof LINEStruct.cancelChatInvitation_args>): Promise<LINETypes.cancelChatInvitation_result["success"]>;
  deleteSelfFromChat(...param: Parameters<typeof LINEStruct.deleteSelfFromChat_args>): Promise<LINETypes.deleteSelfFromChat_result["success"]>;
  acceptChatInvitation(...param: Parameters<typeof LINEStruct.acceptChatInvitation_args>): Promise<LINETypes.acceptChatInvitation_result["success"]>;
  reissueChatTicket(...param: Parameters<typeof LINEStruct.reissueChatTicket_args>): Promise<LINETypes.reissueChatTicket_result["success"]>;
  findChatByTicket(...param: Parameters<typeof LINEStruct.findChatByTicket_args>): Promise<LINETypes.findChatByTicket_result["success"]>;
  acceptChatInvitationByTicket(...param: Parameters<typeof LINEStruct.acceptChatInvitationByTicket_args>): Promise<LINETypes.acceptChatInvitationByTicket_result["success"]>;
  updateChat(...param: Parameters<typeof LINEStruct.updateChat_args>): Promise<LINETypes.updateChat_result["success"]>;
  getAllContactIds(...param: Parameters<typeof LINEStruct.getAllContactIds_args>): Promise<LINETypes.getAllContactIds_result["success"]>;
  getBlockedContactIds(...param: Parameters<typeof LINEStruct.getBlockedContactIds_args>): Promise<LINETypes.getBlockedContactIds_result["success"]>;
  getBlockedRecommendationIds(...param: Parameters<typeof LINEStruct.getBlockedRecommendationIds_args>): Promise<LINETypes.getBlockedRecommendationIds_result["success"]>;
  sendPostback(...param: Parameters<typeof LINEStruct.sendPostback_args>): Promise<void>;
  getMessageBoxes(...param: Parameters<typeof LINEStruct.getMessageBoxes_args>): Promise<LINETypes.getMessageBoxes_result["success"]>;
  getChatRoomAnnouncementsBulk(...param: Parameters<typeof LINEStruct.getChatRoomAnnouncementsBulk_args>): Promise<void>;
  getChatRoomAnnouncements(...param: Parameters<typeof LINEStruct.getChatRoomAnnouncements_args>): Promise<LINETypes.getChatRoomAnnouncements_result["success"]>;
  removeChatRoomAnnouncement(...param: Parameters<typeof LINEStruct.removeChatRoomAnnouncement_args>): Promise<void>;
  createChatRoomAnnouncement(...param: Parameters<typeof LINEStruct.createChatRoomAnnouncement_args>): Promise<LINETypes.createChatRoomAnnouncement_result["success"]>;
  leaveRoom(...param: Parameters<typeof LINEStruct.leaveRoom_args>): Promise<void>;
  getRoomsV2(...param: Parameters<typeof LINEStruct.getRoomsV2_args>): Promise<LINETypes.getRoomsV2_result["success"]>;
  createRoomV2(...param: Parameters<typeof LINEStruct.createRoomV2_args>): Promise<LINETypes.createRoomV2_result["success"]>;
  getCountries(...param: Parameters<typeof LINEStruct.getCountries_args>): Promise<LINETypes.getCountries_result["success"]>;
  acquireEncryptedAccessToken(...param: Parameters<typeof LINEStruct.acquireEncryptedAccessToken_args>): Promise<LINETypes.acquireEncryptedAccessToken_result["success"]>;
  blockContact(...param: Parameters<typeof LINEStruct.blockContact_args>): Promise<void>;
  unblockContact(...param: Parameters<typeof LINEStruct.unblockContact_args>): Promise<void>;
  getConfigurations(...param: Parameters<typeof LINEStruct.getConfigurations_args>): Promise<LINETypes.getConfigurations_result["success"]>;
  fetchOperations(...param: Parameters<typeof LINEStruct.fetchOperations_args>): Promise<LINETypes.fetchOperations_result["success"]>;
  getRepairElements(...param: Parameters<typeof LINEStruct.getRepairElements_args>): Promise<LINETypes.getRepairElements_result["success"]>;
  getSettingsAttributes2(...param: Parameters<typeof LINEStruct.getSettingsAttributes2_args>): Promise<LINETypes.getSettingsAttributes2_result["success"]>;
  updateSettingsAttributes2(...param: Parameters<typeof LINEStruct.updateSettingsAttributes2_args>): Promise<LINETypes.updateSettingsAttributes2_result["success"]>;
  rejectChatInvitation(...param: Parameters<typeof LINEStruct.rejectChatInvitation_args>): Promise<LINETypes.rejectChatInvitation_result["success"]>;
  getE2EEPublicKey(...param: Parameters<typeof LINEStruct.getE2EEPublicKey_args>): Promise<LINETypes.getE2EEPublicKey_result["success"]>;
  public getE2EEPublicKeys(): Promise<LINETypes.getE2EEPublicKeys_result["success"]>;
  registerE2EEPublicKey(...param: Parameters<typeof LINEStruct.registerE2EEPublicKey_args>): Promise<LINETypes.registerE2EEPublicKey_result["success"]>;
  registerE2EEGroupKey(...param: Parameters<typeof LINEStruct.registerE2EEGroupKey_args>): Promise<LINETypes.registerE2EEGroupKey_result["success"]>;
  getE2EEGroupSharedKey(...param: Parameters<typeof LINEStruct.getE2EEGroupSharedKey_args>): Promise<LINETypes.getE2EEGroupSharedKey_result["success"]>;
  getLastE2EEGroupSharedKey(...param: Parameters<typeof LINEStruct.getLastE2EEGroupSharedKey_args>): Promise<LINETypes.getLastE2EEGroupSharedKey_result["success"]>;
  getLastE2EEPublicKeys(...param: Parameters<typeof LINEStruct.getLastE2EEPublicKeys_args>): Promise<LINETypes.getLastE2EEPublicKeys_result["success"]>;
  negotiateE2EEPublicKey(...param: Parameters<typeof LINEStruct.negotiateE2EEPublicKey_args>): Promise<LINETypes.negotiateE2EEPublicKey_result["success"]>;
  react(options: {
    id: bigint | number;
    reaction: LINETypes.MessageReactionType;
  }): Promise<void>;
  createChat(...param: Parameters<typeof LINEStruct.createChat_args>): Promise<LINETypes.createChat_result["success"]>;
  setChatHiddenStatus(...param: Parameters<typeof LINEStruct.setChatHiddenStatus_args>): Promise<void>;
  getFollowers(...param: Parameters<typeof LINEStruct.getFollowers_args>): Promise<LINETypes.getFollowers_result["success"]>;
  getFollowings(...param: Parameters<typeof LINEStruct.getFollowings_args>): Promise<LINETypes.getFollowings_result["success"]>;
  removeFollower(...param: Parameters<typeof LINEStruct.removeFollower_args>): Promise<void>;
  follow(...param: Parameters<typeof LINEStruct.follow_args>): Promise<void>;
  unfollow(...param: Parameters<typeof LINEStruct.unfollow_args>): Promise<void>;
  bulkFollow(...param: Parameters<typeof LINEStruct.bulkFollow_args>): Promise<LINETypes.bulkFollow_result["success"]>;
  decryptFollowEMid(...param: Parameters<typeof LINEStruct.decryptFollowEMid_args>): Promise<LINETypes.decryptFollowEMid_result["success"]>;
  getMessageReadRange(...param: Parameters<typeof LINEStruct.getMessageReadRange_args>): Promise<LINETypes.getMessageReadRange_result["success"]>;
  getChatRoomBGMs(...param: Parameters<typeof LINEStruct.getChatRoomBGMs_args>): Promise<LINETypes.getChatRoomBGMs_result["success"]>;
  updateChatRoomBGM(...param: Parameters<typeof LINEStruct.updateChatRoomBGM_args>): Promise<LINETypes.updateChatRoomBGM_result["success"]>;
  blockRecommendation(...param: Parameters<typeof LINEStruct.blockRecommendation_args>): Promise<void>;
  unblockRecommendation(...param: Parameters<typeof LINEStruct.unblockRecommendation_args>): Promise<void>;
  getRecommendationIds(...param: Parameters<typeof LINEStruct.getRecommendationIds_args>): Promise<LINETypes.getRecommendationIds_result["success"]>;
  getExtendedProfile(...param: Parameters<typeof LINEStruct.getExtendedProfile_args>): Promise<LINETypes.getExtendedProfile_result["success"]>;
  updateExtendedProfileAttribute(...param: Parameters<typeof LINEStruct.updateExtendedProfileAttribute_args>): Promise<void>;
  setNotificationsEnabled(...param: Parameters<typeof LINEStruct.setNotificationsEnabled_args>): Promise<void>;
  syncContacts(...param: Parameters<typeof LINEStruct.syncContacts_args>): Promise<LINETypes.syncContacts_result["success"]>;
  findContactsByPhone(...param: Parameters<typeof LINEStruct.findContactsByPhone_args>): Promise<LINETypes.findContactsByPhone_result["success"]>;
  findContactByUserid(...param: Parameters<typeof LINEStruct.findContactByUserid_args>): Promise<LINETypes.findContactByUserid_result["success"]>;
  updateContactSetting(...param: Parameters<typeof LINEStruct.updateContactSetting_args>): Promise<void>;
  findContactByUserTicket(...param: Parameters<typeof LINEStruct.findContactByUserTicket_args>): Promise<LINETypes.findContactByUserTicket_result["success"]>;
  verifyQrcode(...param: Parameters<typeof LINEStruct.verifyQrcode_args>): Promise<LINETypes.verifyQrcode_result["success"]>;
  reportAbuseEx(...param: Parameters<typeof LINEStruct.reportAbuseEx_args>): Promise<LINETypes.reportAbuseEx_result["success"]>;
  updateProfileAttributes(...param: Parameters<typeof LINEStruct.updateProfileAttributes_args>): Promise<void>;
  updateNotificationToken(...param: Parameters<typeof LINEStruct.updateNotificationToken_args>): Promise<void>;
  tryFriendRequest(...param: Parameters<typeof LINEStruct.tryFriendRequest_args>): Promise<void>;
  generateUserTicket(...param: Parameters<typeof LINEStruct.generateUserTicket_args>): Promise<LINETypes.generateUserTicket_result["success"]>;
  getRecentFriendRequests(...param: Parameters<typeof LINEStruct.getRecentFriendRequests_args>): Promise<LINETypes.getRecentFriendRequests_result["success"]>;
  resendPinCode(...param: Parameters<typeof LINEStruct.resendPinCode_args>): Promise<void>;
  notifyRegistrationComplete(...param: Parameters<typeof LINEStruct.notifyRegistrationComplete_args>): Promise<void>;
  getInstantNews(...param: Parameters<typeof LINEStruct.getInstantNews_args>): Promise<LINETypes.getInstantNews_result["success"]>;
  changeVerificationMethod(...param: Parameters<typeof LINEStruct.changeVerificationMethod_args>): Promise<LINETypes.changeVerificationMethod_result["success"]>;
  getChatEffectMetaList(...param: Parameters<typeof LINEStruct.getChatEffectMetaList_args>): Promise<LINETypes.getChatEffectMetaList_result["success"]>;
  notifyInstalled(...param: Parameters<typeof LINEStruct.notifyInstalled_args>): Promise<void>;
  reportDeviceState(...param: Parameters<typeof LINEStruct.reportDeviceState_args>): Promise<void>;
  sendChatRemoved(...param: Parameters<typeof LINEStruct.sendChatRemoved_args>): Promise<void>;
  startUpdateVerification(...param: Parameters<typeof LINEStruct.startUpdateVerification_args>): Promise<LINETypes.startUpdateVerification_result["success"]>;
  inviteIntoRoom(...param: Parameters<typeof LINEStruct.inviteIntoRoom_args>): Promise<void>;
  removeFriendRequest(...param: Parameters<typeof LINEStruct.removeFriendRequest_args>): Promise<void>;
  reportProfile(...param: Parameters<typeof LINEStruct.reportProfile_args>): Promise<void>;
  wakeUpLongPolling(...param: Parameters<typeof LINEStruct.wakeUpLongPolling_args>): Promise<LINETypes.wakeUpLongPolling_result["success"]>;
  updateAndGetNearby(...param: Parameters<typeof LINEStruct.updateAndGetNearby_args>): Promise<LINETypes.updateAndGetNearby_result["success"]>;
  reportSettings(...param: Parameters<typeof LINEStruct.reportSettings_args>): Promise<void>;
  verifyPhoneNumber(...param: Parameters<typeof LINEStruct.verifyPhoneNumber_args>): Promise<LINETypes.verifyPhoneNumber_result["success"]>;
  isUseridAvailable(...param: Parameters<typeof LINEStruct.isUseridAvailable_args>): Promise<LINETypes.isUseridAvailable_result["success"]>;
  registerUserid(...param: Parameters<typeof LINEStruct.registerUserid_args>): Promise<LINETypes.registerUserid_result["success"]>;
  finishUpdateVerification(...param: Parameters<typeof LINEStruct.finishUpdateVerification_args>): Promise<void>;
  clearRingtone(...param: Parameters<typeof LINEStruct.clearRingtone_args>): Promise<void>;
  notifyUpdated(...param: Parameters<typeof LINEStruct.notifyUpdated_args>): Promise<void>;
  reportPushRecvReports(...param: Parameters<typeof LINEStruct.reportPushRecvReports_args>): Promise<void>;
  getFriendRequests(...param: Parameters<typeof LINEStruct.getFriendRequests_args>): Promise<LINETypes.getFriendRequests_result["success"]>;
  addToFollowBlacklist(...param: Parameters<typeof LINEStruct.addToFollowBlacklist_args>): Promise<void>;
  removeFromFollowBlacklist(...param: Parameters<typeof LINEStruct.removeFromFollowBlacklist_args>): Promise<void>;
  getFollowBlacklist(...param: Parameters<typeof LINEStruct.getFollowBlacklist_args>): Promise<LINETypes.getFollowBlacklist_result["success"]>;
  determineMediaMessageFlow(...param: Parameters<typeof LINEStruct.determineMediaMessageFlow_args>): Promise<LINETypes.determineMediaMessageFlow_result["success"]>;
  createSession(...param: Parameters<typeof LINEStruct.createSession_args>): Promise<LINETypes.createSession_result["success"]>;
  cancelReaction(...param: Parameters<typeof LINEStruct.cancelReaction_args>): Promise<void>;
  getNotificationSettings(...param: Parameters<typeof LINEStruct.getNotificationSettings_args>): Promise<LINETypes.getNotificationSettings_result["success"]>;
  getChats(options: {
    chatMids: string[];
    withInvitees?: boolean;
    withMembers?: boolean;
  }): Promise<LINETypes.getChats_result["success"]>;
  getChat(options: {
    chatMid: string;
    withInvitees?: boolean;
    withMembers?: boolean;
  }): Promise<LINETypes.Chat>;
  getAllChatMids(...param: Parameters<typeof LINEStruct.getAllChatMids_args>): Promise<LINETypes.getAllChatMids_result["success"]>;
  getPreviousMessagesV2WithRequest(...param: Parameters<typeof LINEStruct.getPreviousMessagesV2WithRequest_args>): Promise<LINETypes.getPreviousMessagesV2WithRequest_result["success"]>;
  /**
	 * @description Gets the server time
	 */ public getServerTime(): Promise<number>;
  /**
	 * @description Get user information from mid.
	 */ getContact(options: {
    mid: string;
  }): Promise<LINETypes.Contact>;
  /**
	 * @description Get users information from mids.
	 */ public getContacts(options: {
    mids: string[];
  }): Promise<LINETypes.Contact[]>;
  public getContactsV2(options: {
    mids: string[];
  }): Promise<LINETypes.GetContactsV2Response>;
  noop(): Promise<void>;
}
//# sourceMappingURL=mod.d.ts.map