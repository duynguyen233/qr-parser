import Editor, { type OnMount } from '@monaco-editor/react'
import { Copy, RotateCcw, Wand2 } from 'lucide-react'
import { useRef, useState } from 'react'

export function FormatJsonTab() {
  const [input, setInput] = useState('')
  const [copied, setCopied] = useState(false)
  const editorRef = useRef<any>(null)

  const handleInputChange = (value: string | undefined) => {
    const text = value ?? ''
    setInput(text)
  }

  const handleBeautify = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(input)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setInput('')
    setCopied(false)
  }

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] gap-4">
      {/* Toolbar */}
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleCopy}
          disabled={!input}
          className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleBeautify}
          disabled={!input}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
        >
          <Wand2 className="w-4 h-4" />
          Beautify
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors flex items-center gap-2 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0 border border-gray-300 rounded-lg overflow-hidden">
        <Editor
          language="json"
          value={input}
          onChange={handleInputChange}
          onMount={handleMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 20,
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 20, bottom: 20 },
            bracketPairColorization: { enabled: true },
            formatOnPaste: false,
            formatOnType: true,
          }}
          theme="vs"
        />
      </div>
    </div>
  )
}
