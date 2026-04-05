// deno-lint-ignore-file no-explicit-any
// const TYPE: Record<string, number> = {
// 	STOP: 0,
// 	VOID: 1,
// 	BOOL: 2,
// 	BYTE: 3,
// 	I08: 3,
// 	DOUBLE: 4,
// 	I16: 6,
// 	I32: 8,
// 	I64: 10,
// 	STRING: 11,
// 	UTF7: 11,
// 	STRUCT: 12,
// 	MAP: 13,
// 	SET: 14,
// 	LIST: 15,
// 	UTF8: 16,
// 	UTF16: 17,
// };
// function getType(obj: any) {
// 	if (obj.type === "BaseType") {
// 		return TYPE[obj.baseType.toUpperCase()];
// 	} else if (obj.type === "Identifier") {
// 		return obj.name;
// 	}
// }
function isStruct(obj) {
  return obj && Array.isArray(obj);
}
export class ThriftRenameParser {
  def = {};
  #name2fid(structName, name) {
    const struct = this.def[structName];
    if (struct && Array.isArray(struct)) {
      const result = struct.findIndex((e)=>{
        return e.name == name;
      });
      if (result === -1) {
        return {
          name: name,
          fid: -1
        };
      } else {
        return struct[result];
      }
    } else {
      return {
        name: name,
        fid: -1
      };
    }
  }
  #fid2name(structName, fid) {
    const struct = this.def[structName];
    if (struct && Array.isArray(struct)) {
      const result = struct.findIndex((e)=>{
        return e.fid == fid;
      });
      if (result === -1) {
        return {
          name: fid,
          fid: fid
        };
      } else {
        return struct[result];
      }
    } else {
      return {
        name: fid,
        fid: fid
      };
    }
  }
  rename_thrift(structName, object) {
    const newObject = {};
    if (typeof object !== "object") return object;
    for(const fid in object){
      const value = object[fid];
      const finfo = this.#fid2name(structName, fid);
      if (typeof value === "undefined") {
        continue;
      }
      if (finfo.struct && (typeof value === "object" || typeof value === "number")) {
        if (isStruct(this.def[finfo.struct])) {
          newObject[finfo.name] = this.rename_thrift(finfo.struct, value);
        } else if (this.def[finfo.struct]) {
          newObject[finfo.name] = this.def[finfo.struct][value] || value;
        } else {
          newObject[finfo.name] = value;
        }
      } else if (typeof finfo.list === "string" && typeof value === "object") {
        newObject[finfo.name] = [];
        value.forEach((e, i)=>{
          newObject[finfo.name][i] = this.rename_thrift(finfo.list, e);
        });
      } else if (typeof finfo.map === "string" && typeof value === "object") {
        newObject[finfo.name] = {};
        for(const key in value){
          const e = value[key];
          newObject[finfo.name][key] = this.rename_thrift(finfo.map, e);
        }
      } else if (typeof finfo.set === "string" && typeof value === "object") {
        newObject[finfo.name] = [];
        value.forEach((e, i)=>{
          newObject[finfo.name][i] = this.rename_thrift(finfo.set, e);
        });
      } else {
        newObject[finfo.name] = value;
      }
    }
    return newObject;
  }
  rename_data(data, square) {
    const name = data._info.fname;
    const struct_name = (square ? "SquareService_" : "") + name + "_result";
    data.data = this.rename_thrift(struct_name, data.data);
    return data;
  }
}
//# sourceMappingURL=parser.js.map