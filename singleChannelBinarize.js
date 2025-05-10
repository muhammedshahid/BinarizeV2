function otsuThreshold(imageData) {
  const { data, width, height } = imageData
  const histogram = new Array(256).fill(0)

  // Compute histogram
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    )
    histogram[gray]++
  }

  const totalPixels = width * height
  let sumB = 0
  let wB = 0
  let maximum = 0
  let sum1 = histogram.reduce((sum, val, i) => sum + i * val, 0)
  let threshold = 0

  // Iterate through all thresholds
  for (let t = 0; t < 256; t++) {
    wB += histogram[t] // Weight of background
    if (wB === 0) continue

    const wF = totalPixels - wB // Weight of foreground
    if (wF === 0) break

    sumB += t * histogram[t]

    const mB = sumB / wB // Mean of background
    const mF = (sum1 - sumB) / wF // Mean of foreground

    // Between-class variance
    const varianceBetween = wB * wF * Math.pow(mB - mF, 2)

    // Check for maximum variance
    if (varianceBetween > maximum) {
      maximum = varianceBetween
      threshold = t
    }
  }

  return threshold
}

async function singleChannelBinarize(imageData, progressTracker) {
  const { data } = imageData
  progressTracker({ message: 'Finding threshold' })
  const threshold = otsuThreshold(imageData)
  progressTracker({ message: `Threshold: ${threshold}` })

  for (let i = 0; i < data.length; i += 4) {
    const gray =
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const binaryValue = gray >= threshold ? 255 : 0
    data[i] = data[i + 1] = data[i + 2] = binaryValue // Set to white or black      
  }
  progressTracker({ message: 'Binarized' })
  return imageData
}