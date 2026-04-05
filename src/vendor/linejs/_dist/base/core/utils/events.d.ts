import type * as LINETypes from "@jsr/evex__linejs-types";
import type { SyncData } from "../../polling/mod.js";
import type { LooseType } from "@jsr/evex__loose-types";
type LogType = "login" | "request" | "response" | (string & {
});
export interface Log {
  type: LogType;
  data: LooseType;
}
export type ClientEvents = {
  pincall: (pincode: string) => void;
  qrcall: (loginUrl: string) => void;
  ready: (user: LINETypes.Profile) => void;
  end: (user: LINETypes.Profile) => void;
  "update:authtoken": (authToken: string) => void;
  "update:profile": (profile: LINETypes.Profile) => void;
  "update:cert": (cert: string) => void;
  "update:qrcert": (qrCert: string) => void;
  "update:syncdata": (sync: SyncData) => void;
  log: (data: Log) => void;
};
//# sourceMappingURL=events.d.ts.map