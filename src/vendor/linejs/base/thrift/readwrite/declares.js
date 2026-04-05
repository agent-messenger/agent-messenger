// @ts-types="thrift-types"
import * as thrift from "thrift";
import { Buffer } from "node:buffer";
export const genHeader = {
  3: (name)=>{
    const nameBuf = Buffer.from(String(name), "utf8");
    if (nameBuf.length > 0xff) {
      throw new RangeError("genHeader v3: name too long");
    }
    const prefix = Buffer.from([
      0x80,
      0x01,
      0x00,
      0x01,
      0x00,
      0x00,
      0x00,
      nameBuf.length
    ]);
    const suffix = Buffer.from([
      0x00,
      0x00,
      0x00,
      0x00
    ]);
    return Buffer.concat([
      prefix,
      nameBuf,
      suffix
    ]);
  },
  4: (name)=>{
    const nameBuf = Buffer.from(String(name), "utf8");
    if (nameBuf.length > 0xff) {
      throw new RangeError("genHeader v4: name too long (max 255 bytes)");
    }
    const header = Buffer.from([
      0x82,
      0x21,
      0x00,
      nameBuf.length
    ]);
    return Buffer.concat([
      header,
      nameBuf
    ]);
  }
};
export const Protocols = {
  4: thrift.TCompactProtocol,
  //4: TMoreCompactProtocol,
  3: thrift.TBinaryProtocol
};
//# sourceMappingURL=declares.js.map