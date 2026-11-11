import * as THREE from 'three'
import { B, BLOCKS, tileFor } from './blocks.js'
import { getTextures } from './textures.js'
import { itemDef } from './items.js'

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
const clamp = THREE.MathUtils.clamp

function mat(color, rough = .6, metal = .1, emissive = 0, intensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: intensity })
}

let softGlow = null
function glowSpriteTexture() {
  if (softGlow) return softGlow
  const c = document.createElement('canvas'); c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 62)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(.18, 'rgba(255,235,190,.9)')
  grd.addColorStop(.5, 'rgba(255,150,60,.28)')
  grd.addColorStop(1, 'rgba(255,80,10,0)')
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128)
  softGlow = new THREE.CanvasTexture(c)
  softGlow.colorSpace = THREE.SRGBColorSpace
  return softGlow
}

export class Player {
  constructor(game) {
    this.game = game
    this.camera = game.camera
    this.world = game.world
    this.position = this.world.spawnPoint.clone()
    this.velocity = V()
    this.yaw = 0
    this.pitch = .06
    this.health = 120; this.maxHealth = 120
    this.mana = 100; this.maxMana = 100
    this.flight = 100; this.maxFlight = 100
    this.wings = true; this.wingsUpgraded = false
    this.alive = true; this.grounded = false; this.invuln = 0
    this.walkPhase = 0; this.moveAmount = 0
    this.mousePrimary = false; this.mouseSecondary = false
    this.keys = {}
    this.touchMove = new THREE.Vector2()
    this.jumpRequest = false
    this.dashCd = 0; this.dashTimer = 0
    this.attackCd = 0; this.mineCd = 0; this.placeCd = 0; this.potionCd = 0
    this.grapple = null
    this.mining = null
    this.target = null
    this.lastDamage = 99; this.lavaTimer = 0; this.regenTimer = 0
    this.shake = 0; this.viewKick = 0; this.swing = 0
    this.thirdPerson = false
    this.footTimer = 0
    this.debug = false
    this.touchJump = 0
    this.baseFov = 72
    this.buildViewmodel()
    this.buildAvatar()
    this.setupLight()
    this.setupInput()
    this.updateCamera(0)
  }

  setupLight() {
    // a soft fill on the viewmodel only; the real lantern is projected ahead of the player
    const l = new THREE.PointLight(0xffb066, 1.1, 3.5, 2)
    l.position.set(0, -.1, -.2); this.camera.add(l); this.light = l
    this.worldLight = new THREE.PointLight(0xffc08a, 20, 19, 2)
    this.game.scene.add(this.worldLight)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: 0xffa050, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false }))
    glow.scale.set(2.6, 2.6, 1); glow.position.set(0, -.25, -.8); this.camera.add(glow); this.lanternGlow = glow
  }

  /* ---------------- view models ---------------- */
  buildViewmodel() {
    const vm = new THREE.Group(); vm.position.set(.36, -.33, -.66); vm.scale.setScalar(.42)
    this.camera.add(vm); this.viewmodel = vm
    this.models = {}
    const skin = new THREE.MeshBasicMaterial({ color: 0xa57451 })
    const armor = new THREE.MeshBasicMaterial({ color: 0x3b2826 })
    const leather = new THREE.MeshBasicMaterial({ color: 0x3a2314 })
    const steel = new THREE.MeshBasicMaterial({ color: 0xaeb7c6 })
    const gold = new THREE.MeshBasicMaterial({ color: 0xd0a04b })

    // sword — heavy hellforged blade with a molten rune channel
    const sword = new THREE.Group()
    // the whole weapon (blade, guard, grip, hand) lives in one pivot so nothing
    // detaches when the pose or swing rotation changes
    const bladePivot = new THREE.Group(); bladePivot.rotation.set(-.26, 0, .27); sword.add(bladePivot)
    const bladeGeo = new THREE.BoxGeometry(.085, .78, .022)
    const blade = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({ color: 0x828b99, roughness: .26, metalness: .92, emissive: 0x240902, emissiveIntensity: .6 }))
    blade.position.y = .39; bladePivot.add(blade)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.045, .17, 4), steel)
    tip.position.y = .865; tip.rotation.y = Math.PI / 4; bladePivot.add(tip)
    const fuller = new THREE.Mesh(new THREE.BoxGeometry(.014, .6, .006), new THREE.MeshBasicMaterial({ color: 0xffb066 }))
    fuller.position.set(0, .4, .013); bladePivot.add(fuller)
    for (let i = 0; i < 3; i++) {
      const rune = new THREE.Mesh(new THREE.BoxGeometry(.034, .012, .008), new THREE.MeshBasicMaterial({ color: 0xff7a24 }))
      rune.position.set(0, .22 + i * .15, .014); bladePivot.add(rune)
    }
    const guard = new THREE.Mesh(new THREE.BoxGeometry(.31, .05, .07), gold); guard.position.y = .005; bladePivot.add(guard)
    for (const s of [-1, 1]) {
      const quillon = new THREE.Mesh(new THREE.ConeGeometry(.032, .1, 4), gold)
      quillon.position.set(s * .18, .015, 0); quillon.rotation.z = s * -Math.PI / 2; bladePivot.add(quillon)
    }
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(.038, .042, .22, 8), leather); grip.position.y = -.12; bladePivot.add(grip)
    const pommel = new THREE.Mesh(new THREE.SphereGeometry(.052, 8, 6), gold); pommel.position.y = -.245; bladePivot.add(pommel)
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.115, .15, .125), skin); hand.position.set(0, -.1, .01); bladePivot.add(hand)
    const forearm = new THREE.Mesh(new THREE.BoxGeometry(.135, .34, .135), new THREE.MeshBasicMaterial({ color: 0x4a3024 })); forearm.position.set(.01, -.31, .025); forearm.rotation.z = -.06; bladePivot.add(forearm)
    sword.position.set(-.02, -.02, .02)
    this.models.sword = sword; vm.add(sword)

    // bow
    const bow = new THREE.Group()
    const arc = new THREE.Mesh(new THREE.TorusGeometry(.44, .026, 5, 26, Math.PI * 1.05), mat(0x54321f, .7, .15)); arc.rotation.z = Math.PI / 2; bow.add(arc)
    const stringGeo = new THREE.BufferGeometry().setFromPoints([V(0, .44, 0), V(.12, 0, 0), V(0, -.44, 0)])
    bow.add(new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color: 0xd9cdb7, transparent: true, opacity: .6 })))
    const grip2 = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .22, 6), leather); grip2.position.set(.1, 0, 0); bow.add(grip2)
    const nock = new THREE.Mesh(new THREE.ConeGeometry(.025, .6, 5), mat(0xc8b0ff, .3, .6, 0x4a2a90, 1.2)); nock.position.set(-.18, 0, 0); nock.rotation.z = Math.PI / 2; bow.add(nock)
    bow.position.set(.03, -.08, .04); bow.rotation.x = -.2
    this.models.bow = bow; vm.add(bow)

    // staff
    const staff = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, 1.25, 6), mat(0x31223c, .65, .3)); shaft.rotation.z = -.25; staff.add(shaft)
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.12, 1), new THREE.MeshBasicMaterial({ color: 0xd8a4ff })); orb.position.set(.05, .6, 0); staff.add(orb)
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(.17 + i * .04, .008, 4, 20), new THREE.MeshBasicMaterial({ color: 0xb078ff, transparent: true, opacity: .6 })); r.position.copy(orb.position); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); staff.add(r) }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: 0xc48aff, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.set(.65, .65, 1); glow.position.copy(orb.position); staff.add(glow)
    staff.position.set(.05, -.16, .04); staff.rotation.x = -.1
    this.models.staff = staff; this.staffOrb = orb; vm.add(staff)

    // pickaxe
    const pick = new THREE.Group()
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .9, 6), mat(0x5a3b24, .8, .05)); handle.rotation.z = -.6; handle.position.y = .1; pick.add(handle)
    const head = new THREE.Mesh(new THREE.BoxGeometry(.62, .09, .1), mat(0xa8b0bf, .28, .9, 0x2a1408, .2)); head.position.set(-.18, .5, 0); head.rotation.z = -.12; pick.add(head)
    const tipA = new THREE.Mesh(new THREE.ConeGeometry(.06, .32, 4), steel); tipA.position.set(-.48, .53, 0); tipA.rotation.z = Math.PI / 2; pick.add(tipA)
    const tipB = tipA.clone(); tipB.position.x = .12; tipB.rotation.z = -Math.PI / 2; pick.add(tipB)
    pick.position.set(.1, -.2, .02)
    this.models.pick = pick; vm.add(pick)

    // torch
    const torch = new THREE.Group()
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.04, .055, .7, 6), leather); stick.position.set(-.05, -.05, 0); stick.rotation.z = -.2; torch.add(stick)
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSpriteTexture(), color: 0xffb45a, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false })); flame.scale.set(.28, .44, 1); flame.position.set(-.02, .36, 0); torch.add(flame)
    const ember = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 5), new THREE.MeshBasicMaterial({ color: 0xffc46a })); ember.position.set(-.02, .26, 0); torch.add(ember)
    torch.position.set(.02, -.12, .04)
    this.models.torch = torch; this.torchFlame = flame; vm.add(torch)

    // block
    const block = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshStandardMaterial({ color: 0x7b5a94, roughness: .5, metalness: .2, emissive: 0x1c0a24, emissiveIntensity: .4 }))
    block.position.set(.02, -.15, .02); block.rotation.set(.3, .5, .2)
    this.models.block = block; vm.add(block)

    const bed = new THREE.Group()
    const bframe = new THREE.Mesh(new THREE.BoxGeometry(.48, .1, .28), leather); bed.add(bframe)
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(.44, .11, .24), mat(0xa53b45, .8, 0)); mattress.position.y = .07; bed.add(mattress)
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(.12, .07, .2), mat(0xe6d7c0, .9)); pillow.position.set(-.15, .14, 0); bed.add(pillow)
    bed.position.set(.04, -.2, .02); bed.rotation.set(.2, .4, 0)
    this.models.bed = bed; vm.add(bed)

    for (const k in this.models) this.models[k].visible = false
    this.models.sword.visible = true
    this.hand = new THREE.Mesh(new THREE.BoxGeometry(.13, .26, .13), skin); this.hand.position.set(-.18, -.22, .02); this.hand.visible = false; vm.add(this.hand)
  }

  buildAvatar() {
    const g = new THREE.Group(); g.visible = false
    const armor = mat(0x4b3430, .42, .55, 0x1c0705, .4)
    const dark = mat(0x241a1b, .7, .25)
    const gold = mat(0xc3974e, .32, .7, 0x352006, .4)
    const skin = mat(0xb27a58, .7)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.56, .68, .32), armor); torso.position.y = 1.16; g.add(torso)
    const hip = new THREE.Mesh(new THREE.BoxGeometry(.46, .22, .28), dark); hip.position.y = .76; g.add(hip)
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.18, .62, .2), dark); leg.position.set(s * .14, .42, 0); g.add(leg)
      const boot = new THREE.Mesh(new THREE.BoxGeometry(.2, .18, .28), armor); boot.position.set(s * .14, .1, .03); g.add(boot)
      const sh = new THREE.Mesh(new THREE.SphereGeometry(.19, 8, 6), gold); sh.scale.set(1, .7, 1); sh.position.set(s * .35, 1.4, 0); g.add(sh)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.14, .56, .16), armor); arm.position.set(s * .36, 1.08, 0); g.add(arm)
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(.36, .34, .34), skin); head.position.y = 1.68; g.add(head)
    const helm = new THREE.Mesh(new THREE.ConeGeometry(.27, .3, 5), armor); helm.position.y = 1.94; g.add(helm)
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(.045, .26, 5), gold); horn.position.set(s * .2, 1.95, 0); horn.rotation.z = s * .5; g.add(horn)
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.025, 5, 4), new THREE.MeshBasicMaterial({ color: 0xff9a4e })); eye.position.set(s * .08, 1.71, .176); g.add(eye)
    }
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(.58, 1.0), new THREE.MeshStandardMaterial({ color: 0x4a1218, roughness: .9, side: THREE.DoubleSide, emissive: 0x1a0304, emissiveIntensity: .4 }))
    cape.position.set(0, 1.08, -.19); cape.rotation.x = .16; g.add(cape); this.cape = cape
    const sheath = new THREE.Mesh(new THREE.BoxGeometry(.06, .9, .05), gold); sheath.position.set(.12, 1.15, -.22); sheath.rotation.z = .35; g.add(sheath)
    this.avatar = g; this.game.scene.add(g)
  }

  setupInput() {
    const onKey = (e, down) => {
      if (e.code === 'Tab' || e.code === 'KeyH' || e.code === 'Escape') return
      this.keys[e.code] = down
      if (!down) return
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5)); if (n >= 1 && n <= 8) this.game.selectSlot(n - 1)
      }
      if (e.code === 'KeyF') this.tryPlace()
      if (e.code === 'KeyQ') this.dash()
      if (e.code === 'KeyG') this.grappleHook()
      if (e.code === 'KeyE') this.interact()
      if (e.code === 'KeyV') this.toggleView()
      if (e.code === 'KeyM') { this.game.audio.setMuted(!this.game.audio.muted); this.game.ui.toast(this.game.audio.muted ? 'Audio muted.' : 'Audio online.') }
      if (e.code === 'Space') this.jumpRequest = true
      if (e.code === 'KeyR') this.game.usePotion()
    }
    window.addEventListener('keydown', e => onKey(e, true))
    window.addEventListener('keyup', e => onKey(e, false))
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement === this.game.canvas) this.look(e.movementX, e.movementY)
    })
    this.game.canvas.addEventListener('contextmenu', e => e.preventDefault())
    document.addEventListener('mousedown', e => {
      if (this.game.paused || !this.alive) return
      if (e.button === 0) { this.mousePrimary = true; this.primary() }
      if (e.button === 2) { this.mouseSecondary = true; this.mineCd = 0 }
    })
    document.addEventListener('mouseup', e => {
      if (e.button === 0) {
        this.mousePrimary = false; this.miningActive = false
        if (this.game.hotbar[this.game.selected] === 'Pickaxe') this.mouseSecondary = false
      }
      if (e.button === 2) this.mouseSecondary = false
    })
  }

  toggleView() {
    this.thirdPerson = !this.thirdPerson
    this.avatar.visible = this.thirdPerson
    this.viewmodel.visible = !this.thirdPerson
    this.game.ui.toast(this.thirdPerson ? 'Third-person vantage.' : 'First-person vantage.')
  }

  look(dx, dy) {
    const sens = .0022
    this.yaw -= dx * sens
    this.pitch = clamp(this.pitch - dy * sens, -1.45, 1.45)
  }

  requestJump() { this.jumpRequest = true }

  dash() {
    if (this.dashCd > 0 || !this.alive) return
    this.dashCd = 2.6; this.dashTimer = .22; this.invuln = Math.max(this.invuln, .34)
    const f = this.forward()
    this.velocity.x += f.x * 17; this.velocity.z += f.z * 17
    if (!this.grounded) this.velocity.y = Math.max(this.velocity.y, 3)
    this.game.fx.spawnBurst(this.position.clone().add(V(0, .9, 0)), 0xffb06a, 20, 5, .12)
    this.game.audio.burst(.2, .12, 1400, 'bandpass')
    this.viewKick = .06
  }

  grappleHook() {
    if (this.grapple) { this.releaseGrapple(); return }
    const origin = this.camera.position.clone()
    const dir = this.forward()
    const hit = this.world.raycast(origin, dir, 26)
    if (hit.hit) {
      const point = hit.point.clone().addScaledVector(dir, -.1)
      const geo = new THREE.BufferGeometry().setFromPoints([origin, point])
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: .85 }))
      this.game.scene.add(line)
      this.grapple = { point, time: 1.5, line }
      this.game.audio.tone(640, .15, 'triangle', .08, 200)
      this.game.ui.toast('Grapple anchored.', 'gold')
    } else this.game.ui.toast('No anchor in reach.', 'bad')
  }
  releaseGrapple() { if (this.grapple) { this.game.scene.remove(this.grapple.line); this.grapple.line.geometry.dispose(); this.grapple = null } }

  forward() {
    return V(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)).normalize()
  }

  interact() {
    if (this.game.boss) { this.game.ui.toast('The altar is dormant while a trial is active.', 'bad'); return }
    if (this.game.bedPos && this.position.distanceTo(this.game.bedPos) < 4) {
      this.health = this.maxHealth; this.mana = this.maxMana
      this.game.spawnPoint.copy(this.game.bedPos)
      this.game.ui.toast('You rest at your bed. Respawn anchor secured.', 'good')
      this.game.audio.levelUp()
      return
    }
    if (this.position.distanceTo(this.world.altar) < 5.2) {
      this.game.ui.openRitual()
      return
    }
    this.game.ui.toast('Nothing responds to your touch.', 'bad')
  }

  /* ---------------- combat / actions ---------------- */
  primary() {
    const name = this.game.hotbar[this.game.selected]
    const def = itemDef(name)
    if (def.type === 'weapon') this.attack()
    else if (def.type === 'tool') { this.mouseSecondary = true; this.miningActive = true }
    else if (def.type === 'placeable') this.tryPlace()
    else if (def.type === 'consumable') this.game.usePotion()
  }

  attack() {
    if (!this.alive || this.attackCd > 0) return
    const name = this.game.hotbar[this.game.selected]
    const heavy = name === 'Hellforged Edge'
    const cd = name === 'Ember Blade' ? .42 : heavy ? .34 : name === 'Demon Bow' ? .55 : name === 'Storm Bow' ? .42 : .6
    this.attackCd = cd
    if (name === 'Ember Blade' || name === 'Hellforged Edge') {
      this.swing = 1
      this.game.audio.swing()
      const dmg = heavy ? 58 : 34
      const origin = this.camera.position.clone()
      const dir = this.forward()
      setTimeout(() => this.game.enemies.damageInArc(origin, dir, heavy ? 5.4 : 4.9, heavy ? 1.2 : 1.0, dmg), 70)
      this.viewKick = .035
    } else if (name === 'Demon Bow' || name === 'Storm Bow') {
      this.game.audio.bow()
      const dir = this.forward().add(V((Math.random() - .5) * .012, (Math.random() - .5) * .012, 0)).normalize()
      const origin = this.camera.position.clone().addScaledVector(dir, .6).add(V(0, -.1, 0))
      this.game.projectiles.playerArrow(origin, dir, name === 'Storm Bow' ? 41 : 26, name === 'Storm Bow' ? 0x8dfff0 : 0xb4b0ff, 44)
      this.swing = .6
    } else if (name === 'Starfall Staff' || name === 'Nova Staff') {
      const cost = name === 'Nova Staff' ? 14 : 10
      if (this.mana < cost) { this.game.ui.toast('Not enough arcane energy.', 'bad'); this.game.audio.burst(.1, .05, 300); return }
      this.mana -= cost
      this.game.audio.magic()
      const dir = this.forward()
      const origin = this.camera.position.clone().addScaledVector(dir, .5).add(V(0, -.08, 0))
      this.game.projectiles.playerMagic(origin, dir, name === 'Nova Staff' ? 38 : 22, name === 'Nova Staff' ? 0xffb8f5 : 0xd29bff)
      this.swing = .7
    }
  }

  tryPlace() {
    if (this.placeCd > 0 || !this.alive) return
    const name = this.game.hotbar[this.game.selected]
    if (itemDef(name).type !== 'placeable') return
    if ((this.game.inventory.get(name) || 0) <= 0) { this.game.ui.toast(`No ${name} left. Craft more with TAB.`, 'bad'); return }
    const hit = this.world.raycast(this.camera.position, this.forward(), 6.2)
    if (!hit.hit) { this.game.ui.toast('Aim at a surface to place.', 'bad'); return }
    const pos = new THREE.Vector3(hit.x, hit.y, hit.z).add(hit.normal)
    if (name === 'Torch') {
      const p = new THREE.Vector3(hit.x + .5, hit.y + .5, hit.z + .5).addScaledVector(hit.normal, .52)
      this.game.fx.addTorch(p); this.game.consume(name, 1); this.game.audio.pickup(); this.placeCd = .28
      return
    }
    if (name === 'Bed') {
      const p = new THREE.Vector3(hit.x + .5, hit.y + 1, hit.z + .5)
      const grp = this.game.placeBed(p); this.game.consume(name, 1); this.placeCd = .5
      this.game.ui.toast('Bed placed. Respawn anchored. Press E to rest.', 'good')
      return
    }
    const blockMap = { 'Obsidian Brick': B.OBSIDIANBRICK, 'Ash Brick': B.ASHBRICK, Planks: B.PLANKS }
    const id = blockMap[name] ?? B.STONE
    if (this.game.world.getBlock(pos.x, pos.y, pos.z) !== B.AIR) { this.game.ui.toast('No room there.', 'bad'); return }
    this.game.world.setBlock(pos.x, pos.y, pos.z, id, true)
    this.game.world.flushDirty()
    this.game.consume(name, 1); this.game.audio.breakBlock(); this.placeCd = .22
    this.game.fx.spawnBurst(new THREE.Vector3(pos.x + .5, pos.y + .5, pos.z + .5), 0xffd08a, 5, 2, .07)
  }

  setMining(v) { this.mouseSecondary = v; if (v) this.miningActive = true }

  /* ---------------- physics & update ---------------- */
  update(dt, time) {
    if (!this.alive) { this.updateCamera(dt); return }
    this.attackCd = Math.max(0, this.attackCd - dt); this.dashCd = Math.max(0, this.dashCd - dt)
    this.mineCd = Math.max(0, this.mineCd - dt); this.placeCd = Math.max(0, this.placeCd - dt); this.potionCd = Math.max(0, this.potionCd - dt)
    this.invuln = Math.max(0, this.invuln - dt); this.dashTimer = Math.max(0, this.dashTimer - dt)
    this.lastDamage += dt
    this.shake = Math.max(0, this.shake - dt * 2.2)
    this.viewKick = Math.max(0, this.viewKick - dt * 1.6)
    this.swing = Math.max(0, this.swing - dt * 4.2)
    this.gamepad()

    const forward = this.keys.KeyW ? 1 : 0, back = this.keys.KeyS ? 1 : 0
    const left = this.keys.KeyA ? 1 : 0, right = this.keys.KeyD ? 1 : 0
    let ix = right - left + this.touchMove.x
    let iz = forward - back + this.touchMove.y
    const mag = Math.hypot(ix, iz); if (mag > 1) { ix /= mag; iz /= mag }
    const sprint = this.keys.ShiftLeft || this.keys.ShiftRight
    const speed = (sprint ? 7.6 : 5.4) * (this.inLiquid ? .7 : 1)
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw)
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw)
    const targetVx = (fx * iz + rx * ix) * speed
    const targetVz = (fz * iz + rz * ix) * speed
    const accel = this.grounded ? 16 : 6
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetVx, accel, dt)
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetVz, accel, dt)
    this.moveAmount = Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / 6)

    // flight / jump
    const space = this.keys.Space || this.touchMove.jump > 0 || this.jumpRequest
    if (this.jumpRequest && this.grounded) {
      this.velocity.y = 9.4; this.grounded = false; this.game.audio.jump()
      this.jumpRequest = false
    }
    if (space && !this.grounded && this.wings && this.flight > 0 && this.velocity.y < 8.5) {
      this.velocity.y += 34 * dt
      this.velocity.y = Math.min(this.velocity.y, this.wingsUpgraded ? 9.5 : 7.2)
      this.flight -= 21 * dt
      if (Math.sin(time * 24) > .7) this.game.fx.spawnBurst(this.position.clone().add(V(0, .3, 0)), 0xff8a40, 1, .5, .06)
    }
    if (this.grounded) this.flight = Math.min(this.maxFlight, this.flight + 34 * dt)
    this.jumpRequest = false

    this.velocity.y -= 25 * dt
    if (this.velocity.y < -34) this.velocity.y = -34
    if (this.keys.KeyC) this.velocity.y -= 18 * dt

    // grapple pull
    if (this.grapple) {
      this.grapple.time -= dt
      const to = this.grapple.point.clone().sub(this.camera.position)
      const dist = to.length()
      if (dist < 1.8 || this.grapple.time <= 0) this.releaseGrapple()
      else {
        const pull = to.normalize().multiplyScalar(38)
        this.velocity.addScaledVector(pull, dt)
        this.velocity.clampLength(0, 22)
        this.grapple.line.geometry.attributes.position.array[0] = this.camera.position.x
        this.grapple.line.geometry.attributes.position.array[1] = this.camera.position.y - .15
        this.grapple.line.geometry.attributes.position.array[2] = this.camera.position.z
        this.grapple.line.geometry.attributes.position.needsUpdate = true
      }
    }

    const vBefore = this.velocity.y
    this.moveAndCollide(dt)
    if (this.grounded && vBefore < -17) {
      const dmg = Math.round((-vBefore - 17) * 5)
      if (dmg > 2) this.takeDamage(dmg, 'a lethal fall', this.position)
    }

    // liquids
    const atFeet = this.world.getBlock(this.position.x, this.position.y + .15, this.position.z)
    const atBody = this.world.getBlock(this.position.x, this.position.y + 1.1, this.position.z)
    this.inLiquid = atBody === B.WATER || atBody === B.HONEY || atFeet === B.WATER || atFeet === B.HONEY
    const inLava = atFeet === B.LAVA || atBody === B.LAVA || this.world.getBlock(this.position.x, this.position.y - .1, this.position.z) === B.LAVA
    if (inLava) {
      this.lavaTimer -= dt
      if (this.lavaTimer <= 0) {
        this.takeDamage(13, 'the molten Underworld', this.position, true)
        this.lavaTimer = .32
        this.game.ui.flashLava()
        this.game.audio.burst(.25, .12, 300)
      }
      this.velocity.y = Math.max(this.velocity.y, -2.5)
    } else this.lavaTimer = 0

    // mining
    if (this.mouseSecondary || this.miningActive) this.doMining(dt, time)
    else { this.mining = null; this.game.mining = null; this.miningActive = false }
    if (this.mousePrimary && this.attackCd <= 0) this.primary()

    // attack cooldown and held firing handled in primary via attackCd
    // regen
    if (this.lastDamage > 7) this.health = Math.min(this.maxHealth, this.health + 2.2 * dt)
    this.mana = Math.min(this.maxMana, this.mana + 8.5 * dt)
    if (this.position.y < -3) this.takeDamage(999, 'the void beyond the world', this.position, true)

    // interaction prompt
    this.game.interactText = null
    if (this.game.bedPos && this.position.distanceTo(this.game.bedPos) < 4) this.game.interactText = 'Rest at bed / anchor respawn'
    else if (this.position.distanceTo(this.world.altar) < 5.2) this.game.interactText = this.game.boss ? 'The altar is dormant' : 'Use Ritual Altar'

    // target indicator
    const hit = this.world.raycast(this.camera.position, this.forward(), 6.5)
    this.target = hit
    const cross = this.game.ui.crosshair
    cross.classList.toggle('hot', hit.hit)

    // animations
    this.updateViewmodel(dt, time)
    if (this.thirdPerson) this.updateAvatar()
    this.updateCamera(dt)
    this.updateGrappleLine()
    if (this.grounded && this.moveAmount > .05) {
      this.footTimer -= dt
      if (this.footTimer <= 0) { this.game.audio.footstep(sprint); this.footTimer = sprint ? .26 : .36 }
    }
  }

  gamepad() {
    if (!navigator.getGamepads) return
    const pads = navigator.getGamepads()
    const gp = pads && pads[0]
    if (!gp) return
    const dz = v => Math.abs(v) < .18 ? 0 : v
    if (gp.axes[0] || gp.axes[1]) this.touchMove.set(dz(gp.axes[0]), -dz(gp.axes[1]))
    if (gp.axes.length > 3 && (Math.abs(gp.axes[2]) > .05 || Math.abs(gp.axes[3]) > .05)) this.look(gp.axes[2] * 14, gp.axes[3] * 14)
    if (gp.buttons[0]?.pressed) this.jumpRequest = true
    if (gp.buttons[7]?.pressed) { if (this.attackCd <= 0) this.attack() }
    if (gp.buttons[6]?.pressed) this.mouseSecondary = true; else if (gp.buttons[6] && !gp.buttons[6].pressed) this.mouseSecondary = false
    if (gp.buttons[2]?.pressed) this.dash()
    if (gp.buttons[3]?.pressed) this.grappleHook()
    if (gp.buttons[9]?.pressed) this.game.ui.toggleInventory()
  }

  moveAndCollide(dt) {
    const w = .32, h = 1.76
    const p = this.position
    const dx = this.velocity.x * dt
    p.x += dx
    if (this.world.boxCollides(p.x - w, p.y + .02, p.z - w, p.x + w, p.y + h, p.z + w)) { p.x -= dx; this.velocity.x = 0 }
    const dz = this.velocity.z * dt
    p.z += dz
    if (this.world.boxCollides(p.x - w, p.y + .02, p.z - w, p.x + w, p.y + h, p.z + w)) { p.z -= dz; this.velocity.z = 0 }
    const dy = this.velocity.y * dt
    p.y += dy
    if (this.world.boxCollides(p.x - w, p.y + .02, p.z - w, p.x + w, p.y + h, p.z + w)) {
      p.y -= dy
      if (this.velocity.y < 0) this.grounded = true
      this.velocity.y = 0
    } else this.grounded = false
  }

  doMining(dt, time) {
    const hit = this.world.raycast(this.camera.position, this.forward(), 6.2)
    if (!hit.hit) { this.mining = null; this.game.mining = null; return }
    const block = BLOCKS[hit.block]
    if (!block || hit.block === B.LIFECRYSTAL) {
      // life crystals are mineable, others fall through
    }
    if (!this.mining || this.mining.x !== hit.x || this.mining.y !== hit.y || this.mining.z !== hit.z) {
      this.mining = { x: hit.x, y: hit.y, z: hit.z, progress: 0, name: block.name }
    }
    this.mining.progress += dt * 1.5 / Math.max(.15, block.hardness)
    this.game.mining = this.mining
    if (this.mineCd <= 0) { this.game.audio.mine(); this.mineCd = .22; this.game.fx.spawnBurst(hit.point.clone().addScaledVector(hit.normal, .08), block.tint || 0xffffff, 3, 1.8, .06) }
    this.swing = Math.max(this.swing, .5)
    if (this.mining.progress >= 1) {
      this.breakBlock(hit)
      this.mining = null; this.game.mining = null
    }
  }

  breakBlock(hit) {
    const block = BLOCKS[hit.block]
    if (!block) return
    this.game.world.setBlock(hit.x, hit.y, hit.z, B.AIR, true)
    this.game.world.flushDirty()
    this.game.stats.blocks++
    this.game.audio.breakBlock()
    this.game.fx.spawnBurst(new THREE.Vector3(hit.x + .5, hit.y + .5, hit.z + .5), block.tint || 0xffffff, 18, 3.5, .11)
    if (hit.block === B.LIFECRYSTAL) {
      this.maxHealth += 20
      this.health = Math.min(this.maxHealth, this.health + 55)
      this.game.stats.crystals++
      this.game.ui.toast(`Life Crystal shattered. Max vitality +20 (${this.maxHealth}).`, 'gold')
      this.game.audio.levelUp()
      this.game.fx.spawnBurst(new THREE.Vector3(hit.x + .5, hit.y + .5, hit.z + .5), 0xff6fbf, 40, 6, .16)
    } else if (block.drop) this.game.loot(block.drop, 1)
  }

  takeDamage(amount, cause, source, ignoreInvuln = false) {
    if (!this.alive) return
    if (!ignoreInvuln && this.invuln > 0) return
    if (this.game.godMode) amount = 0
    this.health -= amount
    this.lastDamage = 0
    this.invuln = .55
    this.shake = Math.min(1, 5 + amount * .06)
    if (amount > 0) { this.game.ui.flashDamage(); this.game.audio.hurt() }
    if (source) {
      const k = this.position.clone().sub(source); k.y = 0; const l = k.length()
      if (l > .01) { k.normalize().multiplyScalar(Math.min(5, amount * .18)); this.velocity.x += k.x; this.velocity.z += k.z; this.velocity.y = Math.max(this.velocity.y, 2.2) }
    }
    if (this.health <= 0) this.die(cause)
  }

  die(cause) {
    this.alive = false; this.health = 0
    this.game.scene.remove(this.avatar)
    this.game.ui.showDeath(cause || 'The world was patient.')
    this.game.audio.bossRoar()
    this.game.fx.spawnBurst(this.position.clone().add(V(0, 1, 0)), 0xff4030, 40, 8, .18)
  }

  respawn(pos) {
    this.alive = true; this.health = this.maxHealth; this.mana = this.maxMana; this.flight = this.maxFlight
    this.position.copy(pos); this.velocity.set(0, 0, 0); this.invuln = 2
    this.releaseGrapple(); this.mining = null; this.game.mining = null
    if (this.game.scene && !this.avatar.parent) this.game.scene.add(this.avatar)
    this.lastDamage = 99
    this.game.ui.hideDeath()
    this.game.enemies.clear(); this.game.projectiles.clearEnemyProjectiles()
    if (this.game.boss) { this.game.scene.remove(this.game.boss.root); this.game.boss = null; this.game.ui.bossWrap.classList.add('hidden') }
    this.game.ui.toast('You claw your way back from the dark.', 'good')
  }

  updateGrappleLine() {
    if (!this.grapple) return
    const arr = this.grapple.line.geometry.attributes.position.array
    arr[3] = this.grapple.point.x; arr[4] = this.grapple.point.y; arr[5] = this.grapple.point.z
    this.grapple.line.geometry.attributes.position.needsUpdate = true
  }

  updateCamera(dt) {
    const eye = this.position.clone(); eye.y += 1.62
    if (!this.thirdPerson || !this.alive) {
      this.camera.position.copy(eye)
      this.camera.rotation.order = 'YXZ'
      this.camera.rotation.set(this.pitch, this.yaw, 0)
    } else {
      const back = V(Math.sin(this.yaw) * 4.1, 1.4 - this.pitch * 1.6, Math.cos(this.yaw) * 4.1)
      const desired = eye.clone().add(back)
      const hit = this.world.raycast(eye, back.clone().normalize(), 4.2)
      if (hit.hit) desired.copy(eye).addScaledVector(back.clone().normalize(), Math.max(.5, hit.dist - .2))
      this.camera.position.copy(desired)
      this.camera.rotation.order = 'YXZ'
      this.camera.rotation.set(this.pitch, this.yaw, 0)
    }
    // the lantern hangs a couple of metres ahead so it lights the world without blowing out the viewmodel
    if (this.worldLight) {
      this.worldLight.position.copy(this.camera.position).addScaledVector(this.forward(), 2.6)
      this.worldLight.position.y -= .15
      this.worldLight.intensity = 20 + Math.sin(this.game.fx.time * 2.2) * 1.4
    }
    // bob & shake
    const bob = Math.sin(this.walkPhase) * .032 * this.moveAmount
    this.camera.position.y += bob
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - .5) * this.shake * .1
      this.camera.position.y += (Math.random() - .5) * this.shake * .1
      this.camera.rotation.z += (Math.random() - .5) * this.shake * .02
    }
    const targetFov = this.baseFov + (this.keys.ShiftLeft ? 5 : 0) + (this.dashTimer > 0 ? 9 : 0)
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt)
    this.camera.updateProjectionMatrix()
  }

  updateViewmodel(dt, time) {
    const sel = this.game.hotbar[this.game.selected]
    for (const k in this.models) {
      const visible = (k === 'sword' && sel === 'Ember Blade') || (k === 'sword' && sel === 'Hellforged Edge') ||
        (k === 'bow' && (sel === 'Demon Bow' || sel === 'Storm Bow')) ||
        (k === 'staff' && (sel === 'Starfall Staff' || sel === 'Nova Staff')) ||
        (k === 'pick' && sel === 'Pickaxe') ||
        (k === 'torch' && sel === 'Torch') ||
        (k === 'bed' && sel === 'Bed') ||
        (k === 'block' && (sel === 'Obsidian Brick' || sel === 'Ash Brick' || sel === 'Planks'))
      if (this.models[k]) this.models[k].visible = visible && !this.thirdPerson
    }
    this.hand.visible = false
    const speed = this.moveAmount
    this.walkPhase += dt * (6.5 + speed * 5)
    const bobX = Math.cos(this.walkPhase * .5) * .012 * speed
    const bobY = Math.abs(Math.sin(this.walkPhase * .5)) * .016 * speed
    this.viewmodel.position.x = .38 + bobX
    this.viewmodel.position.y = -.34 + bobY - this.viewKick * .4
    const swingAmt = this.swing
    if (this.models.sword.visible) {
      this.models.sword.rotation.set(-.06 - swingAmt * 1.5, .08 - swingAmt * .25, -.04 + Math.sin(swingAmt * Math.PI) * .7)
      this.models.sword.position.set(-.02, -.02, .02 - swingAmt * .16)
    }
    if (this.models.bow.visible) this.models.bow.rotation.y = -.1 + swingAmt * .2
    if (this.models.staff.visible) {
      this.models.staff.rotation.z = Math.sin(time * 1.5) * .02 + swingAmt * .3
      if (this.staffOrb) this.staffOrb.scale.setScalar(1 + Math.sin(time * 3.4) * .08)
    }
    if (this.models.pick.visible) this.models.pick.rotation.set(-swingAmt * 1.3, 0, Math.sin(time * 2) * .02)
    if (this.models.torch.visible && this.torchFlame) this.torchFlame.scale.set(.32 + Math.sin(time * 11) * .03, .5 + Math.sin(time * 13) * .05, 1)
    this.lanternGlow.material.opacity = .08 + Math.sin(time * 2.2) * .015
  }

  updateAvatar() {
    this.avatar.position.copy(this.position)
    this.avatar.rotation.y = this.yaw
    const bob = Math.abs(Math.sin(this.walkPhase * .5)) * .04 * this.moveAmount
    this.avatar.position.y += bob
    if (this.cape) this.cape.rotation.x = .12 + Math.sin(this.walkPhase * .5) * .06 + this.moveAmount * .1
  }
}
