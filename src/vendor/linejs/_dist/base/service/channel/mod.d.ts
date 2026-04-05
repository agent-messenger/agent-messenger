import { LINEStruct, type ProtocolKey } from "../../thrift/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { BaseClient } from "../../core/mod.js";
import type { BaseService } from "../types.js";
export declare class ChannelService implements BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
  constructor(client: BaseClient);
  /**
	 * @description Gets the ChannelToken by channelId.\
	 * channelIds:
	 * - linevoom: 1341209850
	 */ approveChannelAndIssueChannelToken(...param: Parameters<typeof LINEStruct.approveChannelAndIssueChannelToken_args>): Promise<LINETypes.approveChannelAndIssueChannelToken_result["success"]>;
  getChannelInfo(...param: Parameters<typeof LINEStruct.getChannelInfo_args>): Promise<LINETypes.getChannelInfo_result["success"]>;
  getCommonDomains(...param: Parameters<typeof LINEStruct.getCommonDomains_args>): Promise<LINETypes.getCommonDomains_result["success"]>;
  issueRequestTokenWithAuthScheme(...param: Parameters<typeof LINEStruct.issueRequestTokenWithAuthScheme_args>): Promise<LINETypes.issueRequestTokenWithAuthScheme_result["success"]>;
  getReturnUrlWithRequestTokenForAutoLogin(...param: Parameters<typeof LINEStruct.getReturnUrlWithRequestTokenForAutoLogin_args>): Promise<LINETypes.getReturnUrlWithRequestTokenForAutoLogin_result["success"]>;
  getWebLoginDisallowedUrl(...param: Parameters<typeof LINEStruct.getWebLoginDisallowedUrl_args>): Promise<LINETypes.getWebLoginDisallowedUrl_result["success"]>;
  updateChannelNotificationSetting(...param: Parameters<typeof LINEStruct.updateChannelNotificationSetting_args>): Promise<void>;
  updateChannelSettings(...param: Parameters<typeof LINEStruct.updateChannelSettings_args>): Promise<LINETypes.updateChannelSettings_result["success"]>;
  getUpdatedChannelIds(...param: Parameters<typeof LINEStruct.getUpdatedChannelIds_args>): Promise<LINETypes.getUpdatedChannelIds_result["success"]>;
  getChannelNotificationSettings(...param: Parameters<typeof LINEStruct.getChannelNotificationSettings_args>): Promise<LINETypes.getChannelNotificationSettings_result["success"]>;
  getApprovedChannels(...param: Parameters<typeof LINEStruct.getApprovedChannels_args>): Promise<LINETypes.getApprovedChannels_result["success"]>;
  issueChannelToken(...param: Parameters<typeof LINEStruct.issueChannelToken_args>): Promise<LINETypes.issueChannelToken_result["success"]>;
}
//# sourceMappingURL=mod.d.ts.map