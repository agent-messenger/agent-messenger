import type { BaseClient } from "../core/mod.js";
import type { ProtocolKey } from "../thrift/mod.js";
export interface BaseService {
  client: BaseClient;
  protocolType: ProtocolKey;
  requestPath: string;
  errorName: string;
}
//# sourceMappingURL=types.d.ts.map