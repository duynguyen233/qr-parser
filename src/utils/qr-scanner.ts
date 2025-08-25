import jsQR from 'jsqr-es6'

class QRScanner {
  static async scanImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height

        // Handle transparent images by filling with white background first
        if (ctx) {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
        ctx?.drawImage(img, 0, 0)

        let imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
        if (!imageData) {
          reject(new Error('Failed to get image data'))
          return
        }

        // Try scanning the image as-is first (white background)
        let qrCode = jsQR(imageData.data, imageData.width, imageData.height)

        // If not found, try with black background for transparent images
        if (!qrCode && ctx) {
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          qrCode = jsQR(imageData.data, imageData.width, imageData.height)
        }

        // If still not found, try preprocessing the image for better contrast
        if (!qrCode && imageData) {
          const processedImageData = QRScanner.preprocessImageForQR(imageData)
          qrCode = jsQR(
            processedImageData.data,
            processedImageData.width,
            processedImageData.height,
          )
        }

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
    // Try scanning the image as-is first
    let qrCode = jsQR(imageData.data, imageData.width, imageData.height)

    // If not found, try preprocessing the image for better contrast
    if (!qrCode) {
      const processedImageData = QRScanner.preprocessImageForQR(imageData)
      qrCode = jsQR(processedImageData.data, processedImageData.width, processedImageData.height)
    }

    return qrCode ? qrCode.data : null
  }

  // Image preprocessing function to improve QR code detection for transparent/low contrast images
  static preprocessImageForQR(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data)
    const width = imageData.width
    const height = imageData.height

    // Convert to grayscale and apply contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const alpha = data[i + 3]

      // Handle transparency by treating transparent pixels as white
      if (alpha < 128) {
        data[i] = 255 // R
        data[i + 1] = 255 // G
        data[i + 2] = 255 // B
        data[i + 3] = 255 // A
      } else {
        // Convert to grayscale using luminance formula
        const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)

        // Apply contrast enhancement (make darks darker, lights lighter)
        const enhanced = gray < 128 ? Math.max(0, gray - 30) : Math.min(255, gray + 30)

        data[i] = enhanced // R
        data[i + 1] = enhanced // G
        data[i + 2] = enhanced // B
        data[i + 3] = 255 // A
      }
    }

    return new ImageData(data, width, height)
  }
}

export { QRScanner }
