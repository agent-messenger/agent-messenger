// For Channel (channel, voom, etc)
import { LINEStruct } from "../../thrift/mod.js";
export class ChannelService {
  client;
  protocolType = 4;
  requestPath = "/CH4";
  errorName = "ChannelServiceError";
  constructor(client){
    this.client = client;
  }
  /**
	 * @description Gets the ChannelToken by channelId.\
	 * channelIds:
	 * - linevoom: 1341209850
	 */ async approveChannelAndIssueChannelToken(...param) {
    return await this.client.request.request(LINEStruct.approveChannelAndIssueChannelToken_args(...param), "approveChannelAndIssueChannelToken", this.protocolType, true, this.requestPath);
  }
  async getChannelInfo(...param) {
    return await this.client.request.request(LINEStruct.getChannelInfo_args(...param), "getChannelInfo", this.protocolType, true, this.requestPath);
  }
  async getCommonDomains(...param) {
    return await this.client.request.request(LINEStruct.getCommonDomains_args(...param), "getCommonDomains", this.protocolType, true, this.requestPath);
  }
  async issueRequestTokenWithAuthScheme(...param) {
    return await this.client.request.request(LINEStruct.issueRequestTokenWithAuthScheme_args(...param), "issueRequestTokenWithAuthScheme", this.protocolType, true, this.requestPath);
  }
  async getReturnUrlWithRequestTokenForAutoLogin(...param) {
    return await this.client.request.request(LINEStruct.getReturnUrlWithRequestTokenForAutoLogin_args(...param), "getReturnUrlWithRequestTokenForAutoLogin", this.protocolType, true, this.requestPath);
  }
  async getWebLoginDisallowedUrl(...param) {
    return await this.client.request.request(LINEStruct.getWebLoginDisallowedUrl_args(...param), "getWebLoginDisallowedUrl", this.protocolType, true, this.requestPath);
  }
  async updateChannelNotificationSetting(...param) {
    return await this.client.request.request(LINEStruct.updateChannelNotificationSetting_args(...param), "updateChannelNotificationSetting", this.protocolType, true, this.requestPath);
  }
  async updateChannelSettings(...param) {
    return await this.client.request.request(LINEStruct.updateChannelSettings_args(...param), "updateChannelSettings", this.protocolType, true, this.requestPath);
  }
  async getUpdatedChannelIds(...param) {
    return await this.client.request.request(LINEStruct.getUpdatedChannelIds_args(...param), "getUpdatedChannelIds", this.protocolType, true, this.requestPath);
  }
  async getChannelNotificationSettings(...param) {
    return await this.client.request.request(LINEStruct.getChannelNotificationSettings_args(...param), "getChannelNotificationSettings", this.protocolType, true, this.requestPath);
  }
  async getApprovedChannels(...param) {
    return await this.client.request.request(LINEStruct.getApprovedChannels_args(...param), "getApprovedChannels", this.protocolType, true, this.requestPath);
  }
  async issueChannelToken(...param) {
    return await this.client.request.request(LINEStruct.issueChannelToken_args(...param), "issueChannelToken", this.protocolType, true, this.requestPath);
  }
}
//# sourceMappingURL=mod.js.map