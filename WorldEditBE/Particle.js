import { registerPlayerDataHandler, Config } from "./DataStore.js"
import { GetMaxPos, GetMinPos, ParsePos, MakePos } from "./functions.js"

// 利用liteLoaderBDS材质包的粒子绘图类
export class ParticlePainterLL {
  color
  dots
  worker
  interval
  ready
  constructor(color = "G", interval = 1000) {
    try {
      this.color = color
      this.dots = []
      this.worker = null
      this.interval = interval // respawn interval
      this.ready = true
    } catch (e) {
      logger.error("粒子效果创建失败!请检查plugins/LiteLoader/LiteLoader.json中的ParticleAPI是否开启")
    }
  }
  makeParticleName(length, direction, back) {
    const directionStr = ["pY", "mY", "pZ", "mZ", "pX", "mX"]
    length = length || 1
    return `ll:line${back ? "_back" : ""}${directionStr[direction]}${this.color}${length}`
  }
  binaryDivision(length) {
    let res = []
    // 只能创建最大2048的粒子，所以先把数据缩小到2047内
    while (length > 2048) {
      res.push(2048)
      length -= 2048
    }
    for (let n = 2048; n >= 1; n /= 2) {
      if (length >= n) {
        res.push(n)
        length -= n
      }
    }
    return res
  }
  /** start, end: IntPos|FloatPos */
  drawLine(start, end) {
    const min = GetMinPos(start, end)
    const max = GetMaxPos(start, end)
    let direction = Direction.POS_Y
    let length = 0
    if (max.y > min.y) {
      direction = Direction.POS_Y
      length = max.y - min.y
    }
    if (max.x > min.x) {
      direction = Direction.POS_X
      length = max.x - min.x
    }
    if (max.z > min.z) {
      direction = Direction.POS_Z
      length = max.z - min.z
    }
    const segs = this.binaryDivision(length) // 二分法切割，并添加开头的0
    let lastLen = 0
    segs.forEach((seg) => {
      switch (direction) {
        case Direction.POS_X:
          min.x += lastLen
          this.dots.push({
            p: new FloatPos(min.x + seg / 2, min.y, min.z, start.dimid),
            name: this.makeParticleName(seg, direction, false),
          })
          this.dots.push({
            p: new FloatPos(min.x + seg / 2, min.y, min.z, start.dimid),
            name: this.makeParticleName(seg, direction, true),
          })
          break
        case Direction.POS_Y:
          min.y += lastLen
          this.dots.push({
            p: new FloatPos(min.x, min.y + seg / 2, min.z, start.dimid),
            name: this.makeParticleName(seg, direction, false),
          })
          this.dots.push({
            p: new FloatPos(min.x, min.y + seg / 2, min.z, start.dimid),
            name: this.makeParticleName(seg, direction, true),
          })
          break
        case Direction.POS_Z:
          min.z += lastLen
          this.dots.push({
            p: new FloatPos(min.x, min.y, min.z + seg / 2, start.dimid),
            name: this.makeParticleName(seg, direction, false),
          })
          this.dots.push({
            p: new FloatPos(min.x, min.y, min.z + seg / 2, start.dimid),
            name: this.makeParticleName(seg, direction, true),
          })
          break
      }
      lastLen = seg
    })

    this.start()
  }
  drawCube(start, end) {
    const maxSizeAllowed = 40960
    const s = GetMinPos(ParsePos(start), ParsePos(end))
    const e = GetMaxPos(ParsePos(start), ParsePos(end))
    // check if the size is too large

    if (e.x - s.x > maxSizeAllowed || e.y - s.y > maxSizeAllowed || e.z - s.z > maxSizeAllowed) {
      return
    }

    // add 12 sides
    this.drawLine(s, { ...s, x: e.x })
    this.drawLine({ ...s, y: e.y }, { ...s, y: e.y, x: e.x })
    this.drawLine({ ...s, z: e.z }, { ...s, z: e.z, x: e.x })
    this.drawLine({ ...s, y: e.y, z: e.z }, { ...s, y: e.y, z: e.z, x: e.x })

    this.drawLine(s, { ...s, y: e.y })
    this.drawLine({ ...s, x: e.x }, { ...s, x: e.x, y: e.y })
    this.drawLine({ ...s, z: e.z }, { ...s, z: e.z, y: e.y })
    this.drawLine({ ...s, x: e.x, z: e.z }, { ...s, x: e.x, z: e.z, y: e.y })

    this.drawLine(s, { ...s, z: e.z })
    this.drawLine({ ...s, y: e.y }, { ...s, y: e.y, z: e.z })
    this.drawLine({ ...s, x: e.x }, { ...s, x: e.x, z: e.z })
    this.drawLine({ ...s, y: e.y, x: e.x }, { ...s, y: e.y, x: e.x, z: e.z })

    this.start()
  }
  start() {
    this.paint()
    if (this.worker) {
      return
    }
    this.worker = setInterval(() => this.paint(), this.interval)
  }
  stop() {
    if (this.worker) {
      clearInterval(this.worker)
      this.worker = null
    }
  }
  paint() {
    if (this.dots.length) {
      this.dots.forEach((dot) => {
        // this.ps.spawnParticle(dot, this.particleName)
        mc.spawnParticle(dot.p, dot.name)
      })
    } else {
      this.stop()
    }
  }
  clear() {
    this.stop()
    this.dots = []
  }
}

export class ParticlePainter {
  particleName
  dots
  worker
  interval
  ready
  constructor(particleName = "minecraft:redstone_wire_dust_particle", interval = 1000) {
    try {
      // this.ps = mc.newParticleSpawner(100)
      this.particleName = particleName
      this.dots = []
      this.worker = null
      this.interval = interval // respawn interval
      this.ready = true
    } catch (e) {
      // this.ps = null
      logger.error("粒子效果创建失败!请检查plugins/LiteLoader/LiteLoader.json中的ParticleAPI是否开启")
    }
  }
  /** start, end: IntPos|FloatPos */
  drawLine(start, end, spacing = 1) {
    const diff = {
      x: end.x - start.x,
      y: end.y - start.y,
      z: end.z - start.z,
    }
    const maxDiff = Math.max(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z))
    const maxSeg = Math.floor(maxDiff / spacing)
    const delta = {
      x: diff.x / maxSeg,
      y: diff.y / maxSeg,
      z: diff.z / maxSeg,
    }
    for (let i = 0; i < maxSeg; i++) {
      const dot = MakePos([start.x + i * delta.x, start.y + i * delta.y, start.z + i * delta.z], start.dimid)
      this.dots.push(dot)
    }
    this.start()
  }
  drawCube(start, end, spacing = 1) {
    const s = {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      z: Math.min(start.z, end.z),
    }
    const e = {
      x: Math.max(start.x, end.x),
      y: Math.max(start.y, end.y),
      z: Math.max(start.z, end.z),
    }
    // check if the size is too large

    if (e.x - s.x > 1000 || e.y - s.y > 1000 || e.z - s.z > 1000) {
      return
    }

    // add 12 sides
    for (let x = s.x + spacing; x < e.x; x += spacing) {
      this.dots.push(new FloatPos(x, s.y, s.z, start.dimid))
      this.dots.push(new FloatPos(x, e.y, s.z, start.dimid))
      this.dots.push(new FloatPos(x, s.y, e.z, start.dimid))
      this.dots.push(new FloatPos(x, e.y, e.z, start.dimid))
    }
    for (let y = s.y + spacing; y < e.y; y += spacing) {
      this.dots.push(new FloatPos(s.x, y, s.z, start.dimid))
      this.dots.push(new FloatPos(e.x, y, s.z, start.dimid))
      this.dots.push(new FloatPos(s.x, y, e.z, start.dimid))
      this.dots.push(new FloatPos(e.x, y, e.z, start.dimid))
    }
    for (let z = s.z + spacing; z < e.z; z += spacing) {
      this.dots.push(new FloatPos(s.x, s.y, z, start.dimid))
      this.dots.push(new FloatPos(e.x, s.y, z, start.dimid))
      this.dots.push(new FloatPos(s.x, e.y, z, start.dimid))
      this.dots.push(new FloatPos(e.x, e.y, z, start.dimid))
    }
    // add 8 vertices
    this.dots.push(new FloatPos(s.x, s.y, s.z, start.dimid))
    this.dots.push(new FloatPos(s.x, s.y, e.z, start.dimid))
    this.dots.push(new FloatPos(s.x, e.y, s.z, start.dimid))
    this.dots.push(new FloatPos(s.x, e.y, e.z, start.dimid))
    this.dots.push(new FloatPos(e.x, s.y, s.z, start.dimid))
    this.dots.push(new FloatPos(e.x, s.y, e.z, start.dimid))
    this.dots.push(new FloatPos(e.x, e.y, s.z, start.dimid))
    this.dots.push(new FloatPos(e.x, e.y, e.z, start.dimid))

    this.start()
  }
  start() {
    this.paint()
    if (this.worker) {
      return
    }
    this.worker = setInterval(() => this.paint(), this.interval)
  }
  stop() {
    if (this.worker) {
      clearInterval(this.worker)
      this.worker = null
    }
  }
  paint() {
    if (this.dots.length) {
      this.dots.forEach((dot) => {
        // this.ps.spawnParticle(dot, this.particleName)
        mc.spawnParticle(dot, this.particleName)
      })
    } else {
      this.stop()
    }
  }
  clear() {
    this.stop()
    this.dots = []
  }
  static ShowIndicator(pos, particleName = "minecraft:crop_growth_emitter", duration = 3000, interval = 1000) {
    const ppos = ParsePos(pos)
    let counter = duration / interval
    let worker = setInterval(() => {
      mc.spawnParticle(ppos.x + 0.5, ppos.y + 0.5, ppos.z + 0.5, pos.dimid, particleName)
      if (--counter <= 0) {
        clearInterval(worker)
      }
    }, interval)
  }
}

// Player data handler
function painterHandler(paintName, color, particleName, interval, overwrite = false) {
  if (!this.painterList) {
    this.painterList = new Map()
  }
  // 覆盖原有的painter则需要释放掉对应的资源
  if (this.painterList.has(paintName) && overwrite) {
    this.painterList.get(paintName).clear()
    this.painterList.delete(paintName)
  }

  if (!this.painterList.get(paintName)) {
    let ps
    if (Config.UseLLParticle) {
      ps = new ParticlePainterLL(color)
    } else {
      ps = new ParticlePainter(particleName, interval)
    }
    this.painterList.set(paintName, ps)
  }
  return this.painterList.get(paintName)
}

function freePainterList() {
  this.painterList && this.painterList.forEach((ps) => ps.clear())
}

registerPlayerDataHandler("painter", painterHandler, freePainterList)
