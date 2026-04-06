export function unescapeString(str: string): string {
  return str
    .replace(/\\\\/g, '\\') // backslash first
    .replace(/\\"/g, '"')
    .replace(/\\b/g, '\b')
    .replace(/\\f/g, '\f')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
}

export function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // backslash first
    .replace(/"/g, '\\"')
    .replace(/\b/g, '\\b')
    .replace(/\f/g, '\\f')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

export interface JsonError {
  message: string
  line: number
  column: number
  type: 'syntax' | 'structure'
  suggestion?: string
}

export function parseAndFormatJson(input: string): {
  formatted: string
  errors: JsonError[]
  isValid: boolean
} {
  const errors: JsonError[] = []

  if (!input || input.trim().length === 0) {
    return { formatted: '', errors, isValid: false }
  }

  try {
    // First try to parse the JSON
    const parsed = JSON.parse(input)
    const formatted = JSON.stringify(parsed, null, 2)
    return { formatted, errors, isValid: true }
  } catch (e) {
    // If parsing fails, try to detect common errors
    const errorMessage = (e as Error).message
    const trimmedInput = input.trim()

    // Check for common formatting issues
    if (errorMessage.includes('Unexpected token')) {
      const match = errorMessage.match(/position (\d+)/)
      if (match) {
        const position = parseInt(match[1], 10)
        const line = input.substring(0, position).split('\n').length
        const lastNewline = input.lastIndexOf('\n', position)
        const column = position - (lastNewline === -1 ? 0 : lastNewline + 1)

        // Determine the type of error
        const char = trimmedInput[trimmedInput.length - 1]
        if (char === ',') {
          errors.push({
            message: 'Trailing comma found',
            line,
            column,
            type: 'syntax',
            suggestion: 'Remove the trailing comma before "}" or "]"',
          })
        } else if (char === '{' || char === '[') {
          errors.push({
            message: 'Missing closing bracket/brace',
            line,
            column,
            type: 'structure',
            suggestion: `Add "${char === '{' ? '}' : ']'}" at the end`,
          })
        } else {
          errors.push({
            message: `Unexpected character "${char}" at position ${position}`,
            line,
            column,
            type: 'syntax',
          })
        }
      }
    }

    if (trimmedInput.endsWith('}') === false && trimmedInput.endsWith(']') === false) {
      const openBraces = (trimmedInput.match(/{/g) || []).length
      const closeBraces = (trimmedInput.match(/}/g) || []).length
      const openBrackets = (trimmedInput.match(/\[/g) || []).length
      const closeBrackets = (trimmedInput.match(/\]/g) || []).length

      if (openBraces > closeBraces) {
        errors.push({
          message: `Missing ${openBraces - closeBraces} closing brace(s)`,
          line: trimmedInput.split('\n').length,
          column: trimmedInput.split('\n').pop()?.length || 0,
          type: 'structure',
          suggestion: `Add ${openBraces - closeBraces} "}"`,
        })
      }

      if (openBrackets > closeBrackets) {
        errors.push({
          message: `Missing ${openBrackets - closeBrackets} closing bracket(s)`,
          line: trimmedInput.split('\n').length,
          column: trimmedInput.split('\n').pop()?.length || 0,
          type: 'structure',
          suggestion: `Add ${openBrackets - closeBrackets} "]"`,
        })
      }
    }

    if (errorMessage.includes('Unexpected token') && errors.length === 0) {
      errors.push({
        message: 'Invalid JSON format',
        line: 1,
        column: 1,
        type: 'syntax',
        suggestion: 'Check for missing quotes, commas, or incorrect bracket placement',
      })
    }

    // Try to beautify what we can
    try {
      const partially = input.replace(/([{,]\s*)/g, '$1\n  ').replace(/([}\]]\s*)/g, '\n$1')
      return { formatted: partially, errors, isValid: false }
    } catch {
      return { formatted: input, errors, isValid: false }
    }
  }
}
