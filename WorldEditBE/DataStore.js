const ISHandlerMap = {}
let ConfigPath = "./plugins/WorldEditBE/"
const InfoStoreHandler = {
  get: function (target, prop) {
    if (prop in target) {
      return target[prop]
    }
    if (ISHandlerMap[prop]) {
      const result = ISHandlerMap[prop]
      if (typeof result === "function") {
        return (...args) => result.apply(target, args) // is the handler is a function, then bind the target to it
      }
      return result
    }
  },
}

/**
 * 配置文件基础类，可以实现从磁盘读取和保存配置文件的功能
 */
export class ConfigFile {
  /**
   * @type {string}
   */
  fileName
  /**
   * @type {string}
   */
  template
  /**
   * @type {Record<string, any>}
   */
  content
  constructor(filename, defaultContent) {
    this.fileName = `${ConfigPath}${filename}`
    this.template = typeof defaultContent === "string" ? defaultContent : JSON.stringify(defaultContent, null, 2)
    this.parseFile()
  }
  parseFile() {
    if (File.exists(this.fileName)) {
      this.content = JSON.parse(file.readFrom(this.fileName)) || JSON.stringify(this.template)
    } else {
      new JsonConfigFile(this.fileName, this.template)
      this.content = JSON.parse(this.template)
    }
  }
  saveFile() {
    file.writeTo(this.fileName, JSON.stringify(this.content, null, 2))
  }
}

export class PersistentStore extends ConfigFile {
  constructor() {
    super("player.json", {})
  }
  /**
   * 获得对应用户的数据
   * @param {string} xuid
   */
  get(xuid) {
    if (!this.content[xuid]) {
      this.content[xuid] = {}
    }
    return this.content[xuid]
  }
}

// 保存到磁盘的用户信息
export const PlayerSavedData = new PersistentStore()

class SysConfig extends ConfigFile {
  constructor() {
    super("config.json", {
      Wand: "minecraft:wooden_axe",
      UseLLSEApi: true,
      MaxUndo: 10,
      UseLLParticle: false,
      PermSystem: {
        Enable: false,
        Perm: "Wooden_axe:CanUse",
      },
    })
  }
}

export class InfoStore extends Map {
  xuid
  prefData
  /**
   * player对应的数据管理类，部分数据在内存中，部分持久化到配置文件
   * @param {string} id
   */
  constructor(id) {
    super()
    this.xuid = id
    this.savedData = PlayerSavedData.get(id)
  }
  /** 释放该玩家对应的所有需要管理的资源 */
  destroy() {
    const self = this
    // call destructors
    Object.keys(ISHandlerMap).forEach((name) => {
      if (name.endsWith(":destructor")) {
        ISHandlerMap[name].apply(self)
      }
    })
  }
}

export class PlayerStorage {
  /**
   * @type {Map<string, InfoStore>}
   */
  store
  constructor() {
    this.store = new Map()
  }
  getId(pl) {
    if (typeof pl !== "string") {
      pl = pl.xuid
    }
    return pl
  }
  /**
   * @param {Player} pl
   * @param {string} pl
   * @returns {InfoStore}
   */
  get(pl) {
    const id = this.getId(pl)
    let s = this.store.get(id)
    if (!s) {
      s = new Proxy(new InfoStore(id), InfoStoreHandler)
      this.store.set(id, s)
    }
    return s
  }
  delete(pl) {
    const id = this.getId(pl)
    if (this.store.has(id)) {
      const s = this.store.get(id)
      s.destroy()
      this.store.delete(id)
    }
  }
}

// 内存用户信息
export const PlayerStore = new PlayerStorage()

// 全局配置文件
export const Config = new Proxy(new SysConfig(), {
  get: function (target, prop) {
    if (prop in target) {
      return target[prop]
    }
    const value = target.content[prop]
    if (value === undefined) {
      logger.error(`Config: ${prop} is not defined!`)
    }
    return value
  },
})

export function registerPlayerDataHandler(name, handler, destructor) {
  ISHandlerMap[name] = handler
  destructor && (ISHandlerMap[name + ":destructor"] = destructor)
}

export function unregisterDataHandler(name) {
  delete ISHandlerMap[name]
}
