import { FieldLabel } from '@/components/ui/field'

interface JSONOutputFieldProps {
  value: string
  isValid: boolean
  error: string
}

export default function JSONOutputField({ value, isValid, error }: JSONOutputFieldProps) {
  return (
    <div className="h-full flex flex-col">
      <FieldLabel className="mb-3 text-sm font-medium">Output (Formatted JSON)</FieldLabel>
      <div
        className={`flex-1 w-full bg-card border rounded-lg p-4 font-mono text-sm overflow-auto ${
          error && value === ''
            ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
            : isValid
              ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
              : 'border-border'
        }`}
      >
        {value ? (
          <pre className="whitespace-pre-wrap break-words text-foreground">{value}</pre>
        ) : (
          <p className="text-muted-foreground italic">
            {error ? `Error: ${error}` : 'Formatted output will appear here...'}
          </p>
        )}
      </div>
    </div>
  )
}
