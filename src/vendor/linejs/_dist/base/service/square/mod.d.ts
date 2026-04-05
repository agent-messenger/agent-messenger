import { LINEStruct, type ProtocolKey } from "../../thrift/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { BaseClient } from "../../core/mod.js";
import type { BaseService } from "../types.js";
export declare class SquareService implements BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
  constructor(client: BaseClient);
  inviteIntoSquareChat(...param: Parameters<typeof LINEStruct.SquareService_inviteIntoSquareChat_args>): Promise<LINETypes.SquareService_inviteIntoSquareChat_result["success"]>;
  inviteToSquare(...param: Parameters<typeof LINEStruct.SquareService_inviteToSquare_args>): Promise<LINETypes.SquareService_inviteToSquare_result["success"]>;
  getJoinedSquares(options?: {
    limit?: number;
    continuationToken?: string;
  }): Promise<LINETypes.SquareService_getJoinedSquares_result["success"]>;
  markAsRead(...param: Parameters<typeof LINEStruct.SquareService_markAsRead_args>): Promise<LINETypes.SquareService_markAsRead_result["success"]>;
  reactToMessage(...param: Parameters<typeof LINEStruct.SquareService_reactToMessage_args>): Promise<LINETypes.SquareService_reactToMessage_result["success"]>;
  findSquareByInvitationTicket(...param: Parameters<typeof LINEStruct.SquareService_findSquareByInvitationTicket_args>): Promise<LINETypes.SquareService_findSquareByInvitationTicket_result["success"]>;
  fetchMyEvents(options: {
    syncToken?: string;
    continuationToken?: string;
    limit?: number;
    subscriptionId?: number;
  }): Promise<LINETypes.SquareService_fetchMyEvents_result["success"]>;
  fetchSquareChatEvents(options: {
    squareChatMid: string;
    threadMid?: string;
    syncToken?: string;
    limit?: number;
    direction?: LINETypes.FetchDirection;
  }): Promise<LINETypes.SquareService_fetchSquareChatEvents_result["success"]>;
  sendMessage(options: {
    squareChatMid: string;
    text?: string;
    contentType?: LINETypes.ContentType;
    contentMetadata?: Record<string, string>;
    relatedMessageId?: string;
    location?: LINETypes.Location;
  }): Promise<LINETypes.SquareService_sendMessage_result["success"]>;
  getSquare(options: {
    squareMid: string;
  }): Promise<LINETypes.SquareService_getSquare_result["success"]>;
  getJoinableSquareChats(...param: Parameters<typeof LINEStruct.SquareService_getJoinableSquareChats_args>): Promise<LINETypes.SquareService_getJoinableSquareChats_result["success"]>;
  defaultSquareCoverImageObsHash: string;
  /**
	 *  @description Create square.
	 */ createSquare(options: {
    squareName: string;
    displayName: string;
    profileImageObsHash?: string;
    description?: string;
    searchable?: boolean;
    squareJoinMethodType?: LINETypes.SquareJoinMethodType;
  }): Promise<LINETypes.SquareService_createSquare_result["success"]>;
  getSquareChatAnnouncements(...param: Parameters<typeof LINEStruct.SquareService_getSquareChatAnnouncements_args>): Promise<LINETypes.SquareService_getSquareChatAnnouncements_result["success"]>;
  leaveSquareChat(...param: Parameters<typeof LINEStruct.SquareService_leaveSquareChat_args>): Promise<LINETypes.SquareService_leaveSquareChat_result["success"]>;
  getSquareChatMember(...param: Parameters<typeof LINEStruct.SquareService_getSquareChatMember_args>): Promise<LINETypes.SquareService_getSquareChatMember_result["success"]>;
  searchSquares(...param: Parameters<typeof LINEStruct.SquareService_searchSquares_args>): Promise<LINETypes.SquareService_searchSquares_result["success"]>;
  updateSquareFeatureSet(...param: Parameters<typeof LINEStruct.SquareService_updateSquareFeatureSet_args>): Promise<LINETypes.SquareService_updateSquareFeatureSet_result["success"]>;
  joinSquare(options: {
    squareMid: string;
    displayName: string;
    ableToReceiveMessage?: boolean;
    passCode?: string | undefined;
    joinMessage?: string;
  }): Promise<LINETypes.SquareService_joinSquare_result["success"]>;
  getPopularKeywords(...param: Parameters<typeof LINEStruct.SquareService_getPopularKeywords_args>): Promise<LINETypes.SquareService_getPopularKeywords_result["success"]>;
  reportSquareMessage(...param: Parameters<typeof LINEStruct.SquareService_reportSquareMessage_args>): Promise<LINETypes.SquareService_reportSquareMessage_result["success"]>;
  updateSquareMemberRelation(...param: Parameters<typeof LINEStruct.SquareService_updateSquareMemberRelation_args>): Promise<LINETypes.SquareService_updateSquareMemberRelation_result["success"]>;
  leaveSquare(...param: Parameters<typeof LINEStruct.SquareService_leaveSquare_args>): Promise<LINETypes.SquareService_leaveSquare_result["success"]>;
  getSquareMemberRelations(...param: Parameters<typeof LINEStruct.SquareService_getSquareMemberRelations_args>): Promise<LINETypes.SquareService_getSquareMemberRelations_result["success"]>;
  removeSubscriptions(...param: Parameters<typeof LINEStruct.SquareService_removeSubscriptions_args>): Promise<LINETypes.SquareService_removeSubscriptions_result["success"]>;
  getSquareMembers(...param: Parameters<typeof LINEStruct.SquareService_getSquareMembers_args>): Promise<LINETypes.SquareService_getSquareMembers_result["success"]>;
  updateSquareChat(...param: Parameters<typeof LINEStruct.SquareService_updateSquareChat_args>): Promise<LINETypes.SquareService_updateSquareChat_result["success"]>;
  destroyMessage(options: {
    messageId: string;
    squareChatMid: string;
    threadMid?: string;
  }): Promise<LINETypes.SquareService_destroyMessage_result["success"]>;
  reportSquareChat(...param: Parameters<typeof LINEStruct.SquareService_reportSquareChat_args>): Promise<LINETypes.SquareService_reportSquareChat_result["success"]>;
  unsendMessage(options: {
    messageId: string;
    squareChatMid: string;
    threadMid?: string;
  }): Promise<LINETypes.SquareService_unsendMessage_result["success"]>;
  deleteSquareChatAnnouncement(...param: Parameters<typeof LINEStruct.SquareService_deleteSquareChatAnnouncement_args>): Promise<LINETypes.SquareService_deleteSquareChatAnnouncement_result["success"]>;
  createSquareChat(...param: Parameters<typeof LINEStruct.SquareService_createSquareChat_args>): Promise<LINETypes.SquareService_createSquareChat_result["success"]>;
  deleteSquareChat(...param: Parameters<typeof LINEStruct.SquareService_deleteSquareChat_args>): Promise<LINETypes.SquareService_deleteSquareChat_result["success"]>;
  getSquareChatMembers(options: {
    continuationToken?: string;
    squareChatMid: string;
    limit?: number;
  }): Promise<LINETypes.SquareService_getSquareChatMembers_result["success"]>;
  getSquareFeatureSet(...param: Parameters<typeof LINEStruct.SquareService_getSquareFeatureSet_args>): Promise<LINETypes.SquareService_getSquareFeatureSet_result["success"]>;
  updateSquareAuthority(...param: Parameters<typeof LINEStruct.SquareService_updateSquareAuthority_args>): Promise<LINETypes.SquareService_updateSquareAuthority_result["success"]>;
  rejectSquareMembers(...param: Parameters<typeof LINEStruct.SquareService_rejectSquareMembers_args>): Promise<LINETypes.SquareService_rejectSquareMembers_result["success"]>;
  deleteSquare(...param: Parameters<typeof LINEStruct.SquareService_deleteSquare_args>): Promise<LINETypes.SquareService_deleteSquare_result["success"]>;
  reportSquare(...param: Parameters<typeof LINEStruct.SquareService_reportSquare_args>): Promise<LINETypes.SquareService_reportSquare_result["success"]>;
  getInvitationTicketUrl(...param: Parameters<typeof LINEStruct.SquareService_getInvitationTicketUrl_args>): Promise<LINETypes.SquareService_getInvitationTicketUrl_result["success"]>;
  updateSquareChatMember(...param: Parameters<typeof LINEStruct.SquareService_updateSquareChatMember_args>): Promise<LINETypes.SquareService_updateSquareChatMember_result["success"]>;
  updateSquareMember(...param: Parameters<typeof LINEStruct.SquareService_updateSquareMember_args>): Promise<LINETypes.SquareService_updateSquareMember_result["success"]>;
  updateSquare(...param: Parameters<typeof LINEStruct.SquareService_updateSquare_args>): Promise<LINETypes.SquareService_updateSquare_result["success"]>;
  getSquareAuthorities(...param: Parameters<typeof LINEStruct.SquareService_getSquareAuthorities_args>): Promise<LINETypes.SquareService_getSquareAuthorities_result["success"]>;
  updateSquareMembers(...param: Parameters<typeof LINEStruct.SquareService_updateSquareMembers_args>): Promise<LINETypes.SquareService_updateSquareMembers_result["success"]>;
  getSquareChatStatus(...param: Parameters<typeof LINEStruct.SquareService_getSquareChatStatus_args>): Promise<LINETypes.SquareService_getSquareChatStatus_result["success"]>;
  approveSquareMembers(...param: Parameters<typeof LINEStruct.SquareService_approveSquareMembers_args>): Promise<LINETypes.SquareService_approveSquareMembers_result["success"]>;
  getSquareStatus(...param: Parameters<typeof LINEStruct.SquareService_getSquareStatus_args>): Promise<LINETypes.SquareService_getSquareStatus_result["success"]>;
  searchSquareMembers(...param: Parameters<typeof LINEStruct.SquareService_searchSquareMembers_args>): Promise<LINETypes.SquareService_searchSquareMembers_result["success"]>;
  checkJoinCode(...param: Parameters<typeof LINEStruct.SquareService_checkJoinCode_args>): Promise<LINETypes.SquareService_checkJoinCode_result["success"]>;
  createSquareChatAnnouncement(options: {
    squareChatMid: string;
    senderMid: string;
    messageId: string;
    text: string;
    createdAt: bigint | number;
  }): Promise<LINETypes.SquareService_createSquareChatAnnouncement_result["success"]>;
  getSquareAuthority(...param: Parameters<typeof LINEStruct.SquareService_getSquareAuthority_args>): Promise<LINETypes.SquareService_getSquareAuthority_result["success"]>;
  getSquareChat(options: {
    squareChatMid: string;
  }): Promise<LINETypes.SquareService_getSquareChat_result["success"]>;
  refreshSubscriptions(...param: Parameters<typeof LINEStruct.SquareService_refreshSubscriptions_args>): Promise<LINETypes.SquareService_refreshSubscriptions_result["success"]>;
  getJoinedSquareChats(...param: Parameters<typeof LINEStruct.SquareService_getJoinedSquareChats_args>): Promise<LINETypes.SquareService_getJoinedSquareChats_result["success"]>;
  joinSquareChat(...param: Parameters<typeof LINEStruct.SquareService_joinSquareChat_args>): Promise<LINETypes.SquareService_joinSquareChat_result["success"]>;
  findSquareByEmid(...param: Parameters<typeof LINEStruct.SquareService_findSquareByEmid_args>): Promise<LINETypes.SquareService_findSquareByEmid_result["success"]>;
  getSquareMemberRelation(...param: Parameters<typeof LINEStruct.SquareService_getSquareMemberRelation_args>): Promise<LINETypes.SquareService_getSquareMemberRelation_result["success"]>;
  getSquareMember(options: {
    squareMemberMid: string;
  }): Promise<LINETypes.SquareService_getSquareMember_result["success"]>;
  deleteOtherFromSquare(squareMemberMid: string): Promise<LINETypes.SquareService_updateSquareMember_result["success"]>;
  destroyMessages(...param: Parameters<typeof LINEStruct.SquareService_destroyMessages_args>): Promise<LINETypes.SquareService_destroyMessages_result["success"]>;
  getCategories(...param: Parameters<typeof LINEStruct.SquareService_getCategories_args>): Promise<LINETypes.SquareService_getCategories_result["success"]>;
  reportSquareMember(...param: Parameters<typeof LINEStruct.SquareService_reportSquareMember_args>): Promise<LINETypes.SquareService_reportSquareMember_result["success"]>;
  getNoteStatus(...param: Parameters<typeof LINEStruct.SquareService_getNoteStatus_args>): Promise<LINETypes.SquareService_getNoteStatus_result["success"]>;
  searchSquareChatMembers(options: {
    searchOption?: LINETypes.SquareChatMemberSearchOption;
    continuationToken?: string;
    squareChatMid: string;
    limit?: number;
  }): Promise<LINETypes.SquareService_searchSquareChatMembers_result["success"]>;
  getSquareChatFeatureSet(...param: Parameters<typeof LINEStruct.SquareService_getSquareChatFeatureSet_args>): Promise<LINETypes.SquareService_getSquareChatFeatureSet_result["success"]>;
  getSquareEmid(...param: Parameters<typeof LINEStruct.SquareService_getSquareEmid_args>): Promise<LINETypes.SquareService_getSquareEmid_result["success"]>;
  getSquareMembersBySquare(...param: Parameters<typeof LINEStruct.SquareService_getSquareMembersBySquare_args>): Promise<LINETypes.SquareService_getSquareMembersBySquare_result["success"]>;
  manualRepair(...param: Parameters<typeof LINEStruct.SquareService_manualRepair_args>): Promise<LINETypes.SquareService_manualRepair_result["success"]>;
  syncSquareMembers(...param: Parameters<typeof LINEStruct.SquareService_syncSquareMembers_args>): Promise<LINETypes.SquareService_syncSquareMembers_result["success"]>;
  hideSquareMemberContents(...param: Parameters<typeof LINEStruct.SquareService_hideSquareMemberContents_args>): Promise<LINETypes.SquareService_hideSquareMemberContents_result["success"]>;
  markChatsAsRead(...param: Parameters<typeof LINEStruct.SquareService_markChatsAsRead_args>): Promise<LINETypes.SquareService_markChatsAsRead_result["success"]>;
  reportMessageSummary(...param: Parameters<typeof LINEStruct.SquareService_reportMessageSummary_args>): Promise<LINETypes.SquareService_reportMessageSummary_result["success"]>;
  getGoogleAdOptions(...param: Parameters<typeof LINEStruct.SquareService_getGoogleAdOptions_args>): Promise<LINETypes.SquareService_getGoogleAdOptions_result["success"]>;
  unhideSquareMemberContents(...param: Parameters<typeof LINEStruct.SquareService_unhideSquareMemberContents_args>): Promise<LINETypes.SquareService_unhideSquareMemberContents_result["success"]>;
  getSquareChatEmid(...param: Parameters<typeof LINEStruct.SquareService_getSquareChatEmid_args>): Promise<LINETypes.SquareService_getSquareChatEmid_result["success"]>;
  getSquareThread(...param: Parameters<typeof LINEStruct.SquareService_getSquareThread_args>): Promise<LINETypes.SquareService_getSquareThread_result["success"]>;
  getSquareThreadMid(...param: Parameters<typeof LINEStruct.SquareService_getSquareThreadMid_args>): Promise<LINETypes.SquareService_getSquareThreadMid_result["success"]>;
  getUserSettings(...param: Parameters<typeof LINEStruct.SquareService_getUserSettings_args>): Promise<LINETypes.SquareService_getUserSettings_result["success"]>;
  markThreadsAsRead(...param: Parameters<typeof LINEStruct.SquareService_markThreadsAsRead_args>): Promise<LINETypes.SquareService_markThreadsAsRead_result["success"]>;
  sendSquareThreadMessage(...param: Parameters<typeof LINEStruct.SquareService_sendSquareThreadMessage_args>): Promise<LINETypes.SquareService_sendSquareThreadMessage_result["success"]>;
  findSquareByInvitationTicketV2(...param: Parameters<typeof LINEStruct.SquareService_findSquareByInvitationTicketV2_args>): Promise<LINETypes.SquareService_findSquareByInvitationTicketV2_result["success"]>;
  leaveSquareThread(...param: Parameters<typeof LINEStruct.SquareService_leaveSquareThread_args>): Promise<LINETypes.SquareService_leaveSquareThread_result["success"]>;
  joinSquareThread(...param: Parameters<typeof LINEStruct.SquareService_joinSquareThread_args>): Promise<LINETypes.SquareService_joinSquareThread_result["success"]>;
  updateUserSettings(...param: Parameters<typeof LINEStruct.SquareService_updateUserSettings_args>): Promise<LINETypes.SquareService_updateUserSettings_result["success"]>;
}
//# sourceMappingURL=mod.d.ts.map