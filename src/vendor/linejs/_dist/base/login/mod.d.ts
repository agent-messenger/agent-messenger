import type * as LINETypes from "@jsr/evex__linejs-types";
import { Buffer } from "node:buffer";
import type { BaseClient } from "../core/mod.js";
import type { LooseType } from "@jsr/evex__loose-types";
export type LoginOption = PasswordLoginOption | QrCodeLoginOption | {
  authToken: string;
  email?: undefined;
  qr?: undefined;
};
export interface PasswordLoginOption {
  /**
	 * account e-mail address
	 */ email: string;
  /**
	 * account password
	 */ password: string;
  /**
	 * Custom pin-code. It have to be 6-digit.
	 */ pincode?: string;
  /**
	 * use v3 login or not.
	 */ v3?: boolean;
  /**
	 * use e2ee login or not.
	 * @default true
	 */ e2ee?: boolean;
  qr?: undefined;
  authToken?: undefined;
}
export interface QrCodeLoginOption {
  email?: undefined;
  authToken?: undefined;
  qr?: true;
  /**
	 * use v3 login or not.
	 */ v3?: boolean;
}
export declare class Login {
  readonly client: BaseClient;
  cert: string | null;
  qrCert: string | null;
  constructor(client: BaseClient);
  /**
	 * @description Registers a certificate to be used for login.
	 *
	 * @param {string | null} cert - The certificate to register. If null, the certificate will be cleared.
	 */ public registerCert(cert: string, email: string): Promise<void>;
  /**
	 * @description Reads the certificate from the registered path, if it exists.
	 *
	 * @return {Promise<string | undefined>} The certificate, or undefined if it does not exist or an error occurred.
	 */ public getCert(email: string): Promise<string | undefined>;
  /**
	 * @description Registers a certificate to be used for login.
	 *
	 * @param {string | null} qrCert - The certificate to register. If null, the certificate will be cleared.
	 */ public registerQrCert(qrCert: string): Promise<void>;
  /**
	 * @description Reads the certificate from the registered path, if it exists.
	 *
	 * @return {Promise<string | undefined>} The certificate, or undefined if it does not exist or an error occurred.
	 */ public getQrCert(): Promise<string | undefined>;
  ready(): Promise<void>;
  /**
	 * Logs in the user using the provided options.
	 *
	 * Depending on the options provided, this method will:
	 * - Use QR code authentication if no options are provided or if `options.qr` is true.
	 * - Use an authentication token if `options.authToken` is provided.
	 * - Use email and password authentication if `options.email` is provided.
	 *
	 * @param {LoginOption} [options] - The login options.
	 * @param {boolean} [options.qr] - Whether to use QR code authentication.
	 * @param {boolean} [options.v3] - Whether to use version 3 of QR code authentication.
	 * @param {string} [options.authToken] - The authentication token.
	 * @param {string} [options.email] - The user's email.
	 * @param {string} [options.password] - The user's password.
	 *
	 * @example
	 * // Login with QR code
	 * await login();
	 *
	 * @example
	 * // Login with authentication token
	 * await login({ authToken: 'your-auth-token' });
	 *
	 * @example
	 * // Login with email and password
	 * await login({ email: 'user@example.com', password: 'your-password' });
	 */ login(options?: LoginOption): Promise<void>;
  /**
	 * Login with qrcode.
	 * @param options.v3 use v3 login or not.
	 */ withQrCode(options?: QrCodeLoginOption): Promise<void>;
  public requestSQR(): Promise<string>;
  public requestSQR2(): Promise<string>;
  /**
	 * Login with email and password.
	 * @param options.email account e-mail address
	 * @param options.password account password
	 * @param options.pincode Custom pin-code. It have to be 6-digit.
	 * @param options.v3 use v3 login or not.
	 * @param options.e2ee use e2ee login or not.
	 */ withPassword(options: PasswordLoginOption): Promise<void>;
  /**
	 * @description Login to LINE server with email and password.
	 *
	 * @param {string} [email] The email to login with.
	 * @param {string} [password] The password to login with.
	 * @param {boolean} [enableE2EE=false] Enable E2EE Login or not.
	 * @param {string} [constantPincode="114514"] The constant pincode.
	 * @returns {Promise<string>} The auth token.
	 * @throws {InternalError} If the system is not setup yet.
	 * @throws {InternalError} If the login type is not supported.
	 * @throws {InternalError} If the constant pincode is not valid.
	 * @emits pincall
	 * @emits update:cert
	 */ public requestEmailLogin(email: string, password: string, constantPincode?: string, enableE2EE?: boolean): Promise<string>;
  public requestEmailLoginV2(email: string, password: string, constantPincode?: string): Promise<string>;
  /**
	 * @description Get RSA key info for login.
	 *
	 * @param {number} [provider=0] Provider to get RSA key info from.
	 * @returns {Promise<LINETypes.RSAKey>} RSA key info.
	 * @throws {FetchError} If failed to fetch RSA key info.
	 */ public getRSAKeyInfo(provider?: LINETypes.IdentityProvider): Promise<LINETypes.RSAKey>;
  private loginV2: any;
  public createSession(): Promise<LooseType>;
  public createQrCode(qrcode: string): Promise<LooseType>;
  public checkQrCodeVerified(qrcode: string): Promise<boolean>;
  public verifyCertificate(qrcode: string, cert?: string | undefined): Promise<LooseType>;
  public createPinCode(qrcode: string): Promise<LooseType>;
  public checkPinCodeVerified(qrcode: string): Promise<boolean>;
  public qrCodeLogin(authSessionId: string, autoLoginIsRequired?: boolean): Promise<LooseType>;
  public qrCodeLoginV2(authSessionId: string, modelName?: string, systemName?: string, autoLoginIsRequired?: boolean): Promise<LooseType>;
  public confirmE2EELogin(verifier: string, deviceSecret: Buffer): Promise<LooseType>;
}
//# sourceMappingURL=mod.d.ts.map