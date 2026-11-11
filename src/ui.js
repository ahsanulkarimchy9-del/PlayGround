import { ITEMS, RECIPES, HOTBAR, itemDef, itemIconHTML } from './items.js'

export class UI {
  constructor(game) {
    this.game = game
    this.el = id => document.getElementById(id)
    this.cache()
    this.selTab = 'weapons'
    this.toastList = []
    this.bannerTimer = 0
    this.fpsAcc = 0; this.fpsFrames = 0; this.fpsShown = 60
    this.godElapsed = 0
    this.lastMinimap = 0
    this.bind()
    this.buildHotbar()
    this.renderStations()
    this.renderCrafting()
    this.renderInventory()
  }

  cache() {
    const ids = ['hud', 'objective-text', 'objective-sub', 'depth-value', 'biome-value', 'minimap-label',
      'hp-fill', 'hp-text', 'mana-fill', 'mana-text', 'hotbar', 'weapon-name', 'mine-wrap', 'mine-fill', 'mine-label',
      'interact', 'interact-text', 'boss-wrap', 'boss-name', 'boss-fill', 'boss-phase', 'toasts', 'event-banner',
      'event-kicker', 'event-title', 'damage-flash', 'lava-flash', 'clock-text', 'clock-icon', 'fps-text',
      'q-kills', 'q-blocks', 'q-crystals', 'inventory', 'inv-grid', 'inv-capacity', 'craft-list', 'craft-tabs',
      'station-row', 'ritual', 'help', 'death', 'death-cause', 'respawn-btn', 'touch', 'buff-flight', 'buff-bed',
      'buff-grapple', 'minimap', 'crosshair']
    for (const id of ids) this[id] = document.getElementById(id)
    const alias = {
      'objective-text': 'objectiveText', 'objective-sub': 'objectiveSub', 'depth-value': 'depthValue',
      'biome-value': 'biomeValue', 'minimap-label': 'minimapLabel', 'hp-fill': 'hpFill', 'hp-text': 'hpText',
      'mana-fill': 'manaFill', 'mana-text': 'manaText', 'weapon-name': 'weaponName', 'mine-wrap': 'mineWrap',
      'mine-fill': 'mineFill', 'mine-label': 'mineLabel', 'interact-text': 'interactText', 'boss-wrap': 'bossWrap',
      'boss-name': 'bossName', 'boss-fill': 'bossFill', 'boss-phase': 'bossPhase', 'event-banner': 'eventBanner',
      'event-kicker': 'eventKicker', 'event-title': 'eventTitle', 'damage-flash': 'damageFlash', 'lava-flash': 'lavaFlash',
      'clock-text': 'clockText', 'clock-icon': 'clockIcon', 'fps-text': 'fpsText', 'q-kills': 'qKills',
      'q-blocks': 'qBlocks', 'q-crystals': 'qCrystals', 'inv-grid': 'invGrid', 'inv-capacity': 'invCapacity',
      'craft-list': 'craftList', 'craft-tabs': 'craftTabs', 'station-row': 'stationRow', 'death-cause': 'deathCause',
      'respawn-btn': 'respawnBtn', 'buff-flight': 'buffFlight', 'buff-bed': 'buffBed', 'buff-grapple': 'buffGrapple'
    }
    for (const [id, key] of Object.entries(alias)) this[key] = this[id]
    this.ctx = this.minimap.getContext('2d')
  }

  bind() {
    document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeOverlay(b.dataset.close)))
    document.querySelectorAll('.craft-tabs button').forEach(b => b.addEventListener('click', () => {
      this.selTab = b.dataset.tab
      document.querySelectorAll('.craft-tabs button').forEach(x => x.classList.toggle('active', x === b))
      this.renderCrafting(); this.game.audio.UI()
    }))
    document.querySelectorAll('.ritual-card').forEach(b => b.addEventListener('click', () => {
      this.game.summonBoss(b.dataset.boss); this.closeOverlay('ritual'); this.game.audio.UI()
    }))
    this.respawnBtn.addEventListener('click', () => this.game.respawn())
    // first click on canvas -> pointer lock / audio
    this.game.canvas.addEventListener('pointerdown', () => { if (!this.isOverlayOpen()) this.game.requestLock() })
    // Touch controls
    this.setupTouch()
    window.addEventListener('keydown', e => {
      if (e.code === 'Tab') { e.preventDefault(); this.toggleInventory() }
      else if (e.code === 'KeyH' && !this.isOverlayOpen()) { this.openOverlay('help') }
      else if (e.code === 'Escape') { if (this.isOverlayOpen()) this.closeAll(); else document.exitPointerLock?.() }
    })
  }

  isOverlayOpen() { return !this.inventory.classList.contains('hidden') || !this.ritual.classList.contains('hidden') || !this.help.classList.contains('hidden') || !this.death.classList.contains('hidden') }
  openOverlay(id) {
    document.exitPointerLock?.()
    this[id].classList.remove('hidden')
    this.game.paused = true
    if (id === 'inventory') { this.renderInventory(); this.renderStations(); this.renderCrafting() }
    if (id === 'ritual') this.renderRitual()
    this.game.audio.UI()
  }
  closeOverlay(id) {
    this[id]?.classList.add('hidden')
    if (!this.isOverlayOpen()) { this.game.paused = false; this.game.requestLock() }
    this.game.audio.UI()
  }
  closeAll() { for (const id of ['inventory', 'ritual', 'help']) this[id].classList.add('hidden'); this.game.paused = false }
  toggleInventory() { if (this.inventory.classList.contains('hidden')) this.openOverlay('inventory'); else this.closeOverlay('inventory') }
  openRitual() { this.openOverlay('ritual') }

  setVisible(v) { this.hud.classList.toggle('hidden', !v); this.touch.classList.toggle('hidden', !(v && this.game.isTouch)) }

  buildHotbar() {
    const inv = this.game.inventory
    this.hotbar.innerHTML = ''
    this.game.hotbar.forEach((name, i) => {
      const s = document.createElement('div')
      s.className = 'slot' + (i === this.game.selected ? ' active' : '')
      s.dataset.slot = i
      const def = itemDef(name)
      const count = name === 'Ember Blade' || name === 'Demon Bow' || name === 'Starfall Staff' || name === 'Pickaxe' ? '' : (inv.get(name) || 0)
      s.innerHTML = `<span class="slot-key">${i + 1}</span><span class="slot-icon">${itemIconHTML(name, 25)}</span>${count !== '' ? `<span class="slot-count">${count}</span>` : ''}<span class="slot-name">${name}</span>`
      s.title = def.desc
      s.addEventListener('click', () => { this.game.selectSlot(i); this.game.audio.UI() })
      this.hotbar.appendChild(s)
    })
  }

  refreshHotbar() {
    const inv = this.game.inventory
    ;[...this.hotbar.children].forEach((s, i) => {
      const name = this.game.hotbar[i]
      s.classList.toggle('active', i === this.game.selected)
      const def = itemDef(name)
      const countEl = s.querySelector('.slot-count')
      const count = name === 'Ember Blade' || name === 'Demon Bow' || name === 'Starfall Staff' || name === 'Pickaxe' ? '' : (inv.get(name) || 0)
      if (countEl) countEl.textContent = count
      else if (count !== '') { const c = document.createElement('span'); c.className = 'slot-count'; c.textContent = count; s.appendChild(c) }
      s.title = def.desc
    })
  }

  renderInventory() {
    const inv = this.game.inventory
    this.invGrid.innerHTML = ''
    const entries = [...inv.entries()].filter(([, c]) => c > 0)
    const total = entries.reduce((a, [, c]) => a + c, 0)
    this.invCapacity.textContent = `${Math.min(30, entries.length)} / 30 · ${total} ITEMS`
    for (let i = 0; i < 30; i++) {
      const slot = document.createElement('div')
      slot.className = 'inv-slot'
      const entry = entries[i]
      if (entry) {
        const [name, count] = entry
        const def = itemDef(name)
        slot.classList.add('has')
        slot.title = `${def.name}\n${def.desc}`
        slot.innerHTML = `<span class="in">${name.slice(0, 12)}</span><span class="ii">${itemIconHTML(name, 22)}</span><span class="ic">${count}</span>`
        if (this.game.hotbar.includes(name) && this.game.selected === this.game.hotbar.indexOf(name)) slot.classList.add('selected')
        slot.addEventListener('click', () => { this.game.onInventoryItemClick(name); this.renderInventory(); this.refreshHotbar(); this.game.audio.UI() })
      }
      this.invGrid.appendChild(slot)
    }
  }

  renderStations() {
    const st = this.game.stations
    const defs = [['workbench', 'WORK BENCH'], ['loom', 'LOOM'], ['sawmill', 'SAWMILL'], ['anvil', 'ANVIL']]
    this.stationRow.innerHTML = defs.map(([k, n]) => `<span class="station ${st[k] ? 'on' : ''}">${st[k] ? '◆' : '◇'} ${n}</span>`).join('')
  }

  renderCrafting() {
    const recs = RECIPES.filter(r => r.tab === this.selTab)
    this.craftList.innerHTML = recs.map(r => {
      const def = itemDef(r.item)
      const missingStation = r.station.some(s => !this.game.stations[s])
      const missingMats = Object.entries(r.cost).filter(([k, v]) => (this.game.inventory.get(k) || 0) < v)
      const can = !missingStation && missingMats.length === 0
      const cost = Object.entries(r.cost).map(([k, v]) => {
        const have = this.game.inventory.get(k) || 0
        return `<span class="${have < v ? 'miss' : ''}">${k} ${have}/${v}</span>`
      }).join(' · ')
      return `<div class="recipe ${can ? '' : 'locked'}" data-id="${r.id}">
        <div class="recipe-icon">${itemIconHTML(r.item, 20)}</div>
        <div><div class="recipe-name">${r.item}${r.count > 1 ? ' ×' + r.count : ''}</div><div class="recipe-desc">${r.desc}</div><div class="recipe-cost">${cost}${missingStation ? ` · <span class="miss">needs ${r.station.map(s => s.toUpperCase()).join(' + ')}</span>` : ''}</div></div>
        <button class="craft-btn" ${can ? '' : 'disabled'} data-craft="${r.id}">CRAFT</button>
      </div>`
    }).join('')
    this.craftList.querySelectorAll('.craft-btn').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation(); this.game.craft(b.dataset.craft)
      this.renderInventory(); this.renderStations(); this.renderCrafting(); this.refreshHotbar()
    }))
  }

  renderRitual() {
    const dead = this.game.defeatedBosses
    document.querySelectorAll('.ritual-card').forEach(c => {
      const t = c.dataset.boss
      const done = dead[t]
      c.querySelector('em').textContent = done ? 'DEFEATED' : 'SUMMON'
      c.style.opacity = done ? '.6' : ''
    })
  }

  setSelection() {
    const name = this.game.hotbar[this.game.selected]
    this.weaponName.textContent = (itemDef(name).name || name).toUpperCase()
    this.refreshHotbar()
    this.buildHotbar()
  }

  update(player, game, dt) {
    const fdt = game.realDt || dt
    this.fpsAcc += fdt; this.fpsFrames++
    if (this.fpsAcc > .5) { this.fpsShown = Math.round(this.fpsFrames / this.fpsAcc); this.fpsAcc = 0; this.fpsFrames = 0; this.fpsText.textContent = `${this.fpsShown} FPS` }
    this.hpFill.style.width = `${Math.max(0, player.health / player.maxHealth * 100)}%`
    this.hpText.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`
    this.manaFill.style.width = `${Math.max(0, player.mana / player.maxMana * 100)}%`
    this.manaText.textContent = `${Math.floor(player.mana)} / ${player.maxMana}`
    const ground = game.world.surfaceHeight(Math.floor(player.position.x), Math.floor(player.position.z))
    const depth = Math.round(player.position.y - 8)
    const biome = this.biomeAt(player, ground)
    this.depthValue.textContent = depth <= 0 ? 'ABYSS' : `${depth} m`
    this.biomeValue.textContent = biome.name
    this.minimapLabel.textContent = biome.label
    if (game.boss) {
      this.bossWrap.classList.remove('hidden')
      this.bossName.textContent = game.boss.name
      this.bossFill.style.width = `${Math.max(0, game.boss.hp / game.boss.maxHp * 100)}%`
      this.bossPhase.textContent = game.boss.phaseText
    } else this.bossWrap.classList.add('hidden')
    this.qKills.textContent = game.stats.kills
    this.qBlocks.textContent = game.stats.blocks
    this.qCrystals.textContent = `${game.stats.crystals}/5`
    this.buffFlight.classList.toggle('on', player.wings)
    this.buffBed.classList.toggle('on', !!game.bedPos)
    this.buffGrapple.classList.toggle('on', true)
    const hour = Math.floor(((game.dayTime + .25) % 1) * 24)
    this.clockText.textContent = `${String(hour).padStart(2, '0')}:00`
    this.clockIcon.textContent = hour >= 6 && hour < 19 ? '☀' : '☾'
    if (game.interactText) { this.interactText.textContent = game.interactText; this.interact.classList.remove('hidden') } else this.interact.classList.add('hidden')
    if (game.mining) {
      this.mineWrap.classList.remove('hidden'); this.mineFill.style.width = `${Math.min(100, game.mining.progress * 100)}%`; this.mineLabel.textContent = `MINING ${game.mining.name.toUpperCase()}`
    } else this.mineWrap.classList.add('hidden')
    if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) this.eventBanner.classList.add('hidden') }
    this.drawMinimap(game, player, dt)
    this.refreshHotbar()
    if (game.inventoryDirty) { this.renderInventory(); this.renderStations(); this.renderCrafting(); game.inventoryDirty = false }
  }

  biomeAt(player, ground) {
    const y = player.position.y, x = player.position.x
    if (y > ground - 3) return { name: 'CELEBRATION BEACH', label: 'SURFACE · BEACH' }
    if (y > 48) return { name: 'MUSHROOM GROVE', label: 'THE GLOWING DEEP' }
    if (y > 36) return { name: 'NOT THE BEES', label: 'HIVE LAYER' }
    if (y > 18) return x < 32 ? { name: 'THE CORRUPTION', label: 'CORRUPTED STRATA' } : { name: 'THE CRIMSON', label: 'CRIMSON STRATA' }
    if (y > 8) return { name: 'ASHEN CAVERNS', label: 'THE UNDERWORLD' }
    return { name: 'THE UNDERWORLD', label: 'THE UNDERWORLD' }
  }

  drawMinimap(game, player, dt) {
    this.godElapsed += dt
    if (this.godElapsed < .09) return
    this.godElapsed = 0
    const ctx = this.ctx, size = 184
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = '#080506'; ctx.fillRect(0, 0, size, size)
    ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(-player.yaw)
    const cell = 5, radius = 18
    const px = Math.floor(player.position.x), pz = Math.floor(player.position.z)
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const wx = px + dx, wz = pz + dz
      const c = game.world.mapPixel(wx, wz)
      ctx.fillStyle = c
      ctx.fillRect(dx * cell, dz * cell, cell + .5, cell + .5)
    }
    // lava shimmer markers
    ctx.globalAlpha = .55
    for (const l of game.fx.lavaGlows) {
      const dx = l.position.x - px, dz = l.position.z - pz
      if (Math.abs(dx) < radius && Math.abs(dz) < radius) { ctx.fillStyle = '#ff8a2e'; ctx.fillRect(dx * cell - 2, dz * cell - 2, 6, 6) }
    }
    ctx.globalAlpha = 1
    // enemies
    for (const e of game.enemies.list) {
      const dx = e.position.x - px, dz = e.position.z - pz
      if (Math.abs(dx) < radius && Math.abs(dz) < radius) { ctx.fillStyle = '#ff3f4a'; ctx.fillRect(dx * cell - 1.5, dz * cell - 1.5, 4, 4) }
    }
    if (game.boss) {
      const dx = game.boss.root.position.x - px, dz = game.boss.root.position.z - pz
      ctx.fillStyle = '#ffcf5b'; ctx.beginPath(); ctx.arc(dx * cell, dz * cell, 4, 0, 7); ctx.fill()
    }
    ctx.restore()
    // player arrow
    ctx.save(); ctx.translate(size / 2, size / 2)
    ctx.fillStyle = '#ffdca5'; ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 8
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill()
    ctx.restore()
  }

  toast(text, type = '') {
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = text
    this.toasts.appendChild(el)
    while (this.toasts.children.length > 6) this.toasts.removeChild(this.toasts.firstChild)
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-4px)'; setTimeout(() => el.remove(), 400) }, 3200)
  }

  banner(kicker, title, seconds = 4.5) {
    this.eventKicker.textContent = kicker; this.eventTitle.textContent = title
    this.eventBanner.classList.remove('hidden'); this.bannerTimer = seconds
    this.eventBanner.style.animation = 'none'; void this.eventBanner.offsetWidth; this.eventBanner.style.animation = 'eventIn .5s ease both'
  }

  flashDamage() {
    this.damageFlash.style.opacity = '.9'
    setTimeout(() => this.damageFlash.style.opacity = '0', 60)
  }
  flashLava() {
    this.lavaFlash.style.opacity = '.8'
    setTimeout(() => this.lavaFlash.style.opacity = '0', 90)
  }
  setMining() { }

  showDeath(cause) {
    this.deathCause.textContent = cause
    this.death.classList.remove('hidden')
    this.game.paused = true
    document.exitPointerLock?.()
  }
  hideDeath() { this.death.classList.add('hidden'); this.game.paused = false; this.requestLockSoon() }
  requestLockSoon() { setTimeout(() => this.game.requestLock(), 120) }

  setupTouch() {
    const stick = document.getElementById('touch-stick'), knob = stick.querySelector('i')
    let active = false, id = null, cx = 0, cy = 0
    const setAxis = (x, y) => { this.game.touchMove.set(x, y) }
    stick.addEventListener('pointerdown', e => { active = true; id = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(id) })
    stick.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== id) return
      let dx = (e.clientX - cx) / 44, dy = (e.clientY - cy) / 44
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l }
      knob.style.transform = `translate(${dx * 28}px,${dy * 28}px)`
      setAxis(dx, -dy)
    })
    const end = e => { if (e.pointerId !== id) return; active = false; knob.style.transform = ''; setAxis(0, 0) }
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end)
    const look = document.getElementById('touch-look')
    let lid = null, lx = 0, ly = 0
    look.addEventListener('pointerdown', e => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lid) })
    look.addEventListener('pointermove', e => {
      if (e.pointerId !== lid) return
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY
      this.game.player.look(dx * 2.2, dy * 2.2)
    })
    look.addEventListener('pointerup', () => { lid = null })
    document.querySelectorAll('[data-touch]').forEach(b => {
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); const a = b.dataset.touch
        if (a === 'inventory') this.toggleInventory()
        else if (a === 'jump') this.game.player.requestJump()
        else if (a === 'attack') this.game.player.attack()
        else if (a === 'mine') { this.game.player.setMining(true); setTimeout(() => this.game.player.setMining(false), 650) }
        else if (a === 'dash') this.game.player.dash()
        else if (a === 'grapple') this.game.player.grappleHook()
      })
    })
  }
}
