export async function continueRequest(options) {
  function objectSum(base, add) {
    for(const key in add){
      if (Object.prototype.hasOwnProperty.call(add, key)) {
        const value = add[key];
        if (typeof value === "object") {
          if (!base[key]) {
            base[key] = value;
          } else {
            if (Array.isArray(value)) {
              base[key] = [
                ...value,
                ...base[key]
              ];
            } else {
              base[key] = objectSum(base[key], value);
            }
          }
        } else {
          base[key] = value;
        }
      }
    }
    return base;
  }
  let responseSum;
  let continuationToken;
  while(true){
    options.arg.continuationToken = continuationToken;
    const _response = await options.handler(options.arg);
    if (!responseSum) {
      responseSum = _response;
    } else {
      objectSum(responseSum, _response);
    }
    if (!_response.continuationToken) {
      return responseSum;
    }
    continuationToken = _response.continuationToken;
  }
}
//# sourceMappingURL=continue.js.map