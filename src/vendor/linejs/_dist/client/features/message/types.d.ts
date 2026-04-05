import type { MIDType } from "@jsr/evex__linejs-types";
export type MentionTarget = {
  all: true;
} | {
  all: false;
  mid: string;
};
export type DecorationsData = {
  text: string;
  emoji?: {
    productId: string;
    sticonId: string;
    version?: number;
    resourceType?: string;
    url?: string;
  };
  mention?: {
    mid: string;
    all?: undefined;
  } | {
    mid?: undefined;
    all: boolean;
  };
};
export interface Mid {
  id: string;
  type: MIDType;
}
//# sourceMappingURL=types.d.ts.map