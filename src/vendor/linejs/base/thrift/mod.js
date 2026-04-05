export { Protocols } from "./readwrite/declares.js";
export * as LINEStruct from "./readwrite/struct.js";
import { ThriftRenameParser } from "./rename/parser.js";
import { readThrift, readThriftStruct } from "./readwrite/read.js";
import { writeThrift } from "./readwrite/write.js";
/**
 * Thrift Client
 */ export class Thrift extends ThriftRenameParser {
  constructor(){
    super();
  }
  readThrift(...params) {
    return readThrift(...params);
  }
  readThriftStruct(...params) {
    return readThriftStruct(...params);
  }
  writeThrift(...params) {
    return writeThrift(...params);
  }
}
//# sourceMappingURL=mod.js.map