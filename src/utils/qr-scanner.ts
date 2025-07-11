import jsQR from 'jsqr'

class QRScanner {
  static async scanImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

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
      img.src = URL.createObjectURL(file)
    })
  }

  static detectQRCode(imageData: ImageData): string | null {
    const qrCode = jsQR(imageData.data, imageData.width, imageData.height)
    return qrCode ? qrCode.data : null
  }
}

function scanQRCode(file: File): Promise<string> {
  return QRScanner.scanImage(file)
    .then((result) => {
      if (!result) {
        throw new Error('No QR code found')
      }
      return result
    })
    .catch((error) => {
      throw error
    })
}

export { QRScanner, scanQRCode }
