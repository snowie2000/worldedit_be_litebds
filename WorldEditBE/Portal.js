import { ConfigFile } from "./DataStore.js"
import { CanStandOn, console, ParsePos } from "./functions.js"

export class PortalInfo extends ConfigFile {
  jsonTemplate
  checker
  inActionPlayers
  constructor() {
    super("portal.json", { portals: {}, targets: {} })
    this.checker = 0
    this.inActionPlayers = new Set()
  }
  /** 遍历并返回所有传送门信息 */
  listPortal() {
    const portals = Object.keys(this.content.portals)
    const targets = new Set(Object.keys(this.content.targets))
    return portals.map((p) => ({
      name: p,
      linked: targets.has(p),
    }))
  }
  // 根据portal的形状计算可以被传送的目标点
  getPortalTpSpot(p1, p2) {
    function getProperPosVertial(pos, height) {
      for (let i = 0; i < height; i++) {
        const block = mc.getBlock(pos.x, pos.y + i, pos.z, pos.dimid)
        if (block.isAir) {
          return {
            ...pos,
            y: pos.y + i,
          }
        }
      }
      return pos
    }

    function getProperPosHorizontal(pos1, pos2) {
      const xCenter = (pos1.x + pos2.x) / 2
      const zCenter = (pos1.z + pos2.z) / 2
      let xStart = xCenter,
        xEnd = xCenter,
        zStart = zCenter,
        zEnd = zCenter
      if (xCenter !== Math.floor(xCenter)) {
        //xCenter 是一个整数
        xStart = Math.floor(xCenter)
        xEnd = xStart + 1
      }
      if (zCenter !== Math.floor(zCenter)) {
        //zCenter 是一个整数
        zStart = Math.floor(zCenter)
        zEnd = zStart + 1
      }
      let deltaX = xStart - pos1.x,
        deltaZ = zStart - pos1.z,
        flag = true,
        res = null
      let block, blockPortal
      while (flag && !res) {
        const scanlineX1 = pos1.x + deltaX
        const scanlineX2 = pos2.x - deltaX
        const scanlineZ1 = pos1.z + deltaZ
        const scanlineZ2 = pos2.z - deltaZ
        // let block, blockPortal
        // find a block that is air and the block underneath it is solid.
        for (let x = scanlineX1; x <= scanlineX2; x++) {
          blockPortal = mc.getBlock(x, pos2.y - 1, scanlineZ1, pos1.dimid)
          block = mc.getBlock(x, pos2.y, scanlineZ1, pos1.dimid)
          if (block.isAir && CanStandOn(blockPortal)) {
            res = { x, y: pos2.y, z: scanlineZ1, dimid: pos1.dimid }
            break
          }
          blockPortal = mc.getBlock(x, pos2.y - 1, scanlineZ2, pos1.dimid)
          block = mc.getBlock(x, pos2.y, scanlineZ2, pos1.dimid)
          if (block.isAir && CanStandOn(blockPortal)) {
            res = { x, y: pos2.y, z: scanlineZ2, dimid: pos1.dimid }
            break
          }
        }
        if (!res) {
          for (let z = scanlineZ1; z <= scanlineZ2; z++) {
            blockPortal = mc.getBlock(scanlineX1, pos2.y - 1, z, pos1.dimid)
            block = mc.getBlock(scanlineX1, pos2.y, z, pos1.dimid)
            if (block.isAir && CanStandOn(blockPortal)) {
              res = { x: scanlineX1, y: pos2.y, z, dimid: pos1.dimid }
              break
            }
            blockPortal = mc.getBlock(scanlineX2, pos2.y - 1, z, pos1.dimid)
            block = mc.getBlock(scanlineX2, pos2.y, z, pos1.dimid)
            if (block.isAir && CanStandOn(blockPortal)) {
              res = { x: scanlineX2, y: pos2.y, z, dimid: pos1.dimid }
              break
            }
          }
        }

        // exit loop if both x and z are on their egdes
        flag = false
        if (deltaX >= 0) {
          deltaX--
          flag = true
        }
        if (deltaZ >= 0) {
          deltaZ--
          flag = true
        }
      }
      if (res) {
        //console.log("found a valid empty space to teleport, block is ", block.name, " portal block is ", blockPortal.name)
        //console.log("at ", JSON.stringify(ParsePos(block.pos)), " indicator at ", JSON.stringify(res))
        return res
      }
      console.log("all blocks are occupied, teleport to the center")
      return {
        x: Math.floor(xCenter),
        y: pos2.y,
        z: Math.floor(zCenter),
        dimid: pos1.dimid,
      }
    }

    const depth = p2.z - p1.z + 1
    const width = p2.x - p1.x + 1
    const height = p2.y - p1.y + 1
    let flatPortal = height < width && height < depth // 这是一个横着的portal
    if (flatPortal) {
      // 横向portal
      const tpPoint = getProperPosHorizontal(p1, p2)
      return {
        tp1: tpPoint,
        tp2: tpPoint,
      }
    } else {
      // 竖着的portal
      if (depth > width) {
        return {
          tp1: getProperPosVertial(
            {
              x: p1.x - 1,
              y: p1.y,
              z: Math.floor((p1.z + p2.z) / 2),
              dimid: p1.dimid,
            },
            p2.y - p1.y
          ),
          tp2: getProperPosVertial(
            {
              x: p2.x,
              y: p1.y,
              z: Math.floor((p1.z + p2.z) / 2),
              dimid: p1.dimid,
            },
            p2.y - p1.y
          ),
        }
      } else {
        return {
          tp1: getProperPosVertial(
            {
              x: Math.floor((p1.x + p2.x) / 2),
              y: p1.y,
              z: p1.z - 1,
              dimid: p1.dimid,
            },
            p2.y - p1.y
          ),
          tp2: getProperPosVertial(
            {
              x: Math.floor((p1.x + p2.x) / 2),
              y: p1.y,
              z: p2.z,
              dimid: p1.dimid,
            },
            p2.y - p1.y
          ),
        }
      }
    }
  }
  /** 更新一个现有的传送门信息 */
  updatePortal(name, pos1, pos2) {
    if (!this.content.portals[name]) return false
    const newPortal = {
      posMin: GetMinPos(ParsePos(pos1), ParsePos(pos2)),
      posMax: GetMaxPos(ParsePos(pos1), ParsePos(pos2)),
      name,
    }
    newPortal.posMax = {
      x: newPortal.posMax.x + 1,
      y: newPortal.posMax.y + 1,
      z: newPortal.posMax.z + 1,
      dimid: newPortal.posMax.dimid,
    }
    newPortal.tpTarget = this.getPortalTpSpot(newPortal.posMin, newPortal.posMax)
    this.content.portals[name] = newPortal
    this.saveFile()
    return newPortal.tpTarget
  }
  /** 创建新的传送门 */
  addPortal(name, pos1, pos2) {
    if (this.content.portals[name]) return false
    const newPortal = {
      posMin: GetMinPos(ParsePos(pos1), ParsePos(pos2)),
      posMax: GetMaxPos(ParsePos(pos1), ParsePos(pos2)),
      name,
    }
    newPortal.posMax = {
      x: newPortal.posMax.x + 1,
      y: newPortal.posMax.y + 1,
      z: newPortal.posMax.z + 1,
      dimid: newPortal.posMax.dimid,
    }
    newPortal.tpTarget = this.getPortalTpSpot(newPortal.posMin, newPortal.posMax)
    this.content.portals[name] = newPortal
    this.saveFile()
    return newPortal.tpTarget
  }
  /** 删除传送门，将同时删除目标 */
  deletePortal(name) {
    if (this.content.portals[name]) {
      delete this.content.portals[name]
      delete this.content.targets[name]
      this.saveFile()
      return true
    } else {
      return false
    }
  }
  /** 解除传送门关联 */
  unlinkPortal(name) {
    if (this.content.targets[name]) {
      delete this.content.targets[name]
      this.saveFile()
      return true
    } else {
      return false
    }
  }
  getPortal(name) {
    return this.content.portals[name]
  }
  linkPortal(name, pos1, pos2) {
    if (this.content.portals[name]) {
      const newTarget = {
        posMin: GetMinPos(ParsePos(pos1), ParsePos(pos2)),
        posMax: GetMaxPos(ParsePos(pos1), ParsePos(pos2)),
        name,
      }
      newTarget.posMax = {
        x: newTarget.posMax.x + 1,
        y: newTarget.posMax.y + 1,
        z: newTarget.posMax.z + 1,
        dimid: newTarget.posMax.dimid,
      }
      newTarget.tpTarget = this.getPortalTpSpot(newTarget.posMin, newTarget.posMax)
      this.content.targets[name] = newTarget
      this.saveFile()
      logger.error(JSON.stringify(newTarget.tpTarget))
      return newTarget.tpTarget // 成功则返回传送目标点
    }
    return false
  }
  getTeleportTarget(pos, pl) {
    // 给定一个坐标，返回传送至的坐标，如不在任何传送门内，则返回null
    let res = null
    let src = ParsePos(pos)
    Object.values(this.content.portals).some((portal) => {
      if (portal.posMin.dimid !== src.dimid) return false // 不在同维度直接跳过
      if (!this.content.targets[portal.name]) return false // 没有关联目标，跳过

      if (
        portal.posMin.x < src.x &&
        portal.posMax.x > src.x &&
        portal.posMin.y < src.y &&
        portal.posMax.y > src.y &&
        portal.posMin.z < src.z &&
        portal.posMax.z > src.z
      ) {
        console.log(pl.name, " is in portal ", portal.name)
        res = this.content.targets[portal.name].tpTarget
        return true
      }
    })
    Object.values(this.content.targets).some((portalTarget) => {
      if (portalTarget.posMin.dimid !== src.dimid) return false // 不在同维度直接跳过
      if (
        portalTarget.posMin.x < src.x &&
        portalTarget.posMax.x > src.x &&
        portalTarget.posMin.y < src.y &&
        portalTarget.posMax.y > src.y &&
        portalTarget.posMin.z < src.z &&
        portalTarget.posMax.z > src.z
      ) {
        console.log(pl.name, " is in portal target ", portalTarget.name)
        res = this.content.portals[portalTarget.name].tpTarget
        return true
      }
    })
    if (res) {
      console.log("facing ", pl.direction.toFacing())
      // 根据pl的方向决定传送至tp1还是tp2
      switch (pl.direction.toFacing()) {
        case 2:
        case 1:
          return res.tp1
        case 0:
        case 3:
          return res.tp2
        default:
          return res.tp1
      }
    }
    return null
  }
  doCheck() {
    const players = mc.getOnlinePlayers()
    players.forEach((pl) => {
      if (this.inActionPlayers.has(pl.xuid)) return
      const target = this.getTeleportTarget(pl.pos, pl)
      if (target) {
        this.inActionPlayers.add(pl.xuid)
        setTimeout(() => this.inActionPlayers.delete(pl.xuid), 1000)
        pl.teleport(target.x, target.y, target.z, target.dimid)
      }
    })
    if (!players.length) {
      this.stopCheck()
    }
  }
  checkForTeleport() {
    if (this.checker) return
    console.log("running portal check")
    this.checker = setInterval(() => this.doCheck(), 120)
  }
  stopCheck() {
    if (this.checker) {
      console.log("portal check stopped")
      clearInterval(this.checker)
      this.checker = 0
    }
  }
}

export const Portal = new PortalInfo()