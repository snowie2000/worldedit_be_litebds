/**
 * @name WorldEdit_BE
 * @description 基于Wooden_axe的WE简化版
 * @author Timiya
 * @modified snowie2000
 * @note 编写时间2023/04/13
 */
//LiteLoaderScript Dev Helper
// <reference path="c:\Users\Administrator\.vscode\extensions\moxicat.llscripthelper-2.1.5/dts/llaids/src/index.d.ts"/>
let ConfigPath = "./plugins/WorldEditBE/";
let conf = new JsonConfigFile(`${ConfigPath}config.json`, JSON.stringify({
    "SelectItem": "minecraft:wooden_axe",
    "UseLLSEApi": true,
    "MaxUndo": 10,
    "PermSystem": {
        "Enable": false,
        "Perm": "Wooden_axe:CanUse"
    }
}, null, 2));
let SelectItem;
let PSConf;
let UseLLSEApi = false;
let NbtMap = new Map();
let ParticleGenerator = new Map();
let SelectionMode = new Map();
let OutputSwitch = true;
let WorldOrigin = [0, 0, 0] // 世界原点，无偏移坐标

// for compatiblity
let console = {
    log: logger.info,
    error: logger.error
}

// 将IntPos/FloatPos转换成js对象
function ParsePos(pos) {
    // Timya格式，使用数组表示
    if (Array.isArray(pos)) {
        return {
            x: pos[0],
            y: pos[1],
            z: pos[2],
            dimid: pos[3] || 0
        }
    }
    // LiteBDS标准格式
    return {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        dimid: pos.dimid
    }
}
function MakePos(x, y, z, dimid = 0) {
    return new FloatPos(x, y, z, dimid)
}
function MakePosFromObject(pos) {
    return new FloatPos(pos.x, pos.y, pos.z, pos.dimid)
}
function GetMinPos(...args) {
    if (!args.length) {
        return null
    }
    let min = {...args[0]}
    for (let i=1; i<args.length; i++) {
        min.x = Math.min(min.x, args[i].x)
        min.y = Math.min(min.y, args[i].y)
        min.z = Math.min(min.z, args[i].z)
    }
    return min
}
function GetMaxPos(...args) {
    if (!args.length) {
        return null
    }
    let max = {...args[0]}
    for (let i=1; i<args.length; i++) {
        max.x = Math.max(max.x, args[i].x)
        max.y = Math.max(max.y, args[i].y)
        max.z = Math.max(max.z, args[i].z)
    }
    return max
}

class PortalInfo {
    fileName;
    portalInfo;
    jsonTemplate;
    checker;
    inActionPlayers;
    constructor() {
        this.fileName = `${ConfigPath}portal.json`;
        this.jsonTemplate = {portals: {}, targets: {}}
        this.parseFile();
        this.checker = 0
        this.inActionPlayers = new Set()
    }
    parseFile() {
        if (File.exists(this.fileName)) {
            this.portalInfo = JSON.parse(file.readFrom(this.fileName)) || this.jsonTemplate;
        } else {
            new JsonConfigFile(`${ConfigPath}portal.json`, JSON.stringify(this.jsonTemplate, null, 2));
            this.portalInfo = {...this.jsonTemplate}
        }
    }
    saveFile() {
        file.writeTo(this.fileName, JSON.stringify(this.portalInfo, null, 2))
    }
    listPortal() {
        const portals = Object.keys(this.portalInfo.portals)
        const targets = new Set(Object.keys(this.portalInfo.targets))
        return portals.map(p=>({
            name: p,
            linked: targets.has(p)
        }))
    }
    // 根据portal的形状计算可以被传送的目标点
    getPortalTpSpot(p1, p2) {
        function getProperPosVertial(pos, height) {
            for (let i=0; i<height; i++) {
                const block = mc.getBlock(pos.x, pos.y+i, pos.z, pos.dimid)
                if (block.isAir) {
                    return {
                        ...pos,
                        y: pos.y + i
                    }
                }
            }
            return pos
        }

        function getProperPosHorizontal(pos1, pos2) {
            const xCenter = (pos1.x+pos2.x)/2
            const zCenter = (pos1.z+pos2.z)/2
            let xStart = xCenter, xEnd = xCenter, zStart = zCenter, zEnd = zCenter
            if (xCenter !== Math.floor(xCenter)) {  //xCenter 是一个整数
                xStart = Math.floor(xCenter)
                xEnd = xStart + 1
            }
            if (zCenter !== Math.floor(zCenter)) {  //zCenter 是一个整数
                zStart = Math.floor(zCenter)
                zEnd = zStart + 1
            }
            let deltaX=xStart-pos1.x, deltaZ=zStart-pos1.z, flag = true, res = null
            while (flag && !res) {
                const scanlineX1 = pos1.x + deltaX;
                const scanlineX2 = pos2.x - deltaX;
                const scanlineZ1 = pos1.z + deltaZ;
                const scanlineZ2 = pos2.z - deltaZ;
                let block, blockPortal
                // find a block that is air and the block underneath it is solid.
                for (let x=scanlineX1; x<=scanlineX2; x++) {
                    blockPortal = mc.getBlock(x, pos2.y-1, scanlineZ1, pos1.dimid)
                    block = mc.getBlock(x, pos2.y, scanlineZ1, pos1.dimid)
                    if (block.isAir && !blockPortal.isAir) {
                        res = {x, y: pos2.y, z: scanlineZ1, dimid: pos1.dimid}
                        break
                    }
                    blockPortal = mc.getBlock(x, pos2.y-1, scanlineZ2, pos1.dimid)
                    block = mc.getBlock(x, pos2.y, scanlineZ2, pos1.dimid)
                    if (block.isAir && !blockPortal.isAir) {
                        res = {x, y: pos2.y, z: scanlineZ1, dimid: pos1.dimid}
                        break
                    }
                }
                if (!res) {
                    for (let z=scanlineZ1; z<=scanlineZ2; z++) {
                        blockPortal = mc.getBlock(scanlineX1, pos2.y-1, z, pos1.dimid)
                        block = mc.getBlock(scanlineX1, pos2.y, z, pos1.dimid)
                        if (block.isAir && !blockPortal.isAir) {
                            res = {x: scanlineX1, y: pos2.y, z, dimid: pos1.dimid}
                            break
                        }
                        blockPortal = mc.getBlock(scanlineX2, pos2.y-1, z, pos1.dimid)
                        block = mc.getBlock(scanlineX2, pos2.y, z, pos1.dimid)
                        if (block.isAir && !blockPortal.isAir) {
                            res = {x: scanlineX2, y: pos2.y, z, dimid: pos1.dimid}
                            break
                        }
                    }
                }

                // exit loop if both x and z are on their egdes
                flag = false
                if (deltaX>=0) { deltaX--; flag=true}
                if (deltaZ>=0) { deltaZ--; flag=true}
            }
            if (res) {
                console.log("found a valid empty space to teleport")
                return res
            }
            console.log("all blocks are occupied, teleport to the center")
            return {
                x: Math.floor(xCenter),
                y: pos2.y,
                z: Math.floor(zCenter),
                dimid: pos1.dimid
            }
        }

        const depth = p2.z - p1.z + 1
        const width = p2.x - p1.x + 1
        const height = p2.y - p1.y + 1
        let flatPortal = height < width && height < depth   // 这是一个横着的portal
        if (flatPortal) {
            // 横向portal
            const tpPoint = getProperPosHorizontal(p1, p2)
            return {
                tp1: tpPoint,
                tp2: tpPoint
            }
        } else {
            // 竖着的portal
            if (depth > width) {
                return {
                    tp1: getProperPosVertial({
                        x: p1.x-1, 
                        y: p1.y, 
                        z: Math.floor((p1.z + p2.z)/2),
                        dimid: p1.dimid
                    }, p2.y-p1.y),
                    tp2:getProperPosVertial({
                        x: p2.x+1, 
                        y: p1.y, 
                        z: Math.floor((p1.z + p2.z)/2),
                        dimid: p1.dimid
                    }, p2.y-p1.y)
                }
            } else {
                return {
                    tp1: getProperPosVertial({
                        x: Math.floor((p1.x + p2.x) /2), 
                        y: p1.y, 
                        z: p1.z-1,
                        dimid: p1.dimid
                    }, p2.y-p1.y),
                    tp2:getProperPosVertial({
                        x: Math.floor((p1.x + p2.x) /2), 
                        y: p1.y, 
                        z: p2.z+1,
                        dimid: p1.dimid
                    }, p2.y-p1.y)
                }
            }
        }
    }
    addPortal(name, pos1, pos2) {
        if (this.portalInfo.portals[name]) 
            return false
        const newPortal = {
            posMin: GetMinPos(ParsePos(pos1), ParsePos(pos2)),
            posMax: GetMaxPos(ParsePos(pos1), ParsePos(pos2)),
            name,
        }
        newPortal.posMax = {
            x: newPortal.posMax.x+1,
            y: newPortal.posMax.y+1,
            z: newPortal.posMax.z+1,
            dimid: newPortal.posMax.dimid
        }
        newPortal.tpTarget = this.getPortalTpSpot(newPortal.posMin, newPortal.posMax)
        this.portalInfo.portals[name] = newPortal
        this.saveFile()
        return newPortal.tpTarget
    }
    deletePortal(name) {
        if (this.portalInfo.portals[name]) {
            delete(this.portalInfo.portals[name])
            delete(this.portalInfo.targets[name])
            this.saveFile()
            return true
        } else {
            return false;
        }
    }
    unlinkPortal(name) {
        if (this.portalInfo.targets[name]) {
            delete(this.portalInfo.targets[name])
            this.saveFile()
            return true
        } else {
            return false;
        }
    }
    getPortal(name) {
        return this.portalInfo.portals[name]
    }
    linkPortal(name, pos1, pos2) {
        if (this.portalInfo.portals[name]) {
            const newTarget = {
                posMin: GetMinPos(ParsePos(pos1), ParsePos(pos2)),
                posMax: GetMaxPos(ParsePos(pos1), ParsePos(pos2)),
                name,
            }
            newTarget.posMax = {
                x: newTarget.posMax.x+1,
                y: newTarget.posMax.y+1,
                z: newTarget.posMax.z+1,
                dimid: newTarget.posMax.dimid
            }
            newTarget.tpTarget = this.getPortalTpSpot(newTarget.posMin, newTarget.posMax)
            this.portalInfo.targets[name] = newTarget
            this.saveFile()
            logger.error(JSON.stringify(newTarget.tpTarget))
            return newTarget.tpTarget   // 成功则返回传送目标点
        }
        return false
    }
    getTeleportTarget(pos, pl) {    // 给定一个坐标，返回传送至的坐标，如不在任何传送门内，则返回null
        let res = null
        let src = ParsePos(pos)
        Object.values(this.portalInfo.portals).some(portal=>{
            if (portal.posMin.dimid !== src.dimid) return false   // 不在同维度直接跳过
            if (!this.portalInfo.targets[portal.name]) return false // 没有关联目标，跳过

            if (portal.posMin.x <= src.x && portal.posMax.x >= src.x &&
                portal.posMin.y <= src.y && portal.posMax.y > src.y &&
                portal.posMin.z <= src.z && portal.posMax.z >= src.z) {
                    console.log(pl.name," is in portal ",portal.name)
                    res = this.portalInfo.targets[portal.name].tpTarget  
                    return true
                }
        })
        Object.values(this.portalInfo.targets).some(portalTarget=>{
            if (portalTarget.posMin.dimid !== src.dimid) return false   // 不在同维度直接跳过
            if (portalTarget.posMin.x <= src.x && portalTarget.posMax.x >= src.x &&
                portalTarget.posMin.y <= src.y && portalTarget.posMax.y > src.y &&
                portalTarget.posMin.z <= src.z && portalTarget.posMax.z >= src.z) {
                    console.log(pl.name," is in portal target ",portalTarget.name)
                    res = this.portalInfo.portals[portalTarget.name].tpTarget 
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
        players.forEach(pl=>{
            if (this.inActionPlayers.has(pl.xuid)) return;
            const target = this.getTeleportTarget(pl.feetPos, pl);
            if (target) {
                this.inActionPlayers.add(pl.xuid)
                setTimeout(()=>this.inActionPlayers.delete(pl.xuid), 1000)
                pl.teleport(target.x, target.y, target.z, target.dimid)
            }
        })
        if (!players.length) {
            this.stopCheck()
        }
    }
    checkForTeleport() {
        if (this.checker) return;
        console.log("running portal check")
        this.checker = setInterval(()=>this.doCheck(), 120)
    }
    stopCheck() {
        if (this.checker) {
            console.log("portal check stopped")
            clearInterval(this.checker)
            this.checker = 0
        }
    }
}

let Portal = new PortalInfo();


function GetItemBlockStatesToJson(it) {
    let json = {};
    let nbt = it.getNbt().getTag("Block");
    let states = nbt.getTag("states");
    if (states == null) {
        return json;
    }
    let keys = states.getKeys();
    keys.forEach((v) => {
        let t = states.getTypeOf(v);
        if (t == 1) { //Byte/Bool
            json[v] = Boolean(states.getData(v));
        }
        else if (t == 8) { //String
            json[v] = states.getData(v);
        }
        else if (t == 3) { //int
            json[v] = states.getData(v);
        }
    });
    return json;
}

function ReplaceBlockStateNbt(nbt, states) {
    let nowStates = (nbt.getTag("states") || new NbtCompound({}));
    Object.keys(states).forEach((k) => {
        let v = states[k];
        switch (typeof (v)) {
            case "boolean": {
                nowStates.setByte(k, +v);
                break;
            }
            case "number": {
                nowStates.setInt(k, v);
                break;
            }
            case "string": {
                nowStates.setString(k, v);
                break;
            }
        }
    });
    nbt.setTag("states", nowStates);
}
function GetBlockNbt(pl, type, states) {
    let pos = pl.pos;
    let old = mc.getBlock(pos);
    if (old == null) {
        return null;
    }
    let oldNbt = old.getNbt();
    mc.setBlock(pos, type);
    let res = mc.getBlock(pos);
    if (res == null) {
        return null;
    }
    let resNbt = res.getNbt();
    ReplaceBlockStateNbt(resNbt, states);
    mc.setBlock(pos, oldNbt);
    return resNbt;
}
/**
 * @returns 0失败 1成功 -1获取方块信息失败
 */
function BetterFill(pl, pos1, pos2, type, states) {
    let PlacePos = GetMcMinPhase(pos1, pos2);
    let Pos2 = GetMcMaxPhase(pos1, pos2);
    let size = [Pos2[0] - PlacePos[0] + 1, Pos2[1] - PlacePos[1] + 1, Pos2[2] - PlacePos[2] + 1];
    let BlockSize = size[0] * size[1] * size[2];
    if (UseLLSEApi) {
        let blockNbt = GetBlockNbt(pl, type, states);
        if (blockNbt == null) {
            return -1;
        }
        let buildNbtList_Int = (args) => {
            let nbt = new NbtList();
            let l = args.length, i = 0;
            while (i < l) {
                nbt.addTag(new NbtInt(args[i]));
                i++;
            }
            return nbt;
        };
        let nbt = new NbtCompound({
            "format_version": new NbtInt(1),
            "size": buildNbtList_Int(size),
            "structure": new NbtCompound({
                "block_indices": new NbtList([
                    buildNbtList_Int(new Array(BlockSize).fill(0)),
                    buildNbtList_Int(new Array(BlockSize).fill(-1))
                ]),
                "entities": new NbtCompound({}),
                "palette": new NbtCompound({
                    "default": new NbtCompound({
                        "block_palette": new NbtList([
                            blockNbt
                        ]),
                        "block_position_data": new NbtCompound({})
                    })
                })
            }),
            "structure_world_origin": buildNbtList_Int([0, 0, 0])
        });
        return +mc.setStructure(nbt, new IntPos(...PlacePos, pl.pos.dimid), 0, 0);
    }
    OutputSwitch = false;
    // type = type.split(":")[1];
    let state = "[";
    Object.keys(states).forEach((k) => {
        let v = states[k];
        if (state != "[") {
            state += ",";
        }
        switch (typeof (v)) {
            case "boolean":
            case "number": {
                state += `"${k}":${v}`;
                break;
            }
            case "string": {
                state += `"${k}":"${v}"`;
                break;
            }
        }
    });
    state += "]";
    if (BlockSize < 32769) {
        return +mc.runcmd(`execute as "${pl.name}" run fill ${PlacePos.join(" ")} ${Pos2.join(" ")} ${type} ${state}`);
    }
    let y = PlacePos[1];
    let MaxY = (size[1] - 1) + y;
    do {
        let NowSize = size[0] * size[2];
        if (NowSize < 32769) {
            mc.runcmd(`execute as "${pl.name}" run fill ${PlacePos[0]} ${y} ${Pos2[2]} ${Pos2[0]} ${y} ${PlacePos[2]} ${type} ${state}`);
        }
        else {
            let x = PlacePos[0];
            let MaxX = (size[0] - 1) + y;
            do {
                //你是不是真的有病? 还想着要继续?
                // let NowSize = size[0];
                mc.runcmd(`execute as "${pl.name}" run fill ${x} ${y} ${Pos2[2]} ${Pos2[0]} ${y} ${PlacePos[2]} ${type} ${state}`);
            } while (x != MaxX);
        }
        y += 1;
    } while (y != MaxY);
    OutputSwitch = true;
    return 1;
}
/**
 * 保存结构
 */
function SaveStructure(pl, name, pos1, pos2, type = "memory") {
    if (UseLLSEApi) {
        let dimid = pl.pos.dimid;
        let nbt = mc.getStructure(new IntPos(...pos1, dimid), new IntPos(...pos2, dimid));
        if (!nbt) {
            return { "success": false, "output": "Function mc.getStructure execute failed!" };
        }
        nbt.setTag("structure_world_origin", new NbtList([new NbtInt(0), new NbtInt(0), new NbtInt(0)]));
        // logger.info(nbt.toSNBT(2));
        NbtMap.set(name, nbt);
        return {
            "success": true,
            "output": "Save success!"
        };
    }
    return mc.runcmdEx(`execute as "${pl.name}" run structure save "${name}" ${pos1[0]} ${pos1[1]} ${pos1[2]} ${pos2[0]} ${pos2[1]} ${pos2[2]} ${type}`);
}
/**
 * @param pl
 * @param name
 * @param pos1
 * @param mirror 镜像 0: 不镜像 1: X轴 2: Z轴 3: XZ轴
 * @param rotation 旋转 0: 不旋转 1: 旋转90° 2: 旋转180° 3: 旋转270°
 */
function LoadStructure(pl, name, pos1, mirror = 0, rotation = 0) {
    if (UseLLSEApi) {
        let dimid = pl.pos.dimid;
        let nbt = NbtMap.get(name);
        if (!nbt) {
            return { "success": false, "output": "Not find structure nbt!" };
        }
        let r = mc.setStructure(nbt, new IntPos(...pos1, dimid), mirror, rotation);
        if (!r) {
            return { "success": false, "output": "Function mc.setStructure execute failed!" };
        }
        return {
            "success": true,
            "output": "Load success!"
        };
    }
    let r = rotation == 1 ? 90 : rotation == 2 ? 180 : rotation == 3 ? 270 : 0;
    let m = mirror == 1 ? "x" : mirror == 2 ? "z" : mirror == 3 ? "xy" : "none";
    return mc.runcmdEx(`execute as "${pl.name}" run structure load "${name}" ${pos1[0]} ${pos1[1]} ${pos1[2]} ${r}_degrees ${m}`);
}

/**
 * @param pl
 * @param name
 */
function RemoveStructure(pl, name) {
    if (UseLLSEApi) {
        let nbt = NbtMap.get(name);
        if (nbt) {
            NbtMap.delete(name)
        }
        return {
            "success": true,
            "output": "Remove success!"
        };
    }
    return mc.runcmdEx(`execute as "${pl.name}" run structure delete "${name}"`);
}

function IsInMatrix_100(pos1, pos2, pos3) {
    let min = GetMcMinPhase(pos1, pos2);
    let num = 100;
    min = [min[0] - num, min[1] - num, min[2] - num];
    let max = GetMcMaxPhase(pos1, pos2);
    max = [max[0] + num, max[1] + num, max[2] + num];
    return ((min[1] <= pos3[1] && max[1] >= pos3[1]) &&
        (min[0] <= pos3[0] && max[0] >= pos3[0]) &&
        (min[2] <= pos3[2] && max[2] >= pos3[2]));
}
function RefreshAllPlayerChunk(pos1, pos2, dimid) {
    setTimeout(() => {
        let pls = mc.getOnlinePlayers(), l = pls.length, i = 0;
        while (i < l) {
            let pl = pls[i];
            let pos = pl.pos;
            if (dimid == pos.dimid && IsInMatrix_100(pos1, pos2, FloatPosToPOS(pos))) {
                // logger.info("IN!")
                pl.refreshChunks();
            }
            i++;
        }
    }, 50);
}
/**
 * 获取俩坐标的最小相位的坐标
 * @param pos1
 * @param pos2
 */
function GetMcMinPhase(pos1, pos2) {
    return [
        pos1[0] < pos2[0] ? pos1[0] : pos2[0],
        pos1[1] < pos2[1] ? pos1[1] : pos2[1],
        pos1[2] < pos2[2] ? pos1[2] : pos2[2]
    ];
}
function GetMcMaxPhase(pos1, pos2) {
    return [
        pos1[0] > pos2[0] ? pos1[0] : pos2[0],
        pos1[1] > pos2[1] ? pos1[1] : pos2[1],
        pos1[2] > pos2[2] ? pos1[2] : pos2[2]
    ];
}
function GetOffset(pos1, pos2) {
    return [
        pos2[0] - pos1[0],
        pos2[1] - pos1[1],
        pos2[2] - pos1[2]
    ];
}
function SetOffset(pos, offset) {
    return [
        pos[0] + offset[0],
        pos[1] + offset[1],
        pos[2] + offset[2]
    ];
}

class ParticlePainter {
    // ps;
    particleName;
    dots;
    worker;
    interval;
    ready;
    constructor(particleName = "minecraft:redstone_wire_dust_particle", interval = 1000) {
        try {
            // this.ps = mc.newParticleSpawner(100)
            this.particleName = particleName;
            this.dots = []
            this.worker = null;
            this.interval = interval;// respawn interval
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
            z: end.z - start.z
        }
        const maxDiff = Math.max(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z))
        const maxSeg = Math.floor(maxDiff / spacing)
        const delta = {
            x: diff.x / maxSeg,
            y: diff.y / maxSeg,
            z: diff.z / maxSeg
        }
        for (let i=0; i<maxSeg; i++) {
            const dot = ToFloatPos([start.x + i*delta.x, start.y+i*delta.y, start.z+i*delta.z], start.dimid)
            this.dots.push(dot)
        }
        this.start();
    }
    drawCube(start, end, spacing = 1) {
        const s = {
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y), 
            z: Math.min(start.z, end.z)
        }
        const e = {
            x: Math.max(start.x, end.x),
            y: Math.max(start.y, end.y), 
            z: Math.max(start.z, end.z)
        }
        // check if the size is too large

        if (e.x-s.z>1000 || e.y-s.y>1000 || e.z-s.z>1000) {
            return
        }

        // add 12 sides
        for (let x=s.x+spacing; x<e.x; x+=spacing) {
            this.dots.push(new FloatPos(x, s.y, s.z, start.dimid))
            this.dots.push(new FloatPos(x, e.y, s.z, start.dimid))
            this.dots.push(new FloatPos(x, s.y, e.z, start.dimid))
            this.dots.push(new FloatPos(x, e.y, e.z, start.dimid))
        }
        for (let y=s.y+spacing; y<e.y; y+=spacing) {
            this.dots.push(new FloatPos(s.x, y, s.z, start.dimid))
            this.dots.push(new FloatPos(e.x, y, s.z, start.dimid))
            this.dots.push(new FloatPos(s.x, y, e.z, start.dimid))
            this.dots.push(new FloatPos(e.x, y, e.z, start.dimid))
        }
        for (let z=s.z+spacing; z<e.z; z+=spacing) {
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
        if (this.worker) {
            return;
        }
        this.worker = setInterval(()=>this.paint(), this.interval)
    }
    stop() {
        if (this.worker){
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
        let counter = duration / interval
        let worker = setInterval(()=>{
            mc.spawnParticle(pos, particleName)
            if (--counter <= 0) {
                clearInterval(worker)
            }
        }, interval)
    }
}

class UndoInstance {
    undoName;
    pos1;
    pos2;
    static UndoCounter = 0;
    static Instances = new Map();
    static Save(pl, pos1, pos2) {
        let UndoPos = GetMcMinPhase(pos1, pos2); //取消操作时的执行坐标
        let UndoName = `${pl.realName}_Undo_${++this.UndoCounter}}`;
        let res = SaveStructure(pl, UndoName, pos1, pos2);
        if (!res.success) {
            return res;
        }
        // retrieve old undo list for current player and append new undo instance to it.
        const undoList = this.Instances.get(pl.xuid) || []
        if (undoList.length >= conf.MaxUndo) {
            undoList.splice(0, 1)
        }
        undoList.push(new UndoInstance(UndoName, UndoPos, GetMcMaxPhase(pos1, pos2)))
        this.Instances.set(pl.xuid, undoList);
        return res;
    }
    static Has(xuid) {
        const ins = this.Instances.get(xuid);
        return ins && ins.length
    }
    static Del(xuid) {
        return this.Instances.delete(xuid); // remove undo instances for current player completely
    }
    static Pop(xuid) {
        // if there is any undo instances available, pop the last one and return it
        const ins = this.Instances.get(xuid);
        if (ins && ins.length) {
           return ins.pop();
        }
        return null;
    }
    constructor(undoName, pos1, pos2) {
        this.undoName = undoName;
        this.pos1 = pos1;
        this.pos2 = pos2;
    }
    /**
     * 加载
     */
    load(pl) {
        return LoadStructure(pl, this.undoName, this.pos1, 0, 0);
    }
    destroy(pl) {
        return RemoveStructure(pl, this.undoName);
    }
}
class CopyInstance {
    copyName;
    origin;
    pos1;
    pos2;
    static Instances = new Map();
    static Save(pl, pos1, pos2) {
        let CopyName = `${pl.realName}_Copy`;
        let res = SaveStructure(pl, CopyName, pos1, pos2);
        if (!res.success) {
            return res;
        }
        let playerPos = FloatPosToPOS(pl.pos);
        let targetVertices = {
            p1: GetMcMinPhase(pos1, pos2),
            p2: GetMcMaxPhase(pos1, pos2)
        }
        this.Instances.set(pl.xuid, new CopyInstance(CopyName, targetVertices.p1, targetVertices.p2, playerPos));
        return res;
    }
    static Get(xuid) {
        return this.Instances.get(xuid);
    }
    static Del(xuid) {
        return this.Instances.delete(xuid);
    }
    constructor(copyName, pos1, pos2, playerPos) {
        this.copyName = copyName;
        this.pos1 = pos1;
        this.pos2 = pos2;
        this.origin = playerPos; // 记住复制时玩家的位置，在粘贴时需要计算偏移量
    }
    /**
     * @param mirror  镜像 0: 不镜像 1: X轴 2: Z轴 3: XZ轴
     * @param rotation 旋转 0: 不旋转 1: 旋转90° 2: 旋转180° 3: 旋转270°
     */
    load(pl, pos, mirror = 0, rotation = 0) {
        let posByOffset = SetOffset(pos, GetOffset(this.origin, this.pos1)) // 根据复制时的坐标反推粘贴时的坐标
        return LoadStructure(pl, this.copyName, posByOffset, mirror, rotation);
    }
    getTargetPos(pos) {
        return {
            p1: SetOffset(pos, GetOffset(this.origin, this.pos1)),
            p2: SetOffset(pos, GetOffset(this.origin, this.pos2))
        };
    }
}
class PosSelector {
    pos1;
    pos2;
    static Instance = new Map();
    static Get(xuid) {
        let inst = this.Instance.get(xuid);
        if (inst == null) {
            inst = new PosSelector(undefined, undefined);
            this.Instance.set(xuid, inst);
        }
        return inst;
    }
    static Has(xuid) {
        return this.Instance.has(xuid);
    }
    static Del(xuid) {
        return this.Instance.delete(xuid);
    }
    constructor(pos1, pos2) {
        this.pos1 = pos1;
        this.pos2 = pos2;
    }
    expand(pos, out) {
        if (this.pos1 == undefined) {
            return out("请先选择pos1");
        }
        
        if (this.pos2 == undefined) {
            this.pos2 = pos;
        }
        else {
            let min = GetMcMinPhase(GetMcMinPhase(this.pos1, this.pos2), pos);
            let max = GetMcMaxPhase(GetMcMaxPhase(this.pos1, this.pos2), pos);
            // if (pos[0] < min[0]) {
            //     min[0] = pos[0];
            // }
            // else if (pos[0] > max[0]) {
            //     max[0] = pos[0];
            // }
            // if (pos[1] < min[1]) {
            //     min[1] = pos[1];
            // }
            // else if (pos[1] > max[1]) {
            //     max[1] = pos[1];
            // }
            // if (pos[2] < min[2]) {
            //     min[2] = pos[2];
            // }
            // else if (pos[2] > max[2]) {
            //     max[2] = pos[2];
            // }
            this.pos1 = min;
            this.pos2 = max;
        }
    }
    showGrid(pl) {
		let visualizer = ParticleGenerator.get(pl.xuid)
		visualizer && visualizer.clear()
        if (this.pos1 && this.pos2) {            
            if (!visualizer) {
                visualizer = new ParticlePainter("minecraft:balloon_gas_particle", 1000)
                // visualizer = new ParticlePainter("minecraft:basic_flame_particle", 1000)
                ParticleGenerator.set(pl.xuid, visualizer)
            }
            const small = GetMcMinPhase(this.pos1, this.pos2)
            const big = GetMcMaxPhase(this.pos1, this.pos2)
            visualizer.drawCube(ToFloatPos(small, this.pos1[3]), ToFloatPos([big[0]+1, big[1]+1, big[2]+1], this.pos1[3]))
        }
    }
}
class WA_Command {
    cmd;
    description;
    perm;
    FN;
    constructor(cmd, description, perm) {
        this.cmd = cmd;
        this.description = description;
        this.perm = perm;
    }
    then(fn) {
        this.FN = fn;
        return this;
    }
    reg() {
        let ci = mc.newCommand(this.cmd, this.description, this.perm, 0x80);
        if (!ci) {
            logger.error(`命令: ${this.cmd} 注册失败!`);
            return;
        }
        else if (this.FN != undefined) {
            this.FN(ci);
            ci.setup();
        }
    }
}
/**
 * 自动创建权限组数据
 * @param perm
 */
function AutoCreatePermData(perm) {
    if (!Permission.permissionExists(perm)) {
        logger.warn("检测到权限组未创建!自动创建...");
        Permission.registerPermission(perm, "WorldEditBE");
        Permission.saveData();
    }
}
function CanUseWoodenAxe(pl) {
    if (PSConf.Enable) {
        AutoCreatePermData(PSConf.Perm);
        return Permission.checkPermission(pl.xuid, PSConf.Perm);
    }
    else {
        return (pl.permLevel != 0);
    }
}
function FloatPosToPOS(pos) {
    let F = (x) => Math.floor(x);
    return [F(pos.x), F(pos.y), F(pos.z), pos.dimid];
}

function ToIntPos([x, y, z], dimid = 0) {
    return new IntPos(x, y, z, dimid)
}

function ToFloatPos([x, y, z], dimid = 0) {
    return new FloatPos(x, y, z, dimid)
}
/**
 * 防抖
 */
function Debounce(fn, time) {
    let can = true;
    return (...args) => {
        if (!can) {
            return;
        }
        fn(...args);
        can = false;
        setTimeout(() => {
            can = true;
        }, time);
    };
}
/**
 * @param level 0b 1a 2e 3c
 * @param msg
 */
function GetSendText(level, msg) {
    let color = level == 0 ? "§b" : level == 1 ? "§a" : level == 2 ? "§e" : "§c";
    return `§l§d[WorldEditBE] ${color}${msg}`;
}
/**
 * @param pl
 * @param level 0b 1a 2e 3c
 * @param msg
 */
function ST(pl, level, msg) {
    pl.tell(GetSendText(level, msg));
}
function SetPos1(pl, pos, out) {
    let PosSel = PosSelector.Get(pl.xuid);
    PosSel.pos1 = pos;
	if (SelectionMode.has(pl.xuid) && SelectionMode.get(pl.xuid) == "extend")  {
		PosSel.pos2 = undefined;	// 扩展模式下，选中pos1将重置整个选区
	}
    PosSel.showGrid(pl)
    out(`pos1选择成功(${pos[0]},${pos[1]},${pos[2]},${pl.pos.dim})`);
}
function SetPos2(pl, pos, out) {
    let PosSel = PosSelector.Get(pl.xuid);
    if (SelectionMode.has(pl.xuid) && SelectionMode.get(pl.xuid) == "extend") {
        PosSel.expand(pos, out)
    } else {
        PosSel.pos2 = pos;
    }
    PosSel.showGrid(pl)
    out(`pos2选择成功(${pos[0]},${pos[1]},${pos[2]},${pl.pos.dim})`);
}
function onChangeDim(pl, _dimid) {
    ST(pl, 1, "维度变更!已清除选点");
    ClearSelection(pl)
    return true;
}
function onLeft(pl) {
    let xuid = pl.xuid;
    if (PosSelector.Has(xuid)) {
        PosSelector.Del(xuid);
    }
    if (ParticleGenerator.has(xuid)) {
        ParticleGenerator.get(xuid).clear()
        ParticleGenerator.delete(xuid)
    }
    SelectionMode.delete(xuid)
    if (!mc.getOnlinePlayers().length) {
        Portal.stopCheck()
    }
    return true;
}
function onAttackBlock(pl, bl) {
    if (CanUseWoodenAxe(pl) && pl.getHand().type == SelectItem) {
        SetPos1(pl, FloatPosToPOS(bl.pos), (s) => { ST(pl, 1, s); });
        return false;
    }
    return true;
}
function onDestroyBlock(pl, bl) {
    if (CanUseWoodenAxe(pl) && pl.getHand().type == SelectItem) {
        return false;
    }
    return true;
}
function onUseItemOn(pl, _it, bl, fn) {
    if (CanUseWoodenAxe(pl) && pl.getHand().type == SelectItem) {
        fn(pl, FloatPosToPOS(bl.pos), (s) => { ST(pl, 1, s); });
        return false;
    }
    return true;
}
function onConsoleOutput(_str) {
    // logger.info(str);
    return OutputSwitch;
}
function SendModalFormToPlayer(pl, title, content, but1, but2, cb) {
    return pl.sendSimpleForm(title, content, [but1, but2], ["", ""], (pl, id) => {
        cb(pl, (id == 0));
    });
}

function onPlayerJoin() {
    Portal.checkForTeleport()
}

function ClearSelection(pl, out) {
    if (PosSelector.Has(pl.xuid)) {
        PosSelector.Del(pl.xuid)
        out && out.success(GetSendText(0, "清除选点成功!"));
    }
    else {
        out && out.error(GetSendText(3, "你当前还没有选点!"));
    }
    const pg = ParticleGenerator.get(pl.xuid)
    if (pg) {
        pg.clear()
    }
}
function onServerStarted() {
    //pos1
    new WA_Command("pos1", "选择pos1坐标", PermType.Any).then((cmd) => {
        cmd.overload([]);
        cmd.setCallback((_cmd, ori, out, _res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                let pos = pl.pos;
                pos.y -= 1;
                SetPos1(pl, FloatPosToPOS(pos), (s) => { out.success(GetSendText(0, s)); });
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();
    //pos2
    new WA_Command("pos2", "选择pos2坐标", PermType.Any).then((cmd) => {
        cmd.overload([]);
        cmd.setCallback((_cmd, ori, out, _res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                let pos = pl.pos;
                pos.y -= 1;
                SetPos2(pl, FloatPosToPOS(pos), (s) => { out.success(GetSendText(0, s)); });
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();
    new WA_Command("copy", "复制选定坐标内的方块", PermType.Any).then((cmd) => {
        cmd.overload([]);
        cmd.setCallback((_cmd, ori, out, _res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                let PS = PosSelector.Get(pl.xuid);
                if (!PS.pos1 || !PS.pos2) {
                    return out.error(GetSendText(3, "复制失败,请检查pos1和pos2是否选择"));
                }
                let res = CopyInstance.Save(pl, PS.pos1, PS.pos2);
                if (res.success) {
                    out.success(GetSendText(1, "复制完成!使用/paste可粘贴建筑"));
                }
                else {
                    out.error(GetSendText(1, `复制失败!原因: ${res.output}`));
                }
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();
    new WA_Command("testp", "测试粒子效果", PermType.Any).then((cmd) => {
        cmd.overload([]);
        cmd.setCallback((_cmd, ori, out, _res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                let playerPos = [pl.pos.x, pl.pos.y, pl.pos.z];
                let painter = new ParticlePainter()
                if (painter.ready) {
                    painter.drawCube(pl.pos, ToFloatPos([pl.pos.x+10, pl.pos.y+10, pl.pos.z+10], pl.pos.dimid))
                } 
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();
    new WA_Command("paste", "粘贴所复制的方块", PermType.Any).then((cmd) => {
        cmd.setEnum("WA_MirrorOptEnum", ["none", "x", "z", "xz"]);
        cmd.setEnum("WA_RotationOptEnum", ["0", "90", "180", "270"]);
        cmd.optional("WA_MirrorOpt", ParamType.Enum, "WA_MirrorOptEnum", "WA_MirrorOpt", 1);
        cmd.mandatory("WA_RotationOpt", ParamType.Int);
        cmd.overload([]);
        cmd.overload(["WA_RotationOpt", "WA_MirrorOpt"]);
        cmd.setCallback((_cmd, ori, out, res) => {
            let pl = ori.player;
            let rot = 0
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (res["WA_RotationOpt"]) {
                rot = res["WA_RotationOpt"]
                if (rot>270 || rot%90!==0 || rot<0) {
                    return out.error(GetSendText(3, "旋转角度必须为90的倍数且小于360!"))
                }
            }
            if (CanUseWoodenAxe(pl)) {
                let [r, m] = [rot/90,
                    !res["WA_MirrorOpt"] ? 0 :
                        res["WA_MirrorOpt"] == "none" ? 0 :
                            res["WA_MirrorOpt"] == "x" ? 1 :
                                res["WA_MirrorOpt"] == "z" ? 2 : 3
                ];
                let CI = CopyInstance.Get(pl.xuid);
                if (!CI) {
                    return out.error(GetSendText(3, "你还没有复制方块!"));
                }
                let pos = pl.pos;
                // pos.y -= 1;
                let PlacePos = FloatPosToPOS(pos);
                let targetPos = CI.getTargetPos(PlacePos);
                UndoInstance.Save(pl, targetPos.p1, targetPos.p2);  // 在粘贴前记录粘贴位置上的信息
                let PRes = CI.load(pl, PlacePos, m, r);
                if (PRes.success) {
                    out.success(GetSendText(1, "粘贴成功,使用/undo恢复操作之前!"));
                    RefreshAllPlayerChunk(PlacePos, [
                        CI.pos2[0] - CI.pos1[0] + PlacePos[0],
                        CI.pos2[1] - CI.pos1[1] + PlacePos[1],
                        CI.pos2[1] - CI.pos1[0] + PlacePos[1]
                    ], pl.pos.dimid);
                } else {
                    UndoInstance.Pop(pl.xuid).destroy(pl); // 粘贴失败时删除之前记录的粘贴位置上的信息
                }
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();
    new WA_Command("sel", "设置选区模式", PermType.Any).then((cmd) => {
        cmd.setEnum("WA_SelOptEnum", ["normal", "extend"]);
        cmd.optional("WA_SelOption", ParamType.Enum, "WA_SelOptEnum", "WA_SelOption", 1);
        cmd.overload(["WA_SelOption"]);
        cmd.setCallback((_cmd, ori, out, res) => {
            let pl = ori.player
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                if (!res["WA_SelOption"]) {
                    // no option = clear selection
                    ClearSelection(pl, out)
                } else {
                    SelectionMode.set(pl.xuid, res["WA_SelOption"])
                    out.success(GetSendText(1, `选择模式已设置为${res["WA_SelOption"]==='normal'? '普通模式': '扩展模式'}`))
                }
            }
        })
    }).reg()
    new WA_Command("set", "设置选定区域的方块", PermType.Any).then((cmd) => {
        cmd.setEnum("WA_HandOptEnum", ["hand"]);
        cmd.setEnum("WA_HandOptEnum1", ["hand"]);
        cmd.mandatory("WA_BlockNameHand", ParamType.Enum, "WA_HandOptEnum", "WA_BlockNameHand", 1);
        cmd.optional("WA_BlockStateHand", ParamType.Enum, "WA_HandOptEnum1", "WA_BlockStateHand", 1);
        cmd.mandatory("WA_Block", ParamType.Block);
        cmd.optional("WA_BlockState", ParamType.JsonValue);
        cmd.overload(["WA_BlockNameHand", "WA_BlockStateHand"]);
        cmd.overload(["WA_BlockNameHand", "WA_BlockState"]);
        cmd.overload(["WA_Block", "WA_BlockStateHand"]);
        cmd.overload(["WA_Block", "WA_BlockState"]);
        cmd.setCallback((_cmd, ori, out, res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                let PS = PosSelector.Get(pl.xuid);
                if (!PS.pos1 || !PS.pos2) {
                    return out.error(GetSendText(3, "设置失败,请检查pos1和pos2是否选择"));
                }
                let NameUseHand = !!res["WA_BlockNameHand"];
                let StateUseHand = !!res["WA_BlockStateHand"];
                let hand = pl.getHand();
                if ((NameUseHand || StateUseHand) && !hand.isBlock) {
                    return out.error(GetSendText(3, "所选物品不是一个方块!"));
                }
                let type = NameUseHand ? hand.type : res["WA_Block"].type;
                let state = StateUseHand ? GetItemBlockStatesToJson(hand) : JSON.parse(!res["WA_BlockState"] ? "{}" : res["WA_BlockState"]);
                if (NameUseHand && !StateUseHand) { //防止方块出现奇怪的问题???
                    let d = GetItemBlockStatesToJson(hand);
                    Object.keys(d).forEach((k) => {
                        let v = d[k];
                        if (state[k] == null) {
                            state[k] = v;
                        }
                    });
                }
                let saveRes = UndoInstance.Save(pl, PS.pos1, PS.pos2);
                let sendRes = (a, o) => {
                    switch (a) {
                        case 0: {
                            o("e", "操作失败!原因未知!");
                            break;
                        }
                        case 1: {
                            o("i", "操作完成,使用/undo可撤销");
                            break;
                        }
                        case -1: {
                            o("i", "操作失败!原因: 所站位置超出世界范围!");
                            break;
                        }
                    }
                };
                if (saveRes.success) {
                    sendRes(BetterFill(pl, PS.pos1, PS.pos2, type, state), (t, m) => {
                        if (t == "i") {
                            RefreshAllPlayerChunk(PS.pos1, PS.pos2, pl.pos.dimid);
                            out.success(GetSendText(1, m));
                        }
                        else {
                            out.error(GetSendText(3, m));
                        }
                    });
                }
                else {
                    SendModalFormToPlayer(pl, "§l§d[WorldEditBE]§4[Warning]", [
                        `§l§cundo数据保存失败!§a详情:`,
                        `§e${saveRes.output}`,
                        `§c继续操作将无法undo!`,
                        `请谨慎选择!`
                    ].join("\n"), "继续操作", "放弃操作", (pl, b) => {
                        if (b) {
                            let res = BetterFill(pl, PS.pos1, PS.pos2, type, state);
                            sendRes(res, (t, m) => {
                                if (t == "i") {
                                    RefreshAllPlayerChunk(PS.pos1, PS.pos2, pl.pos.dimid);
                                }
                                ST(pl, t == "e" ? 3 : 1, m);
                            });
                        }
                    });
                }
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();
    new WA_Command("giveup", "放弃当前选点", PermType.Any).then((cmd) => {
        cmd.overload([]);
        cmd.setCallback((_cmd, ori, out, _res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                ClearSelection(pl, out)
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();
    new WA_Command("undo", "恢复上一次操作", PermType.Any).then((cmd) => {
        cmd.overload([]);
        cmd.setCallback((_cmd, ori, out, res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (CanUseWoodenAxe(pl)) {
                let UI = UndoInstance.Pop(pl.xuid);
                if (!UI) {
                    return out.error(GetSendText(3, "你还没有undo记录!"));
                }
                let res = UI.load(pl);
                UI.destroy(pl);   //删除undo数据
                if (res.success) {
                    out.success(GetSendText(1, "恢复上一次操作成功"));
                    RefreshAllPlayerChunk(UI.pos1, UI.pos2, pl.pos.dimid);
                }
                else {
                    out.error(GetSendText(3, `恢复上一次操作失败,原因: ${res.output}`));
                }
            }
            else {
                out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
        });
    }).reg();

    new WA_Command("portal", "Setup a custom portal", PermType.Any).then(cmd=>{
        cmd.optional("WA_PortalName", ParamType.String);
        cmd.setEnum("WA_ActionEnum", ["new", "link", "delete", "list", "unlink", "tp"])
        cmd.mandatory("WA_Action", ParamType.Enum, "WA_ActionEnum", "WA_Action", 1)
        cmd.overload(["WA_Action", "WA_PortalName"])

        cmd.setCallback((_cmd, ori, out, res) => {
            let pl = ori.player;
            if (pl == null) {
                return out.error(GetSendText(3, "无法通过非玩家执行此命令!"));
            }
            if (!CanUseWoodenAxe(pl)) {
                return out.error(GetSendText(3, "你没有权限使用此命令!"));
            }
            let PS = PosSelector.Get(pl.xuid);

            if (res.WA_PortalName) {
                switch (res.WA_Action) {
                    case "new": 
                        if (!PS.pos1 || !PS.pos2) {
                            return out.error(GetSendText(3, "请先选择传送门区域"));
                        }
                        // user is defining a new portal
                        const pt = Portal.addPortal(res.WA_PortalName, PS.pos1, PS.pos2)
                        if (pt) {
                            ParticlePainter.ShowIndicator(MakePosFromObject(pt.tp1))
                            ParticlePainter.ShowIndicator(MakePosFromObject(pt.tp2))
                            return out.success(GetSendText(1, `传送门 ${res.WA_PortalName} 已创建`))
                        } else {
                            return out.error(GetSendText(3, `传送门 ${res.WA_PortalName} 已存在，请选择其他名称`))
                        }
                        break
                    case "link": 
                        if (!PS.pos1 || !PS.pos2) {
                            return out.error(GetSendText(3, "请先选择传送门区域"));
                        }
                        const linkTarget = Portal.linkPortal(res.WA_PortalName, PS.pos1, PS.pos2)
                        if (linkTarget) {
                            ParticlePainter.ShowIndicator(MakePosFromObject(linkTarget.tp1))
                            ParticlePainter.ShowIndicator(MakePosFromObject(linkTarget.tp2))
                            return out.success(GetSendText(1, `已与传送门 ${res.WA_PortalName} 建立连接`))
                        } else {
                            return out.error(GetSendText(3, `传送门 ${res.WA_PortalName} 不存在`))
                        }
                        break
                    case "unlink":
                        if (Portal.unlinkPortal(res.WA_PortalName)) {
                            return out.success(GetSendText(1, `传送门 ${res.WA_PortalName} 已断开连接`))
                        } else {
                            return out.error(GetSendText(3, `传送门 ${res.WA_PortalName} 不存在或没有建立连接`))
                        }
                        break
                    case "delete":
                        if (Portal.deletePortal(res.WA_PortalName)) {
                            return out.success(GetSendText(1, `传送门 ${res.WA_PortalName} 已删除`))
                        } else {
                            return out.error(GetSendText(3, `传送门 ${res.WA_PortalName} 不存在`))
                        }
                        break
                    case "tp":
                        const APortal = Portal.getPortal(res.WA_PortalName)
                        if (APortal) {
                            pl.teleport(MakePosFromObject(APortal.tpTarget.tp1))
                            const visualizer = new ParticlePainter("minecraft:blue_flame_particle", 1000)
                            visualizer.drawCube(MakePosFromObject(APortal.posMin), MakePosFromObject(APortal.posMax))
                            setTimeout(()=>{
                                visualizer.clear()
                            }, 10000)
                        }
                }
            } else {
                switch (res.WA_Action) {
                case "list":
                    const portals = Portal.listPortal()
                    if (portals.length) {
                        out.success(GetSendText(1, `已创建了 ${portals.length} 个传送门：`))
                        portals.forEach((p, i)=>{
                            out.success(GetSendText(p.linked?1:3, `${i+1}. ${p.name} ${p.linked ? "(已关联)" : "(闲置)"}`))
                        })
                    } else {
                        out.error(GetSendText(3, `没有已创建的传送门`))
                    }
                    break
                }
            }
        })
    }).reg()
}
function main() {
    ll.registerPlugin("WorldEditBE.js", "简易版创世神", [1, 3, 0], {
        "Author": "Timiya, SublimeIce"
    });
    logger.setTitle("WorldEdit_BE");
    UseLLSEApi = conf.get("UseLLSEApi");
    PSConf = conf.get("PermSystem");
    SelectItem = conf.get("SelectItem");
    if (PSConf.Enable) {
        AutoCreatePermData(PSConf.Perm);
    }
    mc.listen("onChangeDim", onChangeDim);
    mc.listen("onLeft", onLeft);
    mc.listen("onJoin", onPlayerJoin)
    mc.listen("onAttackBlock", onAttackBlock);
	mc.listen("onDestroyBlock", onDestroyBlock);
    let deb = Debounce(SetPos2, 500);
    mc.listen("onUseItemOn", (p, i, b) => { return onUseItemOn(p, i, b, deb); });
    mc.listen("onConsoleOutput", onConsoleOutput);
    mc.listen("onServerStarted", onServerStarted);
    logger.info("简易版创世神(WorldEdit_BE)部署成功!版本: 1.3.0");
}
main();
