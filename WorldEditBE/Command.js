export class BDSCommand {
  cmd
  constructor(name, description, permission) {
    this.cmd = mc.newCommand(name, description, permission)
  }
  then(cb) {
    cb(this.cmd)
    this.cmd.setup()
  }
}