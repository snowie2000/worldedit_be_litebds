### Credit

Inspired by wooden_axe by [提米吖](https://www.minebbs.com/threads/wooden_axe.7561/page-2).

Some functions are from the wooden_axe but optimized.

### Install

Put the js file into plugin folder.

### What's new

Selection outline visualization. (w/o LiteLoaderBDS-CUIv1.1 pack)

expandable selection (just like java edition of FAWE)

multiple undo instances (10 by default)

redo ability

undoable copy/paste

stack ability

custom portal implementation.

### Portal

* /portal <Action: ActionEnum> [PortalName: string]
  - `list` list all the portals created and their link states
  - `new` create a new portal
  - `delete` delete a portal
  - `link` link current selection with a named portal
  - `unlink` remove link of a named portal
  - `tp` teleport to a portal and highlight the portal outline and teleporation spots.

Portal supports both horizontal and regular vertical portals. With horizontal portals, a proper landing spot will be automatically located.

----

####principles

Basically, the plugins checks for player location against every linked portals every 120ms. Which means if you have a ton of portals and players online, there could be some lag or delay when teleporting.

### Known issues

paste doesn't support mirroring and rotation.