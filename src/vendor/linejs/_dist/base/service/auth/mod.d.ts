import { LINEStruct, type ProtocolKey } from "../../thrift/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import { type BaseClient } from "../../core/mod.js";
import type { BaseService } from "../types.js";
export declare class AuthService implements BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
  constructor(client: BaseClient);
  /**
	 * @description Try to refresh token.
	 */ public tryRefreshToken(): Promise<void>;
  refresh(...param: Parameters<typeof LINEStruct.refresh_args>): Promise<LINETypes.refresh_result["success"]>;
  reportRefreshedAccessToken(...param: Parameters<typeof LINEStruct.reportRefreshedAccessToken_args>): Promise<LINETypes.reportRefreshedAccessToken_result["success"]>;
  connectEapAccount(...param: Parameters<typeof LINEStruct.connectEapAccount_args>): Promise<LINETypes.connectEapAccount_result["success"]>;
  disconnectEapAccount(...param: Parameters<typeof LINEStruct.disconnectEapAccount_args>): Promise<LINETypes.disconnectEapAccount_result["success"]>;
  openSession(...param: Parameters<typeof LINEStruct.openSession_args>): Promise<LINETypes.openSession_result["success"]>;
  verifyEapLogin(...param: Parameters<typeof LINEStruct.verifyEapLogin_args>): Promise<LINETypes.verifyEapLogin_result["success"]>;
  updatePassword(...param: Parameters<typeof LINEStruct.updatePassword_args>): Promise<LINETypes.updatePassword_result["success"]>;
  establishE2EESession(...param: Parameters<typeof LINEStruct.establishE2EESession_args>): Promise<LINETypes.establishE2EESession_result["success"]>;
  issueTokenForAccountMigrationSettings(...param: Parameters<typeof LINEStruct.issueTokenForAccountMigrationSettings_args>): Promise<LINETypes.issueTokenForAccountMigrationSettings_result["success"]>;
  openAuthSession(...param: Parameters<typeof LINEStruct.openAuthSession_args>): Promise<LINETypes.openAuthSession_result["success"]>;
  getAuthRSAKey(...param: Parameters<typeof LINEStruct.getAuthRSAKey_args>): Promise<LINETypes.getAuthRSAKey_result["success"]>;
  setIdentifier(...param: Parameters<typeof LINEStruct.setIdentifier_args>): Promise<LINETypes.setIdentifier_result["success"]>;
  updateIdentifier(...param: Parameters<typeof LINEStruct.updateIdentifier_args>): Promise<LINETypes.updateIdentifier_result["success"]>;
  resendIdentifierConfirmation(...param: Parameters<typeof LINEStruct.resendIdentifierConfirmation_args>): Promise<LINETypes.resendIdentifierConfirmation_result["success"]>;
  confirmIdentifier(...param: Parameters<typeof LINEStruct.confirmIdentifier_args>): Promise<LINETypes.confirmIdentifier_result["success"]>;
  removeIdentifier(...param: Parameters<typeof LINEStruct.removeIdentifier_args>): Promise<LINETypes.removeIdentifier_result["success"]>;
  issueV3TokenForPrimary(...param: Parameters<typeof LINEStruct.issueV3TokenForPrimary_args>): Promise<LINETypes.issueV3TokenForPrimary_result["success"]>;
}
//# sourceMappingURL=mod.d.ts.map