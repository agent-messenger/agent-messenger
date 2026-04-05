import { BaseStorage } from "./base.js";
/**
 * @lassdesc Mmemory Storage for LINE Client
 * @constructor
 */ export class MemoryStorage extends BaseStorage {
  /**
	 * Create a new MemoryStorage instance, with initial data.
	 *
	 * @param {Record<Storage["Key"], Storage["Value"]>} [extendData] - Initial data to be stored in the memory storage.
	 */ constructor(extendData){
    super();
    if (extendData) {
      this.data = new Map(Object.entries(extendData));
    }
  }
  data = new Map();
  async set(key, value) {
    await 0;
    this.data.set(key, value);
  }
  async get(key) {
    await 0;
    return this.data.get(key);
  }
  async delete(key) {
    await 0;
    this.data.delete(key);
  }
  async clear() {
    await 0;
    this.data.clear();
  }
  getAll() {
    return Object.fromEntries(this.data);
  }
  async migrate(storage) {
    const kv = this.getAll();
    for(const key in kv){
      if (Object.prototype.hasOwnProperty.call(kv, key)) {
        const value = kv[key];
        await storage.set(key, value);
      }
    }
  }
}
//# sourceMappingURL=memory.js.map