import Meta from 'gi://Meta'
import Clutter from 'gi://Clutter'
import St from 'gi://St'
import GLib from 'gi://GLib'

const GLOW_OPACITY = 0.75
const GLOW_WIDTH = 5
const GLOW_ANIMATION_DURATION = 300

export class LinkedResizeHandler {
  constructor(settings, windowMover) {
    this._settings = settings
    this._windowMover = windowMover
    this._enabled = false
    this._isResizing = false
    this._resizeInfo = null
    this._linkedWindows = []
    this._glowActor = null
    this._altKeyPressed = false
    this._grabOpBeginId = 0
    this._grabOpEndId = 0
    this._capturedEventId = 0
    this._settingsChangedId = null
    this._resizeTimerId = 0
  }

  enable() {
    if (this._settingsChangedId) return

    this._updateEnabled()
    this._settingsChangedId = this._settings.connect('changed::enable-linked-resize', () => {
      this._updateEnabled()
    })
  }

  disable() {
    this._stopResize()

    if (this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId)
      this._settingsChangedId = null
    }

    if (this._grabOpBeginId) {
      global.display.disconnect(this._grabOpBeginId)
      this._grabOpBeginId = 0
    }

    if (this._grabOpEndId) {
      global.display.disconnect(this._grabOpEndId)
      this._grabOpEndId = 0
    }

    if (this._capturedEventId) {
      global.stage.disconnect(this._capturedEventId)
      this._capturedEventId = 0
    }

    if (this._resizeTimerId) {
      GLib.Source.remove(this._resizeTimerId)
      this._resizeTimerId = 0
    }

    this._enabled = false
    this._altKeyPressed = false
  }

  _updateEnabled() {
    const shouldEnable = this._settings.get_boolean('enable-linked-resize')

    if (shouldEnable === this._enabled) return

    this._enabled = shouldEnable

    if (this._enabled) {
      this._grabOpBeginId = global.display.connect('grab-op-begin', (display, window, grabOp) => {
        this._onGrabOpBegin(window, grabOp)
      })

      this._grabOpEndId = global.display.connect('grab-op-end', (display, window, grabOp) => {
        this._onGrabOpEnd(window, grabOp)
      })

      this._capturedEventId = global.stage.connect('captured-event', (actor, event) => {
        return this._onCapturedEvent(event)
      })
    } else {
      if (this._grabOpBeginId) {
        global.display.disconnect(this._grabOpBeginId)
        this._grabOpBeginId = 0
      }
      if (this._grabOpEndId) {
        global.display.disconnect(this._grabOpEndId)
        this._grabOpEndId = 0
      }
      if (this._capturedEventId) {
        global.stage.disconnect(this._capturedEventId)
        this._capturedEventId = 0
      }
    }
  }

  _onCapturedEvent(event) {
    const type = event.type()

    if (type === Clutter.EventType.KEY_PRESS) {
      const keyCode = event.get_key_code()
      if (keyCode === Clutter.KEY_Alt_L || keyCode === Clutter.KEY_Alt_R) {
        this._altKeyPressed = true
      }
    } else if (type === Clutter.EventType.KEY_RELEASE) {
      const keyCode = event.get_key_code()
      if (keyCode === Clutter.KEY_Alt_L || keyCode === Clutter.KEY_Alt_R) {
        this._altKeyPressed = false
        if (this._isResizing) {
          this._stopResize()
        }
      }
    }

    return Clutter.EVENT_PROPAGATE
  }

  _onGrabOpBegin(window, grabOp) {

    const [x, y, mods] = global.get_pointer()
    const isAltHeld = (mods & Clutter.ModifierType.MOD1_MASK) !== 0


    if (!isAltHeld) return
    if (!window) return

    const isResizeOp = [
      Meta.GrabOp.RESIZING_N,
      Meta.GrabOp.RESIZING_S,
      Meta.GrabOp.RESIZING_E,
      Meta.GrabOp.RESIZING_W,
    ].includes(grabOp)

    if (!isResizeOp) return

    const direction = this._getResizeDirection(grabOp)
    if (!direction) return

    const linkedWindows = this._findLinkedWindows(window, direction)
    if (linkedWindows.length === 0) return

    this._isResizing = true
    this._resizeInfo = {
      window: window,
      direction: direction,
      initialRect: window.get_frame_rect(),
      linkedWindows: linkedWindows.map(w => ({
        window: w,
        initialRect: w.get_frame_rect(),
      })),
    }

    this._createGlowEffect(window, direction, linkedWindows)
    this._startResizeTracking()
  }

  _startResizeTracking() {

    this._resizeTimerId = GLib.timeout_add(GLib.PRIORITY_LOW, 16, () => {
      if (!this._isResizing) {
        this._resizeTimerId = 0
        return GLib.SOURCE_REMOVE
      }
      this.syncLinkedWindows()
      return GLib.SOURCE_CONTINUE
    })
  }

  _onGrabOpEnd(window, grabOp) {
    if (!this._isResizing) return
    this._stopResize()
  }

  _getResizeDirection(grabOp) {
    switch (grabOp) {
      case Meta.GrabOp.RESIZING_E: return 'east'
      case Meta.GrabOp.RESIZING_W: return 'west'
      case Meta.GrabOp.RESIZING_N: return 'north'
      case Meta.GrabOp.RESIZING_S: return 'south'
      default: return null
    }
  }

  _findLinkedWindows(sourceWindow, direction) {
    const workspace = sourceWindow.get_workspace()
    const monitor = sourceWindow.get_monitor()
    const sourceRect = sourceWindow.get_frame_rect()
    const sourceRectObj = {
      x: sourceRect.x,
      y: sourceRect.y,
      width: sourceRect.width,
      height: sourceRect.height
    }


    const allWindows = workspace.list_windows()
    const winCount = allWindows.length

    const sourceWindowId = sourceWindow.get_id()
    const passed = []

    for (let i = 0; i < winCount; i++) {
      const w = allWindows[i]


      if (!w.get_id || typeof w.get_id !== 'function') {
        continue
      }

      const wid = w.get_id()
      const title = w.get_title() || `win-${i}`

      if (wid === sourceWindowId) {
        continue
      }


      if (this._isWindowMinimized(w)) {
        continue
      }

      if (w.get_monitor() !== monitor) {
        continue
      }

      const frameRect = w.get_frame_rect()
      const frameRectObj = { x: frameRect.x, y: frameRect.y, width: frameRect.width, height: frameRect.height }

      const atEdge = this._isWindowAtEdge(sourceRectObj, frameRectObj, direction, sourceWindow)


      if (atEdge) {
        passed.push(w)
      }
    }


    const filtered = this._filterVisibleWindows(passed, sourceWindow, direction)
    return filtered
  }

  _isWindowAtEdge(sourceRect, targetRect, direction, sourceWindow) {
    const threshold = this._calculateEdgeThreshold(sourceWindow)

    switch (direction) {
      case 'east': {
        const edgeDist = Math.abs(targetRect.x - (sourceRect.x + sourceRect.width))
        const vOverlap = this._hasVerticalOverlap(sourceRect, targetRect)
        return edgeDist <= threshold && vOverlap
      }
      case 'west': {
        const edgeDist = Math.abs((targetRect.x + targetRect.width) - sourceRect.x)
        const vOverlap = this._hasVerticalOverlap(sourceRect, targetRect)
        return edgeDist <= threshold && vOverlap
      }
      case 'south': {
        const edgeDist = Math.abs(targetRect.y - (sourceRect.y + sourceRect.height))
        const hOverlap = this._hasHorizontalOverlap(sourceRect, targetRect)
        return edgeDist <= threshold && hOverlap
      }
      case 'north': {
        const edgeDist = Math.abs((targetRect.y + targetRect.height) - sourceRect.y)
        const hOverlap = this._hasHorizontalOverlap(sourceRect, targetRect)
        return edgeDist <= threshold && hOverlap
      }
    }
    return false
  }

  _calculateEdgeThreshold(sourceWindow) {

    const useIndividualGaps = this._settings.get_boolean('enable-individual-gap-sizes')
    const useInnerGaps = this._settings.get_boolean('enable-inner-gaps')
    const isPixels = this._settings.get_boolean('gap-size-in-pixels')

    let gapSize
    if (useIndividualGaps && useInnerGaps) {
      gapSize = this._settings.get_int('gap-size-inner')
    } else {
      gapSize = this._settings.get_int('gap-size')
    }


    let gapPixels
    if (isPixels) {
      gapPixels = gapSize
    } else {

      const monitor = sourceWindow.get_monitor()
      const monitorGeometry = global.display.get_monitor_geometry(monitor)

      gapPixels = Math.round(gapSize / 100 * Math.min(monitorGeometry.width, monitorGeometry.height))
    }


    const threshold = Math.round(gapPixels * 1.5)


    return Math.max(threshold, 2)
  }

  _hasVerticalOverlap(a, b) {
    return !(a.y + a.height <= b.y || b.y + b.height <= a.y)
  }

  _hasHorizontalOverlap(a, b) {
    return !(a.x + a.width <= b.x || b.x + b.width <= a.x)
  }

  _isWindowMinimized(window) {
    // Multiple checks to detect minimized/hidden windows
    if (!window) return true

    // Standard minimized check
    if (window.is_minimized && window.is_minimized()) return true

    // Check if minimized property exists and is true
    if (window.minimized === true) return true

    // Check if window is hidden
    if (window.is_hidden && window.is_hidden()) return true

    // Check if window is on the same workspace
    if (window.get_workspace && window.get_workspace() !== global.workspace_manager.get_active_workspace()) {
      // Window is on different workspace - treat as minimized
      return true
    }

    // Check if window is mapped (visible)
    if (window.is_mapped && !window.is_mapped()) return true

    // Check show on all workspaces
    if (window.is_on_all_workspaces && !window.is_on_all_workspaces()) {
      // Additional check for workspace
      if (window.get_workspace && window.get_workspace() !== global.workspace_manager.get_active_workspace()) {
        return true
      }
    }

    return false
  }

  _filterVisibleWindows(windows, sourceWindow, direction) {
    const workspace = sourceWindow.get_workspace()
    const allWindows = workspace.list_windows()
    const sourceRect = sourceWindow.get_frame_rect()

    return windows.filter(w => {
      const wRect = w.get_frame_rect()
      const sourceIdx = allWindows.indexOf(sourceWindow)
      const wIdx = allWindows.indexOf(w)


      for (const other of allWindows) {
        if (other === w || other === sourceWindow) continue
        if (!other.get_id || typeof other.get_id !== 'function') continue

        if (this._isWindowMinimized(other)) {
          continue
        }

        const otherIdx = allWindows.indexOf(other)
        // Only consider windows that are in front of BOTH source and candidate
        if (otherIdx <= sourceIdx || otherIdx <= wIdx) {
          continue
        }

        const otherRect = other.get_frame_rect()

        // Check if this window actually blocks the gap
        const isBlocking = this._isBlockingGap(sourceRect, wRect, otherRect, direction)
        if (isBlocking) {
          return false
        }
      }
      return true
    })
  }

  _isBlockingGap(sourceRect, targetRect, blockerRect, direction) {
    // Check if blocker is strictly between source and target in the resize direction
    switch (direction) {
      case 'east':
        // Gap is between source right and target left
        // Blocker must be: right of source AND left of target AND overlap vertically with gap
        return blockerRect.x >= sourceRect.x + sourceRect.width &&
               blockerRect.x + blockerRect.width <= targetRect.x &&
               this._hasVerticalOverlap(sourceRect, blockerRect)
      case 'west':
        // Gap is between target right and source left
        return blockerRect.x >= targetRect.x + targetRect.width &&
               blockerRect.x + blockerRect.width <= sourceRect.x &&
               this._hasVerticalOverlap(sourceRect, blockerRect)
      case 'south':
        // Gap is between source bottom and target top
        return blockerRect.y >= sourceRect.y + sourceRect.height &&
               blockerRect.y + blockerRect.height <= targetRect.y &&
               this._hasHorizontalOverlap(sourceRect, blockerRect)
      case 'north':
        // Gap is between target bottom and source top
        return blockerRect.y >= targetRect.y + targetRect.height &&
               blockerRect.y + blockerRect.height <= sourceRect.y &&
               this._hasHorizontalOverlap(sourceRect, blockerRect)
    }
    return false
  }

  _createGlowEffect(sourceWindow, direction, linkedWindows) {
    this._destroyGlow()

    const sourceRect = sourceWindow.get_frame_rect()


    const linkedWindow = linkedWindows[0]
    const linkedRect = linkedWindow.get_frame_rect()

    let glowX, glowY, glowWidth, glowHeight

    switch (direction) {
      case 'east':
        // Center of gap = (source right edge + linked left edge) / 2
        const eastGapCenter = (sourceRect.x + sourceRect.width + linkedRect.x) / 2
        glowX = Math.round(eastGapCenter - GLOW_WIDTH / 2)
        glowY = sourceRect.y
        glowWidth = GLOW_WIDTH
        glowHeight = sourceRect.height
        break
      case 'west':
        // Center of gap = (linked right edge + source left edge) / 2
        const westGapCenter = (linkedRect.x + linkedRect.width + sourceRect.x) / 2
        glowX = Math.round(westGapCenter - GLOW_WIDTH / 2)
        glowY = sourceRect.y
        glowWidth = GLOW_WIDTH
        glowHeight = sourceRect.height
        break
      case 'south':
        // Center of gap = (source bottom edge + linked top edge) / 2
        const southGapCenter = (sourceRect.y + sourceRect.height + linkedRect.y) / 2
        glowX = sourceRect.x
        glowY = Math.round(southGapCenter - GLOW_WIDTH / 2)
        glowWidth = sourceRect.width
        glowHeight = GLOW_WIDTH
        break
      case 'north':
        // Center of gap = (linked bottom edge + source top edge) / 2
        const northGapCenter = (linkedRect.y + linkedRect.height + sourceRect.y) / 2
        glowX = sourceRect.x
        glowY = Math.round(northGapCenter - GLOW_WIDTH / 2)
        glowWidth = sourceRect.width
        glowHeight = GLOW_WIDTH
        break
    }

    this._glowActor = new St.Widget({
      style_class: 'linked-resize-glow',
      x: glowX,
      y: glowY,
      width: glowWidth,
      height: glowHeight,
      opacity: 0,
    })
    
    const color = this._getGlowColor()
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    
    this._glowActor.set_style(`
      background: rgba(${r}, ${g}, ${b}, ${GLOW_OPACITY});
      box-shadow: 0 0 ${GLOW_WIDTH * 2}px ${GLOW_WIDTH * 3}px ${color}, 0 0 ${GLOW_WIDTH * 4}px ${GLOW_WIDTH * 2}px ${color};
      border-radius: ${GLOW_WIDTH / 2}px;
      mix-blend-mode: screen;
    `)
    
    global.window_group.add_child(this._glowActor)
    
    this._animateGlowIn()
    
    this._resizeInfo.glow = {
      actor: this._glowActor,
      direction: direction,
    }
  }

  _getGlowColor() {
    const customColor = this._settings.get_string('linked-resize-glow-color')
    if (customColor && customColor.trim() !== '') {
      return customColor.trim()
    }

    return '#3584e4'
  }

  _animateGlowIn() {
    if (!this._glowActor) return

    this._glowActor.ease({
      opacity: Math.floor(255 * GLOW_OPACITY),
      duration: GLOW_ANIMATION_DURATION,
      mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
      onComplete: () => {
        if (!this._glowActor) return
        this._glowActor.ease({
          opacity: Math.floor(255 * GLOW_OPACITY),
          duration: GLOW_ANIMATION_DURATION,
          mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
        })
      },
    })
  }

  _updateGlowPosition() {
    if (!this._glowActor || !this._resizeInfo) return

    const { window, direction, linkedWindows } = this._resizeInfo
    const rect = window.get_frame_rect()

    if (!linkedWindows || linkedWindows.length === 0) return

    const linkedWindow = linkedWindows[0].window
    const linkedRect = linkedWindow.get_frame_rect()

    let x, y, width, height

    switch (direction) {
      case 'east': {
        const gapCenter = (rect.x + rect.width + linkedRect.x) / 2
        x = Math.round(gapCenter - GLOW_WIDTH / 2)
        height = Math.round(rect.height * 0.95)
        y = rect.y + Math.round((rect.height - height) / 2)
        width = GLOW_WIDTH
        break
      }
      case 'west': {
        const gapCenter = (linkedRect.x + linkedRect.width + rect.x) / 2
        x = Math.round(gapCenter - GLOW_WIDTH / 2)
        height = Math.round(rect.height * 0.95)
        y = rect.y + Math.round((rect.height - height) / 2)
        width = GLOW_WIDTH
        break
      }
      case 'south': {
        const gapCenter = (rect.y + rect.height + linkedRect.y) / 2
        width = Math.round(rect.width * 0.95)
        x = rect.x + Math.round((rect.width - width) / 2)
        y = Math.round(gapCenter - GLOW_WIDTH / 2)
        height = GLOW_WIDTH
        break
      }
      case 'north': {
        const gapCenter = (linkedRect.y + linkedRect.height + rect.y) / 2
        width = Math.round(rect.width * 0.95)
        x = rect.x + Math.round((rect.width - width) / 2)
        y = Math.round(gapCenter - GLOW_WIDTH / 2)
        height = GLOW_WIDTH
        break
      }
    }

    this._glowActor.set_position(Math.round(x), Math.round(y))
    this._glowActor.set_size(Math.round(width), Math.round(height))
  }

  _destroyGlow() {
    if (this._glowActor) {
      this._glowActor.destroy()
      this._glowActor = null
    }
  }

  syncLinkedWindows() {
    if (!this._isResizing || !this._resizeInfo) return

    const { window, direction, initialRect, linkedWindows } = this._resizeInfo
    const currentRect = window.get_frame_rect()

    const deltaW = currentRect.width - initialRect.width
    const deltaH = currentRect.height - initialRect.height
    const deltaX = currentRect.x - initialRect.x
    const deltaY = currentRect.y - initialRect.y

    for (const linked of linkedWindows) {
      const { window: linkedWindow, initialRect: linkedInitial } = linked

      let newX = linkedInitial.x
      let newY = linkedInitial.y
      let newW = linkedInitial.width
      let newH = linkedInitial.height

      switch (direction) {
        case 'east':

          newX = linkedInitial.x + deltaW
          newW = linkedInitial.width - deltaW
          break
        case 'west':

          newW = linkedInitial.width - deltaW
          break
        case 'south':

          newY = linkedInitial.y + deltaH
          newH = linkedInitial.height - deltaH
          break
        case 'north':

          newH = linkedInitial.height - deltaH
          break
      }


      if (newW <= 10 || newH <= 10) continue

      linkedWindow.move_resize_frame(
        true,
        Math.round(newX),
        Math.round(newY),
        Math.round(newW),
        Math.round(newH)
      )
    }

    this._updateGlowPosition()
  }

  _stopResize() {
    if (this._resizeTimerId) {
      GLib.Source.remove(this._resizeTimerId)
      this._resizeTimerId = 0
    }

    this._isResizing = false
    this._resizeInfo = null
    this._linkedWindows = []
    this._destroyGlow()
  }
}
