export function Confirm(pl, option) {
  pl.sendSimpleForm(
    option.title,
    option.content,
    [option.okText ?? "确认", option.cancelText ?? "取消"],
    ["", ""],
    (_, id) => {
      if (id === 0) {
        option.onOk && option.onOk()
      } else {
        option.onCancel && option.onCancel()
      }
    }
  )
}
