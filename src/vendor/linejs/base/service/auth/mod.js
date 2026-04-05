// For Auth (login, refresh, etc)
import { LINEStruct } from "../../thrift/mod.js";
import { InternalError } from "../../core/mod.js";
export class AuthService {
  client;
  protocolType = 4;
  requestPath = "/AS4";
  errorName = "AuthServiceError";
  constructor(client){
    this.client = client;
  }
  /**
	 * @description Try to refresh token.
	 */ async tryRefreshToken() {
    const refreshToken = await this.client.storage.get("refreshToken");
    if (typeof refreshToken === "string") {
      const RATR = await this.refresh({
        request: {
          refreshToken
        }
      });
      this.client.authToken = RATR.accessToken;
      this.client.emit("update:authtoken", RATR.accessToken);
      await this.client.storage.set("expire", RATR.tokenIssueTimeEpochSec + RATR.durationUntilRefreshInSec);
    } else {
      throw new InternalError("RefreshError", "refreshToken not found");
    }
  }
  async refresh(...param) {
    return await this.client.request.request(LINEStruct.refresh_args(...param), "refresh", this.protocolType, true, "/EXT/auth/tokenrefresh/v1");
  }
  async reportRefreshedAccessToken(...param) {
    return await this.client.request.request(LINEStruct.reportRefreshedAccessToken_args(...param), "reportRefreshedAccessToken", this.protocolType, true, this.requestPath);
  }
  //
  async connectEapAccount(...param) {
    return await this.client.request.request(LINEStruct.connectEapAccount_args(...param), "connectEapAccount", this.protocolType, true, this.requestPath);
  }
  async disconnectEapAccount(...param) {
    return await this.client.request.request(LINEStruct.disconnectEapAccount_args(...param), "disconnectEapAccount", this.protocolType, true, this.requestPath);
  }
  async openSession(...param) {
    return await this.client.request.request(LINEStruct.openSession_args(...param), "openSession", this.protocolType, true, this.requestPath);
  }
  async verifyEapLogin(...param) {
    return await this.client.request.request(LINEStruct.verifyEapLogin_args(...param), "verifyEapLogin", this.protocolType, true, this.requestPath);
  }
  //
  async updatePassword(...param) {
    return await this.client.request.request(LINEStruct.updatePassword_args(...param), "updatePassword", this.protocolType, true, this.requestPath);
  }
  async establishE2EESession(...param) {
    return await this.client.request.request(LINEStruct.establishE2EESession_args(...param), "establishE2EESession", this.protocolType, true, this.requestPath);
  }
  async issueTokenForAccountMigrationSettings(...param) {
    return await this.client.request.request(LINEStruct.issueTokenForAccountMigrationSettings_args(...param), "issueTokenForAccountMigrationSettings", this.protocolType, true, this.requestPath);
  }
  async openAuthSession(...param) {
    return await this.client.request.request(LINEStruct.openAuthSession_args(...param), "openAuthSession", this.protocolType, true, this.requestPath);
  }
  async getAuthRSAKey(...param) {
    return await this.client.request.request(LINEStruct.getAuthRSAKey_args(...param), "getAuthRSAKey", this.protocolType, true, this.requestPath);
  }
  async setIdentifier(...param) {
    return await this.client.request.request(LINEStruct.setIdentifier_args(...param), "setIdentifier", this.protocolType, true, this.requestPath);
  }
  async updateIdentifier(...param) {
    return await this.client.request.request(LINEStruct.updateIdentifier_args(...param), "updateIdentifier", this.protocolType, true, this.requestPath);
  }
  async resendIdentifierConfirmation(...param) {
    return await this.client.request.request(LINEStruct.resendIdentifierConfirmation_args(...param), "resendIdentifierConfirmation", this.protocolType, true, this.requestPath);
  }
  async confirmIdentifier(...param) {
    return await this.client.request.request(LINEStruct.confirmIdentifier_args(...param), "confirmIdentifier", this.protocolType, true, this.requestPath);
  }
  async removeIdentifier(...param) {
    return await this.client.request.request(LINEStruct.removeIdentifier_args(...param), "removeIdentifier", this.protocolType, true, this.requestPath);
  }
  async issueV3TokenForPrimary(...param) {
    return await this.client.request.request(LINEStruct.issueV3TokenForPrimary_args(...param), "issueV3TokenForPrimary", this.protocolType, true, this.requestPath);
  }
}
//# sourceMappingURL=mod.js.map