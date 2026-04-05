import type { GetContactV3Response } from "@jsr/evex__linejs-types";
export interface UserInit {
  raw: GetContactV3Response;
}
export declare class User {
  readonly mid: string;
  readonly raw: GetContactV3Response;
  constructor(init: UserInit);
}
//# sourceMappingURL=mod.d.ts.map