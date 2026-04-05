import { Buffer } from "node:buffer";
import { InternalError } from "../core/mod.js";
import { MimeType } from "./mime.js";
import crypto from "node:crypto";
import { writeStruct } from "../thrift/readwrite/write.js";
// @ts-types="thrift-types"
import * as thrift from "thrift";
export class LineObs {
  client;
  prefix = "https://obs.line-apps.com/";
  constructor(client){
    this.client = client;
  }
  /**
	 * Gets a message image URI by appending the given message ID to the prefixSticker
	 * @param {string} [messageId] - The message ID to use in the URLSticker
	 * @param {boolean} [isPreview=false] - Whether to append '/preview' to the URL.
	 * @return {string} The getted message image
	 */ getMessageDataUrl(messageId, isPreview = false, square = false) {
    return `${this.prefix}r/${square ? "g2" : "talk"}/m/${messageId}${isPreview ? "/preview" : ""}`;
  }
  /**
	 * Gets a message image URI by appending the given message ID to the prefixSticker
	 * @param {string} [messageId] - The message ID to use in the URLSticker
	 * @return {string} The getted message image
	 */ getMessageMetadataUrl(messageId, square = false) {
    return `${this.prefix}r/${square ? "g2" : "talk"}/m/${messageId}/object_info.obs`;
  }
  /**
	 * @description Gets the message's data from LINE Obs.
	 */ async downloadMessageData(options) {
    if (!this.client.authToken) {
      throw new InternalError("Not setup yet", "Please call 'login()' first");
    }
    const { messageId, isPreview, isSquare } = {
      isPreview: false,
      isSquare: false,
      ...options
    };
    const blob = await (await this.client.fetch(this.getMessageDataUrl(messageId, isPreview, isSquare), {
      headers: {
        accept: "application/json, text/plain, */*",
        "x-line-application": this.client.request.systemType,
        "x-Line-access": this.client.authToken
      }
    })).blob();
    const fileInfo = await this.getMessageObsMetadata({
      messageId,
      isSquare
    });
    return new File([
      blob
    ], fileInfo.name, {
      type: blob.type
    });
  }
  /**
	 * @description Gets the message's data from LINE Obs.
	 */ async getMessageObsMetadata(options) {
    if (!this.client.authToken) {
      throw new InternalError("Not setup yet", "Please call 'login()' first");
    }
    const { messageId, isSquare } = {
      isSquare: false,
      ...options
    };
    const r = await this.client.fetch(this.getMessageMetadataUrl(messageId, isSquare), {
      headers: {
        accept: "application/json, text/plain, */*",
        "x-line-application": this.client.request.systemType,
        "x-Line-access": this.client.authToken
      }
    });
    return r.json();
  }
  /**
	 * @description Upload obs message to talk.
	 */ async uploadObjTalk(to, type, data, oid, filename) {
    if (!this.client.authToken) {
      throw new InternalError("Not setup yet", "Please call 'login()' first");
    }
    const ext = MimeType[data.type];
    const reqseqValue = await this.client.getReqseq("talk");
    const param = {
      ver: "2.0",
      name: filename || "linejs." + ext,
      type,
      ...oid ? {
        oid: oid
      } : {
        oid: "reqseq",
        tomid: to,
        reqseq: reqseqValue.toString()
      }
    };
    if (type === "image") {
      param.cat = "original";
    } else if (type === "gif") {
      param.cat = "original";
      param.type = "image";
    } else if (type === "audio" || type === "video") {
      param.duration = "1919"; // 810
    }
    const toType = to[0] === "m" || to[0] === "t" ? "g2" : "talk";
    return await this.uploadObjectForService({
      data,
      oType: type,
      obsPath: `${toType}/m/${oid ?? "reqseq"}`,
      filename: param.name,
      params: param
    });
  }
  async uploadObjectForService(options) {
    this.client.log("Obs.uploadObjectForService", options);
    let { data, oType, obsPath, params, filename, addHeaders } = {
      oType: "image",
      obsPath: "myhome/h",
      ...options
    };
    const obsPathFinal = `/r/${obsPath}`;
    oType = oType.toLowerCase();
    filename = filename || crypto.randomUUID();
    const baseParams = {
      type: oType,
      ver: "2.0",
      name: filename
    };
    params = {
      ...baseParams,
      ...params || {}
    };
    if (!data || data.size === 0) {
      throw new InternalError("ObsError", "No data to send.");
    }
    let headers = this.client.request.getHeader("POST");
    headers["content-type"] = "application/octet-stream";
    headers["X-Obs-Params"] = Buffer.from(JSON.stringify(params)).toString("base64");
    if (addHeaders) {
      headers = {
        ...headers,
        ...addHeaders
      };
    }
    const response = await this.client.fetch(this.prefix + obsPathFinal, {
      method: "POST",
      headers,
      body: data
    });
    const objId = response.headers.get("x-obs-oid") ?? "";
    const objHash = response.headers.get("x-obs-hash") ?? "";
    this.client.log("Obs.uploadObjectForServiceResponse", {
      objId,
      objHash,
      headers: response.headers.toString()
    });
    return {
      objId,
      objHash,
      headers: response.headers
    };
  }
  async downloadObjectForService(options) {
    let { obsPath, oid, addHeaders } = {
      addHeaders: {},
      ...options
    };
    if (obsPath.includes("{oid}")) {
      obsPath = obsPath.replace("{oid}", oid);
    } else {
      obsPath += "/" + oid;
    }
    let headers = this.client.request.getHeader("GET");
    headers = {
      ...headers,
      ...addHeaders
    };
    const obsPathFinal = "r/" + obsPath;
    const response = await this.client.fetch(this.prefix + obsPathFinal, {
      method: "GET",
      headers
    });
    return response.blob();
  }
  async uploadMediaByE2EE(options) {
    const { data, oType, to, filename } = options;
    const typeSet = {
      "image": [
        "emi",
        1
      ],
      "video": [
        "emv",
        2
      ],
      "audio": [
        "ema",
        3
      ],
      "file": [
        "emf",
        14
      ],
      "gif": [
        "emi",
        1
      ]
    };
    const ext = filename && filename.split(".").at(-1) || MimeType[data.type];
    const serviceName = "talk";
    const [obsNamespace, contentType] = typeSet[oType];
    const params = {
      "type": "file"
    };
    if (oType === "gif") {
      params["cat"] = "original";
    }
    if (!(to[0] === "u" || to[0] === "c")) {
      throw new InternalError("ObsError", "Invalid mid");
    }
    const { keyMaterial, encryptedData } = await this.client.e2ee.encryptByKeyMaterial(Buffer.from(await data.arrayBuffer()));
    const tempId = "reqid-" + crypto.randomUUID();
    // @ts-expect-error: will fix cuz typescript version change
    const edata = new Blob([
      encryptedData
    ]);
    const { objId } = await this.uploadObjectForService({
      data: edata,
      oType: "file",
      obsPath: `${serviceName}/${obsNamespace}/${tempId}`,
      params
    });
    if (oType === "image" || oType === "gif" || oType === "video") {
      const { objId: objId2, headers } = await this.uploadObjectForService({
        data: edata,
        oType: "file",
        obsPath: `${serviceName}/${obsNamespace}/${objId}__ud-preview`,
        params
      });
      if (objId !== objId2) {
        throw new InternalError("ObsError", "objId not match: " + JSON.stringify(Object.fromEntries(headers)), {
          headers: Object.fromEntries(headers)
        });
      }
    }
    const chunks = await this.client.e2ee.encryptE2EEMessage(to, {
      keyMaterial,
      fileName: filename || "line." + ext
    }, contentType);
    return await this.client.talk.sendMessage({
      to,
      chunks,
      contentType: contentType,
      contentMetadata: {
        SID: obsNamespace,
        OID: objId,
        FILE_SIZE: edata.size.toString(),
        e2eeVersion: "2",
        ...oType === "image" || oType === "gif" || oType === "video" ? {
          MEDIA_CONTENT_INFO: JSON.stringify({
            category: "original",
            fileSize: edata.size,
            extension: ext,
            animated: oType == "gif"
          })
        } : {}
      }
    });
  }
  async downloadMediaByE2EE(message) {
    if (!(message.to[0] === "u" || message.to[0] === "c")) {
      throw new InternalError("ObsError", "Invalid mid");
    }
    const { id, contentMetadata, chunks } = message;
    if (!chunks || !chunks.length) {
      return null;
    }
    const { keyMaterial, fileName } = await this.client.e2ee.decryptE2EEDataMessage(message);
    const talkMeta = Buffer.from(JSON.stringify({
      message: Buffer.from(writeStruct([
        [
          11,
          4,
          id
        ],
        [
          15,
          27,
          [
            12,
            []
          ]
        ]
      ], thrift.TBinaryProtocol)).toString("base64")
    })).toString("base64");
    const data = await this.downloadObjectForService({
      oid: contentMetadata.OID,
      obsPath: "talk/" + contentMetadata.SID,
      addHeaders: {
        "X-Talk-Meta": talkMeta
      }
    });
    const fileData = new File([
      // @ts-expect-error: will fix cuz typescript version change
      await this.client.e2ee.decryptByKeyMaterial(Buffer.from(await data.arrayBuffer()), keyMaterial)
    ], fileName);
    return fileData;
  }
}
//# sourceMappingURL=mod.js.map