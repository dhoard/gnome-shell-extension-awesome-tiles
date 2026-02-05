/*
 * Copyright (C) 2021 Pim Snel
 * Copyright (C) 2021 Veli Tasalı
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import Meta from 'gi://Meta'
import Shell from 'gi://Shell'
import Gio from 'gi://Gio'
import { Extension, ngettext } from 'resource:///org/gnome/shell/extensions/extension.js'
import { osdWindowManager, wm } from 'resource:///org/gnome/shell/ui/main.js';
import * as windowMover from './windowMover.js';
import { LinkedResizeHandler } from './linkedResize.js';
import {
  GAP_SIZE_MAX,
  GAP_SIZE_PIXEL_MAX,
  TILING_STEPS_CENTER,
  TILING_STEPS_SIDE,
} from './constants.js'
import { isRectEqual, parseTilingSteps } from './utils.js'

const DESKTOP_WM_WORKSPACE_KEYBINDINGS = [
  { key: 'switch-to-workspace-left', setting: 'shortcut-workspace-switch-left' },
  { key: 'switch-to-workspace-right', setting: 'shortcut-workspace-switch-right' },
  { key: 'move-to-workspace-left', setting: 'shortcut-workspace-move-left' },
  { key: 'move-to-workspace-right', setting: 'shortcut-workspace-move-right' },
]
const MUTTER_TILED_KEYBINDINGS = [
  'toggle-tiled-left',
  'toggle-tiled-right',
]
export default class AwesomeTilesExtension extends Extension {
  enable() {
    this._windowMover = new windowMover.WindowMover()
    this._settings = this.getSettings()
    this._osdGapChangedIcon = Gio.icon_new_for_string("view-grid-symbolic")
    this._shortcutsBindingIds = []
    this._linkedResizeHandler = new LinkedResizeHandler(this._settings, this._windowMover)

    try {
      const gnomeDesktopWmKeybindingsSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' })
      const gnomeMutterKeybindingSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter.keybindings' })
      
      DESKTOP_WM_WORKSPACE_KEYBINDINGS.forEach(binding => {
        const shortcut = this._settings.get_strv(binding.setting)
        gnomeDesktopWmKeybindingsSettings.set_strv(binding.key, shortcut)
      })
      
      MUTTER_TILED_KEYBINDINGS.forEach(key => gnomeMutterKeybindingSettings.set_strv(key, []))
      Gio.Settings.sync()
    } catch (e) {
      logError(e)
    }

    this._bindShortcut("shortcut-align-window-to-center", this._alignWindowToCenter.bind(this))
    this._bindShortcut("shortcut-tile-window-to-center", this._tileWindowCenter.bind(this))
    this._bindShortcut("shortcut-tile-window-to-left", this._tileWindowLeft.bind(this))
    this._bindShortcut("shortcut-tile-window-to-right", this._tileWindowRight.bind(this))
    this._bindShortcut("shortcut-tile-window-to-top", this._tileWindowTop.bind(this))
    this._bindShortcut("shortcut-tile-window-to-top-left", this._tileWindowTopLeft.bind(this))
    this._bindShortcut("shortcut-tile-window-to-top-right", this._tileWindowTopRight.bind(this))
    this._bindShortcut("shortcut-tile-window-to-bottom", this._tileWindowBottom.bind(this))
    this._bindShortcut("shortcut-tile-window-to-bottom-left", this._tileWindowBottomLeft.bind(this))
    this._bindShortcut("shortcut-tile-window-to-bottom-right", this._tileWindowBottomRight.bind(this))
    this._bindShortcut("shortcut-increase-gap-size", this._increaseGapSize.bind(this))
    this._bindShortcut("shortcut-decrease-gap-size", this._decreaseGapSize.bind(this))

    this._linkedResizeHandler.enable()

    this._workspaceSettingsConnections = []
    DESKTOP_WM_WORKSPACE_KEYBINDINGS.forEach(binding => {
      const connection = this._settings.connect(`changed::${binding.setting}`, () => {
        this._syncWorkspaceKeybindings()
      })
      this._workspaceSettingsConnections.push({ setting: binding.setting, connection })
    })
  }

  disable() {
    this._windowMover.destroy()
    this._shortcutsBindingIds.forEach((id) => wm.removeKeybinding(id))

    if (this._linkedResizeHandler) {
      this._linkedResizeHandler.disable()
      this._linkedResizeHandler = null
    }

    if (this._workspaceSettingsConnections) {
      this._workspaceSettingsConnections.forEach(({ connection }) => {
        this._settings.disconnect(connection)
      })
    }

    try {
      const gnomeDesktopWmKeybindingsSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' })
      const gnomeMutterKeybindingSettings = new Gio.Settings({ schema_id: 'org.gnome.mutter.keybindings' })
      DESKTOP_WM_WORKSPACE_KEYBINDINGS.forEach(binding => gnomeDesktopWmKeybindingsSettings.reset(binding.key))
      MUTTER_TILED_KEYBINDINGS.forEach(key => gnomeMutterKeybindingSettings.reset(key))
      Gio.Settings.sync()
    } catch (e) {
      logError(e)
    }
    this._shortcutsBindingIds = this._settings = this._windowMover = this._osdGapChangedIcon = this._workspaceSettingsConnections = this._linkedResizeHandler = null
  }

  _syncWorkspaceKeybindings() {
    try {
      const gnomeDesktopWmKeybindingsSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.wm.keybindings' })
      DESKTOP_WM_WORKSPACE_KEYBINDINGS.forEach(binding => {
        const shortcut = this._settings.get_strv(binding.setting)
        gnomeDesktopWmKeybindingsSettings.set_strv(binding.key, shortcut)
      })
      Gio.Settings.sync()
    } catch (e) {
      logError(e)
    }
  }

  _alignWindowToCenter() {
    const window = global.display.get_focus_window()
    if (!window) return

    const windowArea = window.get_frame_rect()
    const monitor = window.get_monitor()
    const workspace = window.get_workspace()
    const workspaceArea = workspace.get_work_area_for_monitor(monitor)

    const x = Math.floor(
      workspaceArea.x + ((workspaceArea.width - windowArea.width) / 2),
    )
    const y = Math.floor(
      workspaceArea.y + ((workspaceArea.height - windowArea.height) / 2),
    )

    this._windowMover._setWindowRect(window, x, y, windowArea.width, windowArea.height, this._isWindowAnimationEnabled)
    
  }

  _bindShortcut(name, callback) {
    const mode = Shell.hasOwnProperty('ActionMode') ? Shell.ActionMode : Shell.KeyBindingMode

    wm.addKeybinding(
      name,
      this._settings,
      Meta.KeyBindingFlags.NONE,
      mode.ALL,
      callback
    )

    this._shortcutsBindingIds.push(name)
  }

  _calculateWorkspaceArea(window) {
    const monitor = window.get_monitor()
    const monitorGeometry = global.display.get_monitor_geometry(monitor)
    const isVertical = monitorGeometry.width < monitorGeometry.height

    const workspace = window.get_workspace()
    const workspaceArea = workspace.get_work_area_for_monitor(monitor)

    if (this._isIndividualGapSizesEnabled) {
      return this._calculateIndividualWorkspaceArea(workspaceArea, monitor, isVertical)
    }

    const gap = this._gapSize

    if (gap <= 0 && !this._isBottomGapEnabled) return {
      x: workspaceArea.x,
      y: workspaceArea.y,
      height: workspaceArea.height,
      width: workspaceArea.width,
    }

    let gaps
    if (this._isGapSizeInPixels) {
      const gapPx = Math.round(gap)
      gaps = {
        x: Math.min(gapPx, Math.floor(workspaceArea.width / 2)),
        y: Math.min(gapPx, Math.floor(workspaceArea.height / 2)),
      }
    } else {
      const gapUncheckedX = Math.round(gap / 200 * workspaceArea.width)
      const gapUncheckedY = Math.round(gap / 200 * workspaceArea.height)

      gaps = {
        x: Math.min(gapUncheckedX, gapUncheckedY * 2),
        y: Math.min(gapUncheckedY, gapUncheckedX * 2),
      }
    }

    if (isVertical) {
      const temp = gaps.x
      gaps.x = gaps.y
      gaps.y = temp
    }

    let bottomGap = 0
    if (this._isBottomGapEnabled) {
      const isPrimaryMonitor = monitor === global.display.get_primary_monitor();
      if (!this._isBottomGapMainScreenOnly || isPrimaryMonitor) {
        if (this._isGapSizeInPixels) {
          bottomGap = Math.round(this._bottomGapSize)
        } else {
          bottomGap = Math.round(this._bottomGapSize / 100 * workspaceArea.height)
        }
      }
    }

    return {
      x: workspaceArea.x + gaps.x,
      y: workspaceArea.y + gaps.y,
      height: workspaceArea.height - (gaps.y * 2) - bottomGap,
      width: workspaceArea.width - (gaps.x * 2),
      gaps,
      bottomGap,
    }
  }

  _calculateIndividualWorkspaceArea(workspaceArea, monitor, isVertical) {
    const gapTop = this._gapSizeTop
    const gapBottom = this._gapSizeBottom
    const gapLeft = this._gapSizeLeft
    const gapRight = this._gapSizeRight

    let gaps = { x: 0, y: 0 }

    if (this._isGapSizeInPixels) {
      gaps.x = Math.min(gapLeft + gapRight, workspaceArea.width)
      gaps.y = Math.min(gapTop + gapBottom, workspaceArea.height)
    } else {
      const gapTopPx = Math.round(gapTop / 200 * workspaceArea.height)
      const gapBottomPx = Math.round(gapBottom / 200 * workspaceArea.height)
      const gapLeftPx = Math.round(gapLeft / 200 * workspaceArea.width)
      const gapRightPx = Math.round(gapRight / 200 * workspaceArea.width)

      gaps.x = Math.min(gapLeftPx + gapRightPx, (gapTopPx + gapBottomPx) * 2)
      gaps.y = Math.min(gapTopPx + gapBottomPx, (gapLeftPx + gapRightPx) * 2)
    }

    if (isVertical) {
      const tempX = gaps.x
      gaps.x = gaps.y
      gaps.y = tempX
    }

    let extraBottomGap = 0
    if (this._isBottomGapEnabled) {
      const isPrimaryMonitor = monitor === global.display.get_primary_monitor();
      if (!this._isBottomGapMainScreenOnly || isPrimaryMonitor) {
        if (this._isGapSizeInPixels) {
          extraBottomGap = Math.round(this._bottomGapSize)
        } else {
          extraBottomGap = Math.round(this._bottomGapSize / 100 * workspaceArea.height)
        }
      }
    }

    let topGap, leftGap, rightGap, bottomGap
    if (this._isGapSizeInPixels) {
      topGap = gapTop
      leftGap = gapLeft
      rightGap = gapRight
      bottomGap = gapBottom + extraBottomGap
    } else {
      topGap = Math.round(gapTop / 200 * workspaceArea.height)
      leftGap = Math.round(gapLeft / 200 * workspaceArea.width)
      rightGap = Math.round(gapRight / 200 * workspaceArea.width)
      bottomGap = Math.round(gapBottom / 200 * workspaceArea.height) + extraBottomGap
    }

    if (isVertical) {
      const tempTop = topGap
      topGap = leftGap
      leftGap = tempTop
      const tempBottom = bottomGap
      bottomGap = rightGap
      rightGap = tempBottom
    }

    return {
      x: workspaceArea.x + leftGap,
      y: workspaceArea.y + topGap,
      height: workspaceArea.height - topGap - bottomGap,
      width: workspaceArea.width - leftGap - rightGap,
      gaps,
      bottomGap: extraBottomGap,
      individualGaps: { top: topGap, left: leftGap, right: rightGap, bottom: bottomGap }
    }
  }

  get _gapSizeIncrements() {
    return this._settings.get_int("gap-size-increments")
  }

  _decreaseGapSize() {
    const maxGap = this._isGapSizeInPixels ? GAP_SIZE_PIXEL_MAX : GAP_SIZE_MAX
    this._gapSize = Math.max(this._gapSize - this._gapSizeIncrements, 0)
    this._notifyGapSize()
  }

  _increaseGapSize() {
    const maxGap = this._isGapSizeInPixels ? GAP_SIZE_PIXEL_MAX : GAP_SIZE_MAX
    this._gapSize = Math.min(this._gapSize + this._gapSizeIncrements, maxGap)
    this._notifyGapSize()
  }

  get _isGapSizeInPixels() {
    return this._settings.get_boolean("gap-size-in-pixels")
  }

  get _gapSize() {
    return this._settings.get_int("gap-size")
  }

  set _gapSize(intValue) {
    this._settings.set_int("gap-size", intValue)
  }

  _notifyGapSize() {
    const gapSize = this._gapSize;
    const unit = this._isGapSizeInPixels ? 'pixels' : 'percent';
    const label = ngettext(
      `Gap size is now at %d ${unit}`,
      `Gap size is now at %d ${unit}`,
      gapSize
    ).format(gapSize)

    if (osdWindowManager && osdWindowManager.showOne) {
      osdWindowManager.showOne(
        global.display.get_current_monitor(),
        this._osdGapChangedIcon,
        label,
        null,
        -1
      )
    }
  }

  get _isIndividualGapSizesEnabled() {
    return this._settings.get_boolean("enable-individual-gap-sizes")
  }

  get _gapSizeTop() {
    return this._settings.get_int("gap-size-top")
  }

  get _gapSizeLeft() {
    return this._settings.get_int("gap-size-left")
  }

  get _gapSizeRight() {
    return this._settings.get_int("gap-size-right")
  }

  get _gapSizeBottom() {
    return this._settings.get_int("gap-size-bottom")
  }

  get _gapSizeInner() {
    return this._settings.get_int("gap-size-inner")
  }

  get _isInnerGapsEnabled() {
    return this._settings.get_boolean("enable-inner-gaps")
  }

  get _isBottomGapEnabled() {
    return this._settings.get_boolean("enable-bottom-gap")
  }

  get _isBottomGapMainScreenOnly() {
    return this._settings.get_boolean("bottom-gap-main-screen-only")
  }

  get _bottomGapSize() {
    return this._settings.get_int("bottom-gap-size")
  }

  get _tilingStepsCenter() {
    return parseTilingSteps(
      this._settings.get_string("tiling-steps-center"),
      TILING_STEPS_CENTER,
    )
  }

  get _tilingStepsSide() {
    return parseTilingSteps(
      this._settings.get_string("tiling-steps-side"),
      TILING_STEPS_SIDE,
    )
  }

  get _isWindowAnimationEnabled() {
    return this._settings.get_boolean("enable-window-animation")
  }

  get _nextStepTimeout() {
    return this._settings.get_int("next-step-timeout")
  }

  _tileWindow(top, bottom, left, right) {
    const window = global.display.get_focus_window()
    if (!window) return

    const { x, y, width, height } = this._nextWindowRect(window, top, bottom, left, right)

    this._windowMover._setWindowRect(window, x, y, width, height, this._isWindowAnimationEnabled)
  }

  _nextWindowRect(window, top, bottom, left, right) {
    const time = Date.now()
    const center = !(top || bottom || left || right)
    const prev = this._previousTilingOperation
    const windowId = window.get_id()
    const steps = center ? this._tilingStepsCenter : this._tilingStepsSide
    const successive =
      prev &&
      prev.windowId === windowId &&
      time - prev.time <= this._nextStepTimeout &&
      prev.top === top &&
      prev.bottom === bottom &&
      prev.left === left &&
      prev.right === right &&
      prev.iteration < steps.length &&
      prev.window === window 
    let iteration = successive ? prev.iteration : 0
    let rect = this._computeWindowRect(window, top, bottom, left, right, steps[iteration], center)

    for (const end = iteration; successive && isRectEqual(rect, prev.rect);) {
      iteration = (iteration + 1) % steps.length
      if (iteration === end)
        break;
      rect = this._computeWindowRect(window, top, bottom, left, right, steps[iteration], center)
    }

    this._previousTilingOperation =
      { windowId, top, bottom, left, right, rect, time, iteration: iteration + 1, window }

    return rect
  }

  _computeWindowRect(window, top, bottom, left, right, step, center) {
    const widthFactor = 1.0 - step[0]
    const heightFactor = step.length > 1 ? (1.0 - step[1]) : widthFactor

    const workArea = this._calculateWorkspaceArea(window)
    let { x, y, width, height } = workArea

    if (center) {
      const monitor = window.get_monitor()
      const monitorGeometry = global.display.get_monitor_geometry(monitor)
      const isVertical = monitorGeometry.width < monitorGeometry.height
      const centerTilingWidthFactor = isVertical ? widthFactor / 2 : widthFactor
      const centerTilingHeightFactor = isVertical ? heightFactor : heightFactor / 2

      width -= width * centerTilingWidthFactor
      height -= height * centerTilingHeightFactor
      x += (workArea.width - width) / 2
      y += (workArea.height - height) / 2

    } else {
      if (left !== right) width -= width * widthFactor
      if (top !== bottom) height -= height * heightFactor
      if (!left) x += (workArea.width - width) / (right ? 1 : 2)
      if (!top) y += (workArea.height - height) / (bottom ? 1 : 2)

      if (this._isInnerGapsEnabled) {
        let innerGapX, innerGapY
        if (this._isIndividualGapSizesEnabled) {
          const innerGap = this._gapSizeInner
          if (this._isGapSizeInPixels) {
            innerGapX = innerGap
            innerGapY = innerGap
          } else {
            innerGapX = Math.round(innerGap / 200 * workArea.width)
            innerGapY = Math.round(innerGap / 200 * workArea.height)
          }
        } else {
          innerGapX = workArea.gaps?.x ?? 0
          innerGapY = workArea.gaps?.y ?? 0
        }
        if (left !== right) {
          if (right) x += innerGapX / 2
          width -= innerGapX / 2
        }
        if (top !== bottom) {
          if (bottom) y += innerGapY / 2
          height -= innerGapY / 2
        }
      }
    }

    x = Math.round(x)
    y = Math.round(y)
    width = Math.round(width)
    height = Math.round(height)

    return { x, y, width, height }
  }

  _tileWindowBottom() {
    this._tileWindow(false, true, true, true)
  }

  _tileWindowBottomLeft() {
    this._tileWindow(false, true, true, false)
  }

  _tileWindowBottomRight() {
    this._tileWindow(false, true, false, true)
  }

  _tileWindowCenter() {
    this._tileWindow(false, false, false, false)
  }

  _tileWindowLeft() {
    this._tileWindow(true, true, true, false)
  }

  _tileWindowRight() {
    this._tileWindow(true, true, false, true)
  }

  _tileWindowTop() {
    this._tileWindow(true, false, true, true)
  }

  _tileWindowTopLeft() {
    this._tileWindow(true, false, true, false)
  }

  _tileWindowTopRight() {
    this._tileWindow(true, false, false, true)
  }
}
