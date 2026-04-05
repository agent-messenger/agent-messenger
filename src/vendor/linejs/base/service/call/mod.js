// For Call (call, etc)
import { LINEStruct } from "../../thrift/mod.js";
export class CallService {
  client;
  protocolType = 4;
  requestPath = "/V4";
  errorName = "CallServiceError";
  constructor(client){
    this.client = client;
  }
  async acquireCallRoute(...param) {
    return await this.client.request.request(LINEStruct.acquireCallRoute_args(...param), "acquireCallRoute", this.protocolType, true, this.requestPath);
  }
  async acquireOACallRoute(...param) {
    return await this.client.request.request(LINEStruct.acquireOACallRoute_args(...param), "acquireOACallRoute", this.protocolType, true, this.requestPath);
  }
  async lookupPaidCall(...param) {
    return await this.client.request.request(LINEStruct.lookupPaidCall_args(...param), "lookupPaidCall", this.protocolType, true, this.requestPath);
  }
  async acquirePaidCallRoute(...param) {
    return await this.client.request.request(LINEStruct.acquirePaidCallRoute_args(...param), "acquirePaidCallRoute", this.protocolType, true, this.requestPath);
  }
  async acquireGroupCallRoute(...param) {
    return await this.client.request.request(LINEStruct.acquireGroupCallRoute_args(...param), "acquireGroupCallRoute", this.protocolType, true, this.requestPath);
  }
  async getGroupCall(...param) {
    return await this.client.request.request(LINEStruct.getGroupCall_args(...param), "getGroupCall", this.protocolType, true, this.requestPath);
  }
  async inviteIntoGroupCall(...param) {
    return await this.client.request.request(LINEStruct.inviteIntoGroupCall_args(...param), "inviteIntoGroupCall", this.protocolType, true, this.requestPath);
  }
  async getGroupCallUrls(...param) {
    return await this.client.request.request(LINEStruct.getGroupCallUrls_args(...param), "getGroupCallUrls", this.protocolType, true, this.requestPath);
  }
  async createGroupCallUrl(...param) {
    return await this.client.request.request(LINEStruct.createGroupCallUrl_args(...param), "createGroupCallUrl", this.protocolType, true, this.requestPath);
  }
  async deleteGroupCallUrl(...param) {
    return await this.client.request.request(LINEStruct.deleteGroupCallUrl_args(...param), "deleteGroupCallUrl", this.protocolType, true, this.requestPath);
  }
  async updateGroupCallUrl(...param) {
    return await this.client.request.request(LINEStruct.updateGroupCallUrl_args(...param), "updateGroupCallUrl", this.protocolType, true, this.requestPath);
  }
  async getGroupCallUrlInfo(...param) {
    return await this.client.request.request(LINEStruct.getGroupCallUrlInfo_args(...param), "getGroupCallUrlInfo", this.protocolType, true, this.requestPath);
  }
  async joinChatByCallUrl(...param) {
    return await this.client.request.request(LINEStruct.joinChatByCallUrl_args(...param), "joinChatByCallUrl", this.protocolType, true, this.requestPath);
  }
  async kickoutFromGroupCall(...param) {
    return await this.client.request.request(LINEStruct.kickoutFromGroupCall_args(...param), "kickoutFromGroupCall", this.protocolType, true, this.requestPath);
  }
  async startPhotobooth(...param) {
    return await this.client.request.request(LINEStruct.startPhotobooth_args(...param), "startPhotobooth", this.protocolType, true, this.requestPath);
  }
  async usePhotoboothTicket(...param) {
    return await this.client.request.request(LINEStruct.usePhotoboothTicket_args(...param), "usePhotoboothTicket", this.protocolType, true, this.requestPath);
  }
  async getPhotoboothBalance(...param) {
    return await this.client.request.request(LINEStruct.getPhotoboothBalance_args(...param), "getPhotoboothBalance", this.protocolType, true, this.requestPath);
  }
}
//# sourceMappingURL=mod.js.map