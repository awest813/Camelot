import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { guardEarlyDeviceLoss, pickRenderer } from "./rendering/renderer-choice";
import { MeshoptCompression } from "@babylonjs/core/Meshes/Compression/meshoptCompression";

// The models are meshopt-compressed (tools/optimize-models.mjs); their decoder
// ships with the game instead of coming from Babylon's CDN.
MeshoptCompression.Configuration = { decoder: { url: `${import.meta.env.BASE_URL ?? "/"}vendor/meshopt_decoder.js` } };
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";

import MainScene from "./playground/main-scene";
import { hydrateDesktopSave } from "./platform/desktop-bridge";
import { applyPrefs, loadPrefs } from "./ui/accessibility";
import type { EditorFactory } from "./game/editor-plugin";

export interface AppOptions {
  /** The editor app plugs its suite into the game (see game/editor-plugin.ts). */
  editors?: EditorFactory;
}

/** The page: canvas, engine, physics, the game, and the render loop. */
export class App {
  public engine: Engine | WebGPUEngine;
  public scene: Scene;

  private canvas: HTMLCanvasElement;
  private _fpsElement: HTMLElement | null = null;
  private _lastFpsWriteMs = Number.NEGATIVE_INFINITY;
  private _boundEvents = false;

  constructor(private readonly _options: AppOptions = {}) {
    // Interface scale and reduced motion, before any UI is drawn.
    applyPrefs(loadPrefs());
    // create the canvas html element and attach it to the webpage
    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.id = "renderCanvas";
    document.body.appendChild(this.canvas);

    this._initialize().catch((error: unknown) => {
      console.error("Failed to initialize Camelot", error);
      this._showFatalError(
        "Failed to initialize Camelot. Please refresh or check the browser console for details.",
      );
    });
  }

  private async _initialize(): Promise<void> {
    await this._initEngine();
    await this._setupScene();
  }

  private async _initEngine(): Promise<void> {
    if (pickRenderer() === "webgpu") {
      try {
        await this._initWebGPUEngine();
        return;
      } catch (err) {
        console.warn("[Engine] WebGPU unavailable; using WebGL2.", err);
      }
    }
    await this._initWebGL2Engine();
  }

  private async _initWebGL2Engine(): Promise<void> {
    this.engine = new Engine(this.canvas, false, {
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: true,
      disableWebGL2Support: false,
    });
    this._applyPerformanceRenderScale();
  }

  private async _initWebGPUEngine(): Promise<void> {
    // Loaded on demand: the WebGPU engine (and the WGSL shaders it pulls in)
    // stays out of the default WebGL bundle.
    const [{ WebGPUEngine }] = await Promise.all([
      import("@babylonjs/core/Engines/webgpuEngine"),
      // The WebGPU engine's texture, render-target, query… extensions are
      // separate modules (the WebGL engine's come with it).
      import("@babylonjs/core/Engines/WebGPU/Extensions/index"),
    ]);
    // Ask for an adapter first: a browser can expose WebGPU and still have
    // no adapter to give (blocklisted or headless GPUs), and Babylon logs
    // that as a fatal error.
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu || !(await gpu.requestAdapter())) throw new Error("no WebGPU adapter");
    const webgpu = new WebGPUEngine(this.canvas, {
      adaptToDeviceRatio: true,
      antialias: false,
    });
    await webgpu.initAsync();
    this.engine = webgpu;
    this._applyPerformanceRenderScale();
    guardEarlyDeviceLoss(webgpu);
  }

  private _applyPerformanceRenderScale(): void {
    const configured = Number(import.meta.env.VITE_RENDER_SCALE);
    const scale = Number.isFinite(configured) && configured >= 1
      ? Math.min(configured, 3)
      : 1.0;
    this.engine.setHardwareScalingLevel(scale);
  }

  private async _setupScene(): Promise<void> {
    this.scene = new Scene(this.engine);

    // Add physics. If not needed, you can annotate it to improve loading speed and environment performance.
    await this._setPhysics();

    // Desktop builds mirror the save into a file. Pull the newer slot in
    // before Game constructs SaveSystem.
    await hydrateDesktopSave();

    // Replays (`?replay=record|play`): the replay drives the frames, so it is
    // set up before the game and the render loop never starts.
    const replayMode = new URLSearchParams(location.search).get("replay");
    const replay = replayMode === "record" || replayMode === "play"
      ? await import("./replay/game-replay").then((m) => new m.GameReplay(replayMode, this.engine as Engine, this.scene, this.canvas, replayMode === "play" ? m.readStoredLog() : null))
      : null;

    const main = new MainScene(this.scene, this.canvas, this.engine, this._options.editors);
    if (replay) {
      replay.game = main.game;
      (window as unknown as { __camelotReplay?: unknown }).__camelotReplay = replay;
    }

    // Dev-only handle for in-browser debugging and the visual-shots e2e spec.
    if (import.meta.env.DEV) {
      (window as unknown as { __camelotScene?: Scene }).__camelotScene = this.scene;
    }

    this._config();
    if (!replay) this._renderer();
  }

  async _setPhysics(): Promise<void> {
    const gravity = new Vector3(0, -9.81, 0);
    const hk = await HavokPhysics();
    const plugin = new HavokPlugin(true, hk);
    this.scene.enablePhysics(gravity, plugin);
  }

  _fps(): void {
    if (!this._fpsElement) {
      this._fpsElement = document.getElementById("display-fps");
      if (!this._fpsElement) {
        const div = document.createElement("div");
        div.id = "display-fps";
        div.setAttribute("role", "status");
        div.setAttribute("aria-live", "polite");
        div.setAttribute("aria-atomic", "true");
        div.textContent = "0";
        document.body.appendChild(div);
        this._fpsElement = div;
      }
    }
    // Throttle DOM writes — a textContent assignment invalidates layout even
    // when the value is unchanged.
    const nowMs = performance.now();
    if (nowMs - this._lastFpsWriteMs < 500) return;
    this._lastFpsWriteMs = nowMs;
    const text = `${this.engine.getFps().toFixed()} fps`;
    if (this._fpsElement.textContent !== text) {
      this._fpsElement.textContent = text;
    }
  }

  async _bindEvent(): Promise<void> {
    if (this._boundEvents) {
      return;
    }

    this._boundEvents = true;

    // resize window
    window.addEventListener("resize", () => {
      this.engine.resize();
    });

    window.onbeforeunload = () => {
      // I have tested it myself and the system will automatically remove this junk.
      this.scene.onBeforeRenderObservable.clear();
      this.scene.onAfterRenderObservable.clear();
      this.scene.onKeyboardObservable.clear();
    };
  }

  // Auxiliary Class Configuration
  _config(): void {
    // Axes — only in dev to avoid adding extra meshes in production
    if (import.meta.env.DEV) {
      new AxesViewer(this.scene);
    }

    // Inspector and other stuff
    this._bindEvent();
  }

  _renderer(): void {
    this.engine.runRenderLoop(() => {
      this._fps();
      this.scene.render();
    });
  }

  private _showFatalError(message: string): void {
    const errorBanner = document.createElement("div");
    errorBanner.className = "app-fatal-error";
    errorBanner.setAttribute("role", "alert");
    errorBanner.textContent = message;
    document.body.appendChild(errorBanner);
  }
}
