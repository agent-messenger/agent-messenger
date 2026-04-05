import { LINEStruct, type ProtocolKey } from "../../thrift/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { BaseClient } from "../../core/mod.js";
import type { BaseService } from "../types.js";
export declare class CallService implements BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
  constructor(client: BaseClient);
  acquireCallRoute(...param: Parameters<typeof LINEStruct.acquireCallRoute_args>): Promise<LINETypes.acquireCallRoute_result["success"]>;
  acquireOACallRoute(...param: Parameters<typeof LINEStruct.acquireOACallRoute_args>): Promise<LINETypes.acquireOACallRoute_result["success"]>;
  lookupPaidCall(...param: Parameters<typeof LINEStruct.lookupPaidCall_args>): Promise<LINETypes.lookupPaidCall_result["success"]>;
  acquirePaidCallRoute(...param: Parameters<typeof LINEStruct.acquirePaidCallRoute_args>): Promise<LINETypes.acquirePaidCallRoute_result["success"]>;
  acquireGroupCallRoute(...param: Parameters<typeof LINEStruct.acquireGroupCallRoute_args>): Promise<LINETypes.acquireGroupCallRoute_result["success"]>;
  getGroupCall(...param: Parameters<typeof LINEStruct.getGroupCall_args>): Promise<LINETypes.getGroupCall_result["success"]>;
  inviteIntoGroupCall(...param: Parameters<typeof LINEStruct.inviteIntoGroupCall_args>): Promise<void>;
  getGroupCallUrls(...param: Parameters<typeof LINEStruct.getGroupCallUrls_args>): Promise<LINETypes.getGroupCallUrls_result["success"]>;
  createGroupCallUrl(...param: Parameters<typeof LINEStruct.createGroupCallUrl_args>): Promise<LINETypes.createGroupCallUrl_result["success"]>;
  deleteGroupCallUrl(...param: Parameters<typeof LINEStruct.deleteGroupCallUrl_args>): Promise<LINETypes.deleteGroupCallUrl_result["success"]>;
  updateGroupCallUrl(...param: Parameters<typeof LINEStruct.updateGroupCallUrl_args>): Promise<LINETypes.updateGroupCallUrl_result["success"]>;
  getGroupCallUrlInfo(...param: Parameters<typeof LINEStruct.getGroupCallUrlInfo_args>): Promise<LINETypes.getGroupCallUrlInfo_result["success"]>;
  joinChatByCallUrl(...param: Parameters<typeof LINEStruct.joinChatByCallUrl_args>): Promise<LINETypes.joinChatByCallUrl_result["success"]>;
  kickoutFromGroupCall(...param: Parameters<typeof LINEStruct.kickoutFromGroupCall_args>): Promise<LINETypes.kickoutFromGroupCall_result["success"]>;
  startPhotobooth(...param: Parameters<typeof LINEStruct.startPhotobooth_args>): Promise<LINETypes.startPhotobooth_result["success"]>;
  usePhotoboothTicket(...param: Parameters<typeof LINEStruct.usePhotoboothTicket_args>): Promise<LINETypes.usePhotoboothTicket_result["success"]>;
  getPhotoboothBalance(...param: Parameters<typeof LINEStruct.getPhotoboothBalance_args>): Promise<LINETypes.getPhotoboothBalance_result["success"]>;
}
//# sourceMappingURL=mod.d.ts.map