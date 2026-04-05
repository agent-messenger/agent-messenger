import { LINEStruct, type ProtocolKey } from "../../thrift/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { BaseClient } from "../../core/mod.js";
import type { BaseService } from "../types.js";
export declare class SquareLiveTalkService implements BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
  constructor(client: BaseClient);
  acceptSpeakers(...param: Parameters<typeof LINEStruct.SquareService_acceptSpeakers_args>): Promise<LINETypes.SquareService_acceptSpeakers_result["success"]>;
  acceptToChangeRole(...param: Parameters<typeof LINEStruct.SquareService_acceptToChangeRole_args>): Promise<LINETypes.SquareService_acceptToChangeRole_result["success"]>;
  acceptToListen(...param: Parameters<typeof LINEStruct.SquareService_acceptToListen_args>): Promise<LINETypes.SquareService_acceptToListen_result["success"]>;
  acceptToSpeak(...param: Parameters<typeof LINEStruct.SquareService_acceptToSpeak_args>): Promise<LINETypes.SquareService_acceptToSpeak_result["success"]>;
  cancelToSpeak(...param: Parameters<typeof LINEStruct.SquareService_cancelToSpeak_args>): Promise<LINETypes.SquareService_cancelToSpeak_result["success"]>;
  fetchLiveTalkEvents(...param: Parameters<typeof LINEStruct.SquareService_fetchLiveTalkEvents_args>): Promise<LINETypes.SquareService_fetchLiveTalkEvents_result["success"]>;
  findLiveTalkByInvitationTicket(...param: Parameters<typeof LINEStruct.SquareService_findLiveTalkByInvitationTicket_args>): Promise<LINETypes.SquareService_findLiveTalkByInvitationTicket_result["success"]>;
  forceEndLiveTalk(...param: Parameters<typeof LINEStruct.SquareService_forceEndLiveTalk_args>): Promise<LINETypes.SquareService_forceEndLiveTalk_result["success"]>;
  getLiveTalkInfoForNonMember(...param: Parameters<typeof LINEStruct.SquareService_getLiveTalkInfoForNonMember_args>): Promise<LINETypes.SquareService_getLiveTalkInfoForNonMember_result["success"]>;
  getLiveTalkInvitationUrl(...param: Parameters<typeof LINEStruct.SquareService_getLiveTalkInvitationUrl_args>): Promise<LINETypes.SquareService_getLiveTalkInvitationUrl_result["success"]>;
  getLiveTalkSpeakersForNonMember(...param: Parameters<typeof LINEStruct.SquareService_getLiveTalkSpeakersForNonMember_args>): Promise<LINETypes.SquareService_getLiveTalkSpeakersForNonMember_result["success"]>;
  getSquareInfoByChatMid(...param: Parameters<typeof LINEStruct.SquareService_getSquareInfoByChatMid_args>): Promise<LINETypes.SquareService_getSquareInfoByChatMid_result["success"]>;
  inviteToChangeRole(...param: Parameters<typeof LINEStruct.SquareService_inviteToChangeRole_args>): Promise<LINETypes.SquareService_inviteToChangeRole_result["success"]>;
  inviteToListen(...param: Parameters<typeof LINEStruct.SquareService_inviteToListen_args>): Promise<LINETypes.SquareService_inviteToListen_result["success"]>;
  inviteToLiveTalk(...param: Parameters<typeof LINEStruct.SquareService_inviteToLiveTalk_args>): Promise<LINETypes.SquareService_inviteToLiveTalk_result["success"]>;
  inviteToSpeak(...param: Parameters<typeof LINEStruct.SquareService_inviteToSpeak_args>): Promise<LINETypes.SquareService_inviteToSpeak_result["success"]>;
  joinLiveTalk(...param: Parameters<typeof LINEStruct.SquareService_joinLiveTalk_args>): Promise<LINETypes.SquareService_joinLiveTalk_result["success"]>;
  kickOutLiveTalkParticipants(...param: Parameters<typeof LINEStruct.SquareService_kickOutLiveTalkParticipants_args>): Promise<LINETypes.SquareService_kickOutLiveTalkParticipants_result["success"]>;
  rejectSpeakers(...param: Parameters<typeof LINEStruct.SquareService_rejectSpeakers_args>): Promise<LINETypes.SquareService_rejectSpeakers_result["success"]>;
  rejectToSpeak(...param: Parameters<typeof LINEStruct.SquareService_rejectToSpeak_args>): Promise<LINETypes.SquareService_rejectToSpeak_result["success"]>;
  reportLiveTalk(...param: Parameters<typeof LINEStruct.SquareService_reportLiveTalk_args>): Promise<LINETypes.SquareService_reportLiveTalk_result["success"]>;
  reportLiveTalkSpeaker(...param: Parameters<typeof LINEStruct.SquareService_reportLiveTalkSpeaker_args>): Promise<LINETypes.SquareService_reportLiveTalkSpeaker_result["success"]>;
  requestToListen(...param: Parameters<typeof LINEStruct.SquareService_requestToListen_args>): Promise<LINETypes.SquareService_requestToListen_result["success"]>;
  requestToSpeak(...param: Parameters<typeof LINEStruct.SquareService_requestToSpeak_args>): Promise<LINETypes.SquareService_requestToSpeak_result["success"]>;
  updateLiveTalkAttrs(...param: Parameters<typeof LINEStruct.SquareService_updateLiveTalkAttrs_args>): Promise<LINETypes.SquareService_updateLiveTalkAttrs_result["success"]>;
  acquireLiveTalk(...param: Parameters<typeof LINEStruct.SquareService_acquireLiveTalk_args>): Promise<LINETypes.SquareService_acquireLiveTalk_result["success"]>;
}
//# sourceMappingURL=mod.d.ts.map