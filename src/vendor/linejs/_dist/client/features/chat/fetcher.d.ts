import { TalkMessage } from "../message/mod.js";
export interface MessageFetcher {
  fetch: (limit: number) => Promise<TalkMessage[]>;
}
//# sourceMappingURL=fetcher.d.ts.map