import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const SKY_VERT = `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`
const SKY_FRAG = `
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform float uNight;
varying vec3 vDir;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
void main(){
  vec3 d = normalize(vDir);
  float up = clamp(d.y, -1.0, 1.0);
  float h = pow(clamp(up, 0.0, 1.0), .55);
  vec3 col = mix(uHorizon, uZenith, h);
  col = mix(uGround, col, smoothstep(-0.16, 0.02, up));
  // distant star field
  vec2 sp = vec2(atan(d.z,d.x), asin(clamp(d.y,-1.,1.))) * 24.0;
  float star = pow(hash(floor(sp)), 34.0);
  star *= smoothstep(.1,.5,up) * (0.55 + 0.45*sin(uTime*2.0 + hash(floor(sp))*30.0));
  col += vec3(.85,.92,1.0) * star * 1.5;
  // drunk-world aurora ribbons
  float ang = atan(d.z,d.x);
  float band = sin(ang*2.3 + d.y*7.0 + uTime*.018) * .5 + .5;
  float band2 = sin(ang*3.9 - d.y*11.0 - uTime*.011) * .5 + .5;
  float aur = smoothstep(.55,1.0,band)*smoothstep(.0,.55,up)*.13 + smoothstep(.78,1.0,band2)*smoothstep(.02,.4,up)*.07;
  vec3 auroraCol = mix(vec3(.82,.27,.82), vec3(.24,.85,.78), smoothstep(.1,.8,up));
  col += auroraCol * aur;
  // celebration haze on horizon
  float cel = smoothstep(.35,.0,abs(up-.06)) * smoothstep(.2,.8,sin(ang*1.7 + 1.2)*.5+.5);
  col += vec3(.34,.12,.22) * cel * .6;
  // moon halo (sprite draws the face)
  vec3 moonDir = normalize(vec3(-.43,.52,-.74));
  float md = max(dot(d,moonDir),0.0);
  col += vec3(1.0,.58,.34) * pow(md, 180.0) * 1.2;
  col += vec3(.7,.26,.22) * pow(md, 18.0) * .10;
  gl_FragColor = vec4(col,1.0);
}
`
const SHAFT_VERT = `
varying vec2 vUv;
varying vec3 vWorld;
void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vWorld=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }
`
const SHAFT_FRAG = `
uniform float uTime;
uniform vec3 uColor;
uniform float uStrength;
varying vec2 vUv;
varying vec3 vWorld;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){
  float edge = smoothstep(0.0,.22,vUv.x)*smoothstep(1.0,.78,vUv.x);
  float vertical = smoothstep(0.0,.16,vUv.y)*smoothstep(1.0,.65,vUv.y);
  float streaks = n(vec2(vUv.x*15.0+uTime*.05, vUv.y*5.0-uTime*.11));
  // fade the veil out when the camera steps inside it
  float nearFade = smoothstep(1.2, 6.0, distance(vWorld, cameraPosition));
  float a = edge*vertical*(.042 + streaks*.05)*uStrength*nearFade;
  gl_FragColor = vec4(uColor * (1.0+streaks*.5), a);
}
`
const GRADE_FRAG = `
uniform sampler2D tDiffuse;
uniform float uTime;
uniform vec2 uRes;
varying vec2 vUv;
float rand(vec2 co){ return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv = vUv;
  vec2 c = uv - .5;
  float r2 = dot(c,c);
  float ca = .0012 + r2*.0018;
  float r = texture2D(tDiffuse, uv + c*ca).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - c*ca).b;
  vec3 col = vec3(r,g,b);
  // warm highlights, cold crushed shadows
  float l = dot(col, vec3(.299,.587,.114));
  col = mix(col * vec3(.85,.92,1.06), col * vec3(1.10,1.015,.88), smoothstep(.15,.8,l));
  col = mix(vec3(l), col, 1.06);
  float vig = smoothstep(.92,.25,length(c)*1.15);
  col *= mix(.64,1.0,vig);
  col += (rand(uv*uRes + uTime*37.0)-.5)*.018;
  gl_FragColor = vec4(col,1.0);
}
`

function glowTexture(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,120,30,0)') {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2)
  grd.addColorStop(0, inner); grd.addColorStop(.28, 'rgba(255,190,110,.5)'); grd.addColorStop(1, outer)
  g.fillStyle = grd; g.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

function bannerTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#3a0a10'; g.fillRect(0, 0, 128, 256)
  g.fillStyle = '#5c1119'; g.fillRect(8, 8, 112, 240)
  g.strokeStyle = '#c9984c'; g.lineWidth = 5; g.strokeRect(8, 8, 112, 240)
  g.strokeStyle = '#7e1e26'; g.lineWidth = 3; g.strokeRect(18, 18, 92, 220)
  g.fillStyle = '#c9984c'
  g.beginPath(); g.moveTo(64, 46); g.lineTo(88, 96); g.lineTo(64, 146); g.lineTo(40, 96); g.closePath(); g.fill()
  g.fillStyle = '#571018'; g.beginPath(); g.moveTo(64, 62); g.lineTo(78, 96); g.lineTo(64, 130); g.lineTo(50, 96); g.closePath(); g.fill()
  g.fillStyle = '#e8c07a'; g.beginPath(); g.arc(64, 96, 9, 0, 7); g.fill()
  g.strokeStyle = '#c9984c'; g.lineWidth = 3
  g.beginPath(); g.moveTo(22, 170); g.lineTo(106, 170); g.stroke()
  for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#c9984c' : '#7e1e26'; g.fillRect(20 + i * 13, 214, 9, 26) }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

function moonTexture() {
  const size = 512
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d')
  // outer sickly halo
  let grd = g.createRadialGradient(256, 256, 100, 256, 256, 256)
  grd.addColorStop(0, 'rgba(255,190,120,.20)'); grd.addColorStop(.55, 'rgba(255,110,60,.08)'); grd.addColorStop(1, 'rgba(255,70,30,0)')
  g.fillStyle = grd; g.fillRect(0, 0, size, size)
  // moon disc
  grd = g.createRadialGradient(222, 222, 24, 262, 262, 176)
  grd.addColorStop(0, '#fff3d4'); grd.addColorStop(.42, '#f0d9ac'); grd.addColorStop(.8, '#c9a77f'); grd.addColorStop(1, '#8f6d59')
  g.fillStyle = grd; g.beginPath(); g.ellipse(262, 258, 170, 174, .06, 0, 7); g.fill()
  // crater stains
  const rnd = (() => { let s = 99; return () => (s = (s * 16807) % 2147483647) / 2147483647 })()
  g.globalAlpha = .18
  for (let i = 0; i < 26; i++) {
    const x = 120 + rnd() * 290, y = 110 + rnd() * 300, r = 7 + rnd() * 26
    const gr = g.createRadialGradient(x, y, 1, x, y, r)
    gr.addColorStop(0, '#5f4436'); gr.addColorStop(1, 'rgba(95,68,54,0)')
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill()
  }
  g.globalAlpha = 1
  // distorted grin
  g.strokeStyle = 'rgba(44,22,26,.88)'; g.lineWidth = 13; g.lineCap = 'round'
  g.beginPath(); g.moveTo(164, 308); g.bezierCurveTo(212, 380, 322, 386, 372, 300); g.stroke()
  g.strokeStyle = 'rgba(255,240,215,.5)'; g.lineWidth = 3
  g.beginPath(); g.moveTo(172, 310); g.bezierCurveTo(218, 372, 320, 378, 364, 304); g.stroke()
  // teeth
  g.fillStyle = 'rgba(50,27,28,.55)'
  for (let i = 0; i < 6; i++) { const x = 196 + i * 28; g.beginPath(); g.moveTo(x, 344 + Math.sin(i) * 4); g.lineTo(x + 12, 337); g.lineTo(x + 14, 356); g.closePath(); g.fill() }
  // eyes — asymmetric crescents
  g.fillStyle = 'rgba(38,20,24,.9)'
  g.beginPath(); g.ellipse(206, 224, 34, 25, -.22, 0, 7); g.fill()
  g.beginPath(); g.ellipse(320, 214, 30, 36, .34, 0, 7); g.fill()
  g.fillStyle = 'rgba(255,225,170,.65)'
  g.beginPath(); g.ellipse(212, 226, 7, 8, 0, 0, 7); g.fill()
  g.beginPath(); g.ellipse(314, 220, 5, 6, 0, 0, 7); g.fill()
  // cracks & drunk distortion
  g.strokeStyle = 'rgba(92,60,54,.35)'; g.lineWidth = 2
  for (let i = 0; i < 7; i++) { g.beginPath(); let x = 160 + rnd() * 220, y = 120 + rnd() * 280; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (rnd() - .5) * 24; y += (rnd() - .5) * 20; g.lineTo(x, y) } g.stroke() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}

export class FX {
  constructor(scene, camera, renderer, world, audio) {
    this.scene = scene; this.camera = camera; this.renderer = renderer; this.world = world; this.audio = audio
    this.time = 0
    this.torches = []
    this.torchLights = []
    this.bursts = []
    this.temp = new THREE.Vector3()
    this.setupSky()
    this.setupLights()
    this.setupTorches()
    this.setupBanners()
    this.setupParticles()
    this.setupShafts()
    this.setupPost()
  }

  setupSky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(340, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uZenith: { value: new THREE.Color(0x0a0613) },
          uHorizon: { value: new THREE.Color(0x581d24) },
          uGround: { value: new THREE.Color(0x090607) },
          uNight: { value: 1 }
        },
        vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
        side: THREE.BackSide, depthWrite: false, fog: false
      })
    )
    sky.renderOrder = -1000; this.sky = sky; this.scene.add(sky)

    const starGeo = new THREE.BufferGeometry()
    const starPos = [], starCol = []
    for (let i = 0; i < 900; i++) {
      const theta = Math.random() * Math.PI * 2, phi = Math.acos(Math.random() * .95)
      const r = 315
      starPos.push(Math.sin(phi) * Math.cos(theta) * r, Math.cos(phi) * r * .85 + 10, Math.sin(phi) * Math.sin(theta) * r)
      const b = .45 + Math.random() * .55
      starCol.push(b, b * .92, b * .85)
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3))
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.4, vertexColors: true, transparent: true, opacity: .85, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))
    stars.renderOrder = -999; this.stars = stars; this.scene.add(stars)

    const moonTex = moonTexture()
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, color: 0xffe2c0 }))
    moon.scale.set(66, 66, 1); moon.position.set(-118, 158, -196); moon.renderOrder = -998
    this.moon = moon; this.scene.add(moon)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128, 'rgba(255,190,110,.55)', 'rgba(255,90,40,0)'), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: .42 }))
    halo.scale.set(160, 160, 1); halo.position.copy(moon.position); halo.renderOrder = -999
    this.moonHalo = halo; this.scene.add(halo)
    const moonGroup = new THREE.Group(); moonGroup.add(moon); moonGroup.add(halo); this.scene.add(moonGroup)
    this.moonGroup = moonGroup
  }

  setupLights() {
    this.ambient = new THREE.AmbientLight(0x6a4a55, 1.05); this.scene.add(this.ambient)
    this.hemi = new THREE.HemisphereLight(0x9a6d73, 0x241616, .9); this.scene.add(this.hemi)
    const sun = new THREE.DirectionalLight(0xffb27a, 1.35)
    sun.position.set(42, 95, 28); sun.target.position.set(32, 40, 32)
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -55; sun.shadow.camera.right = 55; sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55
    sun.shadow.camera.near = 20; sun.shadow.camera.far = 180; sun.shadow.bias = -0.0006
    this.scene.add(sun); this.scene.add(sun.target); this.sun = sun

    const spot = new THREE.SpotLight(0x9fc4ff, 42, 36, .44, .86, 1.5)
    spot.position.set(32.5, 19.4, 32.5); spot.target.position.set(32.5, 7.2, 32.5)
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0009; spot.shadow.camera.near = 1; spot.shadow.camera.far = 36
    this.scene.add(spot); this.scene.add(spot.target); this.spot = spot

    this.altarLight = new THREE.PointLight(0xff6b26, 14, 20, 2)
    this.altarLight.position.set(32.5, 12.5, 26.5); this.scene.add(this.altarLight)
    this.heartLight = new THREE.PointLight(0xff5a14, 26, 24, 2)
    this.heartLight.position.set(32.5, 12.5, 17.5); this.scene.add(this.heartLight)

    const l1 = new THREE.PointLight(0xff5a12, 16, 24, 2); l1.position.set(21, 8.7, 39); this.scene.add(l1); this.lavaLightA = l1
    const l2 = new THREE.PointLight(0xff7020, 14, 22, 2); l2.position.set(41, 8.7, 22); this.scene.add(l2); this.lavaLightB = l2

    // brazier lights: two opposing sources instead of four keeps the shader light loop cheap
    this.braziers = []
    for (const [bx, bz] of [[23.5, 23.5], [40.5, 40.5]]) {
      const b = new THREE.PointLight(0xffb070, 18, 18, 2)
      b.position.set(bx, 11.2, bz); this.scene.add(b); this.braziers.push(b)
    }

    this.torchLightColor = 0xff9a4a
  }

  setupTorches() {
    const glow = glowTexture(128, 'rgba(255,240,190,.95)', 'rgba(255,90,20,0)')
    this.torchGlowTex = glow
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: .9 })
    const coal = new THREE.MeshBasicMaterial({ color: 0xffa23a })
    const flameMat = new THREE.SpriteMaterial({ map: glow, color: 0xffb45a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    for (const p of this.world.torchPositions) {
      const grp = new THREE.Group()
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(.055, .085, .55, 5), wood)
      stick.position.y = -.25; grp.add(stick)
      const ember = new THREE.Mesh(new THREE.ConeGeometry(.1, .22, 5), coal)
      ember.position.y = .08; grp.add(ember)
      const f = new THREE.Sprite(flameMat.clone()); f.scale.set(.9, 1.1, 1); f.position.y = .23; grp.add(f)
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff7a30, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .55 }))
      halo.scale.set(2.2, 2.2, 1); halo.position.y = .2; grp.add(halo)
      grp.position.copy(p); grp.userData.flame = f; grp.userData.halo = halo; grp.userData.seed = Math.random() * 10
      this.scene.add(grp); this.torches.push(grp)
    }
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xff9a4a, 4, 11, 2)
      l.intensity = 4; this.scene.add(l); this.torchLights.push(l)
    }
    this.torchAssignTimer = 0
  }

  addTorch(pos) {
    const glow = this.torchGlowTex
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: .9 })
    const coal = new THREE.MeshBasicMaterial({ color: 0xffa23a })
    const grp = new THREE.Group()
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.055, .085, .55, 5), wood); stick.position.y = -.25; grp.add(stick)
    const ember = new THREE.Mesh(new THREE.ConeGeometry(.1, .22, 5), coal); ember.position.y = .08; grp.add(ember)
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffb45a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); f.scale.set(.9, 1.1, 1); f.position.y = .23; grp.add(f)
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xff7a30, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .55 })); halo.scale.set(2.2, 2.2, 1); halo.position.y = .2; grp.add(halo)
    grp.position.copy(pos); grp.userData.flame = f; grp.userData.halo = halo; grp.userData.seed = Math.random() * 10
    this.scene.add(grp); this.torches.push(grp)
    return grp
  }

  setupBanners() {
    const tex = bannerTexture()
    const cloth = new THREE.MeshStandardMaterial({ map: tex, roughness: .92, metalness: .02, side: THREE.DoubleSide, emissive: 0x1c0204, emissiveIntensity: .55 })
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a32, roughness: .55, metalness: .65, emissive: 0x211303, emissiveIntensity: .5 })
    for (const [x, z, ry] of [[47.86, 32, -Math.PI / 2], [16.14, 32, Math.PI / 2], [32, 47.86, Math.PI], [32, 16.14, 0]]) {
      if (z === 16.14) continue // the altar wall already has the lava window
      const g = new THREE.Group()
      const clothMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 5.6), cloth)
      clothMesh.position.y = -1.1; g.add(clothMesh)
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 3.5, 6), rodMat)
      rod.rotation.z = Math.PI / 2; rod.position.y = 1.72; g.add(rod)
      for (const s of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(.08, 6, 5), rodMat)
        cap.position.set(s * 1.76, 1.72, 0); g.add(cap)
      }
      g.position.set(x, 13.6, z); g.rotation.y = ry
      this.scene.add(g)
    }
  }

  setupParticles() {
    const makePoints = (count, colorA, colorB, size, opacity, blending = THREE.AdditiveBlending) => {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(count * 3), col = new Float32Array(count * 3)
      const cA = new THREE.Color(colorA), cB = new THREE.Color(colorB)
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - .5) * 38
        pos[i * 3 + 1] = 4 + Math.random() * 16
        pos[i * 3 + 2] = (Math.random() - .5) * 38
        const c = cA.clone().lerp(cB, Math.random())
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const mat = new THREE.PointsMaterial({ map: this.torchGlowTex, size, vertexColors: true, transparent: true, opacity, depthWrite: false, blending, sizeAttenuation: true })
      const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; this.scene.add(pts)
      return { pts, pos, count, baseY: 4, height: 18, origin: new THREE.Vector3(32, 0, 32) }
    }
    this.embers = makePoints(300, 0xffc36b, 0xff4b12, .12, .36)
    this.embers.origin.set(32, 0, 32); this.embers.baseY = 4; this.embers.height = 18
    this.ash = makePoints(180, 0x9b8a7c, 0x50423d, .08, .30, THREE.NormalBlending)
    this.ash.origin.set(32, 0, 32); this.ash.baseY = 8; this.ash.height = 13
    this.spores = makePoints(140, 0x7dffe8, 0x1c9cff, .1, .42)
    this.spores.origin.set(28, 45, 45); this.spores.baseY = 43; this.spores.height = 12
    this.surfaceMotes = makePoints(110, 0xffe7bd, 0xff9f6a, .07, .25)
    this.surfaceMotes.origin.set(32, 0, 32); this.surfaceMotes.baseY = 50; this.surfaceMotes.height = 20
    // ember geysers over lava
    this.lavaGlows = []
    for (const [x, z, s] of [[18, 36, 13], [46, 22, 11], [32, 50, 10], [10, 32, 9], [54, 40, 8]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128, 'rgba(255,150,60,.6)', 'rgba(255,50,10,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .12 }))
      sp.position.set(x, 7.4, z); sp.scale.set(s, s * .45, 1); this.scene.add(sp); this.lavaGlows.push(sp)
    }
    // spark pool
    const N = 300
    const g = new THREE.BufferGeometry()
    this.sparkPos = new Float32Array(N * 3).fill(9999)
    this.sparkCol = new Float32Array(N * 3)
    this.sparkVel = new Float32Array(N * 3)
    this.sparkLife = new Float32Array(N)
    g.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3))
    this.sparkPoints = new THREE.Points(g, new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, map: this.torchGlowTex }))
    this.sparkPoints.frustumCulled = false; this.scene.add(this.sparkPoints); this.sparkIndex = 0
  }

  setupShafts() {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffb073) }, uStrength: { value: 1 } },
      vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
    mat.uniforms.uStrength.value = .5
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.16, .6, 11.5, 24, 1, true), mat)
    shaft.position.set(32.5, 13.5, 32.5); shaft.renderOrder = 5; shaft.visible = false; this.scene.add(shaft); this.shaft = shaft
    const mat2 = mat.clone(); mat2.uniforms.uColor.value = new THREE.Color(0xffd6a1); mat2.uniforms.uStrength.value = .35
    const shaft2 = new THREE.Mesh(new THREE.CylinderGeometry(.35, 1.0, 40, 20, 1, true), mat2)
    shaft2.position.set(45.5, 38, 33.5); shaft2.visible = false; this.scene.add(shaft2); this.shaft2 = shaft2
    this.shaftMat = mat; this.shaftMat2 = mat2
  }

  setupPost() {
    const composer = new EffectComposer(this.renderer)
    this.renderPass = new RenderPass(this.scene, this.camera)
    composer.addPass(this.renderPass)
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), .2, .55, .88)
    composer.addPass(this.bloom)
    const grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: GRADE_FRAG
    })
    composer.addPass(grade)
    composer.addPass(new OutputPass())
    this.composer = composer; this.grade = grade
    this.quality = 1
  }

  resize(w, h) {
    this.composer.setSize(w, h)
    this.bloom.setSize(w, h)
    this.grade.uniforms.uRes.value.set(w, h)
  }

  setQuality(q) {
    this.quality = q
    this.bloom.enabled = q > .45
    if (q < .55) this.renderer.setPixelRatio(1)
    if (this.sun) this.sun.castShadow = q > .4
    if (this.spot) this.spot.castShadow = q > .4
    if (this.braziers) { this.braziers[0].visible = q > .45; this.braziers[1].visible = q > .45 }
    if (this.torchLights) this.torchLights.forEach(l => l.visible = q > .45)
    if (q < .2) { this.bloom.enabled = false; if (this.sun) this.sun.intensity *= .6 }
  }

  spawnBurst(pos, color = 0xffa04a, count = 18, speed = 5, size = .14) {
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const idx = this.sparkIndex = (this.sparkIndex + 1) % this.sparkLife.length
      const p = idx * 3
      this.sparkPos[p] = pos.x + (Math.random() - .5) * .35
      this.sparkPos[p + 1] = pos.y + (Math.random() - .5) * .35
      this.sparkPos[p + 2] = pos.z + (Math.random() - .5) * .35
      const dir = new THREE.Vector3(Math.random() - .5, Math.random() - .25, Math.random() - .5).normalize().multiplyScalar(speed * (.35 + Math.random()))
      this.sparkVel[p] = dir.x; this.sparkVel[p + 1] = dir.y; this.sparkVel[p + 2] = dir.z
      this.sparkCol[p] = c.r; this.sparkCol[p + 1] = c.g; this.sparkCol[p + 2] = c.b
      this.sparkLife[idx] = .5 + Math.random() * .7
    }
    this.sparkPoints.geometry.attributes.position.needsUpdate = true
    this.sparkPoints.geometry.attributes.color.needsUpdate = true
  }

  update(dt, time, player) {
    this.time = time
    this.sky.position.copy(this.camera.position)
    this.stars.position.copy(this.camera.position)
    this.sky.material.uniforms.uTime.value = time
    this.stars.rotation.y = time * .002
    const day = (Math.sin(time * .012) + 1) * .5
    this.sky.material.uniforms.uZenith.value.setHSL(.76, .55, .035 + .03 * day)
    this.sky.material.uniforms.uHorizon.value.setHSL(.035 + day * .02, .52, .16 + .13 * day)
    this.moonGroup.rotation.y = Math.sin(time * .006) * .18
    this.moonGroup.position.set(Math.sin(time * .013) * 8, Math.cos(time * .009) * 4, 0)
    this.moon.material.color.setHSL(.09, .45, .78 + day * .16)
    this.moonHalo.material.opacity = .45 + day * .18

    // torches flicker
    for (const t of this.torches) {
      const s = t.userData.seed
      const fl = .86 + Math.sin(time * 8 + s) * .09 + Math.sin(time * 19 + s * 3) * .05
      if (t.userData.flame) t.userData.flame.scale.set(.78 * fl, 1.02 * fl, 1)
      if (t.userData.halo) t.userData.halo.material.opacity = .4 * fl + .1
    }
    this.torchAssignTimer -= dt
    if (this.torchAssignTimer <= 0 && player) {
      this.torchAssignTimer = .4
      const sorted = this.torches.map(t => ({ t, d: t.position.distanceToSquared(player.position) })).sort((a, b) => a.d - b.d).slice(0, this.torchLights.length)
      this.torchLights.forEach((l, i) => {
        if (sorted[i]) { l.position.copy(sorted[i].t.position); l.position.y += .4; l.intensity = 4.5; l.distance = 11 } else l.intensity = 0
      })
    }
    for (const l of this.torchLights) l.intensity *= .97 + Math.sin(time * 9 + l.position.x) * .015

    // particles
    this.updateParticles(this.embers, dt, time, .9, 1.6)
    this.updateParticles(this.ash, dt, time, .25, .6, true)
    this.updateParticles(this.spores, dt, time, .18, .5)
    this.updateParticles(this.surfaceMotes, dt, time, .22, .55)
    for (const sp of this.lavaGlows) { sp.material.opacity = .1 + Math.sin(time * 1.3 + sp.position.x) * .035 }

    // sparks
    let any = false
    for (let i = 0; i < this.sparkLife.length; i++) {
      if (this.sparkLife[i] <= 0) continue
      any = true
      const p = i * 3
      this.sparkLife[i] -= dt
      if (this.sparkLife[i] <= 0) { this.sparkPos[p] = 9999; this.sparkPos[p + 1] = 9999; this.sparkPos[p + 2] = 9999; continue }
      this.sparkVel[p + 1] -= 9.5 * dt
      this.sparkPos[p] += this.sparkVel[p] * dt; this.sparkPos[p + 1] += this.sparkVel[p + 1] * dt; this.sparkPos[p + 2] += this.sparkVel[p + 2] * dt
    }
    if (any) { this.sparkPoints.geometry.attributes.position.needsUpdate = true; this.sparkPoints.geometry.attributes.color.needsUpdate = true }

    this.shaftMat.uniforms.uTime.value = time
    this.shaftMat2.uniforms.uTime.value = time
    this.grade.uniforms.uTime.value = time
    this.altarLight.intensity = 12 + Math.sin(time * 2.2) * 2.4 + Math.sin(time * 7.1) * 1.1
    this.lavaLightA.intensity = 15 + Math.sin(time * 1.8) * 2.8
    this.lavaLightB.intensity = 13 + Math.sin(time * 2.3 + 2) * 2.4
    if (this.braziers) for (let i = 0; i < this.braziers.length; i++) {
      this.braziers[i].intensity = 15 + Math.sin(time * 6.2 + i * 1.7) * 2.2 + Math.sin(time * 13.1 + i) * .9
    }
    this.heartLight.intensity = 24 + Math.sin(time * 1.6) * 4 + Math.sin(time * 4.7) * 1.5

    // depth driven lighting
    if (player) {
      const y = player.position.y
      const surf = THREE.MathUtils.smoothstep(y, 42, 62)
      this.sun.intensity = .02 + surf * 1.4
      this.hemi.intensity = .82 + surf * .55
      this.ambient.intensity = .92 - surf * .22
      this.spot.intensity = 42 + Math.sin(time * 3) * 3
      this.scene.fog.color.lerpColors(new THREE.Color(0x150b0d), new THREE.Color(0x2c1a20), surf)
      this.scene.fog.density = .0125 - surf * .006
      this.scene.background = null
    }
  }

  updateParticles(sys, dt, time, speed, drift, down = false) {
    const { pos, count } = sys
    for (let i = 0; i < count; i++) {
      const p = i * 3
      pos[p + 1] += (down ? -1 : 1) * speed * dt * (0.5 + (i % 7) * .13)
      pos[p] += Math.sin(time * .7 + i) * drift * dt
      pos[p + 2] += Math.cos(time * .53 + i * 1.7) * drift * dt
      if (!down && pos[p + 1] > sys.baseY + sys.height) pos[p + 1] = sys.baseY
      if (down && pos[p + 1] < sys.baseY) pos[p + 1] = sys.baseY + sys.height
      if (pos[p] > 19 || pos[p] < -19) pos[p] = (Math.random() - .5) * 38
      if (pos[p + 2] > 19 || pos[p + 2] < -19) pos[p + 2] = (Math.random() - .5) * 38
    }
    sys.pts.position.set(sys.origin.x, 0, sys.origin.z)
    sys.pts.geometry.attributes.position.needsUpdate = true
  }

  render() { this.composer.render() }
}
