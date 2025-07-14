import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ParsedDataObject } from '@/types/parsed-object'
import { parseQRCode, updateCRCInParsedObject, validateCRC } from '@/utils/parse-qr'
import jsQR from 'jsqr'
import {
  AlertCircle,
  Camera,
  CheckCircle,
  ClipboardCheck,
  Copy,
  Download,
  QrCode,
  Upload,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'react-qr-code'

export default function QRCodeParser() {
  const [qrData, setQrData] = useState('')
  const [qrObject, setQRObject] = useState<ParsedDataObject[]>([])
  const [error, setError] = useState('')
  const [isValid, setIsValid] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPasting, setIsPasting] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>(
    'prompt',
  )

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const scanIntervalRef = useRef<any>(null)

  const handleParse = () => {
    try {
      setError('')
      if (!qrData.trim()) {
        setError('Please enter QR code data')
        return
      }
      if (qrData.length < 4) {
        setError('QR code data too short')
        return
      }
      const initialQrObject = parseQRCode(qrData)
      validateCRC(initialQrObject) // Validate original CRC [^vercel_knowledge_base]
      const updatedQrObjectWithCRC = updateCRCInParsedObject(initialQrObject) // Recalculate and update CRC
      setQRObject(updatedQrObjectWithCRC)
      setIsValid(true) // Now it's valid because we've updated the CRC to match
    } catch (error) {
      setQRObject([])
      setError(
        'Failed to parse QR code data - ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
      setIsValid(false) // Set to false if initial parsing or validation fails
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(qrData)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      setError('Failed to copy to clipboard')
    }
  }

  const handleClear = () => {
    setQrData('')
    setQRObject([])
    setError('')
    setIsValid(false)
    setUploadedImage(null)
  }

  const downloadQR = () => {
    try {
      // Create a temporary canvas to render the QR code
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('Failed to create canvas context')
        return
      }

      // Set canvas size (add padding around QR code)
      const qrSize = 290
      const padding = 40
      canvas.width = qrSize + padding * 2
      canvas.height = qrSize + padding * 2

      // Fill background with white
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Get the QR code SVG element
      const qrSvg = document.querySelector('#qr-code-svg') as SVGElement
      if (!qrSvg) {
        setError('QR code not found')
        return
      }

      // Convert SVG to canvas
      const svgData = new XMLSerializer().serializeToString(qrSvg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const img = new window.Image()
      img.onload = () => {
        // Draw QR code on canvas with padding
        ctx.drawImage(img, padding, padding, qrSize, qrSize)

        // Convert canvas to download
        const pngUrl = canvas.toDataURL('image/png')
        const downloadLink = document.createElement('a')
        downloadLink.href = pngUrl
        downloadLink.download = `qr-code-${Date.now()}.png`
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)

        // Clean up
        URL.revokeObjectURL(svgUrl)
      }
      img.onerror = () => {
        setError('Failed to load QR code for download')
        URL.revokeObjectURL(svgUrl)
      }
      img.src = svgUrl
    } catch (error) {
      setError(
        'Failed to download QR code: ' + (error instanceof Error ? error.message : 'Unknown error'),
      )
    }
  }

  const processImageFile = async (file: File) => {
    setIsProcessing(true)
    setError('')
    try {
      // Create image preview
      const imageUrl = URL.createObjectURL(file)
      setUploadedImage(imageUrl)

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new window.Image()
      img.crossOrigin = 'anonymous' // Set crossOrigin to avoid CORS issues [^vercel_knowledge_base]

      const qrData = await new Promise<string>((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx?.drawImage(img, 0, 0)
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
          if (!imageData) {
            reject(new Error('Failed to get image data'))
            return
          }
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height)
          if (qrCode) {
            resolve(qrCode.data)
          } else {
            reject(new Error('No QR code found in image'))
          }
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageUrl
      })
      setQrData(qrData)
      handleParseData(qrData)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to scan QR code from image. Please ensure the image contains a clear QR code.',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processImageFile(file)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleParseData = (data: string) => {
    try {
      setError('')
      if (!data) {
        return
      }
      const initialQrObject = parseQRCode(data)
      validateCRC(initialQrObject) // Validate original CRC [^vercel_knowledge_base]
      const updatedQrObjectWithCRC = updateCRCInParsedObject(initialQrObject) // Recalculate and update CRC
      setQRObject(updatedQrObjectWithCRC)
      setIsValid(true) // Now it's valid because we've updated the CRC to match
    } catch (error) {
      setError(
        'Failed to parse QR code data - ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
      setQRObject([])
      setIsValid(false) // Set to false if initial parsing or validation fails
    }
  }

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const imageFile = files.find((file) => file.type.startsWith('image/'))
    if (imageFile) {
      await processImageFile(imageFile)
    } else {
      setError('Please drop an image file')
    }
  }

  // Clipboard paste handlers
  const handlePaste = async (e: React.ClipboardEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsPasting(true)
    setError('')
    try {
      const items = Array.from(e.clipboardData.items)
      const imageItem = items.find((item) => item.type.startsWith('image/'))
      const textItem = items.find((item) => item.type === 'text/plain')

      if (imageItem) {
        const file = imageItem.getAsFile()
        if (file) {
          await processImageFile(file)
        } else {
          setError('Failed to get image from clipboard')
        }
      } else if (textItem) {
        textItem.getAsString((text) => {
          setQrData(text)
          handleParseData(text) // Parse pasted text data
        })
      } else {
        setError('No image or text found in clipboard. Please copy an image or text first.')
      }
    } catch (error) {
      setError(
        'Failed to process pasted content: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
    } finally {
      setIsPasting(false)
    }
  }

  // Global paste handler
  const handleGlobalPaste = async (e: KeyboardEvent) => {
    // Only trigger if Ctrl+V is pressed and the dropZoneRef is the active element
    if (e.ctrlKey && e.key === 'v' && document.activeElement === dropZoneRef.current) {
      try {
        const clipboardItems = await navigator.clipboard.read()
        for (const clipboardItem of clipboardItems) {
          for (const type of clipboardItem.types) {
            if (type.startsWith('image/')) {
              setIsPasting(true)
              const blob = await clipboardItem.getType(type)
              const file = new File([blob], 'pasted-image.png', { type })
              await processImageFile(file)
              setIsPasting(false)
              return
            } else if (type === 'text/plain') {
              setIsPasting(true)
              const textBlob = await clipboardItem.getType(type)
              const text = await textBlob.text()
              setQrData(text)
              handleParseData(text)
              setIsPasting(false)
              return
            }
          }
        }
        setError('No image or text found in clipboard. Please copy an image or text first.')
      } catch (error) {
        setIsPasting(false)
        setError('Failed to access clipboard. Please try pasting directly in the drop zone.')
      }
    }
  }

  const startCamera = async () => {
    try {
      setError('')
      setIsScanning(true)
      const permissionsStatus = await navigator.permissions.query({
        name: 'camera',
      })
      if (permissionsStatus.state === 'denied') {
        setError(
          'Camera access denied. Please click the camera icon in the address bar and allow camera access, then try again.',
        )
        return
      }
      if (!videoRef.current) return
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser')
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      setCameraPermission('granted')
      videoRef.current.srcObject = stream
      videoRef.current.play()
      requestAnimationFrame(startQRScanning)
    } catch (error) {
      setIsScanning(false)
      setCameraPermission('denied')
      if (error instanceof Error) {
        switch (error.name) {
          case 'NotAllowedError':
            setError(
              'Camera access denied. Please click the camera icon in the address bar and allow camera access, then try again.',
            )
            break
          case 'NotFoundError':
            setError('No camera found. Please ensure a camera is connected to your device.')
            break
          case 'NotReadableError':
            setError(
              'Camera is already in use by another application. Please close other camera apps and try again.',
            )
            break
          case 'OverconstrainedError':
            setError('Camera constraints not supported. Trying with basic settings...')
            setTimeout(() => startCameraWithBasicConstraints(), 1000)
            break
          case 'SecurityError':
            setError(
              "Camera access blocked due to security settings. Please ensure you're on HTTPS or localhost.",
            )
            break
          default:
            setError(
              `Camera error: ${error.message}. Please check your camera permissions and try again.`,
            )
        }
      } else {
        setError('Failed to access camera. Please ensure camera permissions are granted.')
      }
    }
  }

  const startCameraWithBasicConstraints = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      if (videoRef.current) {
        setCameraPermission('granted')
        videoRef.current.srcObject = stream
        setIsScanning(true)
        setError('')
        videoRef.current.onloadedmetadata = () => {
          startQRScanning()
        }
      }
    } catch (error) {
      setError(
        'Failed to access camera even with basic settings. Please check your camera permissions.',
      )
      setIsScanning(false)
      setCameraPermission('denied')
    }
  }

  const startQRScanning = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height)

      if (qrCode && qrCode.data) {
        handleParseData(qrCode.data)
        setQrData(qrCode.data)

        // Crop the QR code area from the video frame
        const { location } = qrCode
        const minX = Math.min(
          location.topLeftCorner.x,
          location.topRightCorner.x,
          location.bottomLeftCorner.x,
          location.bottomRightCorner.x,
        )
        const maxX = Math.max(
          location.topLeftCorner.x,
          location.topRightCorner.x,
          location.bottomLeftCorner.x,
          location.bottomRightCorner.x,
        )
        const minY = Math.min(
          location.topLeftCorner.y,
          location.topRightCorner.y,
          location.bottomLeftCorner.y,
          location.bottomRightCorner.y,
        )
        const maxY = Math.max(
          location.topLeftCorner.y,
          location.topRightCorner.y,
          location.bottomLeftCorner.y,
          location.bottomRightCorner.y,
        )
        const width = maxX - minX
        const height = maxY - minY

        // Create a new canvas for the cropped QR code
        const croppedCanvas = document.createElement('canvas')
        croppedCanvas.width = width
        croppedCanvas.height = height
        const croppedCtx = croppedCanvas.getContext('2d')
        if (croppedCtx) {
          croppedCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height)
          setUploadedImage(croppedCanvas.toDataURL('image/png'))
        }
        stopCamera()
      }
    }
    scanIntervalRef.current = requestAnimationFrame(startQRScanning)
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
    setIsScanning(false)
    if (scanIntervalRef.current) {
      cancelAnimationFrame(scanIntervalRef.current)
    }
  }

  // Modified: This function now only updates the qrObject state without recalculating CRC
  const updateParsedObjectField = useCallback(
    (id: string, newValue: string, objectPath: string[]) => {
      setQRObject((prev) => {
        const updateRecursive = (
          items: ParsedDataObject[],
          currentPath: string[],
        ): ParsedDataObject[] => {
          let changed = false // Flag to track if any item in this level changed
          const newItems = items.map((item) => {
            let updatedItem = item // Start with original item reference

            if (item.id === id && JSON.stringify(currentPath) === JSON.stringify(objectPath)) {
              // Only update if value or length actually changed
              if (
                item.value !== newValue ||
                item.length !== newValue.length.toString().padStart(2, '0')
              ) {
                updatedItem = {
                  ...item,
                  value: newValue,
                  length: newValue.length.toString().padStart(2, '0'),
                }
                changed = true
              }
            } else if (item.children && item.children.length > 0) {
              // Recurse into children
              const newPath = [...currentPath, item.id]
              const updatedChildren = updateRecursive(item.children, newPath)
              if (updatedChildren !== item.children) {
                // If children array actually changed, update parent's value and length
                const childrenData = updatedChildren
                  .map((c) => `${c.id}${c.length}${c.value}`)
                  .join('')
                if (
                  item.value !== childrenData ||
                  item.length !== childrenData.length.toString().padStart(2, '0')
                ) {
                  updatedItem = {
                    ...item,
                    children: updatedChildren,
                    value: childrenData,
                    length: childrenData.length.toString().padStart(2, '0'),
                  }
                } else {
                  // If children changed but parent's value/length derived from children didn't,
                  // just update the children reference.
                  updatedItem = { ...item, children: updatedChildren }
                }
                changed = true
              }
            }
            return updatedItem
          })
          // Return new array only if something changed in this level
          return changed ? newItems : items
        }
        const updated = updateRecursive(prev, [])

        return updateCRCInParsedObject(updated)
      })
    },
    [], // No dependencies needed as it uses functional update for setQRObject
  )

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalPaste)
    return () => {
      stopCamera()
      document.removeEventListener('keydown', handleGlobalPaste)
    }
  }, [])

  // Effect to keep qrData in sync with qrObject and debounce CRC calculation
  useEffect(() => {
    const reconstructQrData = (objects: ParsedDataObject[]): string => {
      return objects
        .map((obj) => {
          return `${obj.id}${obj.length}${obj.value}`
        })
        .join('')
    }

    if (qrObject.length > 0) {
      const newQrData = reconstructQrData(qrObject)
      setQrData(newQrData) // Update the qrData state immediately

      // Debounce the CRC calculation and validation
      const handler = setTimeout(() => {
        try {
          const updatedQrObjectWithCRC = updateCRCInParsedObject(qrObject)
          validateCRC(updatedQrObjectWithCRC) // Validate the CRC
          setIsValid(true)
          setError('') // Clear any previous CRC errors
        } catch (error) {
          setError(
            'CRC validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
          )
          setIsValid(false)
        }
      }, 500) // Debounce by 500ms

      return () => {
        clearTimeout(handler)
      }
    } else {
      setQrData('')
      setIsValid(false)
      setError('')
    }
  }, [qrObject]) // This effect runs whenever qrObject changes

  const DataObjectLine = React.memo(
    ({
      dataObject,
      indent = 0,
      path = [],
      onValueCommit, // New prop
    }: {
      dataObject: ParsedDataObject
      indent?: number
      path?: string[]
      onValueCommit: (id: string, newValue: string, objectPath: string[]) => void // Type for new prop
    }) => {
      const [localValue, setLocalValue] = useState(dataObject.value || '')
      const [isEditing, setIsEditing] = useState(false)
      const inputRef = useRef<HTMLInputElement>(null)

      // Memoize the path to prevent unnecessary re-renders
      const stablePath = useMemo(() => path, [path.join('-')])

      // Update local value when dataObject.value changes (but not when we're actively editing)
      useEffect(() => {
        if (!isEditing) {
          setLocalValue(dataObject.value || '')
        }
      }, [dataObject.value, isEditing])

      const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value) // Only update local state
      }, [])

      const handleInputFocus = useCallback(() => {
        setIsEditing(true)
      }, [])

      const handleInputBlur = useCallback(() => {
        setIsEditing(false)
        // Only commit if the local value has actually changed from the prop value
        if (localValue !== dataObject.value) {
          onValueCommit(dataObject.id, localValue, stablePath)
        }
      }, [dataObject.id, localValue, stablePath, onValueCommit, dataObject.value])

      const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur() // Blur the input to trigger onBlur and commit
        }
      }, [])

      const indentStr = useMemo(() => '. '.repeat(indent), [indent])

      // A field is editable if it has a value - regardless of whether it has children
      const isEditable = useMemo(
        () => dataObject.value !== undefined && dataObject.value !== '',
        [dataObject.value],
      )

      return (
        <div className="p-0">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Combined static text and input on one line */}
              <div className="flex items-center gap-1">
                {' '}
                {/* Use flex and items-center for alignment */}
                <span className="font-mono text-sm whitespace-nowrap">
                  {indentStr}
                  {dataObject.id} {dataObject.length}
                </span>{' '}
                {/* Static ID and Length */}
                {isEditable && !dataObject.children && (
                  <Input
                    ref={inputRef}
                    value={localValue}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onKeyDown={handleKeyDown} // Added onKeyDown
                    className="flex-1 border-none py-0 px-2 outline-none shadow-none h-max bg-muted/50" // flex-1 to take remaining space
                  />
                )}
                {!isEditable && (
                  <span className="flex-1 font-mono text-sm py-0 px-2 text-muted-foreground">
                    {dataObject.value || '(structured data)'}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              {/* Tooltip content remains the same */}
              <div className="max-w-xs">
                {dataObject.name && (
                  <div className="font-semibold text-white mb-1">{dataObject.name}</div>
                )}
                {dataObject.description && (
                  <div className="text-gray-200 text-xs">
                    {dataObject.description?.split('\n').map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                  </div>
                )}
                {dataObject.format && (
                  <div className="text-gray-300 text-xs mt-1">Format: {dataObject.format}</div>
                )}
                {isEditable && (
                  <div className="text-blue-300 text-xs mt-1">Click to edit value</div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          {dataObject.children && dataObject.children.length > 0 && (
            <div>
              {dataObject.children.map((child, idx) => {
                const childPath = useMemo(
                  () => [...stablePath, dataObject.id],
                  [stablePath, dataObject.id],
                )
                return (
                  <DataObjectLine
                    key={`${child.id}-${childPath.join('-')}-${idx}`}
                    dataObject={child}
                    indent={indent + 3}
                    path={childPath}
                    onValueCommit={onValueCommit} // Pass the new prop down
                  />
                )
              })}
            </div>
          )}
        </div>
      )
    },
    (prevProps, nextProps) => {
      // Custom comparison function to prevent unnecessary re-renders
      // Only re-render if the actual data we care about has changed
      return (
        prevProps.dataObject.id === nextProps.dataObject.id &&
        prevProps.dataObject.value === nextProps.dataObject.value &&
        prevProps.dataObject.length === nextProps.dataObject.length &&
        prevProps.indent === nextProps.indent &&
        (prevProps.path || []).join('-') === (nextProps.path || []).join('-') &&
        prevProps.onValueCommit === nextProps.onValueCommit // Include the new prop in comparison
      )
    },
  )
  DataObjectLine.displayName = 'DataObjectLine' // For better debugging in React DevTools

  const RenderDataObject = ({ parseObject }: { parseObject: ParsedDataObject[] }) => {
    return (
      <div className="font-mono text-sm whitespace-pre-wrap border rounded-lg p-4 bg-muted/50">
        {parseObject.map((dataObject, idx) => (
          <DataObjectLine
            key={`${dataObject.id}-root-${idx}`}
            dataObject={dataObject}
            indent={0}
            path={[]}
            onValueCommit={updateParsedObjectField} // Pass the update function
          />
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto p-6 max-w-screen">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="h-6 w-6" />
            <h1 className="text-2xl font-bold">EMV QR Code Parser</h1>
          </div>
          <p className="text-muted-foreground">
            Parse EMV QR codes according to the ID/Length/Value specification
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>QR Code Data Input</CardTitle>
              <CardDescription>
                Enter, paste, or drag & drop an image with QR code data to parse
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Preview */}
              {uploadedImage && (
                <div className="space-y-2">
                  <Label>Uploaded Image</Label>
                  <div className="border rounded-lg p-2 relative">
                    <img
                      src={uploadedImage || '/placeholder.svg'}
                      alt="Uploaded QR code"
                      className="max-w-full max-h-48 mx-auto object-contain"
                    />
                    <Button
                      onClick={() => handleClear()}
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="qr-data">QR Code Data</Label>
                <div
                  ref={dropZoneRef}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onPaste={handlePaste}
                  tabIndex={0}
                >
                  {/* Drag & Drop Area */}
                  {isDragOver ? (
                    <div className="relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer border-primary bg-primary/5 min-h-[150px]">
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                          Drop image here to scan QR code
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Textarea
                      id="qr-data"
                      placeholder="00020101021126580014A000000677010111011500000000000052040000530370654041.005802PH5913MERCHANT NAME6009MAKATICITY61051226062070703***6304"
                      value={qrData}
                      onChange={(e) => setQrData(e.target.value)}
                      className="font-mono text-sm resize-none min-h-[150px]"
                      rows={4}
                    />
                  )}
                  {(isProcessing || isPasting) && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                      <div className="text-sm">
                        {isPasting ? 'Processing pasted image...' : 'Processing image...'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleParse} className="flex-1">
                  Parse QR Code
                </Button>
                {qrData && (
                  <Button onClick={handleCopy} variant="outline" size="sm">
                    {copySuccess ? (
                      <>
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                )}
                {qrData && (
                  <Button onClick={handleClear} variant="outline" size="sm">
                    Clear
                  </Button>
                )}
              </div>
              {/* Camera and File Upload Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={isScanning ? stopCamera : startCamera}
                  variant="secondary"
                  className="flex-1"
                >
                  {isScanning ? (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      Stop Camera
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-1" />
                      Scan with Camera
                    </>
                  )}
                </Button>
                <Button onClick={openFileDialog} variant="secondary" className="flex-1">
                  <Upload className="h-4 w-4 mr-1" />
                  Upload Image
                </Button>
              </div>
              {/* Hidden File Input */}
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {/* Camera Preview */}
              {isScanning && (
                <div className="space-y-2">
                  <Label>Camera Preview</Label>
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full max-h-[300px] rounded-lg border bg-black"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0"
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>
              )}
              {/* Error Display */}
              {error && (
                <Alert variant={error.startsWith('Warning') ? 'default' : 'destructive'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {cameraPermission === 'denied' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Camera access denied. Please allow camera access in your browser settings.
                  </AlertDescription>
                </Alert>
              )}
              {/* Success Display */}
              {qrObject.length > 0 && (
                <Alert variant={isValid ? 'default' : 'destructive'}>
                  {isValid ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {isValid ? 'QR code structure is valid' : 'QR code structure has issues'}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="relative">
              <CardTitle>Parsed QR Format (Editable)</CardTitle>
              <CardDescription>Edit the structured breakdown of the QR code data</CardDescription>
              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button className="absolute top-0 right-0" disabled={!qrObject.length}>
                    <QrCode className="h-4 w-4 mr-2" />
                    Generate QR Code
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Generated QR Code</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex justify-center p-4 bg-white rounded-lg border">
                      <QRCode id="qr-code-svg" value={qrData} size={256} level="H" />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={downloadQR} className="flex-1">
                        <Download className="h-4 w-4 mr-2" />
                        Download PNG
                      </Button>
                      <Button onClick={() => setIsModalOpen(false)} variant="outline">
                        Close
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="font-mono text-sm">
                {qrObject.length ? (
                  <RenderDataObject parseObject={qrObject} />
                ) : (
                  <p className="text-muted-foreground">No parsed data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}
