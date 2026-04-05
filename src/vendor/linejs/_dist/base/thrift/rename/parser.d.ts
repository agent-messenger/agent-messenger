import type { ParsedThrift } from "../readwrite/declares.js";
export declare class ThriftRenameParser {
  def: Record<string, Record<string, string> | any[]>;
  rename_thrift(structName: string, object: any): any;
  rename_data(data: ParsedThrift, square?: boolean): ParsedThrift;
}
//# sourceMappingURL=parser.d.ts.map