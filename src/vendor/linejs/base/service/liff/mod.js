// For Liff (liff, etc)
import { LINEStruct } from "../../thrift/mod.js";
import { InternalError } from "../../core/utils/error.js";
export class LiffService {
  static LINE_LIFF_ENDPOINT = "https://api.line.me/message/v3/share";
  static CONSENT_API_URL = "https://access.line.me/dialog/api/permissions";
  static AUTH_CONSENT_URL = "https://access.line.me/oauth2/v2.1/authorize/consent";
  liffTokenCache = {};
  requestPath = "/LIFF1";
  protocolType = 4;
  errorName = "LiffServiceError";
  liffId = "2006747340-AoraPvdD";
  csrfRegExp = /<input type="hidden" name="__csrf" id="__csrf" value="(.*?)">/;
  client;
  constructor(client){
    this.client = client;
  }
  /**
	 * @description Gets the LiffToken by liffId and chatMid.
	 */ async issueLiffView(options) {
    const { chatMid, liffId, lang } = {
      lang: "ja_JP",
      ...options
    };
    let context = [
      12,
      1,
      []
    ];
    let chaLINETypes;
    let chat;
    if (chatMid) {
      chat = [
        11,
        1,
        chatMid
      ];
      if ([
        "u",
        "c",
        "r"
      ].includes(chatMid[0])) {
        chaLINETypes = 2;
      } else {
        chaLINETypes = 3;
      }
      context = [
        12,
        chaLINETypes,
        [
          chat
        ]
      ];
    }
    return await this.client.request.request([
      [
        12,
        1,
        [
          [
            11,
            1,
            liffId
          ],
          [
            12,
            2,
            [
              context
            ]
          ],
          [
            11,
            3,
            lang
          ]
        ]
      ]
    ], "issueLiffView", this.protocolType, true, this.requestPath);
  }
  async getLiffViewWithoutUserContext(...param) {
    return await this.client.request.request(LINEStruct.getLiffViewWithoutUserContext_args(...param), "getLiffViewWithoutUserContext", this.protocolType, true, this.requestPath);
  }
  async issueSubLiffView(...param) {
    return await this.client.request.request(LINEStruct.issueSubLiffView_args(...param), "issueSubLiffView", this.protocolType, true, this.requestPath);
  }
  /**
	 * @description Gets the LiffToken by liffId and chatMid with consent.
	 */ async getLiffToken(options) {
    const { chatMid, liffId, lang, tryConsent } = {
      lang: "ja_JP",
      tryConsent: true,
      ...options
    };
    try {
      const liff = await this.issueLiffView({
        liffId,
        chatMid,
        lang
      });
      return liff.accessToken;
    } catch (e) {
      if (e.data) {
        const error = e;
        this.client.log("liff-error", {
          ...error.data
        });
        if (error.data.liffException.code === "CONSENT_REQUIRED" && tryConsent) {
          const data = error.data.liffException;
          const payload = data.payload;
          const { channelId, consentUrl } = payload.consentRequired;
          const toType = chatMid && this.client.getToType(chatMid);
          let hasConsent = false;
          if (channelId && consentUrl) {
            if (toType === 4 || this.client.device.startsWith("DESKTOP")) {
              hasConsent = await this.tryConsentAuthorize(consentUrl, channelId);
            } else {
              hasConsent = await this.tryConsentLiff(channelId);
            }
            if (hasConsent) {
              options.tryConsent = false;
              return this.getLiffToken(options);
            }
          }
        }
      }
      throw new InternalError(this.errorName, `Failed to get LiffToken: ${liffId}${chatMid ? "@" + chatMid : ""}`);
    }
  }
  /**
	 * @description Send the LiffMessages.
	 */ async sendLiff(options) {
    let token;
    const { to, messages, tryConsent: _tryConsent, forceIssue } = {
      tryConsent: true,
      forceIssue: false,
      ...options
    };
    if (!this.liffTokenCache[to] || forceIssue) {
      token = await this.getLiffToken({
        chatMid: to,
        liffId: this.liffId
      });
    } else {
      token = this.liffTokenCache[to];
    }
    const liffHeaders = {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Linux; Android 4.4.2; G730-U00 Build/JLS36C) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36 Line/9.8.0",
      "Accept-Encoding": "gzip, deflate",
      "Accept-Language": "zh-TW,zh;q=0.9",
      Authorization: `Bearer ${token}`,
      "content-type": "application/json"
    };
    const payload = JSON.stringify({
      messages
    });
    const response = await this.client.fetch("https://api.line.me/message/v3/share", {
      method: "POST",
      body: payload,
      headers: liffHeaders
    });
    const responseBody = await response.json();
    if (!response.ok) {
      throw new InternalError(this.errorName, `Failed to send Liff message: ${response.statusText}`, responseBody);
    }
    return responseBody;
  }
  async tryConsentLiff(channelId, referer) {
    const payload = JSON.stringify({
      on: [
        "P",
        "CM"
      ],
      off: []
    });
    const headers = {
      "X-LINE-ChannelId": channelId,
      "X-LINE-Access": this.client.authToken,
      "User-Agent": "Mozilla/5.0 (Linux; Android 8.0.1; SAMSUNG Realise/DeachSword; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/56.0.2924.87 Mobile Safari/537.36",
      "Content-Type": "application/json",
      "X-Line-Application": this.client.request.systemType,
      "X-Requested-With": "XMLHttpRequest",
      "Accept-Language": "ja-JP,en-US;q=0.8",
      ...referer ? {
        referer
      } : {}
    };
    const response = await this.client.fetch(LiffService.CONSENT_API_URL, {
      method: "POST",
      body: payload,
      headers
    });
    return response.ok;
  }
  async tryConsentAuthorize(consentUrl, channelId, allPermission = [
    "P",
    "CM",
    "OC"
  ], approvedPermission = [
    "P",
    "CM",
    "OC"
  ]) {
    const headers = {
      "X-Line-Access": this.client?.authToken,
      "User-Agent": this.client.request.userAgent,
      "X-Line-Application": this.client.request.systemType
    };
    const response = await this.client.fetch(consentUrl, {
      method: "GET",
      headers
    });
    if (response.ok) {
      const cookies = [];
      response.headers.forEach((v, k)=>{
        if (k === "set-cookie") {
          cookies.push(v.split(";")[0]);
        }
      });
      const text = await response.text();
      const csrfToken = (this.csrfRegExp.exec(text) || [
        null,
        null
      ])[1];
      if (channelId && csrfToken) {
        headers["cookie"] = cookies.join("; ");
        headers["referer"] = consentUrl;
        const authResponse = await this.client.fetch(LiffService.AUTH_CONSENT_URL, {
          method: "POST",
          body: `${allPermission.map((e)=>"allPermission=" + e).join("&")}&${approvedPermission.map((e)=>"approvedPermission=" + e).join("&")}&__WLS=&channelId=2006747340&__csrf=${csrfToken}&allow=true`,
          headers
        });
        return authResponse.ok;
      }
    }
    return false;
  }
}
//# sourceMappingURL=mod.js.map