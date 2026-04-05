import { BaseStorage, type Storage } from "./base.js";
/**
 * @lassdesc Mmemory Storage for LINE Client
 * @constructor
 */ export declare class MemoryStorage extends BaseStorage {
  /**
	 * Create a new MemoryStorage instance, with initial data.
	 *
	 * @param {Record<Storage["Key"], Storage["Value"]>} [extendData] - Initial data to be stored in the memory storage.
	 */ constructor(extendData?: Record<Storage["Key"], Storage["Value"]>);
  private data: any;
  public set(key: Storage["Key"], value: Storage["Value"]): Promise<void>;
  public get(key: Storage["Key"]): Promise<Storage["Value"] | undefined>;
  public delete(key: Storage["Key"]): Promise<void>;
  public clear(): Promise<void>;
  public getAll(): Record<Storage["Key"], Storage["Value"]>;
  public migrate(storage: BaseStorage): Promise<void>;
}
//# sourceMappingURL=memory.d.ts.map