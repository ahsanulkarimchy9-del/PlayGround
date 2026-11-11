import * as THREE from 'three'
import { B, BLOCKS, TILE, isSolid, isOpaque, isLiquid, tileFor } from './blocks.js'
import { getTextures } from './textures.js'

export const WORLD_W = 64
export const WORLD_H = 72
export const WORLD_D = 64
export const CHUNK = 16

const seed = 0x6e745f626f69 // "getfixedboi" folded

function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function smooth(t) { return t * t * (3 - 2 * t) }
function lerp(a, b, t) { return a + (b - a) * t }
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = smooth(xf), v = smooth(yf), w = smooth(zf)
  const c000 = hash3(xi, yi, zi), c100 = hash3(xi + 1, yi, zi)
  const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi)
  const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1)
  const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1)
  return lerp(lerp(lerp(c000, c100, u), lerp(c010, c110, u), v), lerp(lerp(c001, c101, u), lerp(c011, c111, u), v), w)
}
function vnoise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = smooth(x - xi), zf = smooth(z - zi)
  return lerp(lerp(hash3(xi, 11, zi), hash3(xi + 1, 11, zi), xf), lerp(hash3(xi, 11, zi + 1), hash3(xi + 1, 11, zi + 1), xf), zf)
}
function fbm3(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, norm = 0
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f); norm += a; a *= .5; f *= 2.03 }
  return s / norm
}
function fbm2(x, z, oct = 4) {
  let a = 0.5, f = 1, s = 0, norm = 0
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f, z * f); norm += a; a *= .5; f *= 2.02 }
  return s / norm
}
function rand01(x, z, y = 0) { return hash3(Math.floor(x * 7.3), Math.floor(y * 5.1 + z * 3.7), Math.floor(z * 9.1)) }

const FACE_DEFS = [
  { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] }, // 0 -X
  { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },  // 1 +X
  { dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] }, // 2 -Y
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },  // 3 +Y
  { dir: [0, 0, -1], corners: [[1, 1, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]] }, // 4 -Z
  { dir: [0, 0, 1], corners: [[0, 1, 1], [0, 0, 1], [1, 1, 1], [1, 0, 1]] }   // 5 +Z
]
const FACE_UV = [[0, 1], [0, 0], [1, 1], [1, 0]]
const AO_UV = [0, 1, 0, 1]

const LAVA_VERT = `
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDist;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mv = viewMatrix * wp;
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`
const LAVA_FRAG = `
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vDist;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
  void main(){
    vec2 p = vWorld.xz * 0.55 + vWorld.y * 0.11;
    float t = uTime * 0.10;
    float f = n(p + vec2(t, -t*.6)) * .55 + n(p*2.3 - vec2(t*.8, t)) * .3 + n(p*5.1 + t*1.2) * .15;
    vec3 deep = vec3(0.55, 0.055, 0.005);
    vec3 hot = vec3(1.8, 0.56, 0.055);
    vec3 crust = vec3(1.0, 0.92, 0.5);
    vec3 col = mix(deep, hot, smoothstep(.35, .78, f));
    col = mix(col, crust, smoothstep(.82, .98, f) * .5);
    float edge = pow(1.0 - abs(vNormal.y), 2.0);
    col *= 1.0 - edge * .55;
    float bubbles = smoothstep(.86, .96, n(p*7.0 + vec2(-t*2.0, t*1.3)));
    col += vec3(1.4, .55, .1) * bubbles;
    float fog = 1.0 - exp(-uFogDensity*uFogDensity*vDist*vDist);
    col = mix(col, uFogColor, fog);
    gl_FragColor = vec4(col, 1.0);
  }
`

export class World {
  constructor() {
    this.data = new Uint8Array(WORLD_W * WORLD_H * WORLD_D)
    this.chunks = new Map()
    this.group = new THREE.Group()
    this.group.name = 'VoxelWorld'
    this.dirty = new Set()
    this.torchPositions = []
    this.crystalPositions = []
    this.altar = new THREE.Vector3(32.5, 9, 26.5)
    this.spawnPoint = new THREE.Vector3(32.5, 8.1, 39.5)
    this.heights = new Float32Array(WORLD_W * WORLD_D)
    this.mapColors = new Array(WORLD_W * WORLD_D)
    this._initMaterials()
    this.generate()
    this.buildAllChunks()
  }

  idx(x, y, z) { return x + WORLD_W * (z + WORLD_D * y) }
  inBounds(x, y, z) { return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H && z >= 0 && z < WORLD_D }
  getBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z)
    if (y >= WORLD_H) return B.AIR
    if (y < 0 || x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) return B.OBSIDIAN
    return this.data[this.idx(x, y, z)]
  }
  raw(x, y, z) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H || z < 0 || z >= WORLD_D) return B.AIR
    return this.data[this.idx(x, y, z)]
  }
  setRaw(x, y, z, id) {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H || z < 0 || z >= WORLD_D) return
    this.data[this.idx(x, y, z)] = id
  }
  setBlock(x, y, z, id, rebuild = true) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z)
    if (!this.inBounds(x, y, z)) return false
    const before = this.getBlock(x, y, z)
    if (before === id) return false
    this.setRaw(x, y, z, id)
    if (rebuild) this.markDirtyAround(x, y, z)
    return true
  }
  markDirtyAround(x, y, z) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), cz = Math.floor(z / CHUNK)
    this.dirty.add(`${cx},${cy},${cz}`)
    const lx = x % CHUNK, ly = y % CHUNK, lz = z % CHUNK
    if (lx === 0) this.dirty.add(`${cx - 1},${cy},${cz}`)
    if (lx === CHUNK - 1) this.dirty.add(`${cx + 1},${cy},${cz}`)
    if (ly === 0) this.dirty.add(`${cx},${cy - 1},${cz}`)
    if (ly === CHUNK - 1) this.dirty.add(`${cx},${cy + 1},${cz}`)
    if (lz === 0) this.dirty.add(`${cx},${cy},${cz - 1}`)
    if (lz === CHUNK - 1) this.dirty.add(`${cx},${cy},${cz + 1}`)
  }
  flushDirty() {
    if (!this.dirty.size) return 0
    let n = 0
    for (const key of this.dirty) {
      const [cx, cy, cz] = key.split(',').map(Number)
      if (this.rebuildChunk(cx, cy, cz)) n++
    }
    this.dirty.clear()
    return n
  }

  surfaceHeight(x, z) {
    const base = 57 + (fbm2(x * .045, z * .045, 4) - .5) * 12 + (fbm2(x * .13 + 8, z * .13 - 3, 3) - .5) * 3
    return Math.floor(base)
  }

  generate() {
    const W = WORLD_W, H = WORLD_H, D = WORLD_D
    // ---- strata & surface ----
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
      const h = Math.max(40, Math.min(H - 4, this.surfaceHeight(x, z)))
      this.heights[x + z * W] = h
      const eb = fbm2(x * .07 + 20, z * .07 - 10, 3)
      const corruption = x + (eb - .5) * 14 < 31
      const beach = x > 49 && z > 48
      const evilDepth = 19 + Math.floor(fbm2(x * .1, z * .1, 2) * 5)
      for (let y = 0; y <= h; y++) {
        let id = B.STONE
        if (y <= 3) id = B.OBSIDIAN
        else if (y <= 11) id = rand01(x, z, y) > .7 ? B.HELLSTONE : B.ASH
        else if (y <= 17) id = rand01(x, z, y) > .86 ? B.ASHBRICK : B.STONE
        else if (y <= evilDepth + 17) {
          if (corruption) id = rand01(x, z, y) > .88 ? B.FLESH : B.EBONSTONE
          else id = rand01(x, z, y) > .9 ? B.FLESH : B.CRIMSTONE
          if (rand01(x, z, y) > .985) id = corruption ? B.DEMONITE : B.CRIMTANE
        } else if (y <= 46) {
          id = rand01(x, z, y) > .82 ? B.HIVE : B.MUD
          if (rand01(x, z, y) > .97) id = B.HONEY
        } else if (y < h - 4) id = rand01(x, z, y) > .55 ? B.STONE : B.MOSSSTONE
        else if (y < h) id = B.DIRT
        else {
          if (beach) id = rand01(x, z, y) > .82 ? B.RAINBOW : B.SAND
          else if (corruption) id = B.CORRUPTGRASS
          else if (x > 38) id = B.CRIMSONGRASS
          else id = B.GRASS
        }
        this.setRaw(x, y, z, id)
      }
      for (let y = h + 1; y < H; y++) this.setRaw(x, y, z, B.AIR)
    }

    // ---- caverns ----
    for (let x = 1; x < W - 1; x++) for (let z = 1; z < D - 1; z++) {
      const h = this.heights[x + z * W]
      for (let y = 3; y < h - 1; y++) {
        const n = fbm3(x * .057, y * .085, z * .057, 4)
        const n2 = fbm3(x * .16 + 13, y * .2 - 4, z * .16 + 7, 3)
        const deepBoost = y < 18 ? .055 : 0
        if (n > .595 - deepBoost || (n2 > .695 && y > 12)) this.setRaw(x, y, z, B.AIR)
      }
    }

    // ---- spawn cavern (cathedral of ash) ----
    const cx = 32, cy = 12, cz = 32
    for (let x = cx - 20; x <= cx + 20; x++) for (let y = 3; y <= 22; y++) for (let z = cz - 20; z <= cz + 20; z++) {
      const d = ((x - cx) / 18.4) ** 2 + ((y - cy) / 8.4) ** 2 + ((z - cz) / 18.4) ** 2
      if (d < 1) this.setRaw(x, y, z, B.AIR)
    }
    // lava lake & island
    for (let x = cx - 20; x <= cx + 20; x++) for (let z = cz - 20; z <= cz + 20; z++) {
      const dist = Math.hypot(x - cx, z - cz)
      const edge = ((x - cx) / 18.4) ** 2 + ((z - cz) / 18.4) ** 2
      if (edge < 1.02) {
        for (let y = 4; y <= 6; y++) {
          if (dist > 8.8) this.setRaw(x, y, z, B.LAVA)
          else this.setRaw(x, y, z, B.OBSIDIANBRICK)
        }
        for (let y = 0; y <= 3; y++) if (this.getBlock(x, y, z) === B.AIR) this.setRaw(x, y, z, B.OBSIDIAN)
        if (dist <= 8.8) { this.setRaw(x, 7, z, B.OBSIDIANBRICK); this.setRaw(x, 8, z, B.AIR) }
        else if (this.getBlock(x, 7, z) !== B.AIR && dist < 9.8) this.setRaw(x, 7, z, B.OBSIDIANBRICK)
      }
    }
    // island rim & entrance path
    for (let x = cx - 10; x <= cx + 10; x++) for (let z = cz - 10; z <= cz + 10; z++) {
      const d = Math.hypot(x - cx, z - cz)
      if (d > 7.6 && d < 8.9) { this.setRaw(x, 8, z, B.ASHBRICK); this.setRaw(x, 7, z, B.OBSIDIANBRICK) }
    }
    // altar dais
    const ax = 32, az = 26
    for (let x = ax - 3; x <= ax + 3; x++) for (let z = az - 3; z <= az + 3; z++) {
      const d = Math.max(Math.abs(x - ax), Math.abs(z - az))
      if (d <= 2) this.setRaw(x, 8, z, d === 2 ? B.ASHBRICK : B.OBSIDIANBRICK)
      if (d <= 1) this.setRaw(x, 9, z, B.OBSIDIANBRICK)
    }
    this.setRaw(ax, 10, az, B.EMBERCRYSTAL); this.setRaw(ax, 11, az, B.EMBERCRYSTAL)
    this.setRaw(ax, 12, az, B.EMBERCRYSTAL)
    // grand ruin arch frame
    for (const px of [21, 43]) {
      for (let y = 8; y <= 18; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) + Math.abs(dz) < 2) this.setRaw(px + dx, y, 29 + dz, (y % 4 === 0) ? B.ASHBRICK : B.OBSIDIANBRICK)
      }
    }
    for (let x = 21; x <= 43; x++) {
      this.setRaw(x, 18, 29, B.OBSIDIANBRICK)
      this.setRaw(x, 19, 29, x % 6 === 0 ? B.EMBERCRYSTAL : B.ASHBRICK)
    }
    // throne / skull relief at the back
    for (let x = 26; x <= 38; x++) {
      const t = (x - 26) / 12
      const yTop = 17 - Math.floor(Math.pow(t - .5, 2) * 9)
      for (let y = 9; y <= yTop; y++) this.setRaw(x, y, 15, B.BONE)
    }
    for (const ex of [29, 35]) {
      this.setRaw(ex, 14, 15, B.AIR); this.setRaw(ex + 1, 14, 15, B.AIR)
      this.setRaw(ex, 15, 15, B.AIR); this.setRaw(ex + 1, 15, 15, B.AIR)
      this.setRaw(ex, 14, 16, B.EMBERCRYSTAL); this.setRaw(ex + 1, 14, 16, B.EMBERCRYSTAL)
    }
    for (let x = 30; x <= 34; x++) { this.setRaw(x, 11, 15, B.AIR); this.setRaw(x, 12, 15, B.AIR) }
    for (let x = 30; x <= 34; x += 2) this.setRaw(x, 11, 15, B.BONE)

    // close the cathedral with a brutal ceiling slab
    for (let x = cx - 19; x <= cx + 19; x++) for (let z = cz - 19; z <= cz + 19; z++) {
      const d = Math.hypot((x - cx) / 19, (z - cz) / 19)
      if (d < 1.03) {
        for (let y = 20; y <= 22; y++) {
          if (y === 20 && d > .94) continue
          if (x >= 31 && x <= 33 && z >= 31 && z <= 32) continue
          if (y === 20 && rand01(x, z, y) > .8) continue
          this.setRaw(x, y, z, y === 21 ? B.ASHBRICK : (rand01(x, z, y) > .7 ? B.HELLSTONE : B.ASH))
        }
      }
    }
    for (let i = 0; i < 34; i++) {
      const ang = Math.random() * 6.28, r = 5 + Math.random() * 13
      const x = Math.round(cx + Math.cos(ang) * r), z = Math.round(cz + Math.sin(ang) * r)
      const len = 1 + Math.floor(Math.random() * 4)
      for (let y = 1; y <= len; y++) if (this.getBlock(x, 19 - y, z) === B.AIR) this.setRaw(x, 19 - y, z, y === len ? B.EMBERCRYSTAL : B.OBSIDIAN)
    }
    // lava falls feeding the lake
    for (const [lx, lz, top] of [[18, 25, 18], [46, 39, 19], [23, 45, 16]]) {
      for (let y = 8; y <= top; y++) {
        this.setRaw(lx, y, lz, B.LAVA); this.setRaw(lx + 1, y, lz, B.LAVA)
      }
      this.setRaw(lx, top + 1, lz, B.OBSIDIANBRICK); this.setRaw(lx + 1, top + 1, lz, B.OBSIDIANBRICK)
      this.setRaw(lx, top + 2, lz, B.EMBERCRYSTAL)
    }

    // ---- the world-split fissure: a narrow wound up to the sky ----
    for (let y = 19; y < H; y++) {
      const r = 1.25 + Math.sin(y * .7) * .3
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (dx * dx + dz * dz <= r * r) this.setRaw(cx + dx, y, cz + dz, B.AIR)
      }
    }
    // ragged edges of the fissure
    for (let y = 22; y < 56; y += 5) {
      this.setRaw(cx + 2, y, cz, B.ASHBRICK)
      this.setRaw(cx - 2, y, cz + 1, B.ASHBRICK)
    }

    // ---- vertical ascension shaft ----
    const sx = 45, sz = 33
    for (let y = 9; y <= H; y++) {
      const wobX = Math.round(Math.sin(y * .21) * .8), wobZ = Math.round(Math.cos(y * .17) * .7)
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (dx * dx + dz * dz <= 5) this.setRaw(sx + dx + wobX, y, sz + dz + wobZ, B.AIR)
      }
    }
    for (let y = 14; y <= 60; y += 4) {
      const wobX = Math.round(Math.sin(y * .21) * .8), wobZ = Math.round(Math.cos(y * .17) * .7)
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        if (Math.abs(dx) === 3 || Math.abs(dz) === 3) this.setRaw(sx + dx + wobX, y, sz + dz + wobZ, B.PLANKS)
      }
      this.torchPositions.push(new THREE.Vector3(sx + 3 + wobX + .5, y + 1.2, sz + .5))
    }
    // corridor from island to shaft
    for (let x = 36; x <= 45; x++) for (let y = 8; y <= 10; y++) for (let z = 31; z <= 34; z++) {
      this.setRaw(x, y, z, B.AIR)
      if (y === 8 && (z === 31 || z === 34)) this.setRaw(x, y, z, B.ASHBRICK)
    }
    for (let x = 36; x <= 45; x++) this.setRaw(x, 7, 32, B.ASHBRICK), this.setRaw(x, 7, 33, B.ASHBRICK)
    this.torchPositions.push(new THREE.Vector3(39.5, 9.2, 31.5), new THREE.Vector3(43.5, 9.2, 34.5))

    // ---- corruption chasm & crimson chasm ----
    for (const [ccx, ccz, rad, mode] of [[17, 36, 4.2, 0], [50, 40, 4.0, 1]]) {
      for (let y = 20; y < H; y++) {
        const r = rad * (1 + Math.sin(y * .34) * .18)
        for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
          if (dx * dx + dz * dz < r * r) this.setRaw(ccx + dx, y, ccz + dz, B.AIR)
        }
      }
      for (let y = 19; y < 58; y += 7) {
        for (let dx = -4; dx <= 4; dx++) {
          this.setRaw(ccx + dx, y, ccz - 4, mode ? B.FLESHWALL : B.EBONSTONE)
        }
      }
    }

    // ---- hive cathedral ----
    const hx = 24, hy = 39, hz = 20
    for (let x = hx - 9; x <= hx + 9; x++) for (let y = hy - 5; y <= hy + 5; y++) for (let z = hz - 9; z <= hz + 9; z++) {
      const d = ((x - hx) / 9) ** 2 + ((y - hy) / 5) ** 2 + ((z - hz) / 9) ** 2
      if (d < 1) this.setRaw(x, y, z, B.AIR)
    }
    for (let x = hx - 8; x <= hx + 8; x++) for (let z = hz - 8; z <= hz + 8; z++) {
      const d = ((x - hx) / 8) ** 2 + ((z - hz) / 8) ** 2
      if (d < 1.08) { this.setRaw(x, hy - 5, z, B.HIVE); this.setRaw(x, hy - 4, z, B.HONEY) }
    }
    for (const [px, pz] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, -8], [0, 8]]) {
      for (let y = hy - 4; y <= hy + 4; y++) this.setRaw(hx + px, y, hz + pz, B.HIVEWALL)
      this.setRaw(hx + px, hy + 5, hz + pz, B.EMBERCRYSTAL)
    }

    // ---- glowing mushroom grove ----
    const mx = 28, my = 50, mz = 45
    for (let x = mx - 7; x <= mx + 7; x++) for (let y = my - 4; y <= my + 4; y++) for (let z = mz - 7; z <= mz + 7; z++) {
      const d = ((x - mx) / 7) ** 2 + ((y - my) / 4) ** 2 + ((z - mz) / 7) ** 2
      if (d < 1) this.setRaw(x, y, z, B.AIR)
    }

    // ---- happiness beach: celebration corner ----
    for (let x = 50; x < W; x++) for (let z = 50; z < D; z++) {
      const h = this.heights[x + z * W]
      for (let y = h - 3; y <= h; y++) this.setRaw(x, y, z, rand01(x, z, y) > .76 ? B.RAINBOW : B.SAND)
      for (let y = h + 1; y <= h + 4; y++) this.setRaw(x, y, z, B.AIR)
      if (rand01(x, z, 3) > .93 && x < 60 && z < 60) {
        const th = 4 + Math.floor(rand01(x, z, 4) * 3)
        for (let y = h + 1; y <= h + th; y++) this.setRaw(x, y, z, B.WOOD)
        for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 2; dy++) {
          if (dx * dx + dz * dz + dy * dy < 6.4) this.setRaw(x + dx, h + th + dy, z + dz, B.LEAVES)
        }
      }
    }

    // ---- ore veins ----
    const oreCount = 170
    for (let i = 0; i < oreCount; i++) {
      let x = 2 + Math.floor(Math.random() * (W - 4))
      let z = 2 + Math.floor(Math.random() * (D - 4))
      let y = 8 + Math.floor(Math.random() * 44)
      const isGold = Math.random() < .26
      const ore = isGold ? B.GOLD : (x < 32 ? B.DEMONITE : B.CRIMTANE)
      for (let k = 0; k < 4 + Math.random() * 5; k++) {
        const id = this.getBlock(x, y, z)
        if (id === B.STONE || id === B.EBONSTONE || id === B.CRIMSTONE || id === B.MOSSSTONE || id === B.MUD) this.setRaw(x, y, z, ore)
        x += Math.floor(Math.random() * 3) - 1; y += Math.floor(Math.random() * 3) - 1; z += Math.floor(Math.random() * 3) - 1
        x = Math.max(1, Math.min(W - 2, x)); y = Math.max(3, Math.min(H - 3, y)); z = Math.max(1, Math.min(D - 2, z))
      }
    }

    // ---- life crystals ----
    let placed = 0, tries = 0
    while (placed < 18 && tries++ < 2000) {
      const x = 4 + Math.floor(Math.random() * (W - 8))
      const z = 4 + Math.floor(Math.random() * (D - 8))
      const y = 10 + Math.floor(Math.random() * 40)
      const id = this.getBlock(x, y, z)
      if ((id === B.STONE || id === B.EBONSTONE || id === B.CRIMSTONE) && this.isAirAround(x, y, z)) {
        this.setRaw(x, y, z, B.LIFECRYSTAL)
        this.crystalPositions.push(new THREE.Vector3(x + .5, y + .5, z + .5))
        placed++
      }
    }
    // guarantee a visible crystal near spawn
    this.setRaw(27, 10, 33, B.LIFECRYSTAL)
    this.setRaw(27, 11, 33, B.AIR)
    this.crystalPositions.push(new THREE.Vector3(27.5, 10.5, 33.5))

    // ---- rebuild the spawn cavern into a deliberate cathedral ----
    this.buildSpawnCathedral()

    // ---- glowshrooms & ember crystals on cave surfaces ----
    for (let i = 0; i < 520; i++) {
      const x = 2 + Math.floor(Math.random() * (W - 4))
      const z = 2 + Math.floor(Math.random() * (D - 4))
      const y = 5 + Math.floor(Math.random() * 55)
      // keep the central aisle of the starting cathedral clean
      if (y < 20 && Math.hypot(x - 32, z - 32) < 10) continue
      if (this.getBlock(x, y, z) !== B.AIR) continue
      const below = this.getBlock(x, y - 1, z)
      if (below === B.AIR || isLiquid(below)) continue
      if (y < 18) this.setRaw(x, y, z, Math.random() < .55 ? B.EMBERCRYSTAL : B.CRYSTAL)
      else if (y < 46) this.setRaw(x, y, z, Math.random() < .5 ? B.GLOWSHROOM : B.CRYSTAL)
      else if (Math.random() < .4) this.setRaw(x, y, z, B.GLOWSHROOM)
    }

    // ---- surface trees ----
    let trees = 0
    for (let i = 0; i < 600 && trees < 18; i++) {
      const x = 5 + Math.floor(Math.random() * (W - 10))
      const z = 5 + Math.floor(Math.random() * (D - 10))
      if (x > 48 && z > 48) continue
      const h = this.heights[x + z * W]
      if (this.getBlock(x, h, z) !== B.GRASS) continue
      const th = 4 + Math.floor(Math.random() * 4)
      for (let y = h + 1; y <= h + th; y++) this.setRaw(x, y, z, B.WOOD)
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 2; dy++) {
        if (dx * dx + dz * dz + dy * dy < 7.2) {
          const yy = h + th + dy
          if (this.getBlock(x + dx, yy, z + dz) === B.AIR) this.setRaw(x + dx, yy, z + dz, B.LEAVES)
        }
      }
      trees++
    }

    // ---- spawn torches ----
    this.torchPositions.push(
      new THREE.Vector3(23, 9.2, 30), new THREE.Vector3(41, 9.2, 30),
      new THREE.Vector3(26, 9.2, 37), new THREE.Vector3(38, 9.2, 37),
      new THREE.Vector3(32, 11.2, 24), new THREE.Vector3(28, 9.2, 22),
      new THREE.Vector3(36, 9.2, 22)
    )

    this.computeMapColors()
  }

  /* A clean, hand-authored starting hall. The noise-carved cavern is atmospheric
     everywhere else, but the first thing the player sees needs readable architecture. */
  buildSpawnCathedral() {
    const cx = 32, cz = 32, R = 16.4, far = R + 2.6
    const inHall = (x, z) => Math.hypot(x - cx, z - cz) <= far
    const nearFissure = (x, z) => Math.abs(x - cx) <= 2 && Math.abs(z - cz) <= 2
    const nearShaft = (x, z) => Math.hypot(x - 45, z - 33) <= 3

    // wipe the random cavern debris out of the hall volume
    for (let x = cx - 20; x <= cx + 20; x++) for (let z = cz - 20; z <= cz + 20; z++) {
      if (!inHall(x, z)) continue
      for (let y = 9; y <= 25; y++) this.setRaw(x, y, z, B.AIR)
    }

    // polished ash-stone floor with a dark inlay and a central ember sigil
    for (let x = cx - 10; x <= cx + 10; x++) for (let z = cz - 10; z <= cz + 10; z++) {
      const d = Math.hypot(x - cx, z - cz)
      if (d > 9.1) continue
      let id = B.ASHBRICK
      if (d > 7.7) id = B.OBSIDIANBRICK
      else if (d > 7.2) id = B.ASHBRICK2
      else if ((Math.abs(x - cx) <= 1 && Math.abs(z - cz) <= 5) || (Math.abs(z - cz) <= 1 && Math.abs(x - cx) <= 5)) id = B.OBSIDIANBRICK
      this.setRaw(x, 7, z, id)
    }
    for (const [ex, ez] of [[cx - 4, cz], [cx + 4, cz], [cx, cz - 4], [cx, cz + 4]]) this.setRaw(ex, 7, ez, B.OBSIDIANBRICK)

    // ring wall, with banded masonry and a few crystal-lit bays
    for (let x = cx - 20; x <= cx + 20; x++) for (let z = cz - 20; z <= cz + 20; z++) {
      const d = Math.hypot(x - cx, z - cz)
      if (d < R || d > far) continue
      for (let y = 8; y <= 20; y++) {
        let id = B.ASHBRICK
        if (y % 5 === 0 || y === 20) id = B.OBSIDIANBRICK
        else if ((x * 5 + z * 3 + y * 7) % 29 === 0) id = B.OBSIDIANBRICK
        else if (y === 13 && (x + z) % 13 === 0) id = B.EMBERCRYSTAL
        this.setRaw(x, y, z, id)
      }
    }
    // heavier diagonal buttresses
    for (const a of [Math.PI * .25, Math.PI * .75, Math.PI * 1.25, Math.PI * 1.75]) {
      const bx = Math.round(cx + Math.cos(a) * (R - .5)), bz = Math.round(cz + Math.sin(a) * (R - .5))
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        for (let y = 8; y <= 20; y++) this.setRaw(bx + dx, y, bz + dz, y % 6 === 0 ? B.OBSIDIANBRICK : B.ASHBRICK)
        this.setRaw(bx, 21, bz, B.EMBERCRYSTAL)
      }
    }

    // vaulted ceiling with the central fissure and ascension shaft left open
    for (let x = cx - 20; x <= cx + 20; x++) for (let z = cz - 20; z <= cz + 20; z++) {
      const d = Math.hypot(x - cx, z - cz)
      if (d > far) continue
      if (nearFissure(x, z) || nearShaft(x, z)) continue
      const top = 21 + Math.floor((1 - d / far) * 3.4)
      for (let y = 20; y <= top; y++) {
        const id = y === top ? B.ASHBRICK2 : B.OBSIDIANBRICK
        this.setRaw(x, y, z, id)
      }
    }

    // glowing halo under the vault
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2
      const hx = Math.round(cx + Math.cos(a) * 5.2), hz = Math.round(cz + Math.sin(a) * 5.2)
      this.setRaw(hx, 20, hz, i % 3 ? B.EMBERCRYSTAL : B.CRYSTAL)
    }

    // inner colonnade (four basalt pillars crowned with embers)
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * .25 + i * Math.PI * .5
      const px = Math.round(cx + Math.cos(a) * 12.2), pz = Math.round(cz + Math.sin(a) * 12.2)
      for (let dx = 0; dx <= 1; dx++) for (let dz = 0; dz <= 1; dz++) {
        for (let y = 8; y <= 17; y++) this.setRaw(px + dx, y, pz + dz, y % 4 === 0 ? B.ASHBRICK : B.OBSIDIANBRICK)
        for (let y = 18; y <= 19; y++) this.setRaw(px + dx, y, pz + dz, B.ASHBRICK)
      }
      this.setRaw(px, 20, pz, B.EMBERCRYSTAL)
    }

    // altar dais in the north half of the hall
    for (let x = 27; x <= 37; x++) for (let z = 22; z <= 30; z++) {
      const d = Math.max(Math.abs(x - cx), Math.abs(z - 26))
      if (d <= 4) this.setRaw(x, 8, z, d === 4 ? B.ASHBRICK : B.OBSIDIANBRICK)
      if (d <= 2) this.setRaw(x, 9, z, B.OBSIDIANBRICK)
      if (d <= 1) this.setRaw(x, 10, z, B.OBSIDIANBRICK)
    }
    this.setRaw(cx, 11, 26, B.EMBERCRYSTAL); this.setRaw(cx, 12, 26, B.EMBERCRYSTAL); this.setRaw(cx, 13, 26, B.EMBERCRYSTAL)
    for (const sx of [cx - 2, cx + 2]) this.setRaw(sx, 11, 26, B.EMBERCRYSTAL)

    // a lava-heart window framed by a clean basalt arch and bone pillars
    for (let x = 29; x <= 35; x++) for (let y = 10; y <= 17; y++) {
      if (y === 17 && (x === 29 || x === 35)) continue
      this.setRaw(x, y, 16, B.AIR)
      this.setRaw(x, y, 15, B.LAVA)
      this.setRaw(x, y, 14, B.LAVA)
    }
    for (let y = 9; y <= 18; y++) { this.setRaw(28, y, 16, B.OBSIDIANBRICK); this.setRaw(36, y, 16, B.OBSIDIANBRICK) }
    for (let x = 28; x <= 36; x++) { this.setRaw(x, 9, 16, B.OBSIDIANBRICK); this.setRaw(x, 18, 16, B.OBSIDIANBRICK) }
    for (let y = 8; y <= 18; y++) { this.setRaw(26, y, 16, B.BONE); this.setRaw(38, y, 16, B.BONE) }
    for (let x = 26; x <= 38; x++) this.setRaw(x, 19, 16, x % 4 === 0 ? B.EMBERCRYSTAL : B.OBSIDIANBRICK)
    this.setRaw(32, 18, 16, B.EMBERCRYSTAL)
    this.setRaw(26, 18, 16, B.EMBERCRYSTAL); this.setRaw(38, 18, 16, B.EMBERCRYSTAL)

    // stairway and processional arch between island and altar
    for (let x = 21; x <= 43; x++) {
      this.setRaw(x, 18, 29, B.OBSIDIANBRICK)
      this.setRaw(x, 19, 29, x % 6 === 0 ? B.EMBERCRYSTAL : B.ASHBRICK)
    }
    for (const px of [21, 43]) {
      for (let y = 8; y <= 18; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) + Math.abs(dz) < 2) this.setRaw(px + dx, y, 29 + dz, y % 4 === 0 ? B.ASHBRICK : B.OBSIDIANBRICK)
      }
    }

    // bridge out to the ascension shaft, plus its gatehouse
    for (let x = 38; x <= 45; x++) for (let z = 32; z <= 34; z++) this.setRaw(x, 8, z, B.OBSIDIANBRICK)
    for (let x = 39; x <= 42; x++) { this.setRaw(x, 9, 31, B.ASHBRICK); this.setRaw(x, 9, 35, B.ASHBRICK) }
    for (const [gx, gz] of [[43, 31], [47, 31], [43, 35], [47, 35]]) {
      for (let y = 9; y <= 13; y++) this.setRaw(gx, y, gz, y === 13 ? B.EMBERCRYSTAL : B.ASHBRICK)
    }
    for (let x = 43; x <= 47; x++) this.setRaw(x, 13, 31, B.OBSIDIANBRICK), this.setRaw(x, 13, 35, B.OBSIDIANBRICK)

    // floor-side ember braziers around the island
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * .25 + i * Math.PI * .5
      const bx = Math.round(cx + Math.cos(a) * 8.1), bz = Math.round(cz + Math.sin(a) * 8.1)
      this.setRaw(bx, 8, bz, B.OBSIDIANBRICK); this.setRaw(bx, 9, bz, B.OBSIDIANBRICK); this.setRaw(bx, 10, bz, B.EMBERCRYSTAL)
      this.torchPositions.push(new THREE.Vector3(bx + .5, 11.4, bz + .5))
    }
    this.torchPositions.push(
      new THREE.Vector3(23.5, 11.5, 24.5), new THREE.Vector3(40.5, 11.5, 24.5),
      new THREE.Vector3(20.5, 11.5, 33.5), new THREE.Vector3(44.5, 11.5, 24.5),
      new THREE.Vector3(28.5, 11.2, 21.5), new THREE.Vector3(35.5, 11.2, 21.5)
    )

    // lava pouring down the inner face of the hall wall
    for (const a of [Math.PI * 1.14]) {
      const lx = Math.round(cx + Math.cos(a) * (R - 1.2)), lz = Math.round(cz + Math.sin(a) * (R - 1.2))
      for (let y = 8; y <= 19; y++) this.setRaw(lx, y, lz, B.LAVA)
      this.setRaw(lx, 20, lz, B.EMBERCRYSTAL)
    }

    // guaranteed starter crystal, resting on the hall floor
    this.setRaw(25, 8, 37, B.OBSIDIANBRICK)
    this.setRaw(25, 9, 37, B.LIFECRYSTAL)
    this.crystalPositions.push(new THREE.Vector3(25.5, 9.5, 37.5))
  }

  isAirAround(x, y, z) {
    return this.getBlock(x + 1, y, z) === B.AIR || this.getBlock(x - 1, y, z) === B.AIR || this.getBlock(x, y + 1, z) === B.AIR || this.getBlock(x, y - 1, z) === B.AIR || this.getBlock(x, y, z + 1) === B.AIR || this.getBlock(x, y, z - 1) === B.AIR
  }

  computeMapColors() {
    const palette = {
      [B.LAVA]: '#ff5d18', [B.WATER]: '#296b88', [B.HONEY]: '#e8a52e', [B.GRASS]: '#5b823d',
      [B.CORRUPTGRASS]: '#6b4f9e', [B.CRIMSONGRASS]: '#a34443', [B.SAND]: '#cdb37f',
      [B.RAINBOW]: '#ff7bc4', [B.EBONSTONE]: '#362546', [B.CRIMSTONE]: '#572228',
      [B.FLESH]: '#93454a', [B.ASH]: '#3f3836', [B.HELLSTONE]: '#6e231a',
      [B.OBSIDIAN]: '#181122', [B.STONE]: '#6b625a', [B.DIRT]: '#634b36',
      [B.MUD]: '#49462c', [B.HIVE]: '#b88427', [B.LEAVES]: '#3f6530', [B.WOOD]: '#5a422d',
      [B.GLOWSHROOM]: '#43e4ce', [B.CRYSTAL]: '#bb7df2', [B.EMBERCRYSTAL]: '#ff8a2e',
      [B.LIFECRYSTAL]: '#ff5cb0', [B.DEMONITE]: '#6c74d0', [B.CRIMTANE]: '#c84c4c', [B.GOLD]: '#e5b642'
    }
    for (let x = 0; x < WORLD_W; x++) for (let z = 0; z < WORLD_D; z++) {
      let c = '#060506'
      for (let y = WORLD_H - 1; y >= 0; y--) {
        const id = this.getBlock(x, y, z)
        if (id !== B.AIR) { c = palette[id] || '#4f4640'; break }
      }
      this.mapColors[x + z * WORLD_W] = c
    }
  }

  _initMaterials() {
    const tex = getTextures()
    this.material = new THREE.MeshStandardMaterial({
      map: tex.atlas, normalMap: tex.normalMap, normalScale: new THREE.Vector2(.55, .55),
      roughnessMap: tex.roughnessMap, roughness: 1, metalness: .04, vertexColors: true
    })
    this.material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aEmissive;\nvarying vec3 vEmissive;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmissive = aEmissive;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vEmissive;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmissive;')
    }
    this.material.customProgramCacheKey = () => 'zenith-voxel-v1'

    this.transparentMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true, transparent: true, opacity: .68, roughness: .18, metalness: .15,
      depthWrite: false, side: THREE.DoubleSide
    })
    this.transparentMaterial.onBeforeCompile = this.material.onBeforeCompile
    this.transparentMaterial.customProgramCacheKey = () => 'zenith-voxel-v1'
    this.lavaMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(0x160a08) },
        uFogDensity: { value: .026 }
      },
      vertexShader: LAVA_VERT, fragmentShader: LAVA_FRAG, side: THREE.DoubleSide
    })
  }

  buildAllChunks() {
    const nx = Math.ceil(WORLD_W / CHUNK), ny = Math.ceil(WORLD_H / CHUNK), nz = Math.ceil(WORLD_D / CHUNK)
    for (let cy = 0; cy < ny; cy++) for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) this.rebuildChunk(cx, cy, cz)
  }

  rebuildChunk(cx, cy, cz) {
    if (cx < 0 || cy < 0 || cz < 0) return false
    if (cx * CHUNK >= WORLD_W || cy * CHUNK >= WORLD_H || cz * CHUNK >= WORLD_D) return false
    const key = `${cx},${cy},${cz}`
    let chunk = this.chunks.get(key)
    if (!chunk) {
      chunk = { group: new THREE.Group(), opaque: null, transparent: null, lava: null }
      chunk.group.position.set(cx * CHUNK, cy * CHUNK, cz * CHUNK)
      this.chunks.set(key, chunk)
      this.group.add(chunk.group)
    }
    const builders = { opaque: new Builder(), transparent: new Builder(), lava: new Builder(true) }
    const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK
    for (let y = y0; y < Math.min(y0 + CHUNK, WORLD_H); y++) {
      for (let z = z0; z < Math.min(z0 + CHUNK, WORLD_D); z++) {
        for (let x = x0; x < Math.min(x0 + CHUNK, WORLD_W); x++) {
          const id = this.getBlock(x, y, z)
          if (id === B.AIR) continue
          const liquid = isLiquid(id)
          if (!liquid && !BLOCKS[id]) continue
          for (let f = 0; f < 6; f++) {
            const fd = FACE_DEFS[f]
            const nx2 = x + fd.dir[0], ny2 = y + fd.dir[1], nz2 = z + fd.dir[2]
            const nb = this.getBlock(nx2, ny2, nz2)
            if (isOpaque(nb)) continue
            if (nb === id && !isOpaque(id)) continue
            if (liquid && isLiquid(nb)) continue
            if (id === B.LAVA) { builders.lava.addFace(x - x0, y - y0, z - z0, f, id, this, x, y, z); continue }
            const target = isLiquid(id) || BLOCKS[id].opaque === false ? builders.transparent : builders.opaque
            target.addFace(x - x0, y - y0, z - z0, f, id, this, x, y, z)
          }
        }
      }
    }
    this.swapMesh(chunk, 'opaque', builders.opaque, this.material, true)
    this.swapMesh(chunk, 'transparent', builders.transparent, this.transparentMaterial, false)
    this.swapMesh(chunk, 'lava', builders.lava, this.lavaMaterial, false)
    return true
  }

  swapMesh(chunk, kind, builder, material, shadows) {
    const old = chunk[kind]
    if (old) { chunk.group.remove(old); old.geometry.dispose() }
    chunk[kind] = null
    if (!builder.indices.length) return
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(builder.positions, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(builder.normals, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(builder.uvs, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(builder.colors, 3))
    if (kind !== 'transparent') g.setAttribute('aEmissive', new THREE.Float32BufferAttribute(builder.emissive, 3))
    else g.setAttribute('aEmissive', new THREE.Float32BufferAttribute(builder.emissive, 3))
    g.setIndex(builder.indices)
    g.computeBoundingSphere()
    const mesh = new THREE.Mesh(g, material)
    mesh.castShadow = !!shadows
    mesh.receiveShadow = !!shadows
    mesh.frustumCulled = true
    mesh.matrixAutoUpdate = false
    chunk.group.add(mesh)
    chunk[kind] = mesh
  }

  update(dt, time) {
    this.lavaMaterial.uniforms.uTime.value = time
    this.flushDirty()
  }

  raycast(origin, direction, maxDist = 6) {
    const dir = direction.clone().normalize()
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z)
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z)
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity
    const fracX = dir.x >= 0 ? (x + 1 - origin.x) : (origin.x - x)
    const fracY = dir.y >= 0 ? (y + 1 - origin.y) : (origin.y - y)
    const fracZ = dir.z >= 0 ? (z + 1 - origin.z) : (origin.z - z)
    let tMaxX = dir.x !== 0 ? fracX * tDeltaX : Infinity
    let tMaxY = dir.y !== 0 ? fracY * tDeltaY : Infinity
    let tMaxZ = dir.z !== 0 ? fracZ * tDeltaZ : Infinity
    let face = -1, t = 0
    for (let i = 0; i < 512; i++) {
      if (t > maxDist) break
      const id = this.getBlock(x, y, z)
      if (id !== B.AIR && !isLiquid(id)) {
        if (face < 0) face = 3
        return { hit: true, block: id, x, y, z, normal: new THREE.Vector3(...FACE_DEFS[face].dir), dist: t, point: origin.clone().addScaledVector(dir, t) }
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = stepX > 0 ? 0 : 1 }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = stepY > 0 ? 2 : 3 }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = stepZ > 0 ? 4 : 5 }
    }
    return { hit: false }
  }

  boxCollides(minX, minY, minZ, maxX, maxY, maxZ) {
    const x0 = Math.floor(minX), x1 = Math.floor(maxX - 1e-6)
    const y0 = Math.floor(minY), y1 = Math.floor(maxY - 1e-6)
    const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - 1e-6)
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (isSolid(this.getBlock(x, y, z))) return true
    }
    return false
  }

  playerBlock(pos, eye = false) {
    return this.getBlock(pos.x, pos.y + (eye ? 1.6 : .5), pos.z)
  }

  mapPixel(x, z) {
    if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) return '#050405'
    return this.mapColors[x + z * WORLD_W]
  }

  getTopBlock(x, z) {
    for (let y = WORLD_H - 1; y >= 0; y--) { const id = this.getBlock(x, y, z); if (id !== B.AIR) return { y, id } }
    return { y: 0, id: B.STONE }
  }
}

class Builder {
  constructor(lava = false) {
    this.positions = []; this.normals = []; this.uvs = []; this.colors = []; this.emissive = []; this.indices = []
    this.vertexCount = 0; this.lava = lava
  }
  addFace(x, y, z, f, id, world, wx, wy, wz) {
    const def = FACE_DEFS[f]
    const block = BLOCKS[id]
    const tile = tileFor(id, f)
    const tx = (tile % 8), ty = Math.floor(tile / 8)
    const inset = .0025
    const noise = .91 + hash3(wx * 3, wy * 3, wz * 3) * .16
    const tint = new THREE.Color(block?.tint ?? 0xffffff).multiplyScalar(noise)
    if (!this.lava) {
      const ao0 = this.ao(world, wx, wy, wz, f, 0)
      const ao1 = this.ao(world, wx, wy, wz, f, 1)
      const aos = [ao0, ao1, ao0, ao1]
      for (let i = 0; i < 4; i++) {
        const c = def.corners[i]
        this.positions.push(x + c[0], y + c[1], z + c[2])
        this.normals.push(def.dir[0], def.dir[1], def.dir[2])
        const u = FACE_UV[i][0], v = FACE_UV[i][1]
        const padU = inset + u * (1 - inset * 2), padV = inset + v * (1 - inset * 2)
        this.uvs.push((tx + padU) / 8, 1 - (ty + 1 - padV) / 8)
        const shade = aos[i]
        this.colors.push(tint.r * shade, tint.g * shade, tint.b * shade)
        const em = block?.emissive
        if (em) this.emissive.push(em[0], em[1], em[2]); else this.emissive.push(0, 0, 0)
      }
    } else {
      for (let i = 0; i < 4; i++) {
        const c = def.corners[i]
        this.positions.push(x + c[0], y + c[1], z + c[2])
        this.normals.push(def.dir[0], def.dir[1], def.dir[2])
        this.uvs.push(0, 0)
        this.colors.push(1, 1, 1)
        this.emissive.push(0, 0, 0)
      }
    }
    const b = this.vertexCount
    this.indices.push(b, b + 1, b + 2, b + 2, b + 1, b + 3)
    this.vertexCount += 4
  }
  ao(world, x, y, z, f, cornerIndex) {
    let axes
    switch (f) {
      case 0: case 1: axes = [[0, 1, 0], [0, 0, 1]]; break
      case 2: case 3: axes = [[1, 0, 0], [0, 0, 1]]; break
      default: axes = [[1, 0, 0], [0, 1, 0]]; break
    }
    const c = FACE_DEFS[f].corners[cornerIndex]
    const su = (axes[0][1] ? c[1] : axes[0][0] ? c[0] : c[2]) * 2 - 1
    const sv = (axes[1][1] ? c[1] : axes[1][0] ? c[0] : c[2]) * 2 - 1
    const d = FACE_DEFS[f].dir
    const sx = x + d[0], sy = y + d[1], sz = z + d[2]
    const p1 = world.getBlock(sx + axes[0][0] * su, sy + axes[0][1] * su, sz + axes[0][2] * su)
    const p2 = world.getBlock(sx + axes[1][0] * sv, sy + axes[1][1] * sv, sz + axes[1][2] * sv)
    const pc = world.getBlock(sx + axes[0][0] * su + axes[1][0] * sv, sy + axes[0][1] * su + axes[1][1] * sv, sz + axes[0][2] * su + axes[1][2] * sv)
    const s1 = isOpaque(p1) ? 1 : 0, s2 = isOpaque(p2) ? 1 : 0, cc = isOpaque(pc) ? 1 : 0
    if (s1 && s2) return .42
    return [0.42, 0.64, 0.83, 1][3 - s1 - s2 - cc]
  }
}
