import { DATA_OBJECT_DEFINITIONS } from '@/constants/emvco'
import type { ParsedDataObject } from '@/types/parsed-object'

const CRC_CHECKSUM = '63'

class QRParser {
  private data: string
  private index: number

  constructor(data: string) {
    this.data = data
    this.index = 0
  }

  private parseDataObject(parentId?: string, grandParentId?: string): ParsedDataObject {
    const ID_SIZE = 2
    const LEN_SIZE = 2

    // Extract ID
    const id = this.data.substring(this.index, this.index + ID_SIZE)
    this.index += ID_SIZE

    if (this.data.length < this.index + LEN_SIZE) {
      throw new Error(
        `Data too short for ID ${id}: expected at least ${LEN_SIZE} characters, got ${
          this.data.length - this.index + 1
        }`,
      )
    }

    // Extract length
    const lengthStr = this.data.substring(this.index, this.index + LEN_SIZE)
    this.index += LEN_SIZE

    const length = parseInt(lengthStr, 10)
    if (isNaN(length)) {
      throw new Error(`Invalid payload length: ${lengthStr}`)
    }

    if (this.data.length < this.index + length) {
      throw new Error(
        `Data too short for payload at id ${id}: expected ${length} characters, got ${
          this.data.length - this.index
        }`,
      )
    }

    // Extract value
    const value = this.data.substring(this.index, this.index + length)
    this.index += length

    // Get metadata from definitions
    const definition = this.getDefinition(id, parentId, grandParentId)
    let description = definition?.description
    if (definition?.payload_description) {
      const payloadDescription = definition.payload_description[value] || value
      description = definition.description + `\n${value}:${payloadDescription}`
    }

    const dataObject: ParsedDataObject = {
      id,
      length: lengthStr,
      value,
      name: definition?.name,
      format: definition?.format,
      description: description,
    }

    // Parse children if this is a structured field
    if (definition?.subFields && this.isStructuredField(id)) {
      dataObject.children = this.parseChildren(value, definition.subFields, id)
    }

    return dataObject
  }

  private parseChildren(
    childData: string,
    subFieldDefs: Record<string, any>,
    parentId?: string,
    grandParentId?: string,
  ): ParsedDataObject[] {
    const children: ParsedDataObject[] = []
    const childParser = new QRParser(childData)

    while (childParser.index < childData.length) {
      const child = childParser.parseDataObject(parentId, grandParentId)

      // Special handling for VietQR field 38, sub-field 01
      if (parentId === '38' && child.id === '01') {
        // Field 01 in VietQR contains nested sub-fields
        const subFieldDef = subFieldDefs[child.id]
        if (subFieldDef?.subFields) {
          child.children = this.parseChildren(
            child.value,
            subFieldDef.subFields,
            child.id,
            parentId,
          )
        }
      }

      children.push(child)
    }

    return children
  }

  private getDefinition(id: string, parentId?: string, grandParentId?: string) {
    if (grandParentId) {
      const grandParentDefinition: any = this.getDefinition(grandParentId)
      if (grandParentId && grandParentDefinition && parentId) {
        const parentDefinition: any = this.getDefinition(parentId, grandParentId)
        if (parentDefinition && parentDefinition.subFields?.[id]) {
          return parentDefinition.subFields[id]
        }
        for (const [key, definition] of Object.entries(grandParentDefinition.subFields || {})) {
          if (key.includes('-')) {
            const [start, end] = key.split('-')
            const idNum = parseInt(id, 10)
            const startNum = parseInt(start, 10)
            const endNum = parseInt(end, 10)

            if (idNum >= startNum && idNum <= endNum) {
              return definition
            }
          }
        }
      }
      return
    }
    if (parentId) {
      const parentDefinition: any = this.getDefinition(parentId)
      if (parentDefinition) {
        if (parentDefinition.subFields?.[id]) {
          return parentDefinition.subFields[id]
        }
        for (const [key, definition] of Object.entries(parentDefinition.subFields || {})) {
          if (key.includes('-')) {
            const [start, end] = key.split('-')
            const idNum = parseInt(id, 10)
            const startNum = parseInt(start, 10)
            const endNum = parseInt(end, 10)

            if (idNum >= startNum && idNum <= endNum) {
              return definition
            }
          }
        }
      }
    }
    // Check exact match first
    if (DATA_OBJECT_DEFINITIONS[id]) {
      return DATA_OBJECT_DEFINITIONS[id]
    }

    // Check range matches
    for (const [key, definition] of Object.entries(DATA_OBJECT_DEFINITIONS)) {
      if (key.includes('-')) {
        const [start, end] = key.split('-')
        const idNum = parseInt(id, 10)
        const startNum = parseInt(start, 10)
        const endNum = parseInt(end, 10)

        if (idNum >= startNum && idNum <= endNum) {
          return definition
        }
      }
    }

    return null
  }

  private isStructuredField(id: string): boolean {
    const idNum = parseInt(id, 10)

    // Fields that contain sub-fields
    return (
      (idNum >= 26 && idNum <= 51) || // Merchant Account Information Templates
      idNum === 38 || // VietQR Code through NAPAS
      idNum === 62 || // Additional Data Field Template
      idNum === 64 // Merchant Information—Language Template
    )
  }

  public parse(): ParsedDataObject[] {
    const result: ParsedDataObject[] = []
    this.index = 0

    while (this.index < this.data.length) {
      const dataObject = this.parseDataObject()
      result.push(dataObject)
    }

    return result
  }
}

// Main parsing function
export function parseQRCode(data: string): ParsedDataObject[] {
  if (!data) {
    throw new Error('Data cannot be empty')
  }

  const parser = new QRParser(data)
  return parser.parse()
}

// Helper function to format parsed data for display
function formatParsedData(parsedData: ParsedDataObject[], indent: number = 0): string {
  let result = ''
  const indentStr = '. '.repeat(indent)

  for (const item of parsedData) {
    result += `${indentStr}${item.id} ${item.length}`
    if (!item.children || item.children.length === 0) {
      result += ` ${item.value}`
    }
    result += '\n'

    if (item.children && item.children.length > 0) {
      result += formatParsedData(item.children, indent + 3)
    }
  }

  return result
}

function calculateCrc16IBM3740(data: string | Uint8Array): number {
  let crc = 0xffff
  const crcTable: number[] = [
    0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108, 0x9129, 0xa14a, 0xb16b,
    0xc18c, 0xd1ad, 0xe1ce, 0xf1ef, 0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6,
    0x9339, 0x8318, 0xb37b, 0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401,
    0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d,
    0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4, 0xb75b, 0xa77a, 0x9719, 0x8738,
    0xf7df, 0xe7fe, 0xd79d, 0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
    0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5, 0x4ad4, 0x7ab7, 0x6a96,
    0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a,
    0x6ca6, 0x7c87, 0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd,
    0xad2a, 0xbd0b, 0x8d68, 0x9d49, 0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70,
    0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a, 0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb,
    0xd10c, 0xc12d, 0xf14e, 0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
    0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1, 0x1290, 0x22f3, 0x32d2,
    0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d,
    0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8,
    0xe75f, 0xf77e, 0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634,
    0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9, 0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827,
    0x18c0, 0x08e1, 0x3882, 0x28a3, 0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
    0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92, 0xfd2e, 0xed0f, 0xdd6c, 0xcd4d,
    0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1,
    0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74,
    0x2e93, 0x3eb2, 0x0ed1, 0x1ef0,
  ]

  // Convert string to Uint8Array if necessary
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data

  // Calculate CRC
  for (let i = 0; i < bytes.length; i++) {
    const tblIdx = ((crc >> 8) ^ bytes[i]) & 0xff
    crc = ((crc << 8) & 0xffff) ^ crcTable[tblIdx]
  }

  return crc ^ 0x0000
}

function validateCRC(data: ParsedDataObject[]) {
  if (!data || data.length === 0) {
    throw new Error('Data cannot be empty for CRC validation')
  }
  const crcChecksum = data.find((item) => item.id === CRC_CHECKSUM)
  if (!crcChecksum) {
    throw new Error('CRC checksum not found in data')
  }
  const dataWithoutCRC = data
    .filter((item) => item.id !== CRC_CHECKSUM)
    .map((item) => `${item.id}${item.length.toString().padStart(2, '0')}${item.value}`)
    .join('')
  const checkSumValue = calculateCrc16IBM3740(
    dataWithoutCRC + `${crcChecksum.id}${crcChecksum.length}`,
  )
    .toString(16)
    .padStart(4, '0')
    .toUpperCase()
  if (checkSumValue !== crcChecksum.value) {
    throw new Error(`CRC checksum mismatch: expected ${checkSumValue}, got ${crcChecksum.value}`)
  }
}

function getRawDataStringForCRC(dataObjects: ParsedDataObject[]): string {
  return dataObjects
    .map((item) => {
      if (item.id === CRC_CHECKSUM) {
        // Exclude the CRC field itself from the data string for calculation
        return ''
      }
      if (item.children && item.children.length > 0) {
        // For structured fields, concatenate their ID, Length, and then the raw data of their children
        const childrenRawData = getRawDataStringForCRC(item.children)
        return `${item.id}${item.length}${childrenRawData}`
      }
      // For simple fields, concatenate ID, Length, and Value
      return `${item.id}${item.length}${item.value}`
    })
    .join('')
}

export function updateCRCInParsedObject(currentQrObject: ParsedDataObject[]): ParsedDataObject[] {
  const crcIndex = currentQrObject.findIndex((item) => item.id === CRC_CHECKSUM)
  if (crcIndex === -1) {
    // If CRC object doesn't exist, return as is.
    return currentQrObject
  }

  const dataForCrcCalculation = getRawDataStringForCRC(currentQrObject)

  // The CRC calculation includes the ID and Length of the CRC field itself
  // The length of the CRC field is always 4 (for the 4-character hex value)
  const crcDataForCalculation = dataForCrcCalculation + `${CRC_CHECKSUM}04`

  const newCrcValue = calculateCrc16IBM3740(crcDataForCalculation)
    .toString(16)
    .toUpperCase()
    .padStart(4, '0') // Ensure it's 4 characters long

  const updatedQrObject = JSON.parse(JSON.stringify(currentQrObject)) // Deep copy to avoid direct mutation
  const crcObject = updatedQrObject[crcIndex]

  crcObject.value = newCrcValue
  crcObject.length = newCrcValue.length.toString().padStart(2, '0')

  return updatedQrObject
}

export { calculateCrc16IBM3740, formatParsedData, validateCRC }
