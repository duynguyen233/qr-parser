import { FieldLabel } from '@/components/ui/field'

interface JSONInputFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function JSONInputField({
  value,
  onChange,
  placeholder = 'Paste your JSON here...',
}: JSONInputFieldProps) {
  return (
    <div className="h-full flex flex-col">
      <FieldLabel className="mb-3 text-sm font-medium">
        Input (Escaped JSON)
      </FieldLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 w-full bg-card border border-border rounded-lg p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
        spellCheck="false"
      />
    </div>
  )
}
