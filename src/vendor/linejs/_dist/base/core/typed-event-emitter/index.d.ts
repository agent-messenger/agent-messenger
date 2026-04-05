import type { LooseType } from "@jsr/evex__loose-types";
type RecordEvent = Record<string, (...args: LooseType[]) => LooseType>;
export declare class TypedEventEmitter<T extends RecordEvent, E extends keyof T = keyof T> {
  public listeners: Map<E, T[E][]>;
  public on<E2 extends E>(event: E2, ...listeners: T[E2][]): this;
  public off<E2 extends E>(event: E2, ...listeners: T[E2][]): this;
  public emit<E2 extends E>(event: E2, ...args: Parameters<T[E2]>): this;
  /**
	 * This creates a promise that you can use for a single event.
	 * @param event A event name
	 */ public waitFor<E2 extends E, P = Parameters<T[E2]>>(event: E2): Promise<P>;
}
//# sourceMappingURL=index.d.ts.map