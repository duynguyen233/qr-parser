export interface ParsedDataObject {
  id: string
  length: string
  value: string
  children?: ParsedDataObject[]
  name?: string
  format?: string
  description?: string
}
