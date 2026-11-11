import * as THREE from 'three'
import { B } from './blocks.js'

const rand = (a, b) => a + Math.random() * (b - a)
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

function basicMat(color, emissive = 0, intensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .05, emissive, emissiveIntensity: intensity })
}
function glowSprite(color, scale = 1, opacity = .7) {
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }))
}

/* ============================ PROJECTILES ============================ */
export class Projectile {
  constructor(game, opts) {
    this.game = game
    this.owner = opts.owner
    this.damage = opts.damage || 10
    this.velocity = opts.velocity.clone()
    this.gravity = opts.gravity ?? 0
    this.homing = opts.homing || 0
    this.life = opts.life ?? 5
    this.radius = opts.radius || .18
    this.color = opts.color ?? 0xffa040
    this.kind = opts.kind || 'bolt'
    this.dead = false
    this.trailPts = []
    this.root = new THREE.Group()
    const c = new THREE.Color(this.color)
    if (this.kind === 'arrow') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .8, 5), new THREE.MeshStandardMaterial({ color: 0x8f6a45, roughness: .8 }))
      shaft.rotation.x = Math.PI / 2; this.root.add(shaft)
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.055, .16, 5), new THREE.MeshStandardMaterial({ color: this.color, emissive: this.color, emissiveIntensity: .6 }))
      tip.position.z = .42; tip.rotation.x = Math.PI / 2; this.root.add(tip)
      const sp = glowSprite(this.color, .45, .35); this.root.add(sp)
    } else if (this.kind === 'stinger') {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.1, .45, 6), new THREE.MeshStandardMaterial({ color: 0xffcf6a, emissive: 0x572b08, emissiveIntensity: .4 }))
      cone.rotation.x = Math.PI / 2; this.root.add(cone)
    } else {
      const core = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 10, 8), new THREE.MeshBasicMaterial({ color: this.color }))
      this.root.add(core)
      const sp = glowSprite(this.color, this.radius * 7, .9); this.root.add(sp)
    }
    this.root.position.copy(opts.position)
    game.scene.add(this.root)
    const trailGeo = new THREE.BufferGeometry()
    trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24), 3))
    this.trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: this.color, transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false }))
    this.trail.frustumCulled = false
    game.scene.add(this.trail)
    const ta = trailGeo.attributes.position.array
    for (let i = 0; i < 8; i++) { ta[i * 3] = opts.position.x; ta[i * 3 + 1] = opts.position.y; ta[i * 3 + 2] = opts.position.z }
    trailGeo.attributes.position.needsUpdate = true
    this.trailTimer = 0
  }
  update(dt) {
    if (this.dead) return
    this.life -= dt
    if (this.life <= 0) return this.kill(false)
    if (this.homing) {
      const target = this.owner === 'player' ? this.game.enemies.nearest(this.root.position) : this.game.player.position
      if (target) {
        const desired = (this.owner === 'player' ? target : target.clone().add(V(0, .9, 0))).sub(this.root.position).normalize().multiplyScalar(this.velocity.length())
        this.velocity.lerp(desired, Math.min(1, this.homing * dt))
      }
    }
    this.velocity.y -= this.gravity * dt
    const old = this.root.position.clone()
    const step = this.velocity.clone().multiplyScalar(dt)
    const steps = Math.max(1, Math.ceil(step.length() / .25))
    for (let s = 0; s < steps; s++) {
      this.root.position.addScaledVector(step, 1 / steps)
      const block = this.game.world.getBlock(this.root.position.x, this.root.position.y, this.root.position.z)
      if (block !== B.AIR && block !== B.LAVA && block !== B.WATER && block !== B.HONEY && block !== B.GLOWSHROOM && block !== B.CRYSTAL) {
        this.game.fx.spawnBurst(this.root.position, this.color, 8, 4, .1)
        return this.kill(false)
      }
      if (this.owner === 'player') {
        const hit = this.game.enemies.hitAt(this.root.position, this.radius + .3)
        if (hit) { hit.damage(this.damage); this.game.fx.spawnBurst(this.root.position, this.color, 14, 5, .12); return this.kill(false) }
        const boss = this.game.boss
        if (boss && !boss.dead && boss.root.position.distanceTo(this.root.position) < boss.radius + this.radius) {
          boss.damage(this.damage); this.game.fx.spawnBurst(this.root.position, this.color, 16, 6, .14); return this.kill(false)
        }
      } else {
        const p = this.game.player.position.clone(); p.y += .9
        if (p.distanceTo(this.root.position) < .85 + this.radius) {
          this.game.player.takeDamage(this.damage, 'a ranged attack', this.root.position)
          this.game.fx.spawnBurst(this.root.position, this.color, 12, 4, .12); return this.kill(false)
        }
      }
    }
    // orient
    if (this.kind === 'arrow' || this.kind === 'stinger') this.root.lookAt(this.root.position.clone().add(this.velocity))
    // trail
    this.trailTimer -= dt
    if (this.trailTimer <= 0) {
      this.trailTimer = .025
      this.trailPts.unshift(this.root.position.clone())
      if (this.trailPts.length > 8) this.trailPts.pop()
      const arr = this.trail.geometry.attributes.position.array
      for (let i = 0; i < 8; i++) {
        const p = this.trailPts[i] || this.root.position
        arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z
      }
      this.trail.geometry.attributes.position.needsUpdate = true
    }
  }
  kill(burst = true) {
    if (this.dead) return
    this.dead = true
    if (burst) this.game.fx.spawnBurst(this.root.position, this.color, 12, 4, .12)
    this.game.scene.remove(this.root); this.game.scene.remove(this.trail)
    this.trail.geometry.dispose(); this.trail.material.dispose()
  }
}

export class ProjectileManager {
  constructor(game) { this.game = game; this.list = [] }
  spawn(opts) { const p = new Projectile(this.game, opts); this.list.push(p); return p }
  playerArrow(pos, dir, damage, color = 0xb4b0ff, speed = 38) {
    return this.spawn({ owner: 'player', kind: 'arrow', position: pos, velocity: dir.clone().multiplyScalar(speed), gravity: 5.5, damage, color, life: 3.5, radius: .1 })
  }
  playerMagic(pos, dir, damage, color = 0xd29bff) {
    return this.spawn({ owner: 'player', kind: 'bolt', position: pos, velocity: dir.clone().multiplyScalar(25), homing: 3.4, damage, color, life: 3.2, radius: .2 })
  }
  enemyBolt(pos, dir, damage, color = 0xff5a22, speed = 13) {
    return this.spawn({ owner: 'enemy', kind: 'bolt', position: pos, velocity: dir.clone().multiplyScalar(speed), gravity: 0, damage, color, life: 6, radius: .28 })
  }
  stinger(pos, dir, damage) {
    return this.spawn({ owner: 'enemy', kind: 'stinger', position: pos, velocity: dir.clone().multiplyScalar(22), gravity: 1.2, damage, color: 0xffd26a, life: 4, radius: .14 })
  }
  update(dt) {
    for (const p of this.list) p.update(dt)
    this.list = this.list.filter(p => !p.dead)
  }
  clearEnemyProjectiles() { this.list.forEach(p => { if (p.owner === 'enemy') p.kill(false) }); this.list = this.list.filter(p => !p.dead) }
}

/* ============================ ENEMIES ============================ */
export class Enemy {
  constructor(game, type, pos, layer) {
    this.game = game; this.type = type; this.position = pos.clone(); this.velocity = V()
    this.alive = true; this.hitCd = 0; this.anim = Math.random() * 10; this.layer = layer
    this.root = new THREE.Group(); this.root.position.copy(pos)
    this.flying = type === 'eye' || type === 'bee' || type === 'imp'
    this.build()
    game.scene.add(this.root)
  }
  build() {
    const t = this.type
    if (t === 'slime') {
      this.maxHp = 58; this.hp = 58; this.speed = 2.1; this.damage = 17; this.radius = .75; this.height = 1.2
      const body = new THREE.Mesh(new THREE.SphereGeometry(.8, 14, 10), new THREE.MeshStandardMaterial({ color: 0x8a2b13, roughness: .25, metalness: .1, transparent: true, opacity: .82, emissive: 0x351005, emissiveIntensity: 1.2 }))
      body.scale.set(1.1, .8, 1.1); body.position.y = .62; this.root.add(body); this.body = body
      const core = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff8a2e })); core.position.set(.2, .5, .35); this.root.add(core)
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(.11, 7, 6), new THREE.MeshBasicMaterial({ color: 0xfff3d0 })); eye.position.set(s * .27, .78, .68); this.root.add(eye)
        const pu = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0x260404 })); pu.position.set(s * .27, .78, .76); this.root.add(pu)
      }
      const glow = glowSprite(0xff5a18, 1.9, .4); glow.position.y = .4; this.root.add(glow)
      this.hopTimer = Math.random() * 2
    } else if (t === 'eye') {
      this.maxHp = 44; this.hp = 44; this.speed = 3.1; this.damage = 13; this.radius = .5; this.height = 1
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe8d0c8, roughness: .35, emissive: 0x40150e, emissiveIntensity: .5 }))
      this.root.add(ball)
      const iris = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff3d24 })); iris.position.z = .32; this.root.add(iris)
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0x140000 })); pupil.position.z = .46; this.root.add(pupil)
      this.wings = []
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.CircleGeometry(.75, 8, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a1521, roughness: .8, side: THREE.DoubleSide }))
        wing.position.set(s * .65, .1, -.05); wing.rotation.y = s * .5; wing.scale.set(s, 1, 1); this.root.add(wing); this.wings.push(wing)
      }
      const glow = glowSprite(0xff3220, 2.0, .3); this.root.add(glow)
      this.lungeTimer = rand(2, 4)
    } else if (t === 'worm') {
      const crimson = this.position.x >= 32
      this.maxHp = 92; this.hp = 92; this.speed = 1.9; this.damage = 21; this.radius = .7; this.height = 1
      const col = crimson ? 0x9e3b40 : 0x543a79
      const em = crimson ? 0x2a0709 : 0x130821
      this.segments = []
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(.55 - i * .07, 11, 8), new THREE.MeshStandardMaterial({ color: col, roughness: .45, emissive: em, emissiveIntensity: .6 }))
        s.position.z = -i * .65; s.position.y = .65; this.root.add(s); this.segments.push(s)
      }
      const head = this.segments[0]
      const jaw = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 6), new THREE.MeshBasicMaterial({ color: 0xf2d5b0 })); jaw.position.set(0, 0, .5); jaw.rotation.x = Math.PI / 2; head.add(jaw)
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd35a })); e.position.set(s * .24, .17, .38); head.add(e) }
      this.body = head
    } else if (t === 'bee') {
      this.maxHp = 48; this.hp = 48; this.speed = 4.2; this.damage = 15; this.radius = .45; this.height = .8
      const body = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 9), new THREE.MeshStandardMaterial({ color: 0xf2b32d, roughness: .4 }))
      body.scale.set(.9, .8, 1.4); this.root.add(body)
      for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.TorusGeometry(.28 - i * .04, .055, 5, 12), new THREE.MeshStandardMaterial({ color: 0x1c1108 })); s.position.z = -.15 + i * .25; s.rotation.y = Math.PI / 2; this.root.add(s) }
      const st = new THREE.Mesh(new THREE.ConeGeometry(.06, .35, 5), new THREE.MeshStandardMaterial({ color: 0xffd76a })); st.position.z = .62; st.rotation.x = Math.PI / 2; this.root.add(st)
      this.wings = []
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(.48, 8, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xbfeaff, transparent: true, opacity: .35, side: THREE.DoubleSide })); w.position.set(s * .35, .3, 0); w.rotation.x = -.5; w.scale.set(s, 1, 1); this.root.add(w); this.wings.push(w) }
      const glow = glowSprite(0xffcf50, 1.4, .25); this.root.add(glow)
    } else { // imp
      this.maxHp = 78; this.hp = 78; this.speed = 2.6; this.damage = 14; this.radius = .55; this.height = 1.2
      const body = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8c1d17, roughness: .5, emissive: 0x2a0503, emissiveIntensity: .8 })); body.position.y = .3; this.root.add(body)
      const head = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0xa5271d, roughness: .45 })); head.position.y = .85; this.root.add(head)
      for (const s of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(.07, .3, 5), new THREE.MeshStandardMaterial({ color: 0x2a1712 })); horn.position.set(s * .19, 1.1, 0); this.root.add(horn) }
      const glow = glowSprite(0xff5b1a, 1.5, .35); this.root.add(glow)
      this.shootTimer = rand(1.5, 3)
    }
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  }
  damage(n) {
    if (!this.alive) return
    this.hp -= n
    this.flash = 1
    this.game.stats.damageDealt += n
    if (this.hp <= 0) this.die()
  }
  die() {
    if (!this.alive) return
    this.alive = false
    this.game.fx.spawnBurst(this.position.clone().add(V(0, .7, 0)), this.type === 'eye' ? 0xff4030 : this.type === 'bee' ? 0xffcf50 : 0xff7a2a, 26, 7, .14)
    this.game.audio.hit()
    this.game.scene.remove(this.root)
    this.game.stats.kills++
    if (this.type === 'slime') {
      this.game.loot('gel', 2)
      if (Math.random() < .35) this.game.loot('hellstone', 1)
      // molten death pool
      const pos = this.position
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (dx * dx + dz * dz > 1.5) continue
        const gy = Math.floor(pos.y) - 1
        if (this.game.world.getBlock(pos.x + dx, gy, pos.z + dz) !== B.AIR) this.game.world.setBlock(pos.x + dx, gy + 1, pos.z + dz, B.LAVA, false)
      }
      this.game.world.flushDirty()
      this.game.ui.toast('Lava Slime dissolved into a molten pool.', 'bad')
    } else if (this.type === 'bee') {
      this.game.loot('honey', 1); if (Math.random() < .2) this.game.loot('hive', 1)
    } else if (this.type === 'eye') {
      if (Math.random() < .25) this.game.loot('crystal shard', 1)
    } else if (this.type === 'worm') {
      this.game.loot(this.position.x >= 32 ? 'crimtane' : 'demonite', 2)
    } else { this.game.loot('gold', 1); if (Math.random() < .15) this.game.loot('ember crystal', 1) }
  }
  update(dt, time) {
    if (!this.alive) return
    this.anim += dt
    this.hitCd = Math.max(0, this.hitCd - dt)
    const p = this.game.player
    const target = p.position.clone(); target.y += .8
    const dir = target.clone().sub(this.position); const dist = dir.length(); dir.y = 0; if (dir.lengthSq() > .0001) dir.normalize()
    if (this.type === 'slime') {
      this.hopTimer -= dt
      if (this.hopTimer <= 0 && this.onGround) {
        this.hopTimer = rand(1.0, 2.2)
        this.velocity.y = 6.2
        this.velocity.x = dir.x * this.speed * 1.6
        this.velocity.z = dir.z * this.speed * 1.6
        this.onGround = false
      }
      this.velocity.y -= 24 * dt
      this.moveWithCollision(dt)
      this.body.scale.y = .72 + Math.abs(Math.sin(this.anim * 5)) * .1
    } else if (this.flying) {
      const desired = target.clone().add(V(Math.sin(time * 1.3 + this.anim) * 2.2, 2.2 + Math.sin(time * .9 + this.anim) * .7, Math.cos(time * 1.1 + this.anim) * 2.2))
      if (this.type === 'imp') desired.y = target.y + 2.4
      const to = desired.sub(this.position)
      if (to.length() > .2) to.normalize().multiplyScalar(this.speed)
      this.velocity.lerp(to, dt * 1.8)
      if (this.type === 'eye') {
        this.lungeTimer -= dt
        if (this.lungeTimer <= 0) { this.lungeTimer = rand(2.5, 4.5); this.velocity.copy(target.clone().sub(this.position).normalize().multiplyScalar(11)) }
        for (const w of this.wings) w.rotation.z = Math.sin(this.anim * 22) * .8
      }
      if (this.type === 'bee') { for (const w of this.wings) w.rotation.y = Math.sin(this.anim * 45) * .7 }
      if (this.type === 'imp') {
        this.shootTimer -= dt
        if (this.shootTimer <= 0 && dist < 18) {
          this.shootTimer = rand(1.8, 3.2)
          const d = target.clone().add(V(0, Math.sin(this.anim) * .7, 0)).sub(this.position).normalize()
          this.game.projectiles.enemyBolt(this.position.clone().add(V(0, .9, 0)), d, 13)
          this.game.audio.magic()
        }
      }
      this.root.position.addScaledVector(this.velocity, dt)
      this.root.lookAt(this.position.clone().add(this.velocity))
    } else {
      // crawling worm
      this.velocity.x = dir.x * this.speed; this.velocity.z = dir.z * this.speed
      this.velocity.y -= 20 * dt
      this.moveWithCollision(dt)
      if (dir.lengthSq() > .01) this.root.rotation.y = Math.atan2(dir.x, dir.z)
      for (let i = 1; i < this.segments.length; i++) {
        const s = this.segments[i]
        s.position.x = Math.sin(this.anim * 4 + i * .9) * .22
        s.position.y = .65 + Math.sin(this.anim * 5 + i) * .12
      }
    }
    this.root.position.copy(this.position)
    if (this.flash > 0) { this.flash -= dt * 4; this.root.scale.setScalar(1 + this.flash * .2) } else this.root.scale.setScalar(1)
    // contact
    if (dist < 1.6 + this.radius && this.hitCd <= 0 && p.alive) {
      p.takeDamage(this.damage, this.type === 'slime' ? 'lava slime contact' : `${this.type} contact`, this.position)
      this.hitCd = .85
    }
    if (dist > 45) this.alive = false, this.game.scene.remove(this.root)
  }
  moveWithCollision(dt) {
    const r = .34, h = this.flying ? 0 : 1.1
    const steps = 3
    for (let s = 0; s < steps; s++) {
      const nx = this.position.x + this.velocity.x * dt / steps
      if (!this.game.world.boxCollides(nx - r, this.position.y, this.position.z - r, nx + r, this.position.y + h, this.position.z + r)) this.position.x = nx
      else this.velocity.x = 0
      const nz = this.position.z + this.velocity.z * dt / steps
      if (!this.game.world.boxCollides(this.position.x - r, this.position.y, nz - r, this.position.x + r, this.position.y + h, nz + r)) this.position.z = nz
      else this.velocity.z = 0
      const ny = this.position.y + this.velocity.y * dt / steps
      if (!this.game.world.boxCollides(this.position.x - r, ny, this.position.z - r, this.position.x + r, ny + h, this.position.z + r)) { this.position.y = ny; if (this.velocity.y <= 0) this.onGround = false }
      else { if (this.velocity.y <= 0) this.onGround = true; this.velocity.y = 0 }
    }
  }
}

export class EnemyManager {
  constructor(game) {
    this.game = game; this.list = []; this.spawnTimer = 1.5; this.killCount = 0
    this.warmup()
  }
  warmup() {
    for (const [x, y, z, t] of [[26, 8, 40, 'slime'], [38, 8, 28, 'slime'], [24, 8, 24, 'eye'], [40, 9, 40, 'eye']]) {
      const e = new Enemy(this.game, t, V(x + .5, y, z + .5), 'underworld')
      this.list.push(e)
    }
  }
  nearest(pos) {
    let best = null, bd = 1e9
    for (const e of this.list) { if (!e.alive) continue; const d = e.position.distanceToSquared(pos); if (d < bd) { bd = d; best = e } }
    return best
  }
  hitAt(pos, radius) {
    for (const e of this.list) {
      if (!e.alive) continue
      const c = e.position.clone(); c.y += .7
      if (c.distanceTo(pos) < radius + e.radius) return e
    }
    return null
  }
  damageInArc(origin, dir, range, arc, damage) {
    let hits = 0
    for (const e of this.list) {
      if (!e.alive) continue
      const c = e.position.clone(); c.y += .7
      const d = c.clone().sub(origin)
      if (d.length() > range) continue
      if (d.lengthSq() < .01 || d.clone().normalize().dot(dir) > Math.cos(arc)) { e.damage(damage); hits++; this.game.fx.spawnBurst(c, 0xffa050, 10, 4, .12) }
    }
    const boss = this.game.boss
    if (boss && !boss.dead) {
      const c = boss.root.position.clone()
      const d = c.clone().sub(origin)
      if (d.length() < range + boss.radius && (d.lengthSq() < .01 || d.clone().normalize().dot(dir) > Math.cos(arc))) { boss.damage(damage); hits++ }
    }
    if (hits) this.game.audio.hit()
    return hits
  }
  spawn() {
    const p = this.game.player
    if (!p.alive) return
    const layer = p.position.y
    let type = 'slime'
    const r = Math.random()
    if (layer < 18) type = r < .48 ? 'slime' : r < .8 ? 'eye' : 'imp'
    else if (layer < 36) type = r < .34 ? 'worm' : r < .66 ? 'eye' : r < .82 ? 'slime' : 'imp'
    else if (layer < 47) type = r < .5 ? 'bee' : r < .75 ? 'worm' : 'eye'
    else if (layer < 55) type = r < .4 ? 'bee' : r < .65 ? 'eye' : 'slime'
    else type = r < .4 ? 'slime' : r < .7 ? 'eye' : 'bee'
    for (let attempt = 0; attempt < 24; attempt++) {
      const ang = Math.random() * Math.PI * 2, dist = rand(11, 21)
      const x = Math.floor(p.position.x + Math.cos(ang) * dist), z = Math.floor(p.position.z + Math.sin(ang) * dist)
      let y = Math.floor(p.position.y + rand(-3, 7))
      if (type !== 'slime' && type !== 'worm') {
        if (this.game.world.getBlock(x, y, z) === B.AIR && this.game.world.getBlock(x, y + 1, z) === B.AIR) {
          this.add(type, V(x + .5, y + .2, z + .5)); return
        }
      } else {
        for (let yy = y + 6; yy > y - 8; yy--) {
          if (this.game.world.getBlock(x, yy, z) === B.AIR && this.game.world.getBlock(x, yy + 1, z) === B.AIR && this.game.world.getBlock(x, yy - 1, z) !== B.AIR) {
            this.add(type, V(x + .5, yy, z + .5)); return
          }
        }
      }
    }
  }
  add(type, pos) {
    if (this.list.length >= 16) return
    const layer = this.game.player.position.y < 18 ? 'underworld' : this.game.player.position.y < 36 ? 'evil' : this.game.player.position.y < 47 ? 'hive' : 'surface'
    const e = new Enemy(this.game, type, pos, layer)
    this.list.push(e)
  }
  update(dt, time) {
    this.spawnTimer -= dt
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(1.8, 4.2 - this.game.stats.kills * .01)
      if (this.list.length < 14) this.spawn()
    }
    for (const e of this.list) e.update(dt, time)
    this.list = this.list.filter(e => e.alive)
  }
  clear() { for (const e of this.list) { this.game.scene.remove(e.root); e.alive = false } this.list = [] }
}

/* ============================ BOSSES ============================ */
class Boss {
  constructor(game, name, maxHp) {
    this.game = game; this.name = name; this.maxHp = maxHp; this.hp = maxHp; this.phase = 1
    this.root = new THREE.Group(); this.dead = false; this.t = 0; this.radius = 3; this.contactCd = 0
    this.phaseText = 'PHASE I'
    game.scene.add(this.root)
  }
  setPhase(n) { this.phase = n; this.phaseText = n > 1 ? 'PHASE II · ENRAGED' : 'PHASE I' }
  damage(n) {
    if (this.dead) return
    this.hp -= n
    this.game.stats.damageDealt += n
    this.game.fx.spawnBurst(this.root.position.clone().add(V(rand(-2, 2), rand(-2, 2), rand(-2, 2))), 0xffb070, 9, 5, .13)
    if (this.hp <= 0) this.die()
  }
  die() {
    if (this.dead) return
    this.dead = true
    this.game.audio.bossDeath()
    for (let i = 0; i < 8; i++) setTimeout(() => this.game.fx.spawnBurst(this.root.position.clone().add(V(rand(-4, 4), rand(-4, 4), rand(-4, 4))), 0xff8a40, 40, 12, .2), i * 90)
    this.game.scene.remove(this.root)
    this.game.onBossDeath(this)
  }
  touch() {
    if (this.contactCd > 0) return
    const d = this.root.position.distanceTo(this.game.player.position.clone().add(V(0, .9, 0)))
    if (d < this.radius + 1.2) {
      this.game.player.takeDamage(26, `${this.name.toLowerCase()} contact`, this.root.position)
      this.contactCd = 1.0
    }
  }
  update(dt, time) { this.t += dt; this.contactCd = Math.max(0, this.contactCd - dt) }
}

export class EyeBoss extends Boss {
  constructor(game) {
    super(game, 'EYE OF CTHULHU', 900)
    this.radius = 2.5
    this.root.position.copy(game.player.position).add(V(0, 7, -9))
    const white = new THREE.MeshStandardMaterial({ color: 0xf0d9d1, roughness: .38, metalness: .05, emissive: 0x38100a, emissiveIntensity: .45 })
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.5, 32, 24), white); this.root.add(ball); this.ball = ball
    const veins = new THREE.Mesh(new THREE.SphereGeometry(2.52, 18, 12), new THREE.MeshBasicMaterial({ color: 0xff4438, wireframe: true, transparent: true, opacity: .12 })); this.root.add(veins)
    this.iris = new THREE.Mesh(new THREE.SphereGeometry(1.25, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff4426, roughness: .2, emissive: 0x7a1205, emissiveIntensity: 2.2 })); this.iris.position.z = 1.55; this.root.add(this.iris)
    this.pupil = new THREE.Mesh(new THREE.SphereGeometry(.58, 14, 10), new THREE.MeshBasicMaterial({ color: 0x120202 })); this.pupil.position.z = 2.45; this.root.add(this.pupil)
    this.mouth = new THREE.Group()
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x160203, side: THREE.DoubleSide }))
    m.rotation.x = Math.PI / 2; m.position.set(0, -1.2, 1.7); m.scale.set(1.4, .9, .4); this.mouth.add(m)
    for (let i = 0; i < 7; i++) { const t = new THREE.Mesh(new THREE.ConeGeometry(.11, .45, 5), new THREE.MeshStandardMaterial({ color: 0xf2e0c8 })); const a = (i / 6 - .5) * 2; t.position.set(a * 1.2, -.9 + Math.abs(a) * .25, 2.1); t.rotation.x = Math.PI; this.mouth.add(t) }
    this.mouth.visible = false; this.root.add(this.mouth)
    this.tentacles = []
    for (let i = 0; i < 6; i++) {
      const len = 2.4 + Math.random() * 2.6
      const t = new THREE.Mesh(new THREE.CylinderGeometry(.16, .04, len, 5), new THREE.MeshStandardMaterial({ color: 0xb45a52, roughness: .65, emissive: 0x2a0806, emissiveIntensity: .4 }))
      t.position.set(-1.2 + i * .48, -1.9 - len / 2 + 1, -.5); t.rotation.z = (Math.random() - .5) * .3; this.root.add(t); this.tentacles.push(t)
    }
    const glow = glowSprite(0xff4a2a, 14, .35); this.root.add(glow); this.glow = glow
    this.shootT = 2.2; this.chargeT = 3.4; this.charging = 0
    this.game.setBoss(this)
  }
  update(dt, time) {
    super.update(dt, time)
    if (this.dead) return
    const p = this.game.player.position.clone(); p.y += 1
    const toP = p.clone().sub(this.root.position); const dist = toP.length()
    if (this.hp < this.maxHp * .5 && this.phase === 1) { this.setPhase(2); this.mouth.visible = true; this.ball.material.emissive.setHex(0x7a1008); this.game.audio.bossRoar(); this.game.ui.banner('PHASE II', 'THE EYE UNMAKES ITSELF') }
    this.root.rotation.y = Math.atan2(toP.x, toP.z)
    const orbit = V(Math.sin(time * .65) * 8, 6.5 + Math.sin(time * .9) * 1.5, Math.cos(time * .65) * 8)
    const desired = p.clone().add(orbit)
    if (this.charging > 0) {
      this.charging -= dt
      this.root.position.addScaledVector(this.chargeDir, dt * 26)
    } else {
      this.root.position.lerp(desired, Math.min(1, dt * (this.phase === 2 ? 2.2 : 1.4)))
    }
    this.chargeT -= dt
    if (this.chargeT <= 0 && this.charging <= 0) {
      this.chargeT = this.phase === 2 ? rand(2.6, 4) : rand(4, 5.4)
      this.chargeDir = p.clone().sub(this.root.position).normalize()
      this.charging = .55
      this.iris.material.emissiveIntensity = 5
      setTimeout(() => { if (this.iris) this.iris.material.emissiveIntensity = 2.2 }, 500)
      this.game.audio.bossRoar()
    }
    for (let i = 0; i < this.tentacles.length; i++) this.tentacles[i].rotation.x = Math.sin(time * 2 + i) * .16
    this.glow.material.opacity = .28 + Math.sin(time * 3) * .1
    this.shootT -= dt
    if (this.shootT <= 0) {
      this.shootT = this.phase === 2 ? 1.15 : 2.1
      const base = p.clone().sub(this.iris.getWorldPosition(V())).normalize()
      const n = this.phase === 2 ? 3 : 1
      for (let i = 0; i < n; i++) {
        const d = base.clone().applyAxisAngle(V(0, 1, 0), (i - (n - 1) / 2) * .16)
        this.game.projectiles.enemyBolt(this.iris.getWorldPosition(V()), d, this.phase === 2 ? 19 : 15, 0xff5a28, 14)
      }
      this.game.audio.magic()
    }
    if (dist < 5.5) this.touch()
    this.ball.rotation.x = Math.sin(time * .7) * .04
  }
}

export class QueenBoss extends Boss {
  constructor(game) {
    super(game, 'QUEEN BEE', 700)
    this.radius = 2.2
    this.root.position.copy(game.player.position).add(V(0, 5, -8))
    const gold = new THREE.MeshStandardMaterial({ color: 0xf0b229, roughness: .42, emissive: 0x3a2103, emissiveIntensity: .35 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x241407, roughness: .55 })
    this.segments = []
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(1.65 - i * .2, 20, 14), i % 2 ? dark : gold)
      s.scale.set(1, .9, 1.15); s.position.z = -i * 1.25; this.root.add(s); this.segments.push(s)
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.3, 18, 12), gold); head.position.z = 1.15; this.root.add(head)
    for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9cffd1 })); eye.position.set(s * .55, .35, 2.1); this.root.add(eye) }
    this.stinger = new THREE.Mesh(new THREE.ConeGeometry(.28, 2.4, 8), dark); this.stinger.position.z = -5.5; this.stinger.rotation.x = Math.PI / 2; this.root.add(this.stinger)
    this.wings = []
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(3.0, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: .33, side: THREE.DoubleSide, emissive: 0x203040, emissiveIntensity: .3 }))
      w.position.set(s * 1.5, 1.3, -.5); w.rotation.x = -.35; w.scale.set(s, 1, 1); this.root.add(w); this.wings.push(w)
    }
    const glow = glowSprite(0xffc040, 12, .3); this.root.add(glow); this.glow = glow
    this.shootT = 1.8; this.chargeT = 3.0; this.charging = 0
    this.game.setBoss(this)
  }
  update(dt, time) {
    super.update(dt, time)
    if (this.dead) return
    const p = this.game.player.position.clone(); p.y += 1
    if (this.hp < this.maxHp * .5 && this.phase === 1) { this.setPhase(2); this.game.audio.bossRoar(); this.game.ui.banner('PHASE II', 'THE HIVE IS ANGRY') }
    this.root.rotation.y = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z)
    const desired = p.clone().add(V(Math.sin(time * .8) * 6, 4.8 + Math.sin(time * 1.4) * 1.2, Math.cos(time * .8) * 6))
    if (this.charging > 0) { this.charging -= dt; this.root.position.addScaledVector(this.chargeDir, dt * 24) }
    else this.root.position.lerp(desired, Math.min(1, dt * (this.phase === 2 ? 2 : 1.2)))
    this.chargeT -= dt
    if (this.chargeT <= 0 && this.charging <= 0) {
      this.chargeT = this.phase === 2 ? rand(2.2, 3.4) : rand(3.6, 5)
      this.chargeDir = p.clone().sub(this.root.position).normalize(); this.charging = .5; this.game.audio.bossRoar()
    }
    for (const w of this.wings) w.rotation.z = Math.sin(time * 28) * .5
    for (let i = 0; i < this.segments.length; i++) this.segments[i].position.y = Math.sin(time * 4 + i * .8) * .16
    this.shootT -= dt
    if (this.shootT <= 0) {
      this.shootT = this.phase === 2 ? .8 : 1.5
      const from = this.root.position.clone().add(V(0, 0, 2))
      const base = p.clone().sub(from).normalize()
      const n = this.phase === 2 ? 7 : 4
      for (let i = 0; i < n; i++) {
        const d = base.clone().applyAxisAngle(V(0, 1, 0), (i - (n - 1) / 2) * .13)
        this.game.projectiles.stinger(from, d, this.phase === 2 ? 17 : 13)
      }
      this.game.audio.bow()
    }
    if (this.root.position.distanceTo(p) < 4) this.touch()
  }
}

function fleshTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#5c1a1f'; g.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 4 + Math.random() * 26
    const gr = g.createRadialGradient(x, y, 1, x, y, r)
    const cols = ['#7d2a30', '#93373c', '#481016', '#b35858']
    gr.addColorStop(0, cols[(Math.random() * cols.length) | 0]); gr.addColorStop(1, 'rgba(40,5,9,0)')
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
  }
  g.strokeStyle = 'rgba(220,120,120,.24)'; g.lineWidth = 1.5
  for (let i = 0; i < 30; i++) {
    g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y)
    for (let j = 0; j < 6; j++) { x += (Math.random() - .5) * 45; y += (Math.random() - .5) * 35; g.lineTo(x, y) } g.stroke()
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 3); return t
}

export class WallBoss extends Boss {
  constructor(game) {
    super(game, 'WALL OF FLESH', 3000)
    this.radius = 5.5
    const p = game.player.position
    this.root.position.set(p.x, p.y + 7, p.z - 17)
    this.rise = 0
    this.risen = false
    const mat = new THREE.MeshStandardMaterial({ map: fleshTexture(), color: 0xd6a099, roughness: .7, emissive: 0x2c0306, emissiveIntensity: .5 })
    const wall = new THREE.Mesh(new THREE.BoxGeometry(23, 16, 2.2), mat); this.root.add(wall); this.wall = wall
    const frame = new THREE.Mesh(new THREE.BoxGeometry(24.5, 17.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x3a0b10, roughness: .8, emissive: 0x140204, emissiveIntensity: .8 }))
    frame.position.z = -.9; this.root.add(frame)
    this.eyes = []
    for (let i = 0; i < 8; i++) {
      const e = new THREE.Group()
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(.55 + Math.random() * .35, 12, 9), new THREE.MeshStandardMaterial({ color: 0xf0d8c8, roughness: .3, emissive: 0x301010, emissiveIntensity: .4 }))
      const iris = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff5c24 })); iris.position.z = .42
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0a0000 })); pupil.position.z = .54
      e.add(sclera, iris, pupil)
      e.position.set(-9 + i * 2.55, (i % 2 ? 2.8 : -1.6) + Math.sin(i * 2) * .9, 1.25)
      this.root.add(e); this.eyes.push(e)
    }
    this.mouth = new THREE.Group()
    const m = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.3, .5), new THREE.MeshBasicMaterial({ color: 0x1c0305 })); this.mouth.add(m)
    for (let i = 0; i < 13; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(.18, .9, 4), new THREE.MeshStandardMaterial({ color: 0xf2ddc2, roughness: .4 }))
      t.position.set(-3.3 + i * .55, 1.4, .32); t.rotation.x = Math.PI; this.mouth.add(t)
      const b = t.clone(); b.position.y = -1.5; b.rotation.x = 0; this.mouth.add(b)
    }
    this.mouth.position.set(0, 0, 1.4); this.root.add(this.mouth)
    this.tendrils = []
    for (let i = 0; i < 10; i++) {
      const len = 2 + Math.random() * 5
      const t = new THREE.Mesh(new THREE.CylinderGeometry(.28, .06, len, 5), new THREE.MeshStandardMaterial({ color: 0x7e2a30, roughness: .7 }))
      t.position.set(-10 + i * 2.2, -7 - len / 2, .8); t.rotation.z = (Math.random() - .5) * .4; this.root.add(t); this.tendrils.push(t)
    }
    const glow = glowSprite(0xff4a20, 25, .24); this.root.add(glow); this.glow = glow
    this.fireT = 2.2; this.laserT = 5
    this.game.audio.bossRoar()
    this.game.setBoss(this)
  }
  update(dt, time) {
    super.update(dt, time)
    if (this.dead) return
    const p = this.game.player.position.clone(); p.y += 1
    if (!this.risen) {
      this.rise = Math.min(1, this.rise + dt * .35)
      this.root.position.y = p.y - 7 + this.rise * 10
      if (this.rise >= 1) { this.risen = true; this.game.ui.banner('THE WALL RISES', 'WALL OF FLESH', 3) }
    }
    const toP = p.clone().sub(this.root.position); toP.y = 0
    const dist = toP.length()
    const dir = toP.clone().normalize()
    this.root.rotation.y = Math.atan2(dir.x, dir.z)
    if (dist > 8) this.root.position.addScaledVector(dir, dt * (this.phase === 2 ? 1.6 : .9))
    this.root.position.y += Math.sin(time * .8) * .03
    for (let i = 0; i < this.eyes.length; i++) {
      const e = this.eyes[i]
      e.lookAt(p)
      e.rotation.z = Math.sin(time * 1.5 + i) * .18
    }
    this.mouth.scale.y = 1 + Math.sin(time * 2.4) * .12
    for (let i = 0; i < this.tendrils.length; i++) this.tendrils[i].rotation.x = Math.sin(time * 2 + i) * .2
    this.glow.material.opacity = .2 + Math.sin(time * 2.2) * .07
    this.fireT -= dt
    if (this.fireT <= 0) {
      this.fireT = this.phase === 2 ? 1.1 : 1.8
      const from = this.mouth.getWorldPosition(V())
      const base = p.clone().sub(from).normalize()
      const n = this.phase === 2 ? 5 : 3
      for (let i = 0; i < n; i++) {
        const d = base.clone().applyAxisAngle(V(0, 1, 0), (i - (n - 1) / 2) * .12)
        this.game.projectiles.enemyBolt(from, d, 20, 0xff6a20, 12)
      }
      this.game.audio.magic()
    }
    this.laserT -= dt
    if (this.phase === 1 && this.hp < this.maxHp * .5) { this.setPhase(2); this.game.audio.bossRoar(); this.game.ui.banner('PHASE II', 'THE WALL BLEEDS LIGHT') }
    if (this.phase === 2 && this.laserT <= 0) {
      this.laserT = 2.8
      const from = this.eyes[(Math.random() * this.eyes.length) | 0].getWorldPosition(V())
      const d = p.clone().sub(from).normalize()
      this.game.projectiles.enemyBolt(from, d, 24, 0xffd35a, 34)
      this.game.audio.magic()
    }
    if (dist < 7.5) this.touch()
  }
  die() {
    if (this.dead) return
    this.dead = true
    this.game.audio.bossDeath()
    for (let i = 0; i < 14; i++) setTimeout(() => this.game.fx.spawnBurst(this.root.position.clone().add(V(rand(-10, 10), rand(-7, 7), rand(-2, 2))), i % 2 ? 0xffd36a : 0xff5a20, 40, 14, .24), i * 80)
    this.game.scene.remove(this.root)
    this.game.onBossDeath(this)
  }
}
