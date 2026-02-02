import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';

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

        if (window.is_maximized()) {
            const wasAnimationsEnabled = this._desktopSettings.get_boolean('enable-animations');
            if (wasAnimationsEnabled) this._desktopSettings.set_boolean('enable-animations', false);
            window.unmaximize();
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