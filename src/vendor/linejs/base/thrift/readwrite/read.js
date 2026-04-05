// deno-lint-ignore-file no-explicit-any
// @ts-types="thrift-types"
import * as thrift from "thrift";
import { Buffer } from "node:buffer";
/**
 * @returns {any}
 */ function readStruct(input) {
  const Thrift = thrift.Thrift;
  const returnData = {};
  input.readStructBegin();
  while(true){
    const { ftype, fid } = input.readFieldBegin();
    if (ftype == Thrift.Type.STOP) {
      break;
    }
    returnData[fid] = readValue(input, ftype);
    input.readFieldEnd();
  }
  input.readStructEnd();
  return returnData;
}
function isBinary(bin) {
  try {
    new TextDecoder("utf-8", {
      fatal: true
    }).decode(bin);
    return false;
  } catch  {
    return true;
  }
}
function bigInt(bin) {
  const hex = bin.toString("hex");
  const value = BigInt("0x" + hex);
  if (value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value);
  }
  return value;
}
function readValue(input, ftype) {
  const Thrift = thrift.Thrift;
  if (ftype == Thrift.Type.STRUCT) {
    return readStruct(input);
  } else if (ftype == Thrift.Type.I32) {
    return input.readI32();
  } else if (ftype == Thrift.Type.I64) {
    return bigInt(input.readI64().buffer);
  } else if (ftype == Thrift.Type.STRING) {
    const bin = input.readBinary();
    if (isBinary(bin)) {
      return bin;
    } else {
      return bin.toString();
    }
  } else if (ftype == Thrift.Type.LIST) {
    const returnData = [];
    const { size, etype } = input.readListBegin();
    for(let _i = 0; _i < size; ++_i){
      returnData.push(readValue(input, etype));
    }
    input.readListEnd();
    return returnData;
  } else if (ftype == Thrift.Type.MAP) {
    const returnData = {};
    const { size, ktype, vtype } = input.readMapBegin();
    for(let _i = 0; _i < size; ++_i){
      const key = readValue(input, ktype);
      const val = readValue(input, vtype);
      returnData[key] = val;
    }
    input.readMapEnd();
    return returnData;
  } else if (ftype == Thrift.Type.SET) {
    const returnData = [];
    const { size, etype } = input.readSetBegin();
    for(let _i = 0; _i < size; ++_i){
      returnData.push(readValue(input, etype));
    }
    input.readSetEnd();
    return returnData;
  } else if (ftype == Thrift.Type.BOOL) {
    return input.readBool();
  } else if (ftype == Thrift.Type.DOUBLE) {
    return input.readDouble();
  } else if (ftype == 16) {
    // @ts-expect-error: TODO
    return input.readIString();
  } else if (ftype == 17) {
    // @ts-expect-error: TODO
    return input.readLineMid();
  } else {
    input.skip(ftype);
    return;
  }
}
function _readThrift(data, Protocol = thrift.TCompactProtocol) {
  const bufTrans = new thrift.TFramedTransport(data instanceof Buffer ? data : Buffer.from(data));
  const proto = new Protocol(bufTrans);
  const msg_info = proto.readMessageBegin();
  const tdata = readStruct(proto);
  proto.readMessageEnd();
  return {
    data: tdata,
    _info: msg_info
  };
}
export function readThrift(data, Protocol = thrift.TCompactProtocol) {
  return _readThrift(data, Protocol);
}
export function readThriftStruct(data, Protocol = thrift.TCompactProtocol) {
  const bufTrans = new thrift.TFramedTransport(data instanceof Buffer ? data : Buffer.from(data));
  const proto = new Protocol(bufTrans);
  return readStruct(proto);
}
//# sourceMappingURL=read.js.map