import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAllowedFieldIds, getDefinition } from '@/constants/emvco'
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
  Plus,
  QrCode,
  Trash,
  Upload,
  X,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'react-qr-code'

// Helper to create a new ParsedDataObject based on definition
const createNewDataObject = (id: string, definition: any): ParsedDataObject => {
  const newObject: ParsedDataObject = {
    id: id,
    length: '00', // Default to 0 length for new fields
    value: '', // Default to empty value for new fields
    name: definition.name,
    description: definition.description,
    format: definition.format,
  }
  if (definition.subFields) {
    newObject.children = [] // Initialize children array if it's a template
  }
  return newObject
}

// Recursive function to update the qrObject state for add/delete operations
const updateQrObjectRecursive = (
  objects: ParsedDataObject[],
  targetPath: string[],
  action: 'add' | 'delete',
  newFieldId?: string,
  newFieldDefinition?: any,
): ParsedDataObject[] => {
  if (targetPath.length === 0) {
    // This is the root level for adding a new root field
    if (action === 'add' && newFieldId && newFieldDefinition) {
      const newField = createNewDataObject(newFieldId, newFieldDefinition)
      return [...objects, newField].sort((a, b) => Number.parseInt(a.id) - Number.parseInt(b.id))
    }
    // For delete at root, it means the targetPath was just [id]
    // This case is handled by the filter below after the map
    return objects
  }

  const [currentId, ...restPath] = targetPath
  let changed = false
  const newObjects = objects
    .map((obj) => {
      if (obj.id === currentId) {
        if (restPath.length === 0) {
          // This is the target object itself (for deletion) or the parent (for adding a child)
          if (action === 'delete') {
            changed = true
            return null // Mark for deletion
          } else if (action === 'add' && newFieldId && newFieldDefinition) {
            // This is the parent where a new child needs to be added
            const newChild = createNewDataObject(newFieldId, newFieldDefinition)
            const updatedChildren = [...(obj.children || []), newChild].sort(
              (a, b) => Number.parseInt(a.id) - Number.parseInt(b.id),
            )
            const childrenData = updatedChildren.map((c) => `${c.id}${c.length}${c.value}`).join('')
            changed = true
            return {
              ...obj,
              children: updatedChildren,
              value: childrenData,
              length: childrenData.length.toString().padStart(2, '0'),
            }
          }
        } else if (obj.children) {
          // Recurse into children
          const updatedChildren = updateQrObjectRecursive(
            obj.children,
            restPath,
            action,
            newFieldId,
            newFieldDefinition,
          )
          if (updatedChildren !== obj.children) {
            const childrenData = updatedChildren.map((c) => `${c.id}${c.length}${c.value}`).join('')
            changed = true
            return {
              ...obj,
              children: updatedChildren,
              value: childrenData,
              length: childrenData.length.toString().padStart(2, '0'),
            }
          }
        }
      }
      return obj
    })
    .filter(Boolean) as ParsedDataObject[]

  // Sort the new objects by id to maintain order
  return changed ? newObjects : objects
}

export default function QRCodeParser() {
  const [qrData, setQrData] = useState('')
  const [qrObject, setQRObject] = useState<ParsedDataObject[]>([])
  const [error, setError] = useState('')
  const [isValid, setIsValid] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyImageSuccess, setCopyImageSuccess] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isPasting, setIsPasting] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>(
    'prompt',
  )
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const scanIntervalRef = useRef<any>(null)

  // State for the root "Add Field" dropdown search
  const [addRootFieldOpen, setAddRootFieldOpen] = useState(false)
  const [addRootFieldSearchValue, setAddRootFieldSearchValue] = useState('')

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
      setError(
        'Failed to parse QR code data - ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
      setIsValid(false)
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

  const handleCopyImage = () => {
    try {
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
        // Convert canvas to image and copy to clipboard
        canvas.toBlob((blob) => {
          if (blob) {
            const item = new ClipboardItem({ 'image/png': blob })
            navigator.clipboard.write([item]).then(
              () => {
                setCopyImageSuccess(true)
                setTimeout(() => setCopyImageSuccess(false), 2000)
              },
              (err) => {
                setError('Failed to copy image to clipboard: ' + err.message)
              },
            )
          } else {
            setError('Failed to create image blob from canvas')
          }
        }, 'image/png')

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
      console.log('Error processing image file:', error)
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
      if (!data) {
        return
      }
      const initialQrObject = parseQRCode(data)
      validateCRC(initialQrObject) // Validate original CRC [^vercel_knowledge_base]
      const updatedQrObjectWithCRC = updateCRCInParsedObject(initialQrObject) // Recalculate and update CRC
      setQRObject(updatedQrObjectWithCRC)
      setIsValid(true) // Now it's valid because we've updated the CRC to match
    } catch (error) {
      console.log('Error parsing QR code data:', error)
      setError(
        'Failed to parse QR code data - ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
      setIsValid(false)
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
    handleClear()
    setIsPasting(true)
    setError('')
    try {
      const items = Array.from(e.clipboardData.items)
      const imageItem = items.find((item) => item.type.startsWith('image/'))
      const textItem = items.find((item) => item.type === 'text/plain')

      if (imageItem) {
        const file = imageItem.getAsFile()
        if (file) {
          console.log('Pasting image from clipboard:', file.name)
          await processImageFile(file)
        } else {
          setError('Failed to get image from clipboard')
        }
      } else if (!textItem) {
        setError('No image or text found in clipboard. Please copy an image or text first.')
      }
    } catch (error) {
      console.log('Error pasting content:', error)
      setError(
        'Failed to process pasted content: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
    } finally {
      setIsPasting(false)
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

  const handleAddRootField = (fieldId: string) => {
    const definition = getDefinition(fieldId)
    if (definition) {
      setQRObject((prev) => {
        const updated = updateQrObjectRecursive(prev, [], 'add', fieldId, definition)
        return updateCRCInParsedObject(updated).sort((a, b) => {
          return Number.parseInt(a.id) - Number.parseInt(b.id)
        })
      })
    } else {
      setError(`Definition for field ID ${fieldId} not found.`)
    }
  }

  const handleAddSubField = (parentPath: string[], subFieldId: string) => {
    setQRObject((prev) => {
      let currentDefinition: any = null
      // Traverse the path to find the parent's definition
      for (let i = 0; i < parentPath.length; i++) {
        const id = parentPath[i]
        currentDefinition = getDefinition(id, currentDefinition)
        if (!currentDefinition || !currentDefinition.subFields) {
          setError(`Parent field ${id} does not support subfields.`)
          return prev
        }
      }
      const subFieldDefinition = getDefinition(subFieldId, currentDefinition)
      if (!subFieldDefinition) {
        setError(`Definition for subfield ID ${subFieldId} not found under parent.`)
        return prev
      }
      const updated = updateQrObjectRecursive(
        prev,
        parentPath, // The path to the parent where the child will be added
        'add',
        subFieldId,
        subFieldDefinition,
      )
      return updateCRCInParsedObject(updated).sort((a, b) => {
        return Number.parseInt(a.id) - Number.parseInt(b.id)
      })
    })
  }

  const handleDeleteField = (objectPath: string[]) => {
    setQRObject((prev) => {
      const updated = updateQrObjectRecursive(prev, objectPath, 'delete')
      return updateCRCInParsedObject(updated)
    })
  }

  const openFileDialog = () => {
    fileInputRef.current?.click()
  }

  useEffect(() => {
    const reconstructQrData = (objects: ParsedDataObject[]): string => {
      return objects
        .map((obj) => {
          const childrenData =
            obj.children && obj.children.length > 0 ? reconstructQrData(obj.children) : obj.value
          const length = childrenData.length.toString().padStart(2, '0')
          return `${obj.id}${length}${childrenData}`
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

  interface DataObjectLineProps {
    dataObject: ParsedDataObject
    indent?: number
    path?: string[]
    onValueCommit: (id: string, newValue: string, objectPath: string[]) => void
    onAddSubField: (parentPath: string[], subFieldId: string) => void
    onDeleteField: (objectPath: string[]) => void
  }

  const DataObjectLine = React.memo(
    function DataObjectLine({
      dataObject,
      indent = 0,
      path = [],
      onValueCommit,
      onAddSubField,
      onDeleteField,
    }: DataObjectLineProps) {
      // Local state for the input value
      const [localValue, setLocalValue] = useState(dataObject.value || '')
      // State to track if the input is currently focused/being edited
      const [isEditing, setIsEditing] = useState(false)

      // Memoize the path to prevent unnecessary re-renders
      const stablePath = useMemo(() => path, [path.join('-')])
      const fullPath = useMemo(() => [...path, dataObject.id], [path, dataObject.id])

      const indentStr = useMemo(() => '. '.repeat(indent), [indent])

      const currentDefinition = useMemo(() => {
        let def: any = null
        for (const pId of path) {
          def = getDefinition(pId, def)
        }
        return getDefinition(dataObject.id, def)
      }, [dataObject.id, path])

      const hasSubFields = useMemo(() => {
        return currentDefinition && currentDefinition.subFields
      }, [currentDefinition])

      const allowedSubFieldIds = useMemo(() => {
        return hasSubFields ? getAllowedFieldIds(currentDefinition) : []
      }, [hasSubFields, currentDefinition])

      const hasPayloadDescription = useMemo(() => {
        return currentDefinition && currentDefinition.payload_description
      }, [currentDefinition])

      // Update local value when dataObject.value changes from props, but only if not editing
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
          e.currentTarget.blur()
        }
      }, [])

      return (
        <div className="p-0 bg-transparent">
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Combined static text and input on one line */}
              <div className="flex items-center gap-1 bg-transparent group">
                {' '}
                {/* Added group for hover effects */}
                <span className="font-mono text-sm whitespace-nowrap">
                  {indentStr}
                  {dataObject.id} {dataObject.length}
                </span>{' '}
                {/* Static ID and Length */}
                {!dataObject.children ? (
                  <>
                    <Input
                      value={localValue} // Use localValue
                      onChange={handleInputChange} // Update localValue
                      onFocus={handleInputFocus} // Set isEditing to true
                      onBlur={handleInputBlur} // Set isEditing to false and commit
                      onKeyDown={handleKeyDown} // Trigger blur on Enter
                      className="flex-1 border-none py-0 px-2 outline-none shadow-none h-max bg-none"
                      list={
                        hasPayloadDescription
                          ? `datalist-${dataObject.id}-${fullPath.join('-')}`
                          : undefined
                      }
                    />
                    {hasPayloadDescription && (
                      <datalist id={`datalist-${dataObject.id}-${fullPath.join('-')}`}>
                        {Object.entries(currentDefinition.payload_description).map(
                          ([key, description]) => (
                            <option key={key} value={key}>
                              {description as string}
                            </option>
                          ),
                        )}
                      </datalist>
                    )}
                  </>
                ) : null}
                {/* Add/Delete Buttons */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {hasSubFields && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus className="h-3 w-3" />
                          <span className="sr-only">Add Subfield</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-60 overflow-y-hidden p-0">
                        <Command>
                          <CommandInput placeholder="Search subfields..." />
                          <CommandList>
                            <CommandEmpty>No subfields found.</CommandEmpty>
                            <CommandGroup>
                              {allowedSubFieldIds
                                .map((id) => ({
                                  id,
                                  name: getDefinition(id, currentDefinition)?.name || 'Unknown',
                                }))
                                .filter(({ id, name }) =>
                                  `${id} - ${name}`.toLowerCase().includes(''),
                                )
                                .map(({ id, name }) => (
                                  <CommandItem
                                    key={id}
                                    onSelect={() => {
                                      onAddSubField(fullPath, id)
                                    }}
                                  >
                                    {id} - {name}
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-600"
                    onClick={() => onDeleteField(fullPath)}
                  >
                    <Trash className="h-3 w-3" />
                    <span className="sr-only">Delete Field</span>
                  </Button>
                </div>
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
                {!dataObject.children && (
                  <div className="text-blue-300 text-xs mt-1">Click to edit value</div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
          {dataObject.children && dataObject.children.length > 0 && (
            <div>
              {dataObject.children.map((child, idx) => {
                const childPath = useMemo(() => [...fullPath], [fullPath])
                return (
                  <DataObjectLine
                    key={`${child.id}-${childPath.join('-')}-${idx}`}
                    dataObject={child}
                    indent={indent + 3}
                    path={childPath}
                    onValueCommit={updateParsedObjectField} // Pass the update function
                    onAddSubField={onAddSubField}
                    onDeleteField={onDeleteField}
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
        prevProps.onValueCommit === nextProps.onValueCommit &&
        prevProps.onAddSubField === nextProps.onAddSubField &&
        prevProps.onDeleteField === nextProps.onDeleteField
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
            onAddSubField={handleAddSubField}
            onDeleteField={handleDeleteField}
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
              <div className="absolute top-4 right-4">
                <DropdownMenu open={addRootFieldOpen} onOpenChange={setAddRootFieldOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="overflow-y-auto p-0">
                    <Command>
                      <CommandInput
                        placeholder="Search fields..."
                        value={addRootFieldSearchValue}
                        onValueChange={setAddRootFieldSearchValue}
                      />
                      <CommandList className="max-h-40">
                        <CommandEmpty>No fields found.</CommandEmpty>
                        <CommandGroup>
                          {getAllowedFieldIds()
                            .filter((id) => !qrObject.some((a) => a.id === id))
                            .filter((id) =>
                              `${id} - ${getDefinition(id)?.name || 'Unknown'}`
                                .toLowerCase()
                                .includes(addRootFieldSearchValue.toLowerCase()),
                            )
                            .map((id) => (
                              <CommandItem
                                key={id}
                                onSelect={() => {
                                  handleAddRootField(id)
                                  setAddRootFieldOpen(false)
                                  setAddRootFieldSearchValue('')
                                }}
                              >
                                {id} - {getDefinition(id)?.name || 'Unknown'}
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="font-mono text-sm">
                {qrObject.length ? (
                  <div>
                    <RenderDataObject parseObject={qrObject} />
                    <div className="flex justify-center p-4 bg-white rounded-lg border mb-2">
                      <QRCode
                        id="qr-code-svg"
                        value={qrObject.map((obj) => `${obj.id}${obj.length}${obj.value}`).join('')}
                        size={156}
                        level="H"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1/4" onClick={handleCopyImage}>
                        {copyImageSuccess ? (
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
                      <Button onClick={downloadQR} className="flex-3/4">
                        <Download className="h-4 w-4 mr-2" />
                        Download PNG
                      </Button>
                    </div>
                  </div>
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
