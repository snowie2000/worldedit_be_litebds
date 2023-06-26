import { registerPlayerDataHandler, PlayerStore } from "./DataStore.js"
import { GetMaxPos, GetMinPos, ParsePos, MakePos, console, ParseIntPos } from "./functions.js"

export class PosSelector {
  pos1
  pos2
  xuid
  mode
  constructor(pos1, pos2, xuid) {
    this.pos1 = pos1
    this.pos2 = pos2
    this.xuid = xuid
    this.mode = "normal"
  }
  mode() {
    return this.mode
  }
  setMode(mode) {
    this.mode = mode
  }
  setP1(pos) {
    this.pos1 = pos
    if (this.mode === "extend") {
      this.pos2 = undefined
    }
    this.showGrid()
  }
  setP2(pos) {
    if (this.mode === "extend") {
      this.expand(pos)
    } else {
      this.pos2 = pos
    }
    this.showGrid()
  }
  isValid() {
    return this.pos1 && this.pos2
  }
  clear() {
    this.pos1 = undefined
    this.pos2 = undefined
    PlayerStore.get(this.xuid).painter("selection").clear()
  }
  expand(pos) {
    if (this.pos1 == undefined) {
      return
    }

    if (this.pos2 == undefined) {
      this.pos2 = pos
    } else {
      let min = GetMinPos(this.pos1, this.pos2, pos)
      let max = GetMaxPos(this.pos1, this.pos2, pos)
      this.pos1 = min
      this.pos2 = max
    }
  }
  /** 刷新visualizer的显示 */
  refresh() {
    const lineColor = PlayerStore.get(this.xuid).lineColor()
    PlayerStore.get(this.xuid).painter("selection", lineColor, "minecraft:balloon_gas_particle", 1000, true)
    this.showGrid()
  }
  showGrid() {
    const lineColor = PlayerStore.get(this.xuid).lineColor()
    let visualizer = PlayerStore.get(this.xuid).painter("selection", lineColor, "minecraft:balloon_gas_particle")
    visualizer.clear()
    if (this.pos1 && this.pos2) {
      const small = GetMinPos(this.pos1, this.pos2)
      const big = GetMaxPos(this.pos1, this.pos2)
      visualizer.drawCube(MakePos(small, this.pos1.dimid), MakePos([big.x + 1, big.y + 1, big.z + 1], big.dimid))
    }
  }
}

// Player data handler
function selectionHandler() {
  if (!this.get("selection")) {
    this.set("selection", new PosSelector(undefined, undefined, this.xuid))
  }
  return this.get("selection")
}

function freeSelection() {
  const selection = this.get("selection")
  if (selection) {
    selection.clear()
  }
}

registerPlayerDataHandler("selection", selectionHandler, freeSelection)
