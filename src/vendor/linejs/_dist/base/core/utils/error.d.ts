import type { LooseType } from "@jsr/evex__loose-types";
export declare class InternalError extends Error {
  readonly type: string;
  readonly message: string;
  readonly data: Record<string, LooseType>;
  constructor(type: string, message: string, data?: Record<string, LooseType>);
}
//# sourceMappingURL=error.d.ts.map