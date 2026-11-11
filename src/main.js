import * as THREE from 'three'
import { World } from './world.js'
import { FX } from './fx.js'
import { Player } from './player.js'
import { EnemyManager, ProjectileManager, EyeBoss, QueenBoss, WallBoss } from './entities.js'
import { UI } from './ui.js'
import { AudioEngine } from './audio.js'
import { START_INVENTORY, HOTBAR, RECIPES, itemDef } from './items.js'
import { B } from './blocks.js'

const canvas = document.getElementById('scene')
const loading = document.getElementById('loading')
const loadFill = document.getElementById('load-fill')
const loadStatus = document.getElementById('load-status')
const isTouch = matchMedia('(pointer:coarse)').matches

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.25 : 1.5))
renderer.setSize(window.innerWidth, window.innerHeight, false)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = .98
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setClearColor(0x080506, 1)

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x14090a, .0135)
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, .045, 500)
camera.position.set(32.5, 9.7, 37.5)
scene.add(camera)

const game = {
  canvas, scene, camera, renderer,
  inventory: new Map(Object.entries(START_INVENTORY)),
  hotbar: HOTBAR.map(h => h.name),
  selected: 0,
  stations: { workbench: false, loom: false, sawmill: false, anvil: false },
  stats: { kills: 0, blocks: 0, crystals: 0, damageDealt: 0 },
  defeatedBosses: {},
  bedPos: null, bedMesh: null,
  spawnPoint: null,
  paused: false, isTouch, touchMove: new THREE.Vector2(),
  dayTime: .18, boss: null, enemyManager: null,
  interactText: null, mining: null, inventoryDirty: false,
  godMode: false, sealedBroken: false, started: false,
  toastTimes: new Map(),
  version: '1.0.0'
}

const audio = new AudioEngine(); game.audio = audio
loadStatus.textContent = 'CARVING THE LAYERS'; loadFill.style.width = '18%'

const world = new World(); game.world = world; scene.add(world.group)
game.spawnPoint = world.spawnPoint.clone()
loadStatus.textContent = 'LIGHTING THE UNDERWORLD'; loadFill.style.width = '56%'

const fx = new FX(scene, camera, renderer, world, audio); game.fx = fx
loadStatus.textContent = 'AWAKENING THE SURVIVOR'; loadFill.style.width = '76%'

const player = new Player(game); game.player = player
const projectiles = new ProjectileManager(game); game.projectiles = projectiles
const enemies = new EnemyManager(game); game.enemies = enemies
loadStatus.textContent = 'BINDING THE HUD'; loadFill.style.width = '92%'

const ui = new UI(game); game.ui = ui
ui.setVisible(true)
ui.setSelection()
ui.renderInventory()
loadFill.style.width = '100%'
loadStatus.textContent = 'DESCEND'

/* ---------------- game interface ---------------- */
game.requestLock = () => {
  audio.init(); audio.resume()
  if (!game.paused && !document.pointerLockElement) {
    try { canvas.requestPointerLock() } catch { }
  }
}
game.selectSlot = i => {
  if (i < 0 || i >= game.hotbar.length) return
  game.selected = i
  ui.setSelection()
  const name = game.hotbar[i]
  if (itemDef(name).type === 'weapon') ui.toast(`${name} drawn.`, 'gold')
}
game.addItem = (name, count = 1) => {
  game.inventory.set(name, (game.inventory.get(name) || 0) + count)
  game.inventoryDirty = true
}
game.consume = (name, count = 1) => {
  const have = game.inventory.get(name) || 0
  if (have < count) return false
  if (have - count <= 0) game.inventory.delete(name); else game.inventory.set(name, have - count)
  game.inventoryDirty = true
  ui.refreshHotbar()
  return true
}
game.loot = (name, count = 1) => {
  if (!name) return
  game.addItem(name, count)
  const now = performance.now()
  const last = game.toastTimes.get(name) || 0
  if (now - last > 500) {
    game.toastTimes.set(name, now)
    const def = itemDef(name)
    ui.toast(`+${count} ${def.name}`, 'gold')
    audio.pickup()
  }
}
game.onInventoryItemClick = name => {
  const idx = game.hotbar.indexOf(name)
  if (idx >= 0 && itemDef(name).type !== 'material') { game.selectSlot(idx); ui.toast(`${name} selected.`, 'gold'); return }
  if (itemDef(name).type === 'placeable') {
    game.hotbar[5] = name
    game.selected = 5
    ui.buildHotbar(); ui.toast(`${name} bound to hotbar slot 6.`, 'good')
    return
  }
  const def = itemDef(name)
  ui.toast(`${def.name} — ${def.desc}`, '')
}
game.craft = id => {
  const r = RECIPES.find(x => x.id === id); if (!r) return
  if (r.station.some(s => !game.stations[s])) { ui.toast(`Requires ${r.station.join(' + ')}.`, 'bad'); return }
  for (const [k, v] of Object.entries(r.cost)) if ((game.inventory.get(k) || 0) < v) { ui.toast(`Missing ${k}.`, 'bad'); return }
  for (const [k, v] of Object.entries(r.cost)) { const have = game.inventory.get(k) || 0; if (have - v <= 0) game.inventory.delete(k); else game.inventory.set(k, have - v) }
  const count = r.count || 1
  if (r.stationBuild) { game.stations[r.id] = true; ui.toast(`${r.item} installed at base. Tiers unlocked.`, 'good'); ui.banner('BASE UPGRADED', r.item.toUpperCase(), 3) }
  else if (r.effect === 'wings') {
    player.wings = true; player.wingsUpgraded = true; player.maxFlight = 160; player.flight = 160
    ui.toast('Hellfire Wings fused to your armor. Flight energy increased.', 'good'); ui.banner('ASCENSION', 'HELLFIRE WINGS', 3)
  } else { game.addItem(r.item, count); ui.toast(`Crafted ${r.item}${count > 1 ? ' ×' + count : ''}.`, 'good') }
  game.inventoryDirty = true; audio.craft()
}
game.usePotion = () => {
  if (player.potionCd > 0 || !player.alive) return
  let name = null
  for (const n of ['Greater Healing Potion', 'Healing Potion', 'Mana Potion', 'Royal Jelly']) if ((game.inventory.get(n) || 0) > 0) { name = n; break }
  if (!name) { ui.toast('No consumables in your pack.', 'bad'); return }
  if (name === 'Mana Potion') { player.mana = Math.min(player.maxMana, player.mana + 60); ui.toast('Mana restored +60.', 'good') }
  else if (name === 'Greater Healing Potion') { player.health = Math.min(player.maxHealth, player.health + 110); ui.toast('Vitality restored +110.', 'good') }
  else if (name === 'Royal Jelly') { player.health = Math.min(player.maxHealth, player.health + 60); player.lastDamage = 99; ui.toast('Royal Jelly fortifies you.', 'good') }
  else { player.health = Math.min(player.maxHealth, player.health + 45); ui.toast('Vitality restored +45.', 'good') }
  game.consume(name, 1); player.potionCd = 1.2; audio.levelUp()
}
game.placeBed = pos => {
  const g = new THREE.Group()
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, .28, 2.1), new THREE.MeshStandardMaterial({ color: 0x5d3c24, roughness: .85 }))
  frame.position.y = .18; g.add(frame)
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.38, .26, 1.9), new THREE.MeshStandardMaterial({ color: 0xa83a44, roughness: .8, emissive: 0x230607, emissiveIntensity: .5 }))
  mattress.position.y = .43; g.add(mattress)
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.05, .16, .42), new THREE.MeshStandardMaterial({ color: 0xe6d7c0, roughness: .9 }))
  pillow.position.set(0, .58, -.67); g.add(pillow)
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, .8, .16), new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: .8 })); head.position.set(0, .5, -1.02); g.add(head)
  g.position.copy(pos); g.position.y -= .05
  scene.add(g); game.bedMesh = g; game.bedPos = pos.clone(); game.spawnPoint.copy(pos).add(new THREE.Vector3(0, .1, 0))
  return g
}
game.setBoss = boss => {
  game.boss = boss; game.bossType = boss.name
  ui.bossWrap.classList.remove('hidden'); ui.bossName.textContent = boss.name; ui.bossFill.style.width = '100%'
  audio.bossRoar(); ui.banner('TRIAL BEGINS', boss.name, 4.2)
  game.projectiles.clearEnemyProjectiles()
}
game.summonBoss = type => {
  if (game.boss) { ui.toast('A trial already walks this place.', 'bad'); return }
  if (game.defeatedBosses[type]) { ui.toast('That trial has already been broken.', 'bad'); return }
  if (type === 'eye') new EyeBoss(game)
  else if (type === 'queen') new QueenBoss(game)
  else if (type === 'wall') new WallBoss(game)
  player.releaseGrapple(); player.mining = null; game.mining = null
}
game.onBossDeath = boss => {
  const key = boss.name === 'EYE OF CTHULHU' ? 'eye' : boss.name === 'QUEEN BEE' ? 'queen' : 'wall'
  game.defeatedBosses[key] = true
  game.boss = null
  game.stats.kills++
  const rewards = key === 'eye' ? [['life crystal', 1], ['demonite', 8], ['gold', 6], ['crystal shard', 3]]
    : key === 'queen' ? [['life crystal', 1], ['honey', 12], ['hive', 8], ['royal jelly', 0]]
      : [['life crystal', 2], ['hellstone', 30], ['crimtane', 20], ['ember crystal', 6], ['gold', 20]]
  for (const [n, c] of rewards) if (n && c) game.loot(n, c)
  if (key === 'wall') {
    game.sealedBroken = true
    ui.banner('THE SEAL BREAKS', 'WALL OF FLESH FALLS', 6)
    ui.toast('The way up is open. The surface is yours to take.', 'gold')
    fx.spawnBurst(player.position.clone().add(new THREE.Vector3(0, 3, 0)), 0xffd36a, 80, 12, .22)
  } else {
    ui.banner('TRIAL COMPLETE', boss.name + ' FALLS', 4)
  }
  game.inventoryDirty = true
  audio.event()
}
game.respawn = () => {
  const pos = game.bedPos ? game.bedPos.clone().add(new THREE.Vector3(0, 1.1, 0)) : world.spawnPoint.clone()
  player.respawn(pos)
}
game.restartBoss = () => { if (game.boss) { scene.remove(game.boss.root); game.boss.dead = true; game.boss = null; ui.bossWrap.classList.add('hidden') } }

/* ---------------- resize / render ---------------- */
function onResize() {
  const w = window.innerWidth, h = window.innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h; camera.updateProjectionMatrix()
  fx.resize(w, h)
}
window.addEventListener('resize', onResize)
onResize()

/* ---------------- main loop ---------------- */
let last = performance.now()
let time = 0
let frameCount = 0
let fpsTimer = 0
let qualityStage = 0

function frame(now) {
  requestAnimationFrame(frame)
  const rawReal = Math.max(.001, (now - last) / 1000); last = now
  const raw = Math.min(.05, rawReal)
  const dt = game.paused ? 0 : raw
  game.realDt = rawReal
  time += dt
  frameCount++; fpsTimer += rawReal
  if (fpsTimer > 1.2 && time > 4) {
    const fps = frameCount / fpsTimer
    if (qualityStage === 0 && fps < 34) { qualityStage = 1; fx.setQuality(.35); renderer.setPixelRatio(1); onResize() }
    else if (qualityStage === 1 && fps < 22) { qualityStage = 2; fx.setQuality(.1); renderer.setPixelRatio(.7); onResize() }
    frameCount = 0; fpsTimer = 0
  }
  if (!game.paused) {
    game.dayTime = (game.dayTime + dt / 600) % 1
    player.update(dt, time)
    enemies.update(dt, time)
    projectiles.update(dt)
    world.update(dt, time)
    if (game.boss && !game.boss.dead) game.boss.update(dt, time)
    ui.update(player, game, dt)
  }
  fx.update(dt || raw * .3, time, player)
  fx.render()
  if (!game.started) {
    game.started = true
    loading.style.opacity = '0'
    setTimeout(() => { loading.style.display = 'none' }, 800)
    setTimeout(() => ui.toast('You wake in the Underworld. Ascend, survivor.', 'gold'), 1400)
    setTimeout(() => ui.banner('THE UNDERWORLD', 'ASCEND OR BE CONSUMED', 4.5), 900)
  }
}

// Expose a small, stable debug surface for automated visual tests.
window.__ZENITH = {
  game, world, player, enemies, fx, ui, THREE,
  teleport(x, y, z) { player.position.set(x, y, z); player.velocity.set(0, 0, 0); },
  setTime(t) { game.dayTime = t },
  summon(t) { game.summonBoss(t) },
  give(n, c = 1) { game.loot(n, c) },
  heal() { player.health = player.maxHealth; player.mana = player.maxMana },
  god(v = true) { game.godMode = v },
  setPaused(v) { game.paused = v },
  surface() { const h = world.surfaceHeight(32, 32); this.teleport(32.5, h + 2.1, 32.5); player.yaw = Math.PI * .25; player.pitch = -.08 },
  stats() { return { pos: player.position.toArray(), hp: player.health, boss: game.boss?.name || null, enemies: enemies.list.length, fps: ui.fpsShown, calls: renderer.info.render.calls, tris: renderer.info.render.triangles } },
  quality() { return { stage: qualityStage, ratio: renderer.getPixelRatio(), bloom: fx.bloom.enabled } }
}

requestAnimationFrame(frame)
