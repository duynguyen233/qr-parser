export interface ParsedDataObject {
  id: string
  length: number
  value: string
  children?: ParsedDataObject[]
  name?: string
  format?: string
  description?: string
}
