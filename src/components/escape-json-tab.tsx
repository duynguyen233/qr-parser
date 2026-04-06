'use client'

import { escapeString, unescapeString } from '@/lib/json-utils'
import { Copy, RotateCcw } from 'lucide-react'
import { useState } from 'react'

export function EscapeJsonTab() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [copied, setCopied] = useState(false)
  const [mode, setMode] = useState<'escape' | 'unescape'>('unescape')

  const handleTransform = (text: string) => {
    if (mode === 'escape') {
      const result = escapeString(text)
      setOutput(result)
    } else {
      const result = unescapeString(text)
      setOutput(result)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setInput(text)
    handleTransform(text)
  }

  const handleModeChange = (newMode: 'escape' | 'unescape') => {
    setMode(newMode)
    if (input) {
      if (newMode === 'escape') {
        setOutput(escapeString(input))
      } else {
        setOutput(unescapeString(input))
      }
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setInput('')
    setOutput('')
    setCopied(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => handleModeChange('escape')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'escape'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Escape String
        </button>
        <button
          onClick={() => handleModeChange('unescape')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            mode === 'unescape'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Unescape String
        </button>
        <button
          onClick={handleReset}
          className="ml-auto px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors flex items-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <label className="text-sm font-semibold text-gray-700 mb-2">Input</label>
          <textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Paste your string here..."
            className="flex-1 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ minHeight: '400px' }}
          />
        </div>

        <div className="flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-gray-700">Output</label>
            <button
              onClick={handleCopy}
              disabled={!output}
              className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 transition-colors flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="Escaped/Unescaped output will appear here..."
            className="flex-1 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none bg-gray-50 focus:outline-none"
            style={{ minHeight: '400px' }}
          />
        </div>
      </div>
    </div>
  )
}
