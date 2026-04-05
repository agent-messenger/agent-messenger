export class InternalError extends Error {
  type;
  message;
  data;
  constructor(type, message, data = {}){
    super(message), this.type = type, this.message = message, this.data = data;
    this.name = type;
    this.data = data;
  }
}
//# sourceMappingURL=error.js.map