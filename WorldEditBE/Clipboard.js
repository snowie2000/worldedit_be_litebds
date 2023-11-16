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
  ParseIntPos,
} from "./functions.js"

class UndoInstance {
  UndoCounter
  undoList
  player
  constructor(pl) {
    this.UndoCounter = 0
    this.undoList = []
    this.redoList = []
    this.player = pl
  }
  Save(pos1, pos2, preserveRedo = false) {
    let UndoPosMin = GetMinPos(pos1, pos2) //取消操作时的执行坐标
    let UndoPosMax = GetMaxPos(pos1, pos2)
    let UndoName = `${this.player.realName}_Undo_${++this.UndoCounter}}`
    let res = SaveStructure(this.player, UndoName, UndoPosMin, UndoPosMax)
    if (!res.success) {
      return res
    }
    // retrieve old undo list for current player and append new undo instance to it.
    if (this.undoList.length >= Config.MaxUndo) {
      RemoveStructure(this.player, this.undoList.splice(0, 1)[0].name)
    }
    this.undoList.push({
      posMin: UndoPosMin,
      posMax: UndoPosMax,
      name: UndoName,
    })
    if (!preserveRedo) {
      // 添加新的undo记录时将清空redo
      this.redoList.forEach((item) => {
        RemoveStructure(this.player, item.name)
      })
      this.redoList = []
    }
    return {
      success: true,
      output: "Saved",
    }
  }
  _saveRecordToRedo(record) {
    if (this.redoList.length >= Config.MaxUndo) {
      RemoveStructure(this.player, this.redoList.splice(0, 1)[0].name)
    }
    let RedoName = `Redo_${record.name}`
    let res = SaveStructure(this.player, RedoName, record.posMin, record.posMax)
    if (!res.success) {
      return res
    }
    this.redoList.push({
      ...record,
      name: RedoName,
    })
    return {
      success: true,
      output: "Saved as redo",
    }
  }
  pop() {
    // if there is any undo instances available, pop the last one and return it
    if (this.undoList.length > 0) {
      const record = this.undoList.pop()
      const inst = this
      return {
        ...record,
        undo() {
          return inst.undo(record)
        },
        discard() {
          RemoveStructure(inst.player, record.name)
        },
      }
    }
    return null
  }
  /**
   * 加载
   */
  undo(record) {
    let undo = record || this.pop()
    if (!undo) {
      return { success: false, output: "没有可撤销的操作" }
    }
    // 将undo区块保存为redo信息
    this._saveRecordToRedo(undo)
    let ret = LoadStructure(this.player, undo.name, undo.posMin, 0, 0)
    RemoveStructure(this.player, undo.name)
    return {
      ...ret,
      record: undo,
    }
  }
  redo() {
    let redo = this.redoList.pop()
    if (!redo) {
      return { success: false, output: "没有可恢复的操作" }
    }
    // 在redo时将信息保存为新的undo记录，并保留更多redo记录
    this.Save(redo.posMin, redo.posMax, true)
    let ret = LoadStructure(this.player, redo.name, redo.posMin, 0, 0)
    // redo完成后丢弃structure
    RemoveStructure(this.player, redo.name)
    return {
      ...ret,
      record: redo,
    }
  }
  count() {
    return this.undoList.length
  }
  redoCount() {
    return this.redoList.length
  }
}

class CopyInstance {
  copyName
  origin
  pos1
  pos2
  player
  constructor(pl) {
    this.player = pl
  }
  Save(origin, pos1, pos2, structName = undefined) {
    let CopyName = structName || `${this.player.realName}_Copy`
    let playerPos = ParseIntPos(origin)
    let targetVertices = {
      p1: GetMinPos(pos1, pos2),
      p2: GetMaxPos(pos1, pos2),
    }
    let res = SaveStructure(this.player, CopyName, targetVertices.p1, targetVertices.p2)
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
  clear() {
    if (this.copyName) {
      RemoveStructure(this.player, this.copyName)
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
  paste(pos, mirror = 0, rotation = 0) {
    let posByOffset = SetOffset(pos, GetOffset(this.origin, this.pos1)) // 根据复制时的坐标反推粘贴时的坐标
    return LoadStructure(this.player, this.copyName, posByOffset, mirror, rotation)
  }
  getTargetPos(pos) {
    return {
      p1: SetOffset(pos, GetOffset(this.origin, this.pos1)),
      p2: SetOffset(pos, GetOffset(this.origin, this.pos2)),
    }
  }
}


class StackInstance {
  copyName
  origin
  pos1
  pos2
  player
  constructor(pl) {
    this.player = pl
  }
  Save(origin, pos1, pos2, structName = undefined) {
    let CopyName = structName || `${this.player.realName}_Stack`
    let playerPos = ParseIntPos(origin)
    let targetVertices = {
      p1: GetMinPos(pos1, pos2),
      p2: GetMaxPos(pos1, pos2),
    }
    let res = SaveStructure(this.player, CopyName, targetVertices.p1, targetVertices.p2)
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
  getTargetPos(pos) {
    return {
      p1: SetOffset(pos, GetOffset(this.origin, this.pos1)),
      p2: SetOffset(pos, GetOffset(this.origin, this.pos2)),
    }
  }
  empty() {
    return !this.copyName
  }
  clear() {
    if (this.copyName) {
      RemoveStructure(this.player, this.copyName)
    }
    this.copyName = undefined
    this.pos1 = undefined
    this.pos2 = undefined
    this.origin = undefined
  }
  doStack(pos, direction, count, spacing, callback) {
    const targetPos = this.getTargetPos(ParseIntPos(pos))
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
  stack(pos, direction, count, spacing) {
    return this.doStack(pos, direction, count, spacing ?? 0, (minPos, maxPos) => {
      const result = LoadStructure(this.player, this.copyName, minPos, 0, 0)
      return result && result.success
    })
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
    this.set("undo", new UndoInstance(this.player))
  }
  return this.get("undo")
}

function clipboardHandler() {
  if (!this.get("clipboard")) {
    this.set("clipboard", new CopyInstance(this.player))
  }
  return this.get("clipboard")
}

function stackHandler() {
  if (!this.get("stack")) {
    this.set("stack", new StackInstance(this.player))
  }
  return this.get("stack")
}

registerPlayerDataHandler("undo", undoHandler)
registerPlayerDataHandler("clipboard", clipboardHandler)
registerPlayerDataHandler("stack", stackHandler)