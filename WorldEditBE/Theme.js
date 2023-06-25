import { registerPlayerDataHandler, PlayerSavedData, InfoStore } from "./DataStore.js"

export const llLineColors = ["B", "I", "L", "T", "C", "D", "O", "W", "R", "A", "Y", "G", "V", "S", "P", "E"]

function hashString(str) {
  let hash = 0,
    i,
    chr
  if (str.length === 0) return hash
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

/**
 * @this {InfoStore}
 * @returns {string}
 */
function lineColorHandler() {
  if (this.get("color")) {
    return this.get("color")
  }
  if (this.savedData.color) {
    return this.savedData.color // 如果用户设置了自己想要的颜色，则使用配置文件中保存的
  }
  const hash = hashString(this.xuid)
  const color = llLineColors[hash % llLineColors.length]
  this.set("color", color)
  return color
}

/**
 * 设置用户线条颜色，空白则使用默认颜色
 * @param {string|number|undefined} color
 */
function setLineColorHandler(color) {
  if (typeof color === "number") {
    color = llLineColors[color]
  }
  if (color) {
    this.savedData.color = color
    this.set("color", color)
  } else {
    delete this.savedData.color
    this.delete("color")
  }
  PlayerSavedData.saveFile()
}

registerPlayerDataHandler("lineColor", lineColorHandler)
registerPlayerDataHandler("setLineColor", setLineColorHandler)
