const PlayerCache = new Map()
let playerCounter = 0
const clearTimeout = clearInterval
const MAX_BOSSBAR_NUM = 4
const mobAttackerMap = new Map()

class HPBarController {
  mobMap
  userId
  counter
  xuid
  constructor(pl) {
    this.mobMap = new Map()
    this.counter = 0
    this.xuid = pl.xuid
    this.userId = ++playerCounter * 1000000
  }
  cleanOldMob(pl) {
    logger.info("cleaning")
    const mobs = Array.from(this.mobMap.values()).sort((a, b) => a.expire - b.expire)
    while (mobs.length >= MAX_BOSSBAR_NUM) {
      const mob = mobs.shift()
      logger.info(mob)
      pl.removeBossBar(mob.id)
      this.mobMap.delete(mob.mobId)
    }
    logger.info("good")
  }
  doRemoveMob(pl, barInfo) {
    // 删除血条显示
    pl.removeBossBar(barInfo.id)
    this.mobMap.delete(barInfo.mobId)
    // 将自己从攻击者列表中移除
    const attackerList = mobAttackerMap.get(barInfo.mobId)
    if (attackerList) {
      const index = attackerList.indexOf(this.xuid)
      if (index >= 0) {
        attackerList.splice(index, 1)
      }
    }
  }
  removeMobHP(mobId) {
    const barInfo = this.mobMap.get(mobId)
    if (barInfo) {
      const pl = mc.getPlayer(this.xuid)
      if (pl) this.doRemoveMob(pl, barInfo)
    }
  }
  updateMobHP(mob, dmg) {
    const mobId = mob.uniqueId
    const barInfo = this.mobMap.get(mobId)
    if (barInfo) {
      const pl = mc.getPlayer(this.xuid)
      if (pl) {
        if (mob.health <= 0) {
          this.doRemoveMob(pl, barInfo)
        } else {
          pl.setBossBar(barInfo.id, mob.name, Math.floor(((mob.health - dmg) / mob.maxHealth) * 100), 2)
        }
      }
    }
  }
  showMobHP(pl, mob, dmg) {
    const mobId = mob.uniqueId
    let barInfo
    if (this.mobMap.has(mobId)) {
      barInfo = this.mobMap.get(mobId)
      barInfo.expire = 10
    } else {
      // 血条数量太多了，清理
      if (this.mobMap.size >= MAX_BOSSBAR_NUM) {
        this.cleanOldMob(pl)
      }
      // 添加一个新的boss血条
      barInfo = {
        id: this.userId + ++this.counter,
        mobId,
        expire: 10,
      }
      this.mobMap.set(mobId, barInfo)
      mobAttackerMap.set(mobId, (mobAttackerMap.get(mobId) || []).concat(pl.xuid)) // 将自己添加到mob的攻击者列表中
      pl.setBossBar(barInfo.id, mob.name, Math.floor(((mob.health - dmg) / mob.maxHealth) * 100), 2)
    }
  }
  clear(pl) {
    this.mobMap.forEach((bar) => {
      this.doRemoveMob(pl, bar)
    })
    this.mobMap = new Map()
  }
}

let cleaner = null
function GlobalMobCleaner() {
  PlayerCache.forEach((controller) => {
    controller.mobMap.forEach((bar, mobId) => {
      if (--bar.expire <= 0) {
        controller.removeMobHP(mobId)
      }
    })
  })
  if (mc.getOnlinePlayers().length <= 0) {
    clearInterval(cleaner)
    cleaner = null
  }
}

function onLeft(pl) {
  const cache = PlayerCache.get(pl.xuid)
  if (cache) {
    PlayerCache.delete(pl.xuid)
    cache.clear(pl)
  }
}

function onChangeDim(pl) {
  const cache = PlayerCache.get(pl.xuid)
  if (cache) {
    cache.clear(pl)
  }
}

function onPlayerJoin(pl) {
  PlayerCache.set(pl.xuid, new HPBarController(pl))

  if (!cleaner) {
    cleaner = setInterval(() => GlobalMobCleaner(), 1000)
  }
}

function onAttackEntity(pl, entity, damage) {
  const controller = PlayerCache.get(pl.xuid)
  if (controller) {
    controller.showMobHP(pl, entity, damage)
    // logger.info(`${entity.name}的血量为${entity.health}`)
  }
}

function onMobHurt(mob, source, damage, cause) {
  const mobId = mob.uniqueId
  const attackerList = mobAttackerMap.get(mobId)
  if (attackerList) {
    attackerList.forEach((xuid) => {
      const controller = PlayerCache.get(xuid)
      if (controller) {
        controller.updateMobHP(mob, damage)
      }
    })
  }
}

function onMobDie(mob) {
  const mobId = mob.uniqueId
  const attackerList = mobAttackerMap.get(mobId)
  if (attackerList) {
    attackerList.forEach((xuid) => {
      const controller = PlayerCache.get(xuid)
      if (controller) {
        controller.removeMobHP(mobId)
      }
    })
    mobAttackerMap.delete(mobId)
  }
}

function main() {
  ll.registerPlugin("BossRPG.js", "RPG Mod for LiteLoaderBDS", [1, 0, 0], {
    Author: "SublimeIce",
  })
  logger.setTitle("BossRPG")

  mc.listen("onChangeDim", onChangeDim)
  mc.listen("onMobHurt", onMobHurt)
  mc.listen("onMobDie", onMobDie)
  mc.listen("onLeft", onLeft)
  mc.listen("onJoin", onPlayerJoin)
  mc.listen("onEntityExplode", onMobDie)
  mc.listen("onAttackEntity", onAttackEntity)
  logger.warn("RPG Mod for LiteLoaderBDS 已加载，版本1.0.0")
}
main()
