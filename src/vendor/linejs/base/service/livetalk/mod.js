// For SquareLiveTalk (live, etc)
import { LINEStruct } from "../../thrift/mod.js";
export class SquareLiveTalkService {
  client;
  protocolType = 4;
  requestPath = "/SQLV1";
  errorName = "SquareLiveTalkServiceError";
  constructor(client){
    this.client = client;
  }
  async acceptSpeakers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_acceptSpeakers_args(...param), "acceptSpeakers", this.protocolType, true, this.requestPath);
  }
  async acceptToChangeRole(...param) {
    return await this.client.request.request(LINEStruct.SquareService_acceptToChangeRole_args(...param), "acceptToChangeRole", this.protocolType, true, this.requestPath);
  }
  async acceptToListen(...param) {
    return await this.client.request.request(LINEStruct.SquareService_acceptToListen_args(...param), "acceptToListen", this.protocolType, true, this.requestPath);
  }
  async acceptToSpeak(...param) {
    return await this.client.request.request(LINEStruct.SquareService_acceptToSpeak_args(...param), "acceptToSpeak", this.protocolType, true, this.requestPath);
  }
  async cancelToSpeak(...param) {
    return await this.client.request.request(LINEStruct.SquareService_cancelToSpeak_args(...param), "cancelToSpeak", this.protocolType, true, this.requestPath);
  }
  async fetchLiveTalkEvents(...param) {
    return await this.client.request.request(LINEStruct.SquareService_fetchLiveTalkEvents_args(...param), "fetchLiveTalkEvents", this.protocolType, true, this.requestPath);
  }
  async findLiveTalkByInvitationTicket(...param) {
    return await this.client.request.request(LINEStruct.SquareService_findLiveTalkByInvitationTicket_args(...param), "findLiveTalkByInvitationTicket", this.protocolType, true, this.requestPath);
  }
  async forceEndLiveTalk(...param) {
    return await this.client.request.request(LINEStruct.SquareService_forceEndLiveTalk_args(...param), "forceEndLiveTalk", this.protocolType, true, this.requestPath);
  }
  async getLiveTalkInfoForNonMember(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getLiveTalkInfoForNonMember_args(...param), "getLiveTalkInfoForNonMember", this.protocolType, true, this.requestPath);
  }
  async getLiveTalkInvitationUrl(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getLiveTalkInvitationUrl_args(...param), "getLiveTalkInvitationUrl", this.protocolType, true, this.requestPath);
  }
  async getLiveTalkSpeakersForNonMember(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getLiveTalkSpeakersForNonMember_args(...param), "getLiveTalkSpeakersForNonMember", this.protocolType, true, this.requestPath);
  }
  async getSquareInfoByChatMid(...param) {
    return await this.client.request.request(LINEStruct.SquareService_getSquareInfoByChatMid_args(...param), "getSquareInfoByChatMid", this.protocolType, true, this.requestPath);
  }
  async inviteToChangeRole(...param) {
    return await this.client.request.request(LINEStruct.SquareService_inviteToChangeRole_args(...param), "inviteToChangeRole", this.protocolType, true, this.requestPath);
  }
  async inviteToListen(...param) {
    return await this.client.request.request(LINEStruct.SquareService_inviteToListen_args(...param), "inviteToListen", this.protocolType, true, this.requestPath);
  }
  async inviteToLiveTalk(...param) {
    return await this.client.request.request(LINEStruct.SquareService_inviteToLiveTalk_args(...param), "inviteToLiveTalk", this.protocolType, true, this.requestPath);
  }
  async inviteToSpeak(...param) {
    return await this.client.request.request(LINEStruct.SquareService_inviteToSpeak_args(...param), "inviteToSpeak", this.protocolType, true, this.requestPath);
  }
  async joinLiveTalk(...param) {
    return await this.client.request.request(LINEStruct.SquareService_joinLiveTalk_args(...param), "joinLiveTalk", this.protocolType, true, this.requestPath);
  }
  async kickOutLiveTalkParticipants(...param) {
    return await this.client.request.request(LINEStruct.SquareService_kickOutLiveTalkParticipants_args(...param), "kickOutLiveTalkParticipants", this.protocolType, true, this.requestPath);
  }
  async rejectSpeakers(...param) {
    return await this.client.request.request(LINEStruct.SquareService_rejectSpeakers_args(...param), "rejectSpeakers", this.protocolType, true, this.requestPath);
  }
  async rejectToSpeak(...param) {
    return await this.client.request.request(LINEStruct.SquareService_rejectToSpeak_args(...param), "rejectToSpeak", this.protocolType, true, this.requestPath);
  }
  async reportLiveTalk(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reportLiveTalk_args(...param), "reportLiveTalk", this.protocolType, true, this.requestPath);
  }
  async reportLiveTalkSpeaker(...param) {
    return await this.client.request.request(LINEStruct.SquareService_reportLiveTalkSpeaker_args(...param), "reportLiveTalkSpeaker", this.protocolType, true, this.requestPath);
  }
  async requestToListen(...param) {
    return await this.client.request.request(LINEStruct.SquareService_requestToListen_args(...param), "requestToListen", this.protocolType, true, this.requestPath);
  }
  async requestToSpeak(...param) {
    return await this.client.request.request(LINEStruct.SquareService_requestToSpeak_args(...param), "requestToSpeak", this.protocolType, true, this.requestPath);
  }
  async updateLiveTalkAttrs(...param) {
    return await this.client.request.request(LINEStruct.SquareService_updateLiveTalkAttrs_args(...param), "updateLiveTalkAttrs", this.protocolType, true, this.requestPath);
  }
  async acquireLiveTalk(...param) {
    return await this.client.request.request(LINEStruct.SquareService_acquireLiveTalk_args(...param), "acquireLiveTalk", this.protocolType, true, this.requestPath);
  }
}
//# sourceMappingURL=mod.js.map