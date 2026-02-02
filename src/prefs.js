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

import Gdk from 'gi://Gdk'
import Gio from 'gi://Gio'
import GLib from 'gi://GLib'
import Gtk from 'gi://Gtk'
import Adw from 'gi://Adw'
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import * as Utils from './prefs-utils.js'
import {
  GAP_SIZE_MAX,
  GAP_SIZE_PIXEL_MAX,
  GAP_SIZE_PIXEL_INCREMENTS,
  BOTTOM_GAP_SIZE_PIXEL_MAX,
  INDIVIDUAL_GAP_SIZE_MAX,
  INDIVIDUAL_GAP_SIZE_PIXEL_MAX,
} from './constants.js'

export default class AwesomeTilesPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings()
    const page = new Adw.PreferencesPage({
      title: _('General'),
      icon_name: 'dialog-information-symbolic',
    })

    const behaviorGroup = this._createBehaviorGroup(settings)
    const gapsGroup = this._createGapsGroup(settings)
    const shortcutsGroup = this._createShortcutsGroup(window, settings)

    page.add(behaviorGroup)
    page.add(gapsGroup)
    page.add(shortcutsGroup)

    window.add(page)
  }

  _createBehaviorGroup(settings) {
    const behaviorGroup = new Adw.PreferencesGroup({
      title: _('Behavior'),
    })

    const enableAnimationsSwitchRow = new Adw.SwitchRow({
      title: _('Enable Window Animations'),
      subtitle: _('Animate windows when resized or repositioned (this may be buggy on Wayland).'),
    })
    behaviorGroup.add(enableAnimationsSwitchRow)
    settings.bind(
      'enable-window-animation',
      enableAnimationsSwitchRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT
    )

    const nextIterationTimeoutSpinRow = new Adw.SpinRow({
      title: _('Shortcut Iteration Timeout in Milliseconds'),
      subtitle: _('The time window to consider a new key press an iteration.'),
      adjustment: new Gtk.Adjustment({
        lower: 100,
        upper: 10000,
        'step-increment': 100,
      })
    })
    behaviorGroup.add(nextIterationTimeoutSpinRow)
    settings.bind(
      'next-step-timeout',
      nextIterationTimeoutSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const centerTilingStepsEntry = new Gtk.Entry({
      valign: Gtk.Align.CENTER,
    });
    const centerTilingStepsActionRow = new Adw.ActionRow({
      title: _('Center Tiling Steps'),
      subtitle: _('Steps on each key press (values between 0-1).'),
    })
    centerTilingStepsActionRow.add_suffix(centerTilingStepsEntry)
    behaviorGroup.add(centerTilingStepsActionRow)
    settings.bind(
      'tiling-steps-center',
      centerTilingStepsEntry.buffer,
      'text',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const sideTilingStepsEntry = new Gtk.Entry({
      valign: Gtk.Align.CENTER,
    });
    const sideTilingStepsActionRow = new Adw.ActionRow({
      title: _('Side Tiling Steps'),
      subtitle: _('Steps on each key press (values between 0-1).'),
    })
    sideTilingStepsActionRow.add_suffix(sideTilingStepsEntry)
    behaviorGroup.add(sideTilingStepsActionRow)
    settings.bind(
      'tiling-steps-side',
      sideTilingStepsEntry.buffer,
      'text',
      Gio.SettingsBindFlags.DEFAULT,
    )

    return behaviorGroup
  }

  _createGapsGroup(settings) {
    const gapsGroup = new Adw.PreferencesGroup({
      title: _('Gaps'),
    })

    const gapSizeInPixelsSwitchRow = new Adw.SwitchRow({
      title: _('Use Pixels for Gap Size'),
      subtitle: _('Use pixels instead of percentage for gap size.'),
    })
    gapsGroup.add(gapSizeInPixelsSwitchRow)
    settings.bind(
      'gap-size-in-pixels',
      gapSizeInPixelsSwitchRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const gapsBetweenWindowsSwitchRow = new Adw.SwitchRow({
      title: _('Gaps Between Windows'),
      subtitle: _('Put gaps between windows.'),
    })
    gapsGroup.add(gapsBetweenWindowsSwitchRow)
    settings.bind(
      'enable-inner-gaps',
      gapsBetweenWindowsSwitchRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    )
    
    const individualGapSizesSwitchRow = new Adw.SwitchRow({
      title: _('Enable Individual Gap Sizes'),
      subtitle: _('Configure separate gap sizes for each side (top, left, bottom, right) and between windows.'),
    })
    gapsGroup.add(individualGapSizesSwitchRow)
    settings.bind(
      'enable-individual-gap-sizes',
      individualGapSizesSwitchRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    )
    
    const gapSizeTopSpinRow = new Adw.SpinRow({
      title: _('Top Gap Size'),
      subtitle: _('Gap size at the top (percent).'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 50,
        'step-increment': 1,
      })
    })
    gapsGroup.add(gapSizeTopSpinRow)
    settings.bind(
      'gap-size-top',
      gapSizeTopSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const gapSizeLeftSpinRow = new Adw.SpinRow({
      title: _('Left Gap Size'),
      subtitle: _('Gap size at the left (percent).'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 50,
        'step-increment': 1,
      })
    })
    gapsGroup.add(gapSizeLeftSpinRow)
    settings.bind(
      'gap-size-left',
      gapSizeLeftSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const gapSizeRightSpinRow = new Adw.SpinRow({
      title: _('Right Gap Size'),
      subtitle: _('Gap size at the right (percent).'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 50,
        'step-increment': 1,
      })
    })
    gapsGroup.add(gapSizeRightSpinRow)
    settings.bind(
      'gap-size-right',
      gapSizeRightSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const gapSizeBottomSpinRow = new Adw.SpinRow({
      title: _('Bottom Gap Size'),
      subtitle: _('Gap size at the bottom (percent).'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 50,
        'step-increment': 1,
      })
    })
    gapsGroup.add(gapSizeBottomSpinRow)
    settings.bind(
      'gap-size-bottom',
      gapSizeBottomSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const gapSizeInnerSpinRow = new Adw.SpinRow({
      title: _('Inner Gap Size'),
      subtitle: _('Gap size between windows (percent).'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 50,
        'step-increment': 1,
      })
    })
    gapsGroup.add(gapSizeInnerSpinRow)
    settings.bind(
      'gap-size-inner',
      gapSizeInnerSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const individualGapRows = [
      gapSizeTopSpinRow,
      gapSizeLeftSpinRow,
      gapSizeRightSpinRow,
      gapSizeBottomSpinRow,
      gapSizeInnerSpinRow,
    ]

    const updateIndividualGapRows = () => {
      const useIndividual = settings.get_boolean('enable-individual-gap-sizes')
      const usePixels = settings.get_boolean('gap-size-in-pixels')

      
      individualGapRows.forEach(row => {
        row.visible = useIndividual
      })

      const maxValue = usePixels ? INDIVIDUAL_GAP_SIZE_PIXEL_MAX : INDIVIDUAL_GAP_SIZE_MAX
      const stepIncrement = usePixels ? GAP_SIZE_PIXEL_INCREMENTS : 1
      
      const unit = usePixels ? _('pixels') : _('percent')
      gapSizeTopSpinRow.subtitle = `${_('Gap size at the top')} (${unit})`
      gapSizeLeftSpinRow.subtitle = `${_('Gap size at the left')} (${unit})`
      gapSizeRightSpinRow.subtitle = `${_('Gap size at the right')} (${unit})`
      gapSizeBottomSpinRow.subtitle = `${_('Gap size at the bottom')} (${unit})`
      gapSizeInnerSpinRow.subtitle = `${_('Gap size between windows')} (${unit})`

      individualGapRows.forEach(row => {
        row.adjustment.upper = maxValue
        row.adjustment.step_increment = stepIncrement
      })
    }

    settings.connect('changed::enable-individual-gap-sizes', updateIndividualGapRows)
    settings.connect('changed::gap-size-in-pixels', updateIndividualGapRows)
    updateIndividualGapRows()

    const gapSizeSpinRow = new Adw.SpinRow({
      title: _('Gap Between Window and Workspace'),
      subtitle: _('Percentage to leave out as gap when a window is tiled.'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 25,
        'step-increment': 1,
      })
    })
    gapsGroup.add(gapSizeSpinRow)
    settings.bind(
      'gap-size',
      gapSizeSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )
    
    const updateGapSizeRow = () => {
      const usePixels = settings.get_boolean('gap-size-in-pixels')
      const useIndividual = settings.get_boolean('enable-individual-gap-sizes')
      gapSizeSpinRow.subtitle = usePixels
        ? _('Pixels to leave out as gap when a window is tiled.')
        : _('Percentage to leave out as gap when a window is tiled.')
      gapSizeSpinRow.adjustment.upper = usePixels ? GAP_SIZE_PIXEL_MAX : GAP_SIZE_MAX
      gapSizeSpinRow.adjustment.step_increment = usePixels ? GAP_SIZE_PIXEL_INCREMENTS : 1
      gapSizeSpinRow.visible = !useIndividual
    }
    settings.connect('changed::gap-size-in-pixels', updateGapSizeRow)
    settings.connect('changed::enable-individual-gap-sizes', updateGapSizeRow)
    updateGapSizeRow()

    const gapSizeIncrementsSpinRow = new Adw.SpinRow({
      title: _('Gap Size Increments'),
      subtitle: _('The change that the shorcuts make in the gap size.'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 25,
        'step-increment': 1,
      })
    })
    gapsGroup.add(gapSizeIncrementsSpinRow)
    settings.bind(
      'gap-size-increments',
      gapSizeIncrementsSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const updateIncrementsRow = () => {
      const usePixels = settings.get_boolean('gap-size-in-pixels')
      gapSizeIncrementsSpinRow.adjustment.upper = usePixels ? GAP_SIZE_PIXEL_MAX : GAP_SIZE_MAX
      gapSizeIncrementsSpinRow.adjustment.step_increment = usePixels ? GAP_SIZE_PIXEL_INCREMENTS : 1
    }
    settings.connect('changed::gap-size-in-pixels', updateIncrementsRow)
    updateIncrementsRow()
    
    const bottomGapSwitchRow = new Adw.SwitchRow({
      title: _('Enable Additional Bottom Gap'),
      subtitle: _('Add an additional gap at the bottom of the screen to prevent dock overlap.'),
    })
    gapsGroup.add(bottomGapSwitchRow)
    settings.bind(
      'enable-bottom-gap',
      bottomGapSwitchRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const bottomGapSizeSpinRow = new Adw.SpinRow({
      title: _('Bottom Gap Size'),
      subtitle: _('Additional gap size at the bottom of the screen in percentage.'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 50,
        'step-increment': 1,
      })
    })
    gapsGroup.add(bottomGapSizeSpinRow)
    settings.bind(
      'bottom-gap-size',
      bottomGapSizeSpinRow,
      'value',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const updateBottomGapSizeRow = () => {
      const usePixels = settings.get_boolean('gap-size-in-pixels')
      bottomGapSizeSpinRow.subtitle = usePixels
        ? _('Additional gap size at the bottom of the screen in pixels.')
        : _('Additional gap size at the bottom of the screen in percentage.')
      bottomGapSizeSpinRow.adjustment.upper = usePixels ? BOTTOM_GAP_SIZE_PIXEL_MAX : 50
      bottomGapSizeSpinRow.adjustment.step_increment = usePixels ? GAP_SIZE_PIXEL_INCREMENTS : 5
    }
    settings.connect('changed::gap-size-in-pixels', updateBottomGapSizeRow)
    updateBottomGapSizeRow()

    const bottomGapMainScreenOnlySwitchRow = new Adw.SwitchRow({
      title: _('Bottom Gap Main Screen Only'),
      subtitle: _('Apply the additional bottom gap only on the main screen.'),
    })
    gapsGroup.add(bottomGapMainScreenOnlySwitchRow)
    settings.bind(
      'bottom-gap-main-screen-only',
      bottomGapMainScreenOnlySwitchRow,
      'active',
      Gio.SettingsBindFlags.DEFAULT,
    )

    const updateBottomGapVisibility = () => {
      const enabled = settings.get_boolean('enable-bottom-gap')
      bottomGapSizeSpinRow.visible = enabled
      bottomGapMainScreenOnlySwitchRow.visible = enabled
    }
    settings.connect('changed::enable-bottom-gap', updateBottomGapVisibility)
    updateBottomGapVisibility()

    return gapsGroup
  }

  _createShortcutsGroup(window, settings) {
    const shortcutsGroup = new Adw.PreferencesGroup({
      title: _('Shortcuts'),
      description: _('Assign shortcuts to the functionalities'),
    })

    const workspaceSwitchLeftButton = new Gtk.Button({
      name: 'shortcut-workspace-switch-left',
      valign: Gtk.Align.CENTER,
    })
    const workspaceSwitchLeftActionRow = new Adw.ActionRow({
      title: _('Switch to Workspace Left'),
      subtitle: _('Shortcut to switch to the workspace on the left.'),
    })
    workspaceSwitchLeftActionRow.add_suffix(workspaceSwitchLeftButton)
    shortcutsGroup.add(workspaceSwitchLeftActionRow)

    const workspaceSwitchRightButton = new Gtk.Button({
      name: 'shortcut-workspace-switch-right',
      valign: Gtk.Align.CENTER,
    })
    const workspaceSwitchRightActionRow = new Adw.ActionRow({
      title: _('Switch to Workspace Right'),
      subtitle: _('Shortcut to switch to the workspace on the right.'),
    })
    workspaceSwitchRightActionRow.add_suffix(workspaceSwitchRightButton)
    shortcutsGroup.add(workspaceSwitchRightActionRow)

    const workspaceMoveLeftButton = new Gtk.Button({
      name: 'shortcut-workspace-move-left',
      valign: Gtk.Align.CENTER,
    })
    const workspaceMoveLeftActionRow = new Adw.ActionRow({
      title: _('Move Window to Workspace Left'),
      subtitle: _('Shortcut to move the focused window to the workspace on the left.'),
    })
    workspaceMoveLeftActionRow.add_suffix(workspaceMoveLeftButton)
    shortcutsGroup.add(workspaceMoveLeftActionRow)

    const workspaceMoveRightButton = new Gtk.Button({
      name: 'shortcut-workspace-move-right',
      valign: Gtk.Align.CENTER,
    })
    const workspaceMoveRightActionRow = new Adw.ActionRow({
      title: _('Move Window to Workspace Right'),
      subtitle: _('Shortcut to move the focused window to the workspace on the right.'),
    })
    workspaceMoveRightActionRow.add_suffix(workspaceMoveRightButton)
    shortcutsGroup.add(workspaceMoveRightActionRow)

    const alignWindowToCenterButton = new Gtk.Button({
      name: 'shortcut-align-window-to-center',
      valign: Gtk.Align.CENTER,
    })
    const alignWindowToCenterActionRow = new Adw.ActionRow({
      title: _('Align Window to Center'),
      subtitle: _('Shortcut to align the active window to center without resizing it.'),
    })
    alignWindowToCenterActionRow.add_suffix(alignWindowToCenterButton)
    shortcutsGroup.add(alignWindowToCenterActionRow)

    const incrementGapSizeButton = new Gtk.Button({
      name: 'shortcut-increase-gap-size',
      valign: Gtk.Align.CENTER,
    })
    const incrementGapSizeActionRow = new Adw.ActionRow({
      title: _('Increase Gap Size'),
      subtitle: _('Shortcut to increase the gap size.'),
    })
    incrementGapSizeActionRow.add_suffix(incrementGapSizeButton)
    shortcutsGroup.add(incrementGapSizeActionRow)

    const decreaseGapSizeButton = new Gtk.Button({
      name: 'shortcut-decrease-gap-size',
      valign: Gtk.Align.CENTER,
    })
    const decreaseGapSizeActionRow = new Adw.ActionRow({
      title: _('Decrease Gap Size'),
      subtitle: _('Shortcut to decrease the gap size.'),
    })
    decreaseGapSizeActionRow.add_suffix(decreaseGapSizeButton)
    shortcutsGroup.add(decreaseGapSizeActionRow)

    const tileWindowToCenterButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-center',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToCenterActionRow = new Adw.ActionRow({
      title: _('Tile Window to Center'),
      subtitle: _('Shortcut to tile active window to center.'),
    })
    tileWindowToCenterActionRow.add_suffix(tileWindowToCenterButton)
    shortcutsGroup.add(tileWindowToCenterActionRow)

    const tileWindowToLeftButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-left',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToLeftActionRow = new Adw.ActionRow({
      title: _('Tile Window to Left'),
      subtitle: _('Shortcut to tile the active window to left.'),
    })
    tileWindowToLeftActionRow.add_suffix(tileWindowToLeftButton)
    shortcutsGroup.add(tileWindowToLeftActionRow)

    const tileWindowToRightButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-right',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToRightActionRow = new Adw.ActionRow({
      title: _('Tile Window to Right'),
      subtitle: _('Shortcut to tile the active window to right.'),
    })
    tileWindowToRightActionRow.add_suffix(tileWindowToRightButton)
    shortcutsGroup.add(tileWindowToRightActionRow)

    const tileWindowToTopButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-top',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToTopActionRow = new Adw.ActionRow({
      title: _('Tile Window to Top'),
      subtitle: _('Shortcut to tile the active window to top.'),
    })
    tileWindowToTopActionRow.add_suffix(tileWindowToTopButton)
    shortcutsGroup.add(tileWindowToTopActionRow)

    const tileWindowToBottomButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-bottom',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToBottomActionRow = new Adw.ActionRow({
      title: _('Tile Window to Bottom'),
      subtitle: _('Shortcut to tile the active window to bottom.'),
    })
    tileWindowToBottomActionRow.add_suffix(tileWindowToBottomButton)
    shortcutsGroup.add(tileWindowToBottomActionRow)

    const tileWindowToTopLeftButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-top-left',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToTopLeftActionRow = new Adw.ActionRow({
      title: _('Tile Window to Top Left'),
      subtitle: _('Shortcut to tile the active window to top left.'),
    })
    tileWindowToTopLeftActionRow.add_suffix(tileWindowToTopLeftButton)
    shortcutsGroup.add(tileWindowToTopLeftActionRow)

    const tileWindowToTopRightButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-top-right',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToTopRightActionRow = new Adw.ActionRow({
      title: _('Tile Window to Top Right'),
      subtitle: _('Shortcut to tile the active window to top right.'),
    })

    tileWindowToTopRightActionRow.add_suffix(tileWindowToTopRightButton)
    shortcutsGroup.add(tileWindowToTopRightActionRow)

    const tileWindowToBottomLeftButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-bottom-left',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToBottomLeftActionRow = new Adw.ActionRow({
      title: _('Tile Window to Bottom Left'),
      subtitle: _('Shortcut to tile the active window to bottom left.'),
    })
    tileWindowToBottomLeftActionRow.add_suffix(tileWindowToBottomLeftButton)
    shortcutsGroup.add(tileWindowToBottomLeftActionRow)

    const tileWindowToBottomRightButton = new Gtk.Button({
      name: 'shortcut-tile-window-to-bottom-right',
      valign: Gtk.Align.CENTER,
    })
    const tileWindowToBottomRightActionRow = new Adw.ActionRow({
      title: _('Tile Window to Bottom Right'),
      subtitle: _('Shortcut to tile the active window to bottom right.'),
    })
    tileWindowToBottomRightActionRow.add_suffix(tileWindowToBottomRightButton)
    shortcutsGroup.add(tileWindowToBottomRightActionRow)

    this._bindShortcutSettings(window, settings, [
      workspaceSwitchLeftButton,
      workspaceSwitchRightButton,
      workspaceMoveLeftButton,
      workspaceMoveRightButton,
      alignWindowToCenterButton,
      incrementGapSizeButton,
      decreaseGapSizeButton,
      tileWindowToCenterButton,
      tileWindowToLeftButton,
      tileWindowToRightButton,
      tileWindowToTopButton,
      tileWindowToBottomButton,
      tileWindowToTopLeftButton,
      tileWindowToTopRightButton,
      tileWindowToBottomLeftButton,
      tileWindowToBottomRightButton,
    ])

    return shortcutsGroup
  }

  _bindShortcutSettings(window, settings, widgets) {
    widgets.forEach((widget) => {
      settings.connect("changed::" + widget.get_name(), () => {
        this._reloadShortcutWidget(settings, widget)
      })
      widget.connect("clicked", () => {
        this._onAssignShortcut(window, settings, widget)
      })
    })
    this._reloadShortcutWidgets(settings, widgets)
  }

  _onAssignShortcut(window, settings, widget) {
    const dialog = new ShortcutDialog(this.path, settings, widget.get_name())
    dialog.set_transient_for(window)
    dialog.present()
  }

  _reloadShortcutWidget(settings, widget) {
    const shortcut = settings.get_strv(widget.get_name())
    widget.label = shortcut?.length > 0 ? shortcut[0] : _('Disabled');
  }

  _reloadShortcutWidgets(settings, widgets) {
    widgets.forEach((widget) => {
      this._reloadShortcutWidget(settings, widget)
    })
  }
}

class ShortcutDialog {
  constructor(path, settings, shortcut) {
    this._builder = new Gtk.Builder()
    this._builder.add_from_file(GLib.build_filenamev([path, 'prefs-shortcut-dialog.ui']))

    this.widget = this._builder.get_object('dialog')

    this._connectSettings(settings, shortcut)

    return this.widget
  }

  _connectSettings(settings, shortcut) {
    const eventController = this._builder.get_object('event-controller')
    eventController.connect('key-pressed', (_widget, keyval, keycode, state) => {
      let mask = state & Gtk.accelerator_get_default_mod_mask()
      mask &= ~Gdk.ModifierType.LOCK_MASK

      if (mask === 0 && keyval === Gdk.KEY_Escape) {
        this.widget.visible = false
        return Gdk.EVENT_STOP
      }

      if (keyval === Gdk.KEY_BackSpace) {
        settings.set_strv(shortcut, [])
        this.widget.close()
      } else if (Utils.isBindingValid({ mask, keycode, keyval }) && Utils.isAccelValid({ mask, keyval })) {
        const binding = Gtk.accelerator_name_with_keycode(
          null,
          keyval,
          keycode,
          mask
        )
        settings.set_strv(shortcut, [binding])
        this.widget.close()
      }

      return Gdk.EVENT_STOP
    })
  }
}
