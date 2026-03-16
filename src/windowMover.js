/*
 * Copyright (C) 2021 Pim Snel (https://github.com/mipmip)
 * Copyright (C) 2021 Veli Tasalı (https://github.com/velitasali)
 * Copyright (C) 2026 Samet Güzeldemirci (https://github.com/samex)
 *
 * Contributors:
 * - qwreey (https://github.com/qwreey)
 * - mhecher-sc (https://github.com/mhecher-sc)
 * - FedericoCalzoni (https://github.com/FedericoCalzoni)
 * - Dolland (https://github.com/Dolland)
 * - Vistaus (https://github.com/Vistaus)
 * - nushoin (https://github.com/nushoin)
 * - lazydays79 (https://github.com/lazydays79)
 * - guillaumecle (https://github.com/guillaumecle)
 * - Chake96 (https://github.com/Chake96)
 * - Soupolait (https://github.com/Soupolait)
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

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';

export class WindowMover {
    constructor() {
        this._desktopSettings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' })
    }

    destroy() {
        this._desktopSettings = null;
    }

    _setWindowRect(window, x, y, width, height, animate) {
        if (!window) return;
        const actor = window.get_compositor_private();
        if (!actor || !animate) {
            window.move_resize_frame(true, x, y, width, height);
            return;
        }
        const oldRect = window.get_frame_rect();

        const isMaximized = (window.get_maximized && window.get_maximized() !== Meta.MaximizeFlags.NONE) ||
                           (window.maximized_horizontally || window.maximized_vertically);

        if (isMaximized) {
            const wasAnimationsEnabled = this._desktopSettings.get_boolean('enable-animations');
            if (wasAnimationsEnabled) this._desktopSettings.set_boolean('enable-animations', false);
            window.unmaximize(Meta.MaximizeFlags.BOTH);
            if (wasAnimationsEnabled) this._desktopSettings.set_boolean('enable-animations', true);
        }

        const changeX = oldRect.x - x;
        const changeY = oldRect.y - y;
        const scaleX = oldRect.width / width;
        const scaleY = oldRect.height / height;

        actor.remove_all_transitions();
        actor.freeze();

        actor.set({
            translation_x: changeX,
            translation_y: changeY,
            scale_x: scaleX,
            scale_y: scaleY
        });

        window.move_resize_frame(true, x, y, width, height);

        actor.thaw();

        actor.ease({
            translation_x: 0,
            translation_y: 0,
            scale_x: 1.0,
            scale_y: 1.0,
            duration: 280,

            mode: Clutter.AnimationMode.EASE_OUT_QUINT,

            onComplete: () => {
                actor.set({
                    translation_x: 0,
                    translation_y: 0,
                    scale_x: 1.0,
                    scale_y: 1.0
                });
            }
        });
    }
}