import type { LooseType } from "@jsr/evex__loose-types";
export type Continuable = {
  continuationToken?: string;
  [k: string]: LooseType;
};
export declare function continueRequest<P extends Continuable, R extends Continuable, H extends (param: P) => Promise<R>>(options: {
  handler: H;
  arg: P;
}): Promise<ReturnType<H>>;
//# sourceMappingURL=continue.d.ts.map