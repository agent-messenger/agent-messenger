// For Square (chat, etc)
import { LINEStruct } from "../../thrift/mod.js";
export class SquareService {
  client;
  protocolType = 4;
  requestPath = "/SQ1";
  errorName = "SquareServiceError";
  constructor(client){
    this.client = client;
  }
  async inviteIntoSquareChat(...param) {
    return await this.client.request.request(LINEStruct.SquareService_inviteIntoSquareChat_args(...param), "inviteIntoSquareChat", this.protocolType, true, this.requestPath);
  }
  async inviteToSquare(...param) {
    return await this.client.request.request(LINEStruct.SquareService_inviteToSquare_args(...param), "inviteToSquare", this.protocolType, true, this.requestPath);
  }
  async getJoinedSquares(options = {}) {
    return await this.client.request.request(LINEStruct.SquareService_getJoinedSquares_args({
      request: {
        limit: 100,
        ...options
      }
    }), "getJoinedSquares", this.protocolType, true, this.requestPath);
  }
  async markAsRead(...param) {
    return await this.client.request.request(LINEStruct.SquareService_markAsRead_args(...param), "markAsRead", this.protocolType, true, this.requestPath);
  }
  async reactToMessage(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reactToMessage_args(...param), "reactToMessage", this.protocolType, true, this.requestPath);
  }
  async findSquareByInvitationTicket(...param) {
    return await this.client.request.request(LINEStruct.SquareService_findSquareByInvitationTicket_args(...param), "findSquareByInvitationTicket", this.protocolType, true, this.requestPath);
  }
  async fetchMyEvents(options) {
    return await this.client.request.request(LINEStruct.SquareService_fetchMyEvents_args({
      request: {
        limit: 100,
        ...options
      }
    }), "fetchMyEvents", this.protocolType, true, this.requestPath);
  }
  async fetchSquareChatEvents(options) {
    return await this.client.request.request(LINEStruct.SquareService_fetchSquareChatEvents_args({
      request: {
        limit: 100,
        ...options
      }
    }), "fetchSquareChatEvents", this.protocolType, true, this.requestPath);
  }
  async sendMessage(options) {
    return await this.client.request.request(LINEStruct.SquareService_sendMessage_args({
      request: {
        reqSeq: await this.client.getReqseq("sq"),
        squareChatMid: options.squareChatMid,
        squareMessage: {
          squareMessageRevision: 4,
          message: {
            to: options.squareChatMid,
            text: options.text,
            contentType: options.contentType ?? 0,
            contentMetadata: options.contentMetadata ?? {},
            location: options.location,
            ...options.relatedMessageId ? {
              relatedMessageId: options.relatedMessageId,
              relatedMessageServiceCode: "SQUARE",
              messageRelationType: "REPLY"
            } : {}
          }
        }
      }
    }), "sendMessage", this.protocolType, true, this.requestPath);
  }
  async getSquare(options) {
    return await this.client.request.request(LINEStruct.SquareService_getSquare_args({
      request: {
        mid: options.squareMid
      }
    }), "getSquare", this.protocolType, true, this.requestPath);
  }
  async getJoinableSquareChats(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getJoinableSquareChats_args(...param), "getJoinableSquareChats", this.protocolType, true, this.requestPath);
  }
  defaultSquareCoverImageObsHash = "0h6tJfahRYaVt3H0eLAsAWDFheczgHd3wTCTx2eApNKSoefHNVGRdwfgxbdgUMLi8MSngnPFMeNmpbLi8MSngnPFMeNmpbLi8MSngnPQ";
  /**
	 *  @description Create square.
	 */ async createSquare(options) {
    return await this.client.request.request(LINEStruct.SquareService_createSquare_args({
      request: {
        reqSeq: await this.client.getReqseq("sq"),
        square: {
          name: options.squareName,
          profileImageObsHash: options.profileImageObsHash || this.defaultSquareCoverImageObsHash,
          desc: options.description,
          searchable: options.searchable,
          type: "OPEN",
          categoryId: 1,
          revision: 0,
          ableToUseInvitationTicket: true,
          joinMethod: {
            type: options.squareJoinMethodType
          },
          adultOnly: "NONE",
          svcTags: []
        },
        creator: {
          displayName: options.displayName,
          ableToReceiveMessage: true,
          revision: 0
        }
      }
    }), "createSquare", this.protocolType, true, this.requestPath);
  }
  async getSquareChatAnnouncements(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareChatAnnouncements_args(...param), "getSquareChatAnnouncements", this.protocolType, true, this.requestPath);
  }
  async leaveSquareChat(...param) {
    return await this.client.request.request(LINEStruct.SquareService_leaveSquareChat_args(...param), "leaveSquareChat", this.protocolType, true, this.requestPath);
  }
  async getSquareChatMember(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareChatMember_args(...param), "getSquareChatMember", this.protocolType, true, this.requestPath);
  }
  async searchSquares(...param) {
    return await this.client.request.request(LINEStruct.SquareService_searchSquares_args(...param), "searchSquares", this.protocolType, true, this.requestPath);
  }
  async updateSquareFeatureSet(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquareFeatureSet_args(...param), "updateSquareFeatureSet", this.protocolType, true, this.requestPath);
  }
  async joinSquare(options) {
    return await this.client.request.request(LINEStruct.SquareService_joinSquare_args({
      request: {
        squareMid: options.squareMid,
        joinValue: {
          approvalValue: {
            message: options.joinMessage
          },
          codeValue: {
            code: options.passCode
          }
        },
        member: {
          squareMid: options.squareMid,
          displayName: options.displayName,
          ableToReceiveMessage: options.ableToReceiveMessage,
          revision: 0
        }
      }
    }), "joinSquare", this.protocolType, true, this.requestPath);
  }
  async getPopularKeywords(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getPopularKeywords_args(...param), "getPopularKeywords", this.protocolType, true, this.requestPath);
  }
  async reportSquareMessage(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reportSquareMessage_args(...param), "reportSquareMessage", this.protocolType, true, this.requestPath);
  }
  async updateSquareMemberRelation(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquareMemberRelation_args(...param), "updateSquareMemberRelation", this.protocolType, true, this.requestPath);
  }
  async leaveSquare(...param) {
    return await this.client.request.request(LINEStruct.SquareService_leaveSquare_args(...param), "leaveSquare", this.protocolType, true, this.requestPath);
  }
  async getSquareMemberRelations(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareMemberRelations_args(...param), "getSquareMemberRelations", this.protocolType, true, this.requestPath);
  }
  async removeSubscriptions(...param) {
    return await this.client.request.request(LINEStruct.SquareService_removeSubscriptions_args(...param), "removeSubscriptions", this.protocolType, true, this.requestPath);
  }
  async getSquareMembers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareMembers_args(...param), "getSquareMembers", this.protocolType, true, this.requestPath);
  }
  async updateSquareChat(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquareChat_args(...param), "updateSquareChat", this.protocolType, true, this.requestPath);
  }
  async destroyMessage(options) {
    return await this.client.request.request(LINEStruct.SquareService_destroyMessage_args({
      request: {
        messageId: options.messageId,
        squareChatMid: options.squareChatMid,
        threadMid: options.threadMid
      }
    }), "destroyMessage", this.protocolType, true, this.requestPath);
  }
  async reportSquareChat(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reportSquareChat_args(...param), "reportSquareChat", this.protocolType, true, this.requestPath);
  }
  async unsendMessage(options) {
    return await this.client.request.request(LINEStruct.SquareService_unsendMessage_args({
      request: {
        messageId: options.messageId,
        squareChatMid: options.squareChatMid,
        threadMid: options.threadMid
      }
    }), "unsendMessage", this.protocolType, true, this.requestPath);
  }
  async deleteSquareChatAnnouncement(...param) {
    return await this.client.request.request(LINEStruct.SquareService_deleteSquareChatAnnouncement_args(...param), "deleteSquareChatAnnouncement", this.protocolType, true, this.requestPath);
  }
  async createSquareChat(...param) {
    return await this.client.request.request(LINEStruct.SquareService_createSquareChat_args(...param), "createSquareChat", this.protocolType, true, this.requestPath);
  }
  async deleteSquareChat(...param) {
    return await this.client.request.request(LINEStruct.SquareService_deleteSquareChat_args(...param), "deleteSquareChat", this.protocolType, true, this.requestPath);
  }
  async getSquareChatMembers(options) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareChatMembers_args({
      request: {
        continuationToken: options.continuationToken,
        squareChatMid: options.squareChatMid,
        limit: options.limit ?? 100
      }
    }), "getSquareChatMembers", this.protocolType, true, this.requestPath);
  }
  async getSquareFeatureSet(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareFeatureSet_args(...param), "getSquareFeatureSet", this.protocolType, true, this.requestPath);
  }
  async updateSquareAuthority(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquareAuthority_args(...param), "updateSquareAuthority", this.protocolType, true, this.requestPath);
  }
  async rejectSquareMembers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_rejectSquareMembers_args(...param), "rejectSquareMembers", this.protocolType, true, this.requestPath);
  }
  async deleteSquare(...param) {
    return await this.client.request.request(LINEStruct.SquareService_deleteSquare_args(...param), "deleteSquare", this.protocolType, true, this.requestPath);
  }
  async reportSquare(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reportSquare_args(...param), "reportSquare", this.protocolType, true, this.requestPath);
  }
  async getInvitationTicketUrl(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getInvitationTicketUrl_args(...param), "getInvitationTicketUrl", this.protocolType, true, this.requestPath);
  }
  async updateSquareChatMember(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquareChatMember_args(...param), "updateSquareChatMember", this.protocolType, true, this.requestPath);
  }
  async updateSquareMember(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquareMember_args(...param), "updateSquareMember", this.protocolType, true, this.requestPath);
  }
  async updateSquare(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquare_args(...param), "updateSquare", this.protocolType, true, this.requestPath);
  }
  async getSquareAuthorities(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareAuthorities_args(...param), "getSquareAuthorities", this.protocolType, true, this.requestPath);
  }
  async updateSquareMembers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateSquareMembers_args(...param), "updateSquareMembers", this.protocolType, true, this.requestPath);
  }
  async getSquareChatStatus(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareChatStatus_args(...param), "getSquareChatStatus", this.protocolType, true, this.requestPath);
  }
  async approveSquareMembers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_approveSquareMembers_args(...param), "approveSquareMembers", this.protocolType, true, this.requestPath);
  }
  async getSquareStatus(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareStatus_args(...param), "getSquareStatus", this.protocolType, true, this.requestPath);
  }
  async searchSquareMembers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_searchSquareMembers_args(...param), "searchSquareMembers", this.protocolType, true, this.requestPath);
  }
  async checkJoinCode(...param) {
    return await this.client.request.request(LINEStruct.SquareService_checkJoinCode_args(...param), "checkJoinCode", this.protocolType, true, this.requestPath);
  }
  async createSquareChatAnnouncement(options) {
    return await this.client.request.request(LINEStruct.SquareService_createSquareChatAnnouncement_args({
      createSquareChatAnnouncementRequest: {
        reqSeq: 0,
        squareChatMid: options.squareChatMid,
        squareChatAnnouncement: {
          announcementSeq: 0,
          contents: {
            textMessageAnnouncementContents: {
              senderSquareMemberMid: options.senderMid,
              messageId: options.messageId,
              text: options.text
            }
          },
          createdAt: options.createdAt,
          type: 0
        }
      }
    }), "createSquareChatAnnouncement", this.protocolType, true, this.requestPath);
  }
  async getSquareAuthority(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareAuthority_args(...param), "getSquareAuthority", this.protocolType, true, this.requestPath);
  }
  async getSquareChat(options) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareChat_args({
      request: {
        squareChatMid: options.squareChatMid
      }
    }), "getSquareChat", this.protocolType, true, this.requestPath);
  }
  async refreshSubscriptions(...param) {
    return await this.client.request.request(LINEStruct.SquareService_refreshSubscriptions_args(...param), "refreshSubscriptions", this.protocolType, true, this.requestPath);
  }
  async getJoinedSquareChats(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getJoinedSquareChats_args(...param), "getJoinedSquareChats", this.protocolType, true, this.requestPath);
  }
  async joinSquareChat(...param) {
    return await this.client.request.request(LINEStruct.SquareService_joinSquareChat_args(...param), "joinSquareChat", this.protocolType, true, this.requestPath);
  }
  async findSquareByEmid(...param) {
    return await this.client.request.request(LINEStruct.SquareService_findSquareByEmid_args(...param), "findSquareByEmid", this.protocolType, true, this.requestPath);
  }
  async getSquareMemberRelation(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareMemberRelation_args(...param), "getSquareMemberRelation", this.protocolType, true, this.requestPath);
  }
  async getSquareMember(options) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareMember_args({
      request: options
    }), "getSquareMember", this.protocolType, true, this.requestPath);
  }
  async deleteOtherFromSquare(squareMemberMid) {
    if (typeof squareMemberMid !== 'string' || !squareMemberMid.startsWith('p')) {
      throw new Error('Invalid value: squareMemberMid');
    }
    const response = await this.getSquareMember({
      squareMemberMid
    });
    const squareMember = response.squareMember;
    return await this.updateSquareMember({
      request: {
        updatedAttrs: [
          5
        ],
        updatedPreferenceAttrs: [],
        squareMember: {
          ...squareMember,
          membershipState: 'KICK_OUT'
        }
      }
    });
  }
  async destroyMessages(...param) {
    return await this.client.request.request(LINEStruct.SquareService_destroyMessages_args(...param), "destroyMessages", this.protocolType, true, this.requestPath);
  }
  async getCategories(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getCategories_args(...param), "getCategories", this.protocolType, true, this.requestPath);
  }
  async reportSquareMember(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reportSquareMember_args(...param), "reportSquareMember", this.protocolType, true, this.requestPath);
  }
  async getNoteStatus(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getNoteStatus_args(...param), "getNoteStatus", this.protocolType, true, this.requestPath);
  }
  async searchSquareChatMembers(options) {
    return await this.client.request.request(LINEStruct.SquareService_searchSquareChatMembers_args({
      request: {
        searchOption: options.searchOption,
        continuationToken: options.continuationToken,
        squareChatMid: options.squareChatMid,
        limit: options.limit ?? 100
      }
    }), "searchSquareChatMembers", this.protocolType, true, this.requestPath);
  }
  async getSquareChatFeatureSet(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareChatFeatureSet_args(...param), "getSquareChatFeatureSet", this.protocolType, true, this.requestPath);
  }
  async getSquareEmid(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareEmid_args(...param), "getSquareEmid", this.protocolType, true, this.requestPath);
  }
  async getSquareMembersBySquare(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareMembersBySquare_args(...param), "getSquareMembersBySquare", this.protocolType, true, this.requestPath);
  }
  async manualRepair(...param) {
    return await this.client.request.request(LINEStruct.SquareService_manualRepair_args(...param), "manualRepair", this.protocolType, true, this.requestPath);
  }
  async syncSquareMembers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_syncSquareMembers_args(...param), "syncSquareMembers", this.protocolType, true, this.requestPath);
  }
  async hideSquareMemberContents(...param) {
    return await this.client.request.request(LINEStruct.SquareService_hideSquareMemberContents_args(...param), "hideSquareMemberContents", this.protocolType, true, this.requestPath);
  }
  async markChatsAsRead(...param) {
    return await this.client.request.request(LINEStruct.SquareService_markChatsAsRead_args(...param), "markChatsAsRead", this.protocolType, true, this.requestPath);
  }
  async reportMessageSummary(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reportMessageSummary_args(...param), "reportMessageSummary", this.protocolType, true, this.requestPath);
  }
  async getGoogleAdOptions(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getGoogleAdOptions_args(...param), "getGoogleAdOptions", this.protocolType, true, this.requestPath);
  }
  async unhideSquareMemberContents(...param) {
    return await this.client.request.request(LINEStruct.SquareService_unhideSquareMemberContents_args(...param), "unhideSquareMemberContents", this.protocolType, true, this.requestPath);
  }
  async getSquareChatEmid(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareChatEmid_args(...param), "getSquareChatEmid", this.protocolType, true, this.requestPath);
  }
  async getSquareThread(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareThread_args(...param), "getSquareThread", this.protocolType, true, this.requestPath);
  }
  async getSquareThreadMid(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareThreadMid_args(...param), "getSquareThreadMid", this.protocolType, true, this.requestPath);
  }
  async getUserSettings(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getUserSettings_args(...param), "getUserSettings", this.protocolType, true, this.requestPath);
  }
  async markThreadsAsRead(...param) {
    return await this.client.request.request(LINEStruct.SquareService_markThreadsAsRead_args(...param), "markThreadsAsRead", this.protocolType, true, this.requestPath);
  }
  async sendSquareThreadMessage(...param) {
    return await this.client.request.request(LINEStruct.SquareService_sendSquareThreadMessage_args(...param), "sendSquareThreadMessage", this.protocolType, true, this.requestPath);
  }
  async findSquareByInvitationTicketV2(...param) {
    return await this.client.request.request(LINEStruct.SquareService_findSquareByInvitationTicketV2_args(...param), "findSquareByInvitationTicketV2", this.protocolType, true, this.requestPath);
  }
  async leaveSquareThread(...param) {
    return await this.client.request.request(LINEStruct.SquareService_leaveSquareThread_args(...param), "leaveSquareThread", this.protocolType, true, this.requestPath);
  }
  async joinSquareThread(...param) {
    return await this.client.request.request(LINEStruct.SquareService_joinSquareThread_args(...param), "joinSquareThread", this.protocolType, true, this.requestPath);
  }
  async updateUserSettings(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateUserSettings_args(...param), "updateUserSettings", this.protocolType, true, this.requestPath);
  }
}
//# sourceMappingURL=mod.js.map