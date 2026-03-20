import { BSON } from 'bson'

import { LOCO_BODY_TYPE_BSON, LOCO_HEADER_SIZE, type LocoPacket } from './types'

export function encodePacket(packet: LocoPacket): Buffer {
  const bsonBody = BSON.serialize(packet.body)

  const methodBuf = Buffer.alloc(11)
  methodBuf.write(packet.method, 'ascii')

  const header = Buffer.alloc(LOCO_HEADER_SIZE)
  header.writeUInt32LE(packet.packetId, 0)
  header.writeInt16LE(packet.statusCode, 4)
  methodBuf.copy(header, 6)
  header.writeUInt8(packet.bodyType, 17)
  header.writeUInt32LE(bsonBody.length, 18)

  return Buffer.concat([header, bsonBody])
}

export function decodePacket(data: Buffer): { packet: LocoPacket; bytesConsumed: number } | null {
  if (data.length < LOCO_HEADER_SIZE) return null

  const bodyLength = data.readUInt32LE(18)
  const totalLength = LOCO_HEADER_SIZE + bodyLength
  if (data.length < totalLength) return null

  const packetId = data.readUInt32LE(0)
  const statusCode = data.readInt16LE(4)

  const methodBuf = data.subarray(6, 17)
  const nullIdx = methodBuf.indexOf(0)
  const method = methodBuf.subarray(0, nullIdx === -1 ? 11 : nullIdx).toString('ascii')

  const bodyType = data.readUInt8(17)
  const bodyBuf = data.subarray(LOCO_HEADER_SIZE, totalLength)

  let body: Record<string, unknown> = {}
  if (bodyType === LOCO_BODY_TYPE_BSON && bodyLength > 0) {
    body = BSON.deserialize(bodyBuf, { promoteValues: true }) as Record<string, unknown>
  }

  return {
    packet: { packetId, statusCode, method, bodyType, body },
    bytesConsumed: totalLength,
  }
}
