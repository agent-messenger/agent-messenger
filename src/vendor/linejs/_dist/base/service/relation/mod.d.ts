import { LINEStruct, type ProtocolKey } from "../../thrift/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { BaseClient } from "../../core/mod.js";
import type { BaseService } from "../types.js";
import type { LooseType } from "@jsr/evex__loose-types";
export declare class RelationService implements BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
  constructor(client: BaseClient);
  getTargetProfiles(...param: Parameters<typeof LINEStruct.getTargetProfiles_args>): Promise<LINETypes.getTargetProfiles_result["success"]>;
  getRecommendationDetails(...param: Parameters<typeof LINEStruct.getRecommendationDetails_args>): Promise<LINETypes.getRecommendationDetails_result["success"]>;
  getContactCalendarEvents(...param: Parameters<typeof LINEStruct.getContactCalendarEvents_args>): Promise<LINETypes.getContactCalendarEvents_result["success"]>;
  getContactsV3(options: {
    mids: string[];
    checkUserStatusStrictly?: boolean;
  }): Promise<LINETypes.getContactsV3_result["success"]>;
  getFriendDetails(...param: Parameters<typeof LINEStruct.getFriendDetails_args>): Promise<LINETypes.getFriendDetails_result["success"]>;
  getUserFriendIds(...param: Parameters<typeof LINEStruct.getUserFriendIds_args>): Promise<LINETypes.getUserFriendIds_result["success"]>;
  /**
	 * @description Add friend by mid.
	 */ public addFriendByMid(options: {
    mid: string;
    reference?: string;
    trackingMetaType?: number;
    trackingMetaHint?: string;
  }): Promise<LooseType>;
}
//# sourceMappingURL=mod.d.ts.map