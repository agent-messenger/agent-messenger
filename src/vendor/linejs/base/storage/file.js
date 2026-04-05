import * as fs from "node:fs";
import { BaseStorage } from "./base.js";
/**
 * @classdesc File Storage for LINE Client
 * @constructor
 */ export class FileStorage extends BaseStorage {
  path;
  /**
	 * @description Construct a FileStorage with the given path and data.
	 *
	 * @param {string} path - The path to the file.
	 * @param {string} [extendData] - The data to extend the file with. If the file does not exist, it will be created with the given data. If the file does exist, the data will be appended to the file. If no data is given, the file will be created with an empty object.
	 */ constructor(path, extendData){
    super(), this.path = path;
    try {
      fs.readFileSync(this.path, "utf-8");
      if (extendData) {
        fs.writeFileSync(this.path, extendData, "utf-8");
      }
    } catch (_e) {
      fs.writeFileSync(this.path, extendData || "{}", "utf-8");
    }
  }
  async set(key, value) {
    const data = await this.getAll();
    data[key] = value;
    await new Promise((resolve)=>{
      fs.writeFile(this.path, JSON.stringify(data), "utf-8", resolve);
    });
  }
  async get(key) {
    const data = await this.getAll();
    return data[key];
  }
  async delete(key) {
    const data = await this.getAll();
    delete data[key];
    await new Promise((resolve)=>{
      fs.writeFile(this.path, JSON.stringify(data), "utf-8", resolve);
    });
  }
  async clear() {
    await new Promise((resolve)=>{
      fs.writeFile(this.path, "{}", "utf-8", resolve);
    });
  }
  async getAll() {
    const file = await new Promise((resolve)=>{
      fs.readFile(this.path, "utf-8", (_e, data)=>resolve(data));
    });
    return JSON.parse(file || "{}");
  }
  async migrate(storage) {
    const kv = await this.getAll();
    for(const key in kv){
      if (Object.prototype.hasOwnProperty.call(kv, key)) {
        const value = kv[key];
        await storage.set(key, value);
      }
    }
  }
}
//# sourceMappingURL=file.js.map