import { AdvancedDynamicTexture, Control, Ellipse, Button, TextBlock, Rectangle, Image } from "babylonjs-gui";
import { Player } from "./Player";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ControlLayout {
    leftPx: number;    // offset from anchor edge
    topPx: number;     // offset from anchor edge
    widthPx: number;
    heightPx: number;
}

interface FullLayout {
    leftStick: ControlLayout;
    rightStick: ControlLayout;
    shoot: ControlLayout;
    jump: ControlLayout;
    reload: ControlLayout;
    sprint: ControlLayout;
    pause: ControlLayout;
}

const STORAGE_KEY = "wasteland_controls_layout";

// ─── Defaults (non-overlapping) ──────────────────────────────────────────────

function defaultLayout(): FullLayout {
    return {
        leftStick:  { leftPx: 30,  topPx: -30,  widthPx: 150, heightPx: 150 },
        rightStick: { leftPx: -30, topPx: -30,  widthPx: 150, heightPx: 150 },
        shoot:      { leftPx: -210, topPx: -40,  widthPx: 80,  heightPx: 80 },
        jump:       { leftPx: -300, topPx: -120, widthPx: 70,  heightPx: 70 },
        reload:     { leftPx: -210, topPx: -140, widthPx: 60,  heightPx: 60 },
        sprint:     { leftPx: 30,   topPx: -200, widthPx: 70,  heightPx: 70 },
        pause:      { leftPx: -20,  topPx: 20,   widthPx: 50,  heightPx: 50 },
    };
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class MobileControlsManager {
    private ui: AdvancedDynamicTexture;
    private player: Player;
    private layout: FullLayout;
    private controls: Map<string, Control> = new Map();
    private editMode: boolean = false;
    private editOverlays: Control[] = [];
    private editBtn: Button;
    private doneBtn: Button;
    private resetBtn: Button;
    private onTogglePause: () => void;

    constructor(ui: AdvancedDynamicTexture, player: Player, onTogglePause: () => void) {
        this.ui = ui;
        this.player = player;
        this.onTogglePause = onTogglePause;
        this.layout = this.loadLayout();
        this.createControls();
    }

    // ─── Persistence ─────────────────────────────────────────────────────

    private loadLayout(): FullLayout {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as FullLayout;
                // Validate it has all keys
                const def = defaultLayout();
                for (const key of Object.keys(def)) {
                    if (!(key in parsed)) return def;
                }
                return parsed;
            }
        } catch { /* ignore */ }
        return defaultLayout();
    }

    private saveLayout() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.layout));
    }

    // ─── Apply layout to a control ───────────────────────────────────────

    private applyLayout(ctrl: Control, cfg: ControlLayout, hAlign: number, vAlign: number) {
        ctrl.horizontalAlignment = hAlign;
        ctrl.verticalAlignment = vAlign;
        ctrl.widthInPixels = cfg.widthPx;
        ctrl.heightInPixels = cfg.heightPx;
        ctrl.left = cfg.leftPx + "px";
        ctrl.top = cfg.topPx + "px";
    }

    // ─── Create all controls ─────────────────────────────────────────────

    private createControls() {
        this.createLeftStick();
        this.createRightStick();
        this.createShootButton();
        this.createJumpButton();
        this.createReloadButton();
        this.createSprintButton();
        this.createPauseButton();
        this.createEditButton();
    }

    // ─── Left Stick (Movement) ───────────────────────────────────────────

    private createLeftStick() {
        const cfg = this.layout.leftStick;

        const container = new Ellipse("leftStickContainer");
        container.color = "rgba(255,255,255,0.5)";
        container.thickness = 2;
        container.background = "rgba(0,0,0,0.15)";
        container.isPointerBlocker = true;
        this.applyLayout(container, cfg, Control.HORIZONTAL_ALIGNMENT_LEFT, Control.VERTICAL_ALIGNMENT_BOTTOM);
        this.ui.addControl(container);
        this.controls.set("leftStick", container);

        const puck = new Ellipse("leftPuck");
        puck.width = "40px";
        puck.height = "40px";
        puck.color = "transparent";
        puck.thickness = 0;
        puck.background = "rgba(255,255,255,0.6)";
        container.addControl(puck);

        let pointerDown = false;
        let pointerId = -1;

        container.onPointerDownObservable.add((coords: any) => {
            if (this.editMode) return;
            pointerDown = true;
            pointerId = coords.pointerId;
            puck.background = "rgba(255,255,255,0.9)";
        });

        container.onPointerUpObservable.add((coords: any) => {
            if (coords.pointerId === pointerId) {
                pointerDown = false;
                puck.left = 0; puck.top = 0;
                puck.background = "rgba(255,255,255,0.6)";
                this.player.setVirtualInput("w", false);
                this.player.setVirtualInput("s", false);
                this.player.setVirtualInput("a", false);
                this.player.setVirtualInput("d", false);
            }
        });

        container.onPointerMoveObservable.add((coords: any) => {
            if (!pointerDown || this.editMode) return;
            const radius = cfg.widthPx / 2;
            let dx = coords.x - container.centerX;
            let dy = coords.y - container.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius) { dx = (dx / dist) * radius; dy = (dy / dist) * radius; }
            puck.left = dx + "px"; puck.top = dy + "px";
            const deadzone = 20;
            this.player.setVirtualInput("w", dy < -deadzone);
            this.player.setVirtualInput("s", dy > deadzone);
            this.player.setVirtualInput("a", dx < -deadzone);
            this.player.setVirtualInput("d", dx > deadzone);
        });
    }

    // ─── Right Stick (Look) ──────────────────────────────────────────────

    private createRightStick() {
        const cfg = this.layout.rightStick;

        const container = new Ellipse("rightStickContainer");
        container.color = "rgba(255,255,255,0.5)";
        container.thickness = 2;
        container.background = "rgba(0,0,0,0.15)";
        container.isPointerBlocker = true;
        this.applyLayout(container, cfg, Control.HORIZONTAL_ALIGNMENT_RIGHT, Control.VERTICAL_ALIGNMENT_BOTTOM);
        this.ui.addControl(container);
        this.controls.set("rightStick", container);

        const puck = new Ellipse("rightPuck");
        puck.width = "40px";
        puck.height = "40px";
        puck.color = "transparent";
        puck.thickness = 0;
        puck.background = "rgba(255,255,255,0.6)";
        container.addControl(puck);

        let pointerDown = false;
        let pointerId = -1;

        container.onPointerDownObservable.add((coords: any) => {
            if (this.editMode) return;
            pointerDown = true;
            pointerId = coords.pointerId;
            puck.background = "rgba(255,255,255,0.9)";
        });

        container.onPointerUpObservable.add((coords: any) => {
            if (coords.pointerId === pointerId) {
                pointerDown = false;
                puck.left = 0; puck.top = 0;
                puck.background = "rgba(255,255,255,0.6)";
            }
        });

        container.onPointerMoveObservable.add((coords: any) => {
            if (!pointerDown || this.editMode) return;
            const radius = cfg.widthPx / 2;
            let dx = coords.x - container.centerX;
            let dy = coords.y - container.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius) { dx = (dx / dist) * radius; dy = (dy / dist) * radius; }
            puck.left = dx + "px"; puck.top = dy + "px";
            this.player.handleVirtualLook(dx * 0.1, dy * 0.1);
        });
    }

    // ─── Action buttons ──────────────────────────────────────────────────

    private createShootButton() {
        const cfg = this.layout.shoot;
        const btn = Button.CreateSimpleButton("shootBtn", "🔫");
        btn.cornerRadius = cfg.widthPx / 2;
        btn.color = "white";
        btn.background = "rgba(255, 50, 50, 0.45)";
        btn.fontSize = 28;
        this.applyLayout(btn, cfg, Control.HORIZONTAL_ALIGNMENT_RIGHT, Control.VERTICAL_ALIGNMENT_BOTTOM);
        btn.onPointerDownObservable.add(() => { if (!this.editMode) this.player.setVirtualInput("mouseLeft", true); });
        btn.onPointerUpObservable.add(() => { this.player.setVirtualInput("mouseLeft", false); });
        this.ui.addControl(btn);
        this.controls.set("shoot", btn);
    }

    private createJumpButton() {
        const cfg = this.layout.jump;
        const btn = Button.CreateSimpleButton("jumpBtn", "JUMP");
        btn.cornerRadius = cfg.widthPx / 2;
        btn.color = "white";
        btn.background = "rgba(50, 200, 50, 0.45)";
        btn.fontSize = 16;
        this.applyLayout(btn, cfg, Control.HORIZONTAL_ALIGNMENT_RIGHT, Control.VERTICAL_ALIGNMENT_BOTTOM);
        btn.onPointerDownObservable.add(() => { if (!this.editMode) this.player.setVirtualInput(" ", true); });
        btn.onPointerUpObservable.add(() => { this.player.setVirtualInput(" ", false); });
        this.ui.addControl(btn);
        this.controls.set("jump", btn);
    }

    private createReloadButton() {
        const cfg = this.layout.reload;
        const btn = Button.CreateSimpleButton("reloadBtn", "R");
        btn.cornerRadius = cfg.widthPx / 2;
        btn.color = "white";
        btn.background = "rgba(50, 100, 255, 0.45)";
        btn.fontSize = 18;
        this.applyLayout(btn, cfg, Control.HORIZONTAL_ALIGNMENT_RIGHT, Control.VERTICAL_ALIGNMENT_BOTTOM);
        btn.onPointerClickObservable.add(() => {
            if (this.editMode) return;
            this.player.setVirtualInput("r", true);
            setTimeout(() => this.player.setVirtualInput("r", false), 100);
        });
        this.ui.addControl(btn);
        this.controls.set("reload", btn);
    }

    private createSprintButton() {
        const cfg = this.layout.sprint;
        const btn = Button.CreateSimpleButton("sprintBtn", "RUN");
        btn.cornerRadius = cfg.widthPx / 2;
        btn.color = "white";
        btn.background = "rgba(255, 165, 0, 0.45)";
        btn.fontSize = 16;
        this.applyLayout(btn, cfg, Control.HORIZONTAL_ALIGNMENT_LEFT, Control.VERTICAL_ALIGNMENT_BOTTOM);
        btn.onPointerDownObservable.add(() => { if (!this.editMode) this.player.setVirtualInput("shift", true); });
        btn.onPointerUpObservable.add(() => { this.player.setVirtualInput("shift", false); });
        this.ui.addControl(btn);
        this.controls.set("sprint", btn);
    }

    private createPauseButton() {
        const cfg = this.layout.pause;
        const btn = Button.CreateSimpleButton("pauseBtn", "| |");
        btn.cornerRadius = 10;
        btn.color = "white";
        btn.background = "rgba(0, 0, 0, 0.5)";
        btn.fontSize = 16;
        this.applyLayout(btn, cfg, Control.HORIZONTAL_ALIGNMENT_RIGHT, Control.VERTICAL_ALIGNMENT_TOP);
        btn.onPointerClickObservable.add(() => { if (!this.editMode) this.onTogglePause(); });
        this.ui.addControl(btn);
        this.controls.set("pause", btn);
    }

    // ─── Edit Layout Button (always visible, top-left) ──────────────────

    private createEditButton() {
        // Edit button
        this.editBtn = Button.CreateSimpleButton("editLayoutBtn", "✏️");
        this.editBtn.width = "44px";
        this.editBtn.height = "44px";
        this.editBtn.cornerRadius = 8;
        this.editBtn.color = "white";
        this.editBtn.background = "rgba(0,0,0,0.5)";
        this.editBtn.fontSize = 20;
        this.editBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.editBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.editBtn.left = "-75px";
        this.editBtn.top = "20px";
        this.editBtn.onPointerClickObservable.add(() => this.enterEditMode());
        this.ui.addControl(this.editBtn);

        // Done button (hidden until edit mode)
        this.doneBtn = Button.CreateSimpleButton("doneLayoutBtn", "✓ DONE");
        this.doneBtn.width = "100px";
        this.doneBtn.height = "44px";
        this.doneBtn.cornerRadius = 8;
        this.doneBtn.color = "white";
        this.doneBtn.background = "rgba(0,180,0,0.8)";
        this.doneBtn.fontSize = 18;
        this.doneBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.doneBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.doneBtn.top = "20px";
        this.doneBtn.left = "0px";
        this.doneBtn.isVisible = false;
        this.doneBtn.onPointerClickObservable.add(() => this.exitEditMode());
        this.ui.addControl(this.doneBtn);

        // Reset button (hidden until edit mode)
        this.resetBtn = Button.CreateSimpleButton("resetLayoutBtn", "↺ RESET");
        this.resetBtn.width = "100px";
        this.resetBtn.height = "44px";
        this.resetBtn.cornerRadius = 8;
        this.resetBtn.color = "white";
        this.resetBtn.background = "rgba(200,0,0,0.8)";
        this.resetBtn.fontSize = 18;
        this.resetBtn.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.resetBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.resetBtn.top = "20px";
        this.resetBtn.left = "120px";
        this.resetBtn.isVisible = false;
        this.resetBtn.onPointerClickObservable.add(() => this.resetLayout());
        this.ui.addControl(this.resetBtn);
    }

    // ─── Edit Mode ───────────────────────────────────────────────────────

    private enterEditMode() {
        this.editMode = true;
        this.editBtn.isVisible = false;
        this.doneBtn.isVisible = true;
        this.resetBtn.isVisible = true;

        // Add drag + scale handles for each movable control
        const editableKeys: Array<{ key: string; hAlign: number; vAlign: number }> = [
            { key: "leftStick",  hAlign: Control.HORIZONTAL_ALIGNMENT_LEFT,  vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "rightStick", hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "shoot",      hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "jump",       hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "reload",     hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "sprint",     hAlign: Control.HORIZONTAL_ALIGNMENT_LEFT,  vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
        ];

        for (const { key, hAlign, vAlign } of editableKeys) {
            const ctrl = this.controls.get(key);
            if (!ctrl) continue;

            // Highlight border
            if (ctrl instanceof Ellipse) {
                ctrl.color = "rgba(0, 200, 255, 0.9)";
                ctrl.thickness = 3;
            } else if (ctrl instanceof Button) {
                ctrl.thickness = 3;
                ctrl.color = "rgba(0, 200, 255, 0.9)";
            }

            // Label
            const label = new TextBlock(key + "_editLabel");
            label.text = key.toUpperCase();
            label.color = "cyan";
            label.fontSize = 11;
            label.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
            label.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
            label.top = "-16px";
            label.heightInPixels = 16;
            label.widthInPixels = 100;
            label.horizontalAlignment = ctrl.horizontalAlignment;
            label.verticalAlignment = ctrl.verticalAlignment;
            label.left = ctrl.left;
            // Position label just above the control
            const ctrlTopPx = (this.layout as any)[key].topPx;
            const ctrlH = (this.layout as any)[key].heightPx;
            label.top = (ctrlTopPx - ctrlH / 2 - 18) + "px";
            this.ui.addControl(label);
            this.editOverlays.push(label);

            // Scale buttons
            const layoutCfg = (this.layout as any)[key] as ControlLayout;
            this.createScaleButtons(key, ctrl, layoutCfg, hAlign, vAlign);

            // Drag handling
            this.enableDrag(key, ctrl, layoutCfg, hAlign, vAlign);
        }
    }

    private createScaleButtons(key: string, ctrl: Control, cfg: ControlLayout, hAlign: number, vAlign: number) {
        const plusBtn = Button.CreateSimpleButton(key + "_plus", "+");
        plusBtn.width = "30px";
        plusBtn.height = "30px";
        plusBtn.cornerRadius = 15;
        plusBtn.color = "white";
        plusBtn.background = "rgba(0,180,0,0.8)";
        plusBtn.fontSize = 20;
        plusBtn.horizontalAlignment = hAlign;
        plusBtn.verticalAlignment = vAlign;
        // Position to the right-bottom of the control
        const offsetX = hAlign === Control.HORIZONTAL_ALIGNMENT_LEFT ? cfg.leftPx + cfg.widthPx / 2 + 20 : cfg.leftPx - cfg.widthPx / 2 - 20;
        plusBtn.left = offsetX + "px";
        plusBtn.top = (cfg.topPx - cfg.heightPx / 2 - 20) + "px";
        plusBtn.onPointerClickObservable.add(() => {
            cfg.widthPx = Math.min(250, cfg.widthPx + 10);
            cfg.heightPx = Math.min(250, cfg.heightPx + 10);
            this.applyLayout(ctrl, cfg, hAlign, vAlign);
            if (ctrl instanceof Ellipse || ctrl instanceof Button) {
                (ctrl as any).cornerRadius = cfg.widthPx / 2;
            }
        });
        this.ui.addControl(plusBtn);
        this.editOverlays.push(plusBtn);

        const minusBtn = Button.CreateSimpleButton(key + "_minus", "−");
        minusBtn.width = "30px";
        minusBtn.height = "30px";
        minusBtn.cornerRadius = 15;
        minusBtn.color = "white";
        minusBtn.background = "rgba(200,0,0,0.8)";
        minusBtn.fontSize = 20;
        minusBtn.horizontalAlignment = hAlign;
        minusBtn.verticalAlignment = vAlign;
        const offsetXMinus = hAlign === Control.HORIZONTAL_ALIGNMENT_LEFT ? cfg.leftPx - cfg.widthPx / 2 - 20 : cfg.leftPx + cfg.widthPx / 2 + 20;
        minusBtn.left = offsetXMinus + "px";
        minusBtn.top = (cfg.topPx - cfg.heightPx / 2 - 20) + "px";
        minusBtn.onPointerClickObservable.add(() => {
            cfg.widthPx = Math.max(40, cfg.widthPx - 10);
            cfg.heightPx = Math.max(40, cfg.heightPx - 10);
            this.applyLayout(ctrl, cfg, hAlign, vAlign);
            if (ctrl instanceof Ellipse || ctrl instanceof Button) {
                (ctrl as any).cornerRadius = cfg.widthPx / 2;
            }
        });
        this.ui.addControl(minusBtn);
        this.editOverlays.push(minusBtn);
    }

    private enableDrag(key: string, ctrl: Control, cfg: ControlLayout, hAlign: number, vAlign: number) {
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let origLeft = 0;
        let origTop = 0;

        ctrl.onPointerDownObservable.add((coords) => {
            if (!this.editMode) return;
            dragging = true;
            startX = coords.x;
            startY = coords.y;
            origLeft = cfg.leftPx;
            origTop = cfg.topPx;
        });

        ctrl.onPointerMoveObservable.add((coords) => {
            if (!dragging || !this.editMode) return;
            let dx = coords.x - startX;
            let dy = coords.y - startY;

            // For right-aligned controls, horizontal movement is inverted
            if (hAlign === Control.HORIZONTAL_ALIGNMENT_RIGHT) dx = -dx;
            // For bottom-aligned controls, vertical movement is inverted
            if (vAlign === Control.VERTICAL_ALIGNMENT_BOTTOM) dy = -dy;

            cfg.leftPx = origLeft + dx;
            cfg.topPx = origTop + dy;
            this.applyLayout(ctrl, cfg, hAlign, vAlign);
        });

        ctrl.onPointerUpObservable.add(() => {
            dragging = false;
        });
    }

    private exitEditMode() {
        this.editMode = false;
        this.editBtn.isVisible = true;
        this.doneBtn.isVisible = false;
        this.resetBtn.isVisible = false;

        // Remove overlays
        for (const overlay of this.editOverlays) {
            this.ui.removeControl(overlay);
            overlay.dispose();
        }
        this.editOverlays = [];

        // Restore normal appearance
        this.controls.forEach((ctrl, key) => {
            if (key === "pause") return;
            if (ctrl instanceof Ellipse) {
                ctrl.color = "rgba(255,255,255,0.5)";
                ctrl.thickness = 2;
            } else if (ctrl instanceof Button) {
                ctrl.thickness = 0;
                ctrl.color = "white";
            }
        });

        this.saveLayout();
    }

    private resetLayout() {
        this.layout = defaultLayout();

        // Re-apply defaults to all controls
        const mapping: Array<{ key: keyof FullLayout; hAlign: number; vAlign: number }> = [
            { key: "leftStick",  hAlign: Control.HORIZONTAL_ALIGNMENT_LEFT,  vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "rightStick", hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "shoot",      hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "jump",       hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "reload",     hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "sprint",     hAlign: Control.HORIZONTAL_ALIGNMENT_LEFT,  vAlign: Control.VERTICAL_ALIGNMENT_BOTTOM },
            { key: "pause",      hAlign: Control.HORIZONTAL_ALIGNMENT_RIGHT, vAlign: Control.VERTICAL_ALIGNMENT_TOP },
        ];

        for (const { key, hAlign, vAlign } of mapping) {
            const ctrl = this.controls.get(key);
            if (ctrl) {
                this.applyLayout(ctrl, this.layout[key], hAlign, vAlign);
            }
        }

        // Clean up edit mode overlays and re-enter to refresh positions
        for (const overlay of this.editOverlays) {
            this.ui.removeControl(overlay);
            overlay.dispose();
        }
        this.editOverlays = [];
        // Re-enter edit mode to recreate overlays at new positions
        this.editMode = false;
        this.enterEditMode();

        this.saveLayout();
    }
}
