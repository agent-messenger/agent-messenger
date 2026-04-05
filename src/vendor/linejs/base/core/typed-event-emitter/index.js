export class TypedEventEmitter {
  listeners = new Map();
  on(event, ...listeners) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    for (const listener of listeners){
      if (!(listener instanceof Function)) {
        throw new TypeError("listeners is not function");
      }
      this.listeners.get(event)?.push(listener);
    }
    return this;
  }
  off(event, ...listeners) {
    if (this.listeners.has(event)) {
      for (const listener of listeners){
        if (!this.listeners.get(event)?.includes(listener)) continue;
        this.listeners.get(event)?.splice(this.listeners.get(event)?.indexOf(listener) ?? 0, 1);
      }
    }
    return this;
  }
  emit(event, ...args) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)?.forEach((listener)=>listener(...args));
    }
    return this;
  }
  /**
	 * This creates a promise that you can use for a single event.
	 * @param event A event name
	 */ waitFor(event) {
    return new Promise((resolve)=>{
      const listener = (...args)=>{
        this.off(event, listener);
        resolve(args);
      };
      this.on(event, listener);
    });
  }
}
//# sourceMappingURL=index.js.map