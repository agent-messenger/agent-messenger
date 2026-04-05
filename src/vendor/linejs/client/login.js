/**
 * linejs client.
 * @module
 */ import { BaseClient } from "../base/mod.js";
import { Client } from "./client.js";
const createBaseClient = (init)=>new BaseClient({
    fetch: init.fetch,
    device: init.device,
    storage: init.storage
  });
export const loginWithQR = async (opts, init)=>{
  const base = createBaseClient(init);
  base.on("qrcall", opts.onReceiveQRUrl);
  base.on("pincall", opts.onPincodeRequest);
  await base.loginProcess.withQrCode({});
  await base.loginProcess.ready();
  return new Client(base);
};
export const loginWithPassword = async (opts, init)=>{
  const base = createBaseClient(init);
  base.on("pincall", opts.onPincodeRequest);
  await base.loginProcess.withPassword({
    email: opts.email,
    password: opts.password,
    pincode: opts.pincode
  });
  await base.loginProcess.ready();
  return new Client(base);
};
export const loginWithAuthToken = async (authToken, init)=>{
  const base = createBaseClient(init);
  base.authToken = authToken;
  await base.loginProcess.ready();
  return new Client(base);
};
//# sourceMappingURL=login.js.map