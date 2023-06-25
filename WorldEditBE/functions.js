import { Config } from "./DataStore.js"

export const console = {
  log: logger.info,
  error: logger.error,
}

// 将IntPos/FloatPos转换成js对象
export function ParsePos(pos) {
  // Timya格式，使用数组表示
  if (Array.isArray(pos)) {
    return {
      x: pos[0],
      y: pos[1],
      z: pos[2],
      dimid: pos[3] || 0,
    }
  }
  // LiteBDS标准格式
  return {
    x: pos.x,
    y: pos.y,
    z: pos.z,
    dimid: pos.dimid,
  }
}
export function MakePos(...args) {
  if (args.length > 3) {
    return new FloatPos(...args)
  }
  const pos = args[0]
  if (Array.isArray(pos)) {
    return new FloatPos(pos[0], pos[1], pos[2], pos[3] || 0)
  }
  return new FloatPos(pos.x, pos.y, pos.z, pos.dimid)
}

export function MakeIntPos(...args) {
  if (args.length > 3) {
    return new IntPos(...args)
  }
  const pos = args[0]
  if (Array.isArray(pos)) {
    return new IntPos(pos[0], pos[1], pos[2], pos[3] || 0)
  }
  return new IntPos(pos.x, pos.y, pos.z, pos.dimid)
}

export function GetMinPos(...args) {
  if (!args.length) {
    return null
  }
  let min = { ...args[0] }
  for (let i = 1; i < args.length; i++) {
    min.x = Math.min(min.x, args[i].x)
    min.y = Math.min(min.y, args[i].y)
    min.z = Math.min(min.z, args[i].z)
  }
  return min
}
export function GetMaxPos(...args) {
  if (!args.length) {
    return null
  }
  let max = { ...args[0] }
  for (let i = 1; i < args.length; i++) {
    max.x = Math.max(max.x, args[i].x)
    max.y = Math.max(max.y, args[i].y)
    max.z = Math.max(max.z, args[i].z)
  }
  return max
}

export function CanStandOn(bl) {
  if (!bl) {
    return false
  }
  if (bl.isAir) {
    return false
  }
  if (bl.translucency) {
    const name = bl.name
    const solidNames = ["leaves", "glass", "lantern", "stone", "ice", "beacon"]
    return solidNames.some((n) => name.includes(n))
  }
  return true
}

const NbtMap = new Map()

/**
 * 保存结构
 */
export function SaveStructure(pl, name, pos1, pos2, type = "memory") {
  if (Config.UseLLSEApi) {
    let nbt = mc.getStructure(MakeIntPos(pos1), MakeIntPos(pos2))
    if (!nbt) {
      return { success: false, output: "Function mc.getStructure execute failed!" }
    }
    nbt.setTag("structure_world_origin", new NbtList([new NbtInt(0), new NbtInt(0), new NbtInt(0)]))
    // logger.info(nbt.toSNBT(2));
    NbtMap.set(name, nbt)
    return {
      success: true,
      output: "Save success!",
    }
  }
  return mc.runcmdEx(
    `execute as "${pl.name}" run structure save "${name}" ${pos1.x} ${pos1.y} ${pos1.z} ${pos2.x} ${pos2.y} ${pos2.z} ${type}`
  )
}
/**
 * @param pl
 * @param name
 * @param pos1
 * @param mirror 镜像 0: 不镜像 1: X轴 2: Z轴 3: XZ轴
 * @param rotation 旋转 0: 不旋转 1: 旋转90° 2: 旋转180° 3: 旋转270°
 */
export function LoadStructure(pl, name, pos1, mirror = 0, rotation = 0) {
  if (Config.UseLLSEApi) {
    let nbt = NbtMap.get(name)
    if (!nbt) {
      return { success: false, output: "Not find structure nbt!" }
    }
    let r = mc.setStructure(nbt, MakeIntPos(pos1), mirror, rotation)
    if (!r) {
      return { success: false, output: "Function mc.setStructure execute failed!" }
    }
    return {
      success: true,
      output: "Load success!",
    }
  }
  let r = rotation == 1 ? 90 : rotation == 2 ? 180 : rotation == 3 ? 270 : 0
  let m = mirror == 1 ? "x" : mirror == 2 ? "z" : mirror == 3 ? "xy" : "none"
  return mc.runcmdEx(
    `execute as "${pl.name}" run structure load "${name}" ${pos1.x} ${pos1.y} ${pos1.z} ${r}_degrees ${m}`
  )
}

/**
 * @param pl
 * @param name
 */
export function RemoveStructure(pl, name) {
  if (Config.UseLLSEApi) {
    let nbt = NbtMap.get(name)
    if (nbt) {
      NbtMap.delete(name)
    }
    return {
      success: true,
      output: "Remove success!",
    }
  }
  return mc.runcmdEx(`execute as "${pl.name}" run structure delete "${name}"`)
}

export function GetOffset(pos1, pos2) {
  return {
    ...pos1,
    x: pos2.x - pos1.x,
    y: pos2.y - pos1.y,
    z: pos2.z - pos1.z,
  }
}

export function SetOffset(pos, offset) {
  return {
    ...pos,
    x: pos.x + offset.x,
    y: pos.y + offset.y,
    z: pos.z + offset.z,
  }
}

// bds引擎没有clearTimeout支持，需要使用clearInterval模拟
function fakeSetTimeout(fn, delay) {
  let id = setInterval(() => {
    clearInterval(id)
    fn()
  }, delay)
  return id
}

function fakeClearTimeout(id) {
  clearInterval(id)
}

export function debounce(fn, delay, immediate) {
  let timer = null
  return function (...args) {
    if (timer) {
      fakeClearTimeout(timer)
    }
    // 若没有timer，空闲状态，则立即执行任务，并创建一个timer延迟下一次任务
    if (!timer && immediate) {
      timer = fakeSetTimeout(() => {
        timer = null
      }, delay)
      fn.apply(this, args)
    } else {
      // 否则将任务推迟到delay后执行
      timer = fakeSetTimeout(() => {
        fn.apply(this, args)
        timer = null
      }, delay)
    }
  }
}

export function ColorMsg(msg, level) {
  let color = "§c"
  switch (level) {
    case 0:
      color = "§b"
      break
    case 1:
      color = "§a"
      break
    case 2:
      color = "§e"
      break
  }
  return `§l§d[WorldEditBE] ${color}${msg}`
}

export function RefreshChunkForAffectedPlayers(pos1, pos2) {
  const min = SetOffset(GetMinPos(pos1, pos2), {
    x: -100,
    y: -100,
    z: -100,
  })
  const max = SetOffset(GetMaxPos(pos1, pos2), {
    x: 100,
    y: 100,
    z: 100,
  })

  const isAffected = (pos) => {
    if (pos.dimid !== min.dimid) {
      return false
    }
    return pos.x >= min.x && pos.x <= max.x && pos.y >= min.y && pos.y <= max.y && pos.z >= min.z && pos.z <= max.z
  }

  setTimeout(() => {
    mc.getOnlinePlayers().forEach((pl) => {
      let pos = ParsePos(pl.pos)
      if (isAffected(pos1, pos2, pos)) {
        pl.refreshChunks()
      }
    })
  }, 50)
}

export function GetItemBlockStatesToJson(it) {
  let json = {}
  let nbt = it.getNbt().getTag("Block")
  let states = nbt.getTag("states")
  if (states == null) {
    return json
  }
  let keys = states.getKeys()
  keys.forEach((v) => {
    let t = states.getTypeOf(v)
    if (t == 1) {
      //Byte/Bool
      json[v] = Boolean(states.getData(v))
    } else if (t == 8) {
      //String
      json[v] = states.getData(v)
    } else if (t == 3) {
      //int
      json[v] = states.getData(v)
    }
  })
  return json
}

export function FillStructure(pl, pos1, pos2, type, states) {
  let PosMin = GetMinPos(pos1, pos2)
  let PosMax = GetMaxPos(pos1, pos2)
  let size = {
    x: PosMax.x - PosMin.x + 1,
    y: PosMax.y - PosMin.y + 1,
    z: PosMax.z - PosMin.z + 1,
  }
  let BlockSize = size.x * size.y * size.z
  if (Config.UseLLSEApi) {
    let blockNbt = GetBlockNbt(pl, type, states)
    if (blockNbt == null) {
      return -1
    }
    let buildNbtList_Int = (args) => {
      let nbt = new NbtList()
      let l = args.length,
        i = 0
      while (i < l) {
        nbt.addTag(new NbtInt(args[i]))
        i++
      }
      return nbt
    }
    let nbt = new NbtCompound({
      format_version: new NbtInt(1),
      size: buildNbtList_Int([size.x, size.y, size.z]),
      structure: new NbtCompound({
        block_indices: new NbtList([
          buildNbtList_Int(new Array(BlockSize).fill(0)),
          buildNbtList_Int(new Array(BlockSize).fill(-1)),
        ]),
        entities: new NbtCompound({}),
        palette: new NbtCompound({
          default: new NbtCompound({
            block_palette: new NbtList([blockNbt]),
            block_position_data: new NbtCompound({}),
          }),
        }),
      }),
      structure_world_origin: buildNbtList_Int([0, 0, 0]),
    })
    return +mc.setStructure(nbt, MakeIntPos(PosMin), 0, 0)
  }

  // 使用mc原生指令设置
  OutputSwitch = false
  // type = type.split(":")[1];
  let state = "["
  Object.keys(states).forEach((k) => {
    let v = states[k]
    if (state != "[") {
      state += ","
    }
    switch (typeof v) {
      case "boolean":
      case "number": {
        state += `"${k}":${v}`
        break
      }
      case "string": {
        state += `"${k}":"${v}"`
        break
      }
    }
  })
  state += "]"
  if (BlockSize < 32769) {
    return +mc.runcmd(
      `execute as "${pl.name}" run fill ${PosMin.x} ${PosMin.y} ${PosMin.z} ${PosMax.x} ${PosMax.y} ${PosMax.z} ${type} ${state}`
    )
  }
  let y = PosMin.y
  let MaxY = size.y - 1 + y
  do {
    let NowSize = size.x * size.z
    if (NowSize < 32769) {
      mc.runcmd(
        `execute as "${pl.name}" run fill ${PosMin.x} ${y} ${PosMax.z} ${PosMax.x} ${y} ${PosMin.z} ${type} ${state}`
      )
    } else {
      let x = PosMin.x
      let MaxX = size.x - 1 + x
      do {
        mc.runcmd(
          `execute as "${pl.name}" run fill ${x} ${y} ${PosMax.z} ${PosMax.x} ${y} ${PosMin.z} ${type} ${state}`
        )
      } while (x != MaxX)
    }
    y += 1
  } while (y != MaxY)
  OutputSwitch = true
  return 1
}
