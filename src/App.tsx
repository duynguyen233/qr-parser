import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, CheckCircle, QrCode } from 'lucide-react'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './components/ui/tooltip'
import { calculateCrc16IBM3740, formatQR } from './utils/parse-qr'

export default function QRCodeParser() {
  const [qrData, setQrData] = useState('')
  const [parsedData, setParsedData] = useState<string>('')
  const [error, setError] = useState('')
  const [isValid, setIsValid] = useState(false)

  const handleParse = () => {
    try {
      setError('')

      if (!qrData.trim()) {
        setError('Please enter QR code data')
        return
      }

      // Basic format validation
      if (qrData.length < 4) {
        setError('QR code data too short')
        return
      }

      const parsed = formatQR(qrData)
      if (!parsed) {
        setError('Invalid QR code data format')
        return
      }
      // Validate CRC
      const checkSum = calculateCrc16IBM3740(qrData.substring(0, qrData.length - 4))
      if (qrData.slice(-4) !== checkSum.toString(16).toUpperCase()) {
        setError('Invalid CRC checksum in QR code data')
        setIsValid(false)
        return
      }
      setParsedData(parsed)
      setIsValid(true)
    } catch (error) {
      setError(
        'Failed to parse QR code data - ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      )
      return
    }
  }

  const renderDataObject = (parsedData: string) => (
    <div>
      {parsedData.split('\n').map((line, idx) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span key={idx}>
              {line}
              <br />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-sm text-muted-foreground"></span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )

  return (
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

      <div className="gap-6">
        <div className="grid grid-cols-2 space-x-2">
          <Card>
            <CardHeader>
              <CardTitle>QR Code Data Input</CardTitle>
              <CardDescription>Enter the raw QR code data string to parse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-center">
                <Label htmlFor="qr-data">QR Code Data</Label>
                <Textarea
                  id="qr-data"
                  placeholder="00020101021126580014A000000677010111011500000000000052040000530370654041.005802PH5913MERCHANT NAME6009MAKATI CITY61051226062070703***6304"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  className="font-mono text-sm resize-none overflow-y-auto max-h-[300px] min-h-[150px]"
                  rows={4}
                />
              </div>

              <Button onClick={handleParse} className="w-full">
                Parse QR Code
              </Button>

              {error && (
                <Alert variant={error.startsWith('Warning') ? 'default' : 'destructive'}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {parsedData.length > 0 && (
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
            <CardHeader>
              <CardTitle>QR Format</CardTitle>
              <CardDescription>The formatting QR</CardDescription>
            </CardHeader>
            <CardContent className="">
              <div className="font-mono text-sm whitespace-pre-wrap">
                {renderDataObject(parsedData)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
