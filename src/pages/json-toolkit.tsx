'use client'

import { EscapeJsonTab } from '@/components/escape-json-tab'
import { FormatJsonTab } from '@/components/format-json-tab'
import { useState } from 'react'

export default function JsonToolkit() {
  const [activeTab, setActiveTab] = useState<'escape' | 'format'>('escape')

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">JSON Toolkit</h1>
          <p className="text-gray-600">
            Escape, unescape, format, and validate your JSON with ease
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-300">
          <button
            onClick={() => setActiveTab('escape')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'escape'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Escape / Unescape
          </button>
          <button
            onClick={() => setActiveTab('format')}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === 'format'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Format & Validate
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'escape' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <EscapeJsonTab />
          </div>
        )}
        {activeTab === 'format' && (
          <div className="">
            <FormatJsonTab />
          </div>
        )}
      </div>
    </main>
  )
}
