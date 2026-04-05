import { LINEStruct, type ProtocolKey } from "../../thrift/mod.js";
import type * as LINETypes from "@jsr/evex__linejs-types";
import type { BaseClient } from "../../core/mod.js";
import type { BaseService } from "../types.js";
import type { LooseType } from "@jsr/evex__loose-types";
export declare class LiffService implements BaseService {
  static readonly LINE_LIFF_ENDPOINT: "https://api.line.me/message/v3/share";
  static readonly CONSENT_API_URL: "https://access.line.me/dialog/api/permissions";
  static readonly AUTH_CONSENT_URL: "https://access.line.me/oauth2/v2.1/authorize/consent";
  liffTokenCache: {
    [key: string]: string;
  };
  requestPath: string;
  protocolType: ProtocolKey;
  errorName: string;
  liffId: string;
  csrfRegExp: RegExp;
  client: BaseClient;
  constructor(client: BaseClient);
  /**
	 * @description Gets the LiffToken by liffId and chatMid.
	 */ public issueLiffView(options: {
    chatMid?: string;
    liffId: string;
    lang?: string;
  }): Promise<LINETypes.LiffViewResponse>;
  getLiffViewWithoutUserContext(...param: Parameters<typeof LINEStruct.getLiffViewWithoutUserContext_args>): Promise<LINETypes.getLiffViewWithoutUserContext_result["success"]>;
  issueSubLiffView(...param: Parameters<typeof LINEStruct.issueSubLiffView_args>): Promise<LINETypes.issueSubLiffView_result["success"]>;
  /**
	 * @description Gets the LiffToken by liffId and chatMid with consent.
	 */ public getLiffToken(options: {
    chatMid?: string;
    liffId: string;
    lang?: string;
    tryConsent?: boolean;
  }): Promise<string>;
  /**
	 * @description Send the LiffMessages.
	 */ public sendLiff(options: {
    to: string;
    messages: {
      type: string;
      text?: string;
    }[];
    tryConsent?: boolean;
    forceIssue?: boolean;
  }): Promise<LooseType>;
  private tryConsentLiff: any;
  private tryConsentAuthorize: any;
}
//# sourceMappingURL=mod.d.ts.map