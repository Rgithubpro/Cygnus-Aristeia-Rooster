// App icon as PNG files: 512 and 192 (any), 180 (iPhone) and a "maskable" 512 with extra safe space for Android.
export async function laadBitmap(bron) {
  const blob = typeof bron === 'string' ? await (await fetch(bron, { mode: 'cors' })).blob() : bron
  return createImageBitmap(blob)
}
function teken(bmp, S, { marge, achtergrond }, maskable) {
  const c = document.createElement('canvas')
  c.width = c.height = S
  const x = c.getContext('2d')
  x.fillStyle = achtergrond || '#ffffff' // always opaque: iPhones turn transparent icons black
  x.fillRect(0, 0, S, S)
  let binnen = S * (1 - (2 * marge) / 100)
  if (maskable) binnen = Math.min(binnen, S * 0.62)
  const sc = Math.min(binnen / bmp.width, binnen / bmp.height)
  const w = bmp.width * sc
  const h = bmp.height * sc
  x.drawImage(bmp, (S - w) / 2, (S - h) / 2, w, h)
  return c
}
const blobVan = (c) => new Promise((res) => c.toBlob(res, 'image/png'))
export async function bouwIcoonSet(bmp, opt) {
  return {
    512: await blobVan(teken(bmp, 512, opt, false)),
    192: await blobVan(teken(bmp, 192, opt, false)),
    180: await blobVan(teken(bmp, 180, opt, false)),
    m512: await blobVan(teken(bmp, 512, opt, true)),
  }
}
export const voorbeeld = (bmp, S, opt, maskable) => teken(bmp, S, opt, maskable).toDataURL('image/png')
export const icoonPaden = (p512) => {
  const b = p512.replace(/-512\.png$/, '')
  return [`${b}-512.png`, `${b}-192.png`, `${b}-180.png`, `${b}-m512.png`]
}
