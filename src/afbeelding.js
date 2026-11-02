// Shrinks a picture in the browser (max side `maxPx`) and returns a JPEG blob.
export async function verkleind(bestand, maxPx = 1600) {
  const bmp = await createImageBitmap(bestand)
  const schaal = Math.min(1, maxPx / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * schaal))
  canvas.height = Math.max(1, Math.round(bmp.height * schaal))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // transparent PNG logos get a white background in the JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
}
