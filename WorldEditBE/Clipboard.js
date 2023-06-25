import { registerPlayerDataHandler, Config } from "./DataStore.js"
import {
  SaveStructure,
  LoadStructure,
  RemoveStructure,
  GetMinPos,
  GetMaxPos,
  ParsePos,
  SetOffset,
  GetOffset,
} from "./functions.js"

class UndoInstance {
  UndoCounter
  undoList
  constructor() {
    this.UndoCounter = 0
    this.undoList = []
  }
  Save(pl, pos1, pos2) {
    let UndoPosMin = GetMinPos(pos1, pos2) //取消操作时的执行坐标
    let UndoPosMax = GetMaxPos(pos1, pos2)
    let UndoName = `${pl.realName}_Undo_${++this.UndoCounter}}`
    let res = SaveStructure(pl, UndoName, UndoPosMin, UndoPosMax)
    if (!res.success) {
      return res
    }
    // retrieve old undo list for current player and append new undo instance to it.
    if (this.undoList.length >= Config.MaxUndo) {
      this.undoList.splice(0, 1)
    }
    this.undoList.push({
      posMin: UndoPosMin,
      posMax: UndoPosMax,
      name: UndoName,
    })
  }
  pop() {
    // if there is any undo instances available, pop the last one and return it
    if (this.undoList.length > 0) {
      const record = this.undoList.pop()
      return {
        ...record,
        undo(pl) {
          this.undo(pl, record, false)
        },
        discard(pl) {
          RemoveStructure(pl, record.name)
        },
      }
    }
    return null
  }
  /**
   * 加载
   */
  undo(pl, record, discard = true) {
    let undo = record || this.pop()
    if (!undo) {
      return { success: false, output: "没有可撤销的操作" }
    }
    let ret = LoadStructure(pl, undo.name, undo.posMin, 0, 0)
    if (discard) {
      RemoveStructure(pl, undo.name)
    }
    return ret
  }
  count() {
    return this.undoList.length
  }
}

class CopyInstance {
  copyName
  origin
  pos1
  pos2
  Save(pl, pos1, pos2) {
    let CopyName = `${pl.realName}_Copy`
    let playerPos = ParsePos(pl.pos)
    let targetVertices = {
      p1: GetMinPos(pos1, pos2),
      p2: GetMaxPos(pos1, pos2),
    }
    let res = SaveStructure(pl, CopyName, targetVertices.p1, targetVertices.p2)
    if (!res.success) {
      return res
    }
    // 复制成功，记录复制时的坐标和玩家的位置以及structure的名称
    this.pos1 = targetVertices.p1
    this.pos2 = targetVertices.p2
    this.origin = playerPos
    this.copyName = CopyName
    return res
  }
  empty() {
    return !this.copyName
  }
  clear(pl) {
    if (this.copyName) {
      RemoveStructure(pl, this.copyName)
    }
    this.copyName = undefined
    this.pos1 = undefined
    this.pos2 = undefined
    this.origin = undefined
  }
  /**
   * @param mirror  镜像 0: 不镜像 1: X轴 2: Z轴 3: XZ轴
   * @param rotation 旋转 0: 不旋转 1: 旋转90° 2: 旋转180° 3: 旋转270°
   */
  paste(pl, pos, mirror = 0, rotation = 0) {
    let posByOffset = SetOffset(pos, GetOffset(this.origin, this.pos1)) // 根据复制时的坐标反推粘贴时的坐标
    return LoadStructure(pl, this.copyName, posByOffset, mirror, rotation)
  }
  doStack(pos, direction, count, spacing, callback) {
    const targetPos = this.getTargetPos(pos)
    const min = GetMinPos(targetPos.p1, targetPos.p2)
    const max = GetMaxPos(targetPos.p1, targetPos.p2)
    const dimension = {
      x: Math.abs(min.x - max.x) + 1,
      y: Math.abs(min.y - max.y) + 1,
      z: Math.abs(min.z - max.z) + 1,
    }
    let flag = true

    for (let i = 0; i < count; ++i) {
      const endPoint = {
        x: min.x + dimension.x,
        y: min.y + dimension.y,
        z: min.z + dimension.z,
        dimid: min.dimid,
      }
      if (!callback(min, endPoint)) {
        flag = false
        break
      }

      switch (direction) {
        case "east":
          min.x += dimension.x + spacing
          break
        case "west":
          min.x -= dimension.x + spacing
          break
        case "north":
          min.z -= dimension.z + spacing
          break
        case "south":
          min.z += dimension.z + spacing
          break
        case "up":
          min.y += dimension.y + spacing
          break
        case "down":
          min.y -= dimension.y + spacing
          break
      }
    }
    return flag
  }
  stack(pl, pos, direction, count, spacing) {
    return this.doStack(pos, direction, count, spacing ?? 0, (minPos, maxPos) => {
      const result = LoadStructure(pl, this.copyName, minPos, 0, 0)
      return result && result.success
    })
  }
  getTargetPos(pos) {
    return {
      p1: SetOffset(pos, GetOffset(this.origin, this.pos1)),
      p2: SetOffset(pos, GetOffset(this.origin, this.pos2)),
    }
  }
  getStackPos(target, direction, count, spacing) {
    let start, stop
    this.doStack(target, direction, count, spacing ?? 0, (minPos, maxPos) => {
      if (!start) {
        start = { ...minPos }
      } else {
        start = GetMinPos(start, minPos)
      }
      if (!stop) {
        stop = { ...maxPos }
      } else {
        stop = GetMaxPos(stop, maxPos)
      }
      return true
    })
    return {
      p1: start,
      p2: stop,
    }
  }
}

function undoHandler() {
  if (!this.get("undo")) {
    this.set("undo", new UndoInstance())
  }
  return this.get("undo")
}

function clipboardHandler() {
  if (!this.get("clipboard")) {
    this.set("clipboard", new CopyInstance())
  }
  return this.get("clipboard")
}

registerPlayerDataHandler("undo", undoHandler)
registerPlayerDataHandler("clipboard", clipboardHandler)
