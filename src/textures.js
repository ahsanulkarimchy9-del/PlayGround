import * as THREE from 'three'
import { TILE } from './blocks.js'

const TILE_PX = 64
const GRID = 8
const ATLAS = TILE_PX * GRID

function mulberry(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry(0x5eed)

function hexLerp(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`
}

function noiseFill(g, colorA, colorB, amount = 0.5, cell = 1) {
  const a = new THREE.Color(colorA), b = new THREE.Color(colorB)
  for (let y = 0; y < TILE_PX; y += cell) {
    for (let x = 0; x < TILE_PX; x += cell) {
      const n = rnd()
      const c = a.clone().lerp(b, n * amount + (1 - amount) * 0.5)
      g.fillStyle = `#${c.getHexString()}`
      g.fillRect(x, y, cell, cell)
    }
  }
}

function speckle(g, count, colors, sizeMin = 1, sizeMax = 2, alpha = 1) {
  g.globalAlpha = alpha
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[(rnd() * colors.length) | 0]
    const s = sizeMin + rnd() * (sizeMax - sizeMin)
    g.fillRect(rnd() * TILE_PX, rnd() * TILE_PX, s, s)
  }
  g.globalAlpha = 1
}

function cracks(g, color, count = 5, width = 1) {
  g.strokeStyle = color
  g.lineWidth = width
  for (let i = 0; i < count; i++) {
    let x = rnd() * TILE_PX, y = rnd() * TILE_PX
    g.beginPath(); g.moveTo(x, y)
    for (let j = 0; j < 4 + rnd() * 5; j++) {
      x += (rnd() - 0.5) * 18; y += (rnd() - 0.5) * 18
      g.lineTo(x, y)
    }
    g.stroke()
  }
}

function bevel(g, light = 'rgba(255,255,255,.10)', dark = 'rgba(0,0,0,.28)') {
  g.fillStyle = light; g.fillRect(0, 0, TILE_PX, 2); g.fillRect(0, 0, 2, TILE_PX)
  g.fillStyle = dark; g.fillRect(0, TILE_PX - 2, TILE_PX, 2); g.fillRect(TILE_PX - 2, 0, 2, TILE_PX)
}

function blobs(g, count, colors, rMin = 2, rMax = 6, alpha = 1) {
  g.globalAlpha = alpha
  for (let i = 0; i < count; i++) {
    const x = rnd() * TILE_PX, y = rnd() * TILE_PX, r = rMin + rnd() * (rMax - rMin)
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    const c = colors[(rnd() * colors.length) | 0]
    grd.addColorStop(0, c); grd.addColorStop(1, c.replace('rgb', 'rgba').replace(')', ',0)'))
    g.fillStyle = grd
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
  }
  g.globalAlpha = 1
}

function oreTile(g, baseA, baseB, veinColors) {
  noiseFill(g, baseA, baseB, 0.55, 2)
  cracks(g, 'rgba(0,0,0,.2)', 4, 1)
  blobs(g, 11, veinColors, 3, 8, 0.95)
  speckle(g, 34, veinColors, 1, 2.4, 0.8)
  bevel(g)
}

const painters = {}
painters[TILE.ASH] = g => { noiseFill(g, '#332e2d', '#514744', 0.6, 1); speckle(g, 80, ['#241f1f', '#6a5b52', '#8a7566'], 1, 2, 0.5); bevel(g) }
painters[TILE.HELLSTONE] = g => {
  noiseFill(g, '#3c1210', '#74251c', 0.7, 2)
  cracks(g, 'rgba(255,90,20,.85)', 8, 1.5)
  cracks(g, 'rgba(255,190,80,.5)', 4, 1)
  speckle(g, 32, ['#ff7e2e', '#5a0d08', '#ffc16b'], 1, 2.2, 0.8)
  bevel(g, 'rgba(255,150,80,.14)', 'rgba(0,0,0,.4)')
}
painters[TILE.OBSIDIAN] = g => {
  noiseFill(g, '#0e0a16', '#261c36', 0.55, 1)
  cracks(g, 'rgba(130,95,190,.5)', 7, 1)
  speckle(g, 28, ['#5c3d8a', '#140f1f', '#a17ee0'], 1, 2, 0.6)
  g.fillStyle = 'rgba(220,190,255,.1)'; g.fillRect(6, 8, 22, 2); g.fillRect(34, 26, 20, 1)
  bevel(g, 'rgba(190,160,255,.16)', 'rgba(0,0,0,.5)')
}
painters[TILE.STONE] = g => { noiseFill(g, '#4b4541', '#756b62', 0.45, 2); cracks(g, 'rgba(0,0,0,.2)', 5, 1); speckle(g, 60, ['#3a3532', '#8e8174', '#a3988a'], 1, 2, 0.5); bevel(g) }
painters[TILE.DIRT] = g => { noiseFill(g, '#4d3828', '#6f533b', 0.5, 2); speckle(g, 70, ['#38281d', '#856544', '#9a7d55'], 1, 2.5, 0.65); bevel(g) }
painters[TILE.GRASS_TOP] = g => {
  noiseFill(g, '#3d5c2d', '#638246', 0.7, 1)
  speckle(g, 80, ['#2b431f', '#8baa58', '#a9c875', '#4c6e35'], 1, 2, 0.9)
  for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(160,200,110,.5)'; g.lineWidth = 1; const x = rnd() * 64, y = rnd() * 64; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 3, y - 3 - rnd() * 4); g.stroke() }
  bevel(g)
}
painters[TILE.GRASS_SIDE] = g => {
  painters[TILE.DIRT](g)
  const grd = g.createLinearGradient(0, 0, 0, 22)
  grd.addColorStop(0, '#648443'); grd.addColorStop(0.7, '#4b6b34'); grd.addColorStop(1, 'rgba(75,107,52,0)')
  g.fillStyle = grd; g.fillRect(0, 0, 64, 23)
  for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(100,140,65,.65)'; g.fillRect(i * 4 + rnd() * 2, 20 + rnd() * 7, 2, 3 + rnd() * 7) }
}
painters[TILE.EBONSTONE] = g => {
  noiseFill(g, '#241a33', '#3d2b55', 0.55, 2)
  cracks(g, 'rgba(170,130,235,.5)', 7, 1)
  blobs(g, 8, ['#7452a8', '#8f6bc9'], 2, 5, 0.4)
  speckle(g, 40, ['#170f24', '#9e7bd4', '#513872'], 1, 2, 0.6); bevel(g, 'rgba(190,150,255,.15)', 'rgba(0,0,0,.45)')
}
painters[TILE.CRIMSTONE] = g => {
  noiseFill(g, '#3b1316', '#642326', 0.55, 2)
  cracks(g, 'rgba(255,140,140,.45)', 7, 1)
  blobs(g, 8, ['#b64046', '#d46161'], 2, 5, 0.42)
  speckle(g, 40, ['#26090b', '#e0837b', '#8f2e34'], 1, 2, 0.65); bevel(g, 'rgba(255,160,160,.12)', 'rgba(0,0,0,.45)')
}
painters[TILE.FLESH] = g => {
  noiseFill(g, '#5b2027', '#9b4147', 0.55, 2)
  for (let i = 0; i < 7; i++) { g.strokeStyle = 'rgba(220,120,120,.3)'; g.lineWidth = 1 + rnd() * 2; g.beginPath(); let x = rnd() * 64, y = rnd() * 64; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (rnd() - .5) * 22; y += (rnd() - .5) * 22; g.lineTo(x, y) } g.stroke() }
  blobs(g, 13, ['#3d1117', '#c46a6a', '#722831'], 2, 6, 0.45)
  speckle(g, 45, ['#2f0a10', '#d8837d', '#7e2f36'], 1, 2, 0.7); bevel(g, 'rgba(255,170,170,.12)', 'rgba(0,0,0,.42)')
}
painters[TILE.MUD] = g => { noiseFill(g, '#3d3924', '#5b5636', 0.55, 2); speckle(g, 70, ['#2b2819', '#74703f', '#8b8750'], 1, 2, 0.6); blobs(g, 5, ['#4e5c30', '#676f39'], 3, 7, 0.3); bevel(g) }
painters[TILE.HIVE] = g => {
  noiseFill(g, '#6d4b17', '#c18d2c', 0.5, 2)
  g.strokeStyle = 'rgba(60,35,5,.7)'; g.lineWidth = 2
  const s = 16
  for (let row = -1; row < 5; row++) for (let col = -1; col < 5; col++) {
    const cx = col * s + (row % 2 ? s / 2 : 0), cy = row * s * .86
    g.beginPath()
    for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; const x = cx + Math.cos(a) * s * .5, y = cy + Math.sin(a) * s * .5; k ? g.lineTo(x, y) : g.moveTo(x, y) }
    g.closePath(); g.stroke()
  }
  speckle(g, 35, ['#eabf5f', '#895e1d', '#ffe08a'], 1, 2, 0.5); bevel(g, 'rgba(255,220,130,.16)', 'rgba(0,0,0,.35)')
}
painters[TILE.SAND] = g => { noiseFill(g, '#a78e63', '#d6bf92', 0.45, 1); speckle(g, 100, ['#917a52', '#ead6a8', '#bda87c'], 1, 2, 0.55); bevel(g, 'rgba(255,240,200,.14)', 'rgba(0,0,0,.2)') }
painters[TILE.WOOD] = g => {
  noiseFill(g, '#4b3524', '#705437', 0.5, 2)
  for (let i = 0; i < 11; i++) { g.strokeStyle = i % 3 ? 'rgba(30,18,10,.35)' : 'rgba(150,110,65,.3)'; g.lineWidth = 1; const x = 3 + i * 5.8 + rnd() * 2; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 3, 20, x - 3, 42, x + 1, 64); g.stroke() }
  g.fillStyle = 'rgba(20,12,8,.5)'; g.fillRect(0, 21, 64, 3); g.fillRect(0, 45, 64, 2); bevel(g)
}
painters[TILE.PLANKS] = g => {
  noiseFill(g, '#6b4c30', '#987349', 0.5, 2)
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(35,22,12,.42)'; g.fillRect(0, i * 16, 64, 2); g.fillStyle = 'rgba(220,170,110,.1)'; g.fillRect(0, i * 16 + 2, 64, 1) }
  for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(40,26,14,.45)'; g.fillRect(6 + (i % 4) * 16, 4 + ((i / 4) | 0) * 16, 2, 2) }
  speckle(g, 30, ['#3f2b1a', '#b08858'], 1, 1, 0.5); bevel(g)
}
painters[TILE.LEAVES] = g => {
  noiseFill(g, '#1e381d', '#3f652e', 0.7, 1)
  blobs(g, 22, ['#588c3e', '#79a34d', '#2b4b22'], 3, 8, 0.55)
  speckle(g, 50, ['#152a14', '#7ba74e', '#4a7434'], 1, 2, 0.8); bevel(g, 'rgba(150,220,120,.12)', 'rgba(0,0,0,.3)')
}
painters[TILE.GLOWSHROOM] = g => {
  noiseFill(g, '#062b2c', '#0a4545', 0.4, 1)
  blobs(g, 6, ['#34e8d0', '#8ffff1', '#0d8078'], 5, 13, 0.75)
  for (let i = 0; i < 22; i++) { g.fillStyle = ['#8dfff1', '#37f1dc', '#d9fffb'][(rnd() * 3) | 0]; g.beginPath(); g.arc(rnd() * 64, rnd() * 64, 1 + rnd() * 2.2, 0, 7); g.fill() }
  bevel(g, 'rgba(160,255,245,.22)', 'rgba(0,0,0,.4)')
}
painters[TILE.CRYSTAL] = g => {
  noiseFill(g, '#2a1438', '#4c2467', 0.5, 2)
  for (let i = 0; i < 7; i++) {
    const x = rnd() * 64, y = rnd() * 64, w = 6 + rnd() * 12
    g.fillStyle = ['rgba(230,160,255,.75)', 'rgba(170,90,255,.65)', 'rgba(255,210,255,.85)'][(rnd() * 3) | 0]
    g.beginPath(); g.moveTo(x, y - w); g.lineTo(x + w * .5, y); g.lineTo(x, y + w); g.lineTo(x - w * .45, y); g.closePath(); g.fill()
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 1, y - w * .5, 1, w)
  }
  bevel(g, 'rgba(255,200,255,.24)', 'rgba(0,0,0,.35)')
}
painters[TILE.LAVA] = g => {
  noiseFill(g, '#b42c05', '#ff9d1c', 0.85, 2)
  for (let i = 0; i < 16; i++) { g.strokeStyle = 'rgba(255,235,140,.6)'; g.lineWidth = 1 + rnd() * 2; g.beginPath(); let x = rnd() * 64, y = rnd() * 64; g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (rnd() - .5) * 20; y += (rnd() - .5) * 11; g.lineTo(x, y) } g.stroke() }
  blobs(g, 8, ['#ffe47a', '#ff5a0a'], 3, 10, 0.5)
}
painters[TILE.WATER] = g => { noiseFill(g, '#1b3e52', '#2f6f86', 0.55, 2); for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(150,220,235,.22)'; g.beginPath(); const y = rnd() * 64; g.moveTo(0, y); g.bezierCurveTo(20, y - 5, 40, y + 5, 64, y); g.stroke() } }
painters[TILE.DEMONITE] = g => oreTile(g, '#3e4158', '#5a5f7c', ['#5b62be', '#8b93ff', '#373d86'])
painters[TILE.CRIMTANE] = g => oreTile(g, '#4b3030', '#6a4444', ['#a92c37', '#e05a5a', '#6d121e'])
painters[TILE.GOLD] = g => oreTile(g, '#544b3d', '#776a54', ['#e5b642', '#ffe28a', '#8a6419'])
painters[TILE.LIFECRYSTAL] = g => {
  noiseFill(g, '#3a1730', '#61264c', 0.4, 2)
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 24); grd.addColorStop(0, '#ffe3f4'); grd.addColorStop(.45, '#ff75bd'); grd.addColorStop(1, 'rgba(255,80,170,0)')
  g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.fill()
  g.fillStyle = '#ffd4ef'; g.beginPath(); g.moveTo(32, 12); g.lineTo(45, 32); g.lineTo(32, 52); g.lineTo(19, 32); g.closePath(); g.fill()
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(30, 18, 2, 20)
  bevel(g, 'rgba(255,200,240,.3)', 'rgba(0,0,0,.3)')
}
painters[TILE.HONEY] = g => { noiseFill(g, '#b67315', '#f0bf4e', 0.5, 2); blobs(g, 7, ['#ffe28c', '#f7a91e'], 4, 12, 0.4); for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(255,240,180,.3)'; g.beginPath(); g.arc(32, 32, 8 + i * 5, 0, 7); g.stroke() } }
painters[TILE.RAINBOW] = g => {
  const cols = ['#ff4d6d', '#ff9f43', '#ffe66d', '#7bed9f', '#45aaf2', '#a55eea']
  for (let i = 0; i < 64; i++) { g.fillStyle = cols[((i + Math.floor(i * .23)) % cols.length + cols.length) % cols.length]; g.fillRect(0, i, 64, 2) }
  noiseFill(g, 'rgba(255,255,255,1)', 'rgba(255,255,255,1)', 1, 1)
  g.globalAlpha = .25; g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64); g.globalAlpha = 1
  speckle(g, 50, ['#ffffff', '#000000'], 1, 1, 0.35)
  bevel(g)
}
painters[TILE.ASHBRICK] = g => {
  noiseFill(g, '#3c3432', '#5a4e49', 0.45, 2)
  for (let row = 0; row < 4; row++) { const off = row % 2 ? 16 : 0; for (let col = -1; col < 3; col++) { g.strokeStyle = 'rgba(15,12,12,.6)'; g.strokeRect(col * 32 + off, row * 16, 32, 16); g.fillStyle = 'rgba(255,220,180,.04)'; g.fillRect(col * 32 + off + 1, row * 16 + 1, 30, 1) } }
  speckle(g, 30, ['#2a2422', '#7a665c'], 1, 2, 0.5); bevel(g)
}
painters[TILE.MOSSSTONE] = g => { painters[TILE.STONE](g); blobs(g, 12, ['#496b3d', '#61864a', '#2f4a29'], 3, 8, 0.45); speckle(g, 25, ['#7ca35a', '#263d21'], 1, 2, 0.5) }
painters[TILE.OBSIDIANBRICK] = g => {
  noiseFill(g, '#100b19', '#241a33', 0.45, 2)
  for (let row = 0; row < 4; row++) { const off = row % 2 ? 16 : 0; for (let col = -1; col < 3; col++) { g.strokeStyle = 'rgba(120,80,180,.35)'; g.strokeRect(col * 32 + off, row * 16, 32, 16) } }
  speckle(g, 25, ['#7756a8', '#090610'], 1, 2, 0.5); bevel(g, 'rgba(180,140,255,.14)', 'rgba(0,0,0,.5)')
}
painters[TILE.HIVEWALL] = g => { noiseFill(g, '#4a3414', '#7e5a1e', 0.5, 2); g.strokeStyle = 'rgba(30,18,4,.55)'; g.lineWidth = 2; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(rnd() * 64, rnd() * 64, 7 + rnd() * 13, 0, 7); g.stroke() } speckle(g, 25, ['#b78c35', '#2f210a'], 1, 2, 0.5); bevel(g) }
painters[TILE.FLESHWALL] = g => {
  noiseFill(g, '#43141b', '#7a2d35', 0.55, 2)
  blobs(g, 12, ['#2a080d', '#b06060', '#5c1e26'], 2, 7, 0.45)
  for (let i = 0; i < 9; i++) { g.strokeStyle = 'rgba(200,110,110,.25)'; g.beginPath(); let y = rnd() * 64; g.moveTo(0, y); g.bezierCurveTo(20, y + 15, 44, y - 15, 64, y); g.stroke() }
  bevel(g, 'rgba(255,160,160,.1)', 'rgba(0,0,0,.4)')
}
painters[TILE.EMBERCRYSTAL] = g => {
  noiseFill(g, '#3a0e05', '#7a1d06', 0.5, 2)
  for (let i = 0; i < 8; i++) { const x = rnd() * 64, y = rnd() * 64, w = 5 + rnd() * 11; g.fillStyle = ['#ffb347', '#ff6a1a', '#ffe08a'][(rnd() * 3) | 0]; g.beginPath(); g.moveTo(x, y - w); g.lineTo(x + w * .5, y); g.lineTo(x, y + w); g.lineTo(x - w * .4, y); g.closePath(); g.fill() }
  bevel(g, 'rgba(255,200,120,.25)', 'rgba(0,0,0,.35)')
}
painters[TILE.CLOUD] = g => { noiseFill(g, '#e6e1ec', '#ffffff', 0.35, 2); blobs(g, 10, ['#ffffff', '#d4cce0'], 6, 16, 0.5) }
painters[TILE.CORRUPTGRASS] = g => {
  noiseFill(g, '#2f2442', '#4a3866', 0.6, 1)
  speckle(g, 70, ['#1e1630', '#7054a8', '#8f74c4', '#43315f'], 1, 2, 0.9)
  for (let i = 0; i < 20; i++) { g.strokeStyle = 'rgba(155,120,220,.45)'; g.beginPath(); const x = rnd() * 64, y = rnd() * 64; g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 3, y - 3 - rnd() * 4); g.stroke() }
  bevel(g)
}
painters[TILE.CRIMSONGRASS] = g => {
  noiseFill(g, '#4f1e22', '#7e3635', 0.6, 1)
  speckle(g, 70, ['#381013', '#b75a50', '#d98272', '#6a2b2b'], 1, 2, 0.9)
  for (let i = 0; i < 20; i++) { g.strokeStyle = 'rgba(230,130,110,.45)'; g.beginPath(); const x = rnd() * 64, y = rnd() * 64; g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 3, y - 3 - rnd() * 4); g.stroke() }
  bevel(g)
}
painters[TILE.BONE] = g => { noiseFill(g, '#a99e88', '#e3d9c2', 0.4, 2); cracks(g, 'rgba(80,70,55,.35)', 4, 1); speckle(g, 40, ['#8d816d', '#f5eddc'], 1, 2, 0.5); bevel(g) }
painters[TILE.ASHBRICK2] = g => { painters[TILE.ASHBRICK](g); cracks(g, 'rgba(10,8,8,.7)', 8, 1.6); speckle(g, 30, ['#8a7263', '#1a1514'], 1, 2, 0.5) }

export function createAtlas() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = ATLAS
  const g = canvas.getContext('2d', { willReadFrequently: true })
  g.imageSmoothingEnabled = false
  for (let t = 0; t < 64; t++) {
    const tx = (t % GRID) * TILE_PX, ty = Math.floor(t / GRID) * TILE_PX
    g.save(); g.translate(tx, ty); g.beginPath(); g.rect(0, 0, TILE_PX, TILE_PX); g.clip()
    const p = painters[t]
    if (p) p(g); else { noiseFill(g, '#3a3230', '#5a4c46', 0.5, 2); bevel(g) }
    g.restore()
  }
  // subtle atlas-wide grime pass
  g.globalAlpha = .055
  for (let i = 0; i < 450; i++) { g.fillStyle = i % 3 ? '#000' : '#fff'; g.fillRect(rnd() * ATLAS, rnd() * ATLAS, 1 + rnd() * 2, 1 + rnd() * 2) }
  g.globalAlpha = 1
  return canvas
}

function normalFromCanvas(canvas, strength = 2.4) {
  const w = canvas.width, h = canvas.height
  const src = canvas.getContext('2d').getImageData(0, 0, w, h).data
  const out = document.createElement('canvas'); out.width = w; out.height = h
  const octx = out.getContext('2d'); const img = octx.createImageData(w, h)
  const lum = (x, y) => { x = (x + w) % w; y = (y + h) % h; const i = (y * w + x) * 4; return (src[i] * .299 + src[i + 1] * .587 + src[i + 2] * .114) / 255 }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength
    const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength
    let nx = -dx, ny = dy, nz = 1
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz); nx /= l; ny /= l; nz /= l
    const i = (y * w + x) * 4
    img.data[i] = (nx * .5 + .5) * 255; img.data[i + 1] = (ny * .5 + .5) * 255; img.data[i + 2] = (nz * .5 + .5) * 255; img.data[i + 3] = 255
  }
  octx.putImageData(img, 0, 0)
  return out
}

function roughnessFromCanvas(canvas) {
  const w = canvas.width, h = canvas.height
  const out = document.createElement('canvas'); out.width = w; out.height = h
  const g = out.getContext('2d')
  g.drawImage(canvas, 0, 0)
  const img = g.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const l = (img.data[i] * .3 + img.data[i + 1] * .59 + img.data[i + 2] * .11) / 255
    const v = 150 + (1 - l) * 80
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return out
}

let cached = null
export function getTextures() {
  if (cached) return cached
  const atlasCanvas = createAtlas()
  const normalCanvas = normalFromCanvas(atlasCanvas, 2.2)
  const roughCanvas = roughnessFromCanvas(atlasCanvas)
  const atlas = new THREE.CanvasTexture(atlasCanvas)
  atlas.colorSpace = THREE.SRGBColorSpace
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping
  atlas.minFilter = THREE.LinearMipmapLinearFilter
  atlas.magFilter = THREE.LinearFilter
  atlas.generateMipmaps = true
  atlas.anisotropy = 4
  const normalMap = new THREE.CanvasTexture(normalCanvas)
  normalMap.colorSpace = THREE.NoColorSpace
  normalMap.minFilter = THREE.LinearMipmapLinearFilter
  normalMap.generateMipmaps = true
  const roughnessMap = new THREE.CanvasTexture(roughCanvas)
  roughnessMap.colorSpace = THREE.NoColorSpace
  roughnessMap.minFilter = THREE.LinearMipmapLinearFilter
  roughnessMap.generateMipmaps = true

  const iconCache = new Map()
  function iconForTile(tile) {
    if (tile == null || tile < 0) return ''
    if (iconCache.has(tile)) return iconCache.get(tile)
    const c = document.createElement('canvas'); c.width = c.height = 48
    const cc = c.getContext('2d')
    cc.imageSmoothingEnabled = false
    cc.drawImage(atlasCanvas, (tile % GRID) * TILE_PX, Math.floor(tile / GRID) * TILE_PX, TILE_PX, TILE_PX, 0, 0, 48, 48)
    const url = c.toDataURL('image/png')
    iconCache.set(tile, url)
    return url
  }
  cached = { atlas, normalMap, roughnessMap, atlasCanvas, iconForTile }
  return cached
}
