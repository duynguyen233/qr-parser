import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import jsQR from 'jsqr'
import {
  AlertCircle,
  Camera,
  CheckCircle,
  Clipboard,
  ClipboardCheck,
  Copy,
  Download,
  Image,
  QrCode,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog'
import type { ParsedDataObject } from './types/parsed-object'
import { formatParsedData, parseQRCode, validateCRC } from './utils/parse-qr'

export default function QRCodeParser() {
  const [qrData, setQrData] = useState('')
  const [qrObject, setQRObject] = useState<ParsedDataObject[]>([])
  const [parsedData, setParsedData] = useState<string>('')
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
      const qrObject = parseQRCode(qrData)
      validateCRC(qrObject)
      setQRObject(qrObject)
      setParsedData(formatParsedData(qrObject))
      setIsValid(true)
    } catch (error) {
      setQRObject([])
      setError(
        'Failed to parse QR code data - ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
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
    setParsedData('')
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

      const qrObject = parseQRCode(data)
      validateCRC(qrObject)
      setQRObject(qrObject)
      setParsedData(formatParsedData(qrObject))
      setIsValid(true)
    } catch (error) {
      setError(
        'Failed to parse QR code data - ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
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

      if (imageItem) {
        const file = imageItem.getAsFile()
        if (file) {
          await processImageFile(file)
        } else {
          setError('Failed to get image from clipboard')
        }
      } else {
        setError('No image found in clipboard. Please copy an image first.')
      }
    } catch (error) {
      setError(
        'Failed to process pasted image: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
    } finally {
      setIsPasting(false)
    }
  }

  // Global paste handler
  const handleGlobalPaste = async (e: KeyboardEvent) => {
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
            }
          }
        }

        setError('No image found in clipboard. Please copy an image first.')
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
        console.error('Camera API not supported in this browser')
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
      console.error('Camera error:', error)
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
      console.error('Basic camera error:', error)
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
      console.log('Starting QR scan')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height)

      if (qrCode && qrCode.data) {
        try {
          handleParseData(qrCode.data)
          setQrData(qrCode.data)
        } finally {
          stopCamera()
        }
      } else {
        console.log('No QR code found, continuing scan')
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
      // cancelAnimationFrame(scanIntervalRef.current)
    }
  }

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

  const DataObjectLine = ({
    dataObject,
    indent = 0,
  }: {
    dataObject: ParsedDataObject
    indent?: number
  }) => {
    const indentStr = '. '.repeat(indent)
    let displayText = `${indentStr}${dataObject.id} ${dataObject.length}`

    if (!dataObject.children || dataObject.children.length === 0) {
      displayText += ` ${dataObject.value}`
    }

    return (
      <div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-pointer">{displayText}</span>
          </TooltipTrigger>
          <TooltipContent side="right">
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
            </div>
          </TooltipContent>
        </Tooltip>
        {dataObject.children && dataObject.children.length > 0 && (
          <div>
            {dataObject.children.map((child, idx) => (
              <DataObjectLine
                key={`${dataObject.id}-${child.id}-${idx}`}
                dataObject={child}
                indent={indent + 3}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const RenderDataObject = ({ parseObject }: { parseObject: ParsedDataObject[] }) => {
    return (
      <div>
        {parseObject.map((dataObject, idx) => (
          <DataObjectLine key={`${dataObject.id}-${idx}`} dataObject={dataObject} indent={0} />
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
                  <div className="border rounded-lg p-2">
                    <img
                      src={uploadedImage}
                      alt="Uploaded QR code"
                      className="max-w-full max-h-48 mx-auto object-contain"
                    />
                  </div>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className={`
                  relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                  ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                  }
                `}
              >
                <div className="text-center space-y-3">
                  <div className="flex justify-center space-x-2">
                    <Image className="h-8 w-8 text-muted-foreground" />
                    <Clipboard className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isDragOver
                        ? 'Drop image here to scan QR code'
                        : 'Drag & drop an image or paste from clipboard'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Copy an image and press Ctrl+V, or click here and paste
                    </p>
                  </div>
                </div>

                {(isProcessing || isPasting) && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                    <div className="text-sm">
                      {isPasting ? 'Processing pasted image...' : 'Processing image...'}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="qr-data">QR Code Data</Label>
                <Textarea
                  id="qr-data"
                  placeholder="00020101021126580014A000000677010111011500000000000052040000530370654041.005802PH5913MERCHANT NAME6009MAKATICITY61051226062070703***6304"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  className="font-mono text-sm resize-none min-h-[150px]"
                  rows={4}
                />
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
                  <Button className="absolute top-0 right-0" disabled={!parsedData}>
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
              <div className="font-mono text-sm whitespace-pre-wrap border rounded-lg p-4 bg-muted/50">
                {parsedData ? (
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
