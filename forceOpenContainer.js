ll.registerPlugin(
  /* name */ "ForceOpenContainer",
  /* introduction */ "在任何状态下都可以打开容器",
  /* version */ [0, 0, 1],
  /* otherInformation */ {
    Author: "SublimeIce",
  }
)

// 修改此选项以开启或关闭插件
let CanOpen = 1

const fnCanOpenContainer = NativeFunction.fromDescription(NativeTypes.Bool, NativeTypes.Pointer, NativeTypes.Pointer)
fnCanOpenContainer.address = NativePointer.fromSymbol("?canOpen@ChestBlockActor@@QEBA_NAEAVBlockSource@@@Z")

if (fnCanOpenContainer.address) {
  const orgCanOpenContainer = fnCanOpenContainer.hook((container, bs) => {
    if (CanOpen) return true
    return orgCanOpenContainer.call(container, bs)
  })
} else {
  CanOpen = 0
  logger.error("当前版本不兼容，已自动关闭插件")
}

logger.warn("ForceOpenContainer已加载，当前状态为：" + (CanOpen ? "开启" : "关闭"))
