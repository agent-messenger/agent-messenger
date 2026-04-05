export declare enum LegyH2PushFrameType {
  NONE = 0,
  ACK = 1,
  ACK_REQUIRED = 2
}
export declare class LegyH2Frame {
  frameType: number;
  constructor(frameType: number);
  requestPacket(payload: Uint8Array): Uint8Array;
}
export declare class LegyH2PushFrame extends LegyH2Frame {
  pushType?: LegyH2PushFrameType;
  serviceType?: number;
  pushId?: number;
  pushPayload?: Uint8Array;
  constructor(pushType?: number, serviceType?: number, pushId?: number, pushPayload?: Uint8Array);
  ackPacket(): Uint8Array;
}
//# sourceMappingURL=connData.d.ts.map