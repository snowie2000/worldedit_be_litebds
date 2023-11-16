// LiteLoader-AIDS automatic generated
/// <reference path="./dts/HelperLib-master/src/index.d.ts"/> 

import { Config, PlayerStore } from "./plugins/WorldEditBE/DataStore.js"
import {
  ParseIntPos,
  debounce,
  ColorMsg,
  console,
  FillStructure,
  SetOffset,
  MakePos,
  GetItemBlockStatesToJson,
  RefreshChunkForAffectedPlayers,
} from "./plugins/WorldEditBE/functions.js"
import { Confirm } from "./plugins/WorldEditBE/Dialog.js"
import { ParticlePainter } from "./plugins/WorldEditBE/Particle.js"
import { Portal } from "./plugins/WorldEditBE/Portal.js"
import { BDSCommand } from "./plugins/WorldEditBE/Command.js"
import "./plugins/WorldEditBE/Theme.js"
import "./plugins/WorldEditBE/Clipboard.js"
import "./plugins/WorldEditBE/Selection.js"


const Wand = Config.Wand || "minecraft:wooden_axe"

/**
 * 自动创建权限组数据
 */
function ForcePermData(perm) {
  if (!Permission.permissionExists(perm)) {
    logger.warn("检测到权限组未创建!自动创建...")
    Permission.registerPermission(perm, "WorldEditBE")
    Permission.saveData()
  }
}
function CanUseWoodenAxe(pl) {
  if (Config.PermSystem.Enable) {
    ForcePermData(Config.PermSystem.Perm)
    return Permission.checkPermission(pl.xuid, PSConf.Perm)
  } else {
    return pl.permLevel != 0
  }
}

function SetPos1(pl, pos) {
  PlayerStore.get(pl.xuid).selection().setP1(pos)
  pl.tell(ColorMsg(`pos1 已选定为 ${pos.x}, ${pos.y}, ${pos.z}, ${pl.pos.dim}`, 1))
}

function SetPos2(pl, pos) {
  let sel = PlayerStore.get(pl.xuid).selection()
  if (sel.pos1) {
    sel.setP2(pos)
    pl.tell(ColorMsg(`pos2 已选定为 ${pos.x}, ${pos.y}, ${pos.z}, ${pl.pos.dim}`, 1))
  } else {
    pl.tell(ColorMsg(`请先选择pos1`))
  }
}

function onChangeDim(pl, _dimid) {
  pl.tell(ColorMsg("世界变更，请重新选择选区", 1))
  ClearSelection(pl)
  return true
}

function onLeft(pl) {
  let xuid = pl.xuid
  PlayerStore.delete(xuid)
  return true
}

function onAttackBlock(pl, bl) {
  if (CanUseWoodenAxe(pl) && pl.getHand().type == Wand) {
    SetPos1(pl, ParseIntPos(bl.pos))
    return false
  }
  return true
}

function onDestroyBlock(pl, bl) {
  if (CanUseWoodenAxe(pl) && pl.getHand().type == Wand) {
    return false
  }
  return true
}

const suspendedActions = new Set()

function onUseItemOn(pl, _, bl) {
  const actionKey = pl.xuid + '_useItem';
  if (CanUseWoodenAxe(pl) && pl.getHand().type == Wand && !suspendedActions.has(actionKey)) {
    SetPos2(pl, ParseIntPos(bl.pos))
	if (!suspendedActions.has(actionKey)) {
		suspendedActions.add(actionKey);
		setTimeout(()=>suspendedActions.delete(actionKey), 500);
	}	
    return false
  }
  return true
}

function onConsoleOutput(_str) {
  // logger.info(str);
  return OutputSwitch
}

function ClearSelection(pl) {
  PlayerStore.get(pl.xuid).selection().clear()
  pl.tell(ColorMsg("选区已清除!"))
}

function onPlayerJoin() {
  Portal.checkForTeleport()
}

function onServerStarted() {
  //pos1
  new BDSCommand("pos1", "选择pos1坐标", PermType.Any).then((cmd) => {
    cmd.overload([])
    cmd.setCallback((_cmd, ori, out, _res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (CanUseWoodenAxe(pl)) {
        let pos = pl.pos
        SetPos1(pl, ParseIntPos(pos))
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  //pos2
  new BDSCommand("pos2", "选择pos2坐标", PermType.Any).then((cmd) => {
    cmd.overload([])
    cmd.setCallback((_cmd, ori, out, _res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (CanUseWoodenAxe(pl)) {
        let pos = pl.pos
        pos.y -= 1
        SetPos2(pl, ParseIntPos(pos), (s) => {
          out.success(ColorMsg(s))
        })
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  new BDSCommand("copy", "复制选定坐标内的方块", PermType.Any).then((cmd) => {
    cmd.overload([])
    cmd.setCallback((_cmd, ori, out, _res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (CanUseWoodenAxe(pl)) {
        let sel = PlayerStore.get(pl.xuid).selection()
        if (!sel.isValid()) {
          return out.error(ColorMsg("请先创建选区", 3))
        }
        const copyIns = PlayerStore.get(pl.xuid).clipboard()
        let res = copyIns.Save(pl.pos, sel.pos1, sel.pos2)
        if (res.success) {
          out.success(ColorMsg("复制完成!使用/paste可粘贴建筑", 1))
        } else {
          out.error(ColorMsg(`复制失败! ${res.output}`, 1))
        }
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  new BDSCommand("paste", "粘贴所复制的方块", PermType.Any).then((cmd) => {
    //   cmd.setEnum("MirrorOptEnum", ["none", "x", "z", "xz"])
    //   cmd.setEnum("RotationOptEnum", ["0", "90", "180", "270"])
    //   cmd.optional("MirrorOpt", ParamType.Enum, "MirrorOptEnum", "MirrorOpt", 1)
    //   cmd.mandatory("RotationOpt", ParamType.Int)
    //   cmd.overload(["RotationOpt", "MirrorOpt"])
    cmd.overload([])
    cmd.setCallback((_cmd, ori, out, res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }

      if (CanUseWoodenAxe(pl)) {
        const copyIns = PlayerStore.get(pl.xuid).clipboard()
        if (copyIns.empty()) {
          return out.error(ColorMsg("请先复制结构再粘贴!", 3))
        }
        const undoIns = PlayerStore.get(pl.xuid).undo()

        let pos = pl.pos
        let PlacePos = ParseIntPos(pos)
        let targetPos = copyIns.getTargetPos(PlacePos)
        undoIns.Save(targetPos.p1, targetPos.p2) // 在粘贴前记录粘贴位置上的信息
        const ret = copyIns.paste(PlacePos)
        if (ret.success) {
          out.success(ColorMsg("粘贴成功,可使用 /undo 撤销粘贴操作!", 1))
          RefreshChunkForAffectedPlayers(targetPos.p1, targetPos.p2)
        } else {
          undoIns.discardLast() // 粘贴失败时删除之前记录的粘贴位置上的信息
        }
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  new BDSCommand("stack", "Stack copied structures", PermType.Any).then((cmd) => {
    cmd.mandatory("StackCount", ParamType.Int)
    cmd.setEnum("Direction", ["up", "down", "north", "south", "east", "west"])
    cmd.optional("StackDirection", ParamType.Enum, "Direction", "StackDirection", 1)
    cmd.optional("StatckSpacing", ParamType.Int)
    cmd.overload(["StackCount", "StatckSpacing", "StackDirection"])

    cmd.setCallback((_cmd, ori, out, res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (res.StackCount <= 0) {
        return out.error(ColorMsg("堆叠数量必须大于0!", 3))
      }
      // 计算玩家的朝向
      const DirectionDict = ["south", "west", "north", "east", "up", "down"]
      let plDirection = DirectionDict[pl.direction.toFacing()]
      if (pl.direction.pitch > 60) {
        plDirection = "down"
      }
      if (pl.direction.pitch < -60) {
        plDirection = "up"
      }

      if (CanUseWoodenAxe(pl)) {
        const stackIns = PlayerStore.get(pl.xuid).stack()
        const undoIns = PlayerStore.get(pl.xuid).undo()
        let sel = PlayerStore.get(pl.xuid).selection()
        if (!sel.isValid()) {
          return out.error(ColorMsg("请先创建选区", 3))
        }
        let pos = pl.pos
        const direction = res["StackDirection"] || plDirection // 如果玩家输入了方向，则使用玩家输入的方向，否则使用玩家朝向
        let PlacePos = ParseIntPos(pos)
        let retSave = stackIns.Save(pl.pos, sel.pos1, sel.pos2) // 保存选中部分结构
        if (!retSave.success) {
          return out.error(ColorMsg(`无法保存选中区域! ${res.output}`, 1))
        }
        let targetPos = stackIns.getStackPos(PlacePos, direction, res.StackCount, res.StatckSpacing) // 计算stack后会占用的空间坐标
        const visualizer = PlayerStore.get(pl).painter("target", "V", "minecraft:blue_flame_particle", 1000)
        visualizer.drawCube(MakePos(targetPos.p1), MakePos(targetPos.p2))
        setTimeout(() => {
          visualizer.clear()
        }, 10000)

        undoIns.Save(targetPos.p1, SetOffset(targetPos.p2, { x: -1, y: -1, z: -1 })) // 在stack前记录位置上的信息, targetPos给出的显示范围，总是比block范围大1
        let ret = stackIns.stack(PlacePos, direction, res.StackCount, res.StatckSpacing)
        if (ret) {
          out.success(ColorMsg("堆叠成功,使用 /undo 恢复操作之前!", 1))
          RefreshChunkForAffectedPlayers(targetPos.p1, targetPos.p2)
        } else {
          undoIns.discardLast() // 粘贴失败时删除之前记录的粘贴位置上的信息
        }
        // 堆叠结束后，无论是否成功均需要清除保存的结构
        stackIns.clear()
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  new BDSCommand("sel", "设置选区模式", PermType.Any).then((cmd) => {
    cmd.setEnum("SelOptEnum", ["normal", "extend"])
    cmd.optional("SelOption", ParamType.Enum, "SelOptEnum", "SelOption", 1)
    cmd.overload(["SelOption"])
    cmd.setCallback((_cmd, ori, out, res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (CanUseWoodenAxe(pl)) {
        if (!res.SelOption) {
          // no option = clear selection
          ClearSelection(pl)
        } else {
          PlayerStore.get(pl.xuid).selection().setMode(res.SelOption)
          out.success(ColorMsg(`选择模式已设置为${res.SelOption === "normal" ? "普通模式" : "扩展模式"}`, 1))
        }
      }
    })
  })

  new BDSCommand("set", "设置选定区域的方块", PermType.Any).then((cmd) => {
    cmd.setEnum("HandOptEnum", ["hand"])
    cmd.optional("BlockStateHand", ParamType.Enum, "HandOptEnum", "BlockStateHand", 1)
    cmd.optional("BlockState", ParamType.JsonValue)
    cmd.mandatory("BlockNameHand", ParamType.Enum, "HandOptEnum", "BlockNameHand", 1)
    cmd.mandatory("Block", ParamType.Block)
    cmd.overload(["Block", "BlockStateHand"])
    cmd.overload(["Block", "BlockState"])
    cmd.overload(["BlockNameHand", "BlockStateHand"])
    cmd.overload(["BlockNameHand", "BlockState"])
    cmd.setCallback((_cmd, ori, out, res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (CanUseWoodenAxe(pl)) {
        let sel = PlayerStore.get(pl.xuid).selection()
        if (!sel.isValid()) {
          return out.error(ColorMsg("请先选择一块区域", 3))
        }
        let NameUseHand = !!res["BlockNameHand"]
        let StateUseHand = !!res["BlockStateHand"]
        let hand = pl.getHand()
        if ((NameUseHand || StateUseHand) && !hand.isBlock) {
          return out.error(ColorMsg("所选物品不是一个方块!", 3))
        }
        let type = NameUseHand ? hand.type : res["Block"].type
        let state = StateUseHand
          ? GetItemBlockStatesToJson(hand)
          : JSON.parse(!res["BlockState"] ? "{}" : res["BlockState"])
        if (NameUseHand && !StateUseHand) {
          //防止方块出现奇怪的问题???
          let d = GetItemBlockStatesToJson(hand)
          Object.keys(d).forEach((k) => {
            let v = d[k]
            if (state[k] == null) {
              state[k] = v
            }
          })
        }
        const undoIns = PlayerStore.get(pl.xuid).undo()
        const ret = undoIns.Save(sel.pos1, sel.pos2)
        let sendRes = (a, o) => {
          switch (a) {
            case 0: {
              o("e", "操作失败!原因未知!")
              break
            }
            case 1: {
              o("i", "操作完成,使用/undo可撤销")
              break
            }
            case -1: {
              o("i", "操作失败!原因: 所站位置超出世界范围!")
              break
            }
          }
        }
        if (ret.success) {
          sendRes(FillStructure(pl, sel.pos1, sel.pos2, type, state), (t, m) => {
            if (t == "i") {
              RefreshChunkForAffectedPlayers(sel.pos1, sel.pos2)
              out.success(ColorMsg(m, 1))
            } else {
              out.error(ColorMsg(m, 3))
            }
          })
        } else {
          Confirm(pl, {
            title: "§l§d[WorldEditBE]§4[警告]",
            content: `§l§cundo数据保存失败!§a详情:\n§e${saveRes.output}\n§c继续操作将无法undo!\n请谨慎选择!`,
            okText: "继续",
            cancelText: "放弃",
            onOk() {
              let res = FillStructure(pl, sel.pos1, sel.pos2, type, state)
              sendRes(res, (t, m) => {
                if (t == "i") {
                  RefreshChunkForAffectedPlayers(sel.pos1, sel.pos2)
                }
                ST(pl, t == "e" ? 3 : 1, m)
              })
            },
          })
        }
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  new BDSCommand("undo", "恢复上一次操作", PermType.Any).then((cmd) => {
    cmd.overload([])
    cmd.setCallback((_cmd, ori, out, res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (CanUseWoodenAxe(pl)) {
        const undoIns = PlayerStore.get(pl.xuid).undo()
        if (!undoIns.count()) {
          return out.error(ColorMsg("你还没有undo记录!", 3))
        }
        const ret = undoIns.undo()
        if (ret.success) {
          out.success(ColorMsg("恢复上一次操作成功", 1))
          RefreshChunkForAffectedPlayers(ret.record.posMin, ret.record.posMax)
        } else {
          out.error(ColorMsg(`恢复上一次操作失败,原因: ${ret.output}`, 3))
        }
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  new BDSCommand("redo", "恢复上一次撤销的操作", PermType.Any).then((cmd) => {
    cmd.overload([])
    cmd.setCallback((_cmd, ori, out, res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (CanUseWoodenAxe(pl)) {
        const redoIns = PlayerStore.get(pl.xuid).undo()
        if (!redoIns.redoCount()) {
          return out.error(ColorMsg("没有操作可以恢复", 3))
        }
        const ret = redoIns.redo()
        if (ret.success) {
          out.success(ColorMsg("恢复上一次操作成功", 1))
          RefreshChunkForAffectedPlayers(ret.record.posMin, ret.record.posMax)
        } else {
          out.error(ColorMsg(`恢复上一次操作失败,原因: ${ret.output}`, 3))
        }
      } else {
        out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
    })
  })

  new BDSCommand("color", "Change selection frame color", PermType.Any).then((cmd) => {
    cmd.mandatory("ColorIndex", ParamType.Int)
    cmd.overload(["ColorIndex"])

    cmd.setCallback((_cmd, ori, out, res) => {
      let coloridx = parseInt(res.ColorIndex)
      if (coloridx < 0 || coloridx > 16) {
        return out.error(ColorMsg("只能选择1-16的颜色", 3))
      }
      const pldata = PlayerStore.get(ori.player.xuid)
      if (coloridx === 0) {
        pldata.setLineColor()
      } else {
        pldata.setLineColor(coloridx - 1)
      }
      pldata.selection().refresh()
      out.success("显示颜色已更新")
    })
  })

  new BDSCommand("portal", "Setup a custom portal", PermType.Any).then((cmd) => {
    cmd.optional("PortalName", ParamType.String)
    cmd.setEnum("ActionEnum", ["new", "link", "delete", "list", "unlink", "update", "tp"])
    cmd.setEnum("RemoteActionEnum", ["remote"])
    cmd.mandatory("ServerHost", ParamType.String)
    cmd.optional("ServerPort", ParamType.Int)
    cmd.mandatory("Action", ParamType.Enum, "ActionEnum", "Action", 1)
    cmd.mandatory("RemoteAction", ParamType.Enum, "RemoteActionEnum", "RemoteAction", 1)
    cmd.overload(["Action", "PortalName"])
    cmd.overload(["RemoteAction", "PortalName", "ServerHost", "ServerPort"])

    cmd.setCallback((_cmd, ori, out, res) => {
      let pl = ori.player
      if (pl == null) {
        return out.error(ColorMsg("无法通过非玩家执行此命令!", 3))
      }
      if (!CanUseWoodenAxe(pl)) {
        return out.error(ColorMsg("你没有权限使用此命令!", 3))
      }
      const sel = PlayerStore.get(pl.xuid).selection()

      if (res.PortalName) {
        switch (res.Action) {
          case "new":
            if (!sel.isValid()) {
              return out.error(ColorMsg("请先选择传送门区域", 3))
            }
            // user is defining a new portal
            const pt = Portal.addPortal(res.PortalName, sel.pos1, sel.pos2)
            if (pt) {
              ParticlePainter.ShowIndicator(MakePos(pt.tp1))
              ParticlePainter.ShowIndicator(MakePos(pt.tp2))
              return out.success(ColorMsg(`传送门 ${res.PortalName} 已创建`, 1))
            } else {
              return out.error(ColorMsg(`传送门 ${res.PortalName} 已存在，请选择其他名称`, 3))
            }
            break
          case "update":
            if (!sel.pos1 || !sel.pos2) {
              return out.error(ColorMsg("请先选择传送门区域", 3))
            }
            // user is defining a new portal
            const pt2 = Portal.updatePortal(res.PortalName, sel.pos1, sel.pos2)
            if (pt2) {
              ParticlePainter.ShowIndicator(MakePos(pt2.tp1))
              ParticlePainter.ShowIndicator(MakePos(pt2.tp2))
              return out.success(ColorMsg(`传送门 ${res.PortalName} 已更新`, 1))
            } else {
              return out.error(ColorMsg(`传送门 ${res.PortalName} 不存在，请先创建该传送门`, 3))
            }
            break
          case "link":
            if (!sel.pos1 || !sel.pos2) {
              return out.error(ColorMsg("请先选择传送门区域", 3))
            }
            const linkTarget = Portal.linkPortal(res.PortalName, sel.pos1, sel.pos2)
            if (linkTarget) {
              ParticlePainter.ShowIndicator(MakePos(linkTarget.tp1))
              ParticlePainter.ShowIndicator(MakePos(linkTarget.tp2))
              return out.success(ColorMsg(`已与传送门 ${res.PortalName} 建立连接`, 1))
            } else {
              return out.error(ColorMsg(`传送门 ${res.PortalName} 不存在`, 3))
            }
            break
          case "unlink":
            if (Portal.unlinkPortal(res.PortalName)) {
              return out.success(ColorMsg(`传送门 ${res.PortalName} 已断开连接`, 1))
            } else {
              return out.error(ColorMsg(`传送门 ${res.PortalName} 不存在或没有建立连接`, 3))
            }
            break
          case "delete":
            if (Portal.deletePortal(res.PortalName)) {
              return out.success(ColorMsg(`传送门 ${res.PortalName} 已删除`, 1))
            } else {
              return out.error(ColorMsg(`传送门 ${res.PortalName} 不存在`, 3))
            }
            break
          case "tp":
            const APortal = Portal.getPortal(res.PortalName)
            if (APortal) {
              pl.teleport(MakePos(APortal.tpTarget.tp1))
              const visualizer = new ParticlePainter("minecraft:blue_flame_particle", 1000)
              visualizer.drawCube(MakePos(APortal.posMin), MakePos(APortal.posMax))
              ParticlePainter.ShowIndicator(MakePos(APortal.tpTarget.tp1))
              ParticlePainter.ShowIndicator(MakePos(APortal.tpTarget.tp2))
              setTimeout(() => {
                visualizer.clear()
              }, 10000)
            }
        }
        switch (res.RemoteAction) {
          case "remote":
            res.ServerPort |= 19132
            if (res.ServerPort < 0 || res.ServerPort >= 65565) {
              return out.error(ColorMsg("非法端口，请输入1-65535内的端口号", 3))
            }
            if (Portal.linkServer(res.PortalName, res.ServerHost, res.ServerPort)) {
              return out.success(ColorMsg(`传送门 ${res.PortalName} 已与异度空间建立了连接`, 1))
            } else {
              return out.error(ColorMsg(`传送门 ${res.PortalName} 不存在`, 3))
            }
        }
      } else {
        switch (res.Action) {
          case "list":
            const portals = Portal.listPortal()
            if (portals.length) {
              out.success(ColorMsg(`已创建了 ${portals.length} 个传送门：`, 1))
              portals.forEach((p, i) => {
                out.success(ColorMsg(`${i + 1}. ${p.name} ${p.linked ? "(已关联)" : "(闲置)"}`, p.linked ? 1 : 3))
              })
            } else {
              out.error(ColorMsg(`没有已创建的传送门`, 3))
            }
            break
        }
      }
    })
  })
}
function main() {
  ll.registerPlugin("WorldEditBE.js", "WorldEdit for LiteBDS", [1, 0, 0], {
    Author: "SublimeIce",
  })
  logger.setTitle("WorldEdit_BE")

  mc.listen("onChangeDim", onChangeDim)
  mc.listen("onLeft", onLeft)
  mc.listen("onJoin", onPlayerJoin)
  mc.listen("onAttackBlock", onAttackBlock)
  mc.listen("onDestroyBlock", onDestroyBlock)
  mc.listen("onUseItemOn", onUseItemOn)
  mc.listen("onConsoleOutput", onConsoleOutput)
  mc.listen("onServerStarted", onServerStarted)
  logger.info("WorldEdit for LiteBDS 已加载，版本1.0.0")
}
main()
