import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { AxesViewer } from "@babylonjs/core/Debug/axesViewer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";

import MainScene from "./playground/main-scene";

class App {
  public engine: Engine | WebGPUEngine;
  public scene: Scene;

  private canvas: HTMLCanvasElement;
  private _fpsElement: HTMLElement | null = null;
  private _boundEvents = false;

  constructor() {
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
    const useWebGPU = import.meta.env.VITE_USE_WEBGPU === "true";

    if (useWebGPU) {
      await this._initWebGPUEngine();
    } else {
      await this._initWebGL2Engine();
    }
  }

  private async _initWebGL2Engine(): Promise<void> {
    this.engine = new Engine(this.canvas, true, {
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: true,
      disableWebGL2Support: false,
    });
  }

  private async _initWebGPUEngine(): Promise<void> {
    const webgpu = new WebGPUEngine(this.canvas, {
      adaptToDeviceRatio: true,
      antialias: true,
    });
    await webgpu.initAsync();
    this.engine = webgpu;
  }

  private async _setupScene(): Promise<void> {
    this.scene = new Scene(this.engine);

    // Add physics. If not needed, you can annotate it to improve loading speed and environment performance.
    await this._setPhysics();

    new MainScene(this.scene, this.canvas, this.engine);

    this._config();
    this._renderer();
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
        div.textContent = "0";
        document.body.appendChild(div);
        this._fpsElement = div;
      }
    }
    this._fpsElement.textContent = `${this.engine.getFps().toFixed()} fps`;
  }

  async _bindEvent(): Promise<void> {
    if (this._boundEvents) {
      return;
    }

    this._boundEvents = true;

    // Imports and hide/show the Inspector
    // Works only in DEV mode to reduce the size of the PRODUCTION build
    // Comment IF statement to work in both modes
    if (import.meta.env.DEV) {
      await import("@babylonjs/core/Debug/debugLayer");
      await import("@babylonjs/inspector");

      window.addEventListener("keydown", (ev) => {
        // Shift+Ctrl+Alt+I
        if (ev.repeat) {
          return;
        }

        if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.code === "KeyI") {
          if (this.scene.debugLayer.isVisible()) {
            this.scene.debugLayer.hide();
          } else {
            this.scene.debugLayer.show();
          }
        }
      });
    } // End of IF statement

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
      new AxesViewer();
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
    errorBanner.style.position = "fixed";
    errorBanner.style.left = "16px";
    errorBanner.style.right = "16px";
    errorBanner.style.bottom = "16px";
    errorBanner.style.padding = "12px 16px";
    errorBanner.style.borderRadius = "8px";
    errorBanner.style.background = "rgba(120, 0, 0, 0.9)";
    errorBanner.style.color = "#fff";
    errorBanner.style.fontFamily = "system-ui, sans-serif";
    errorBanner.style.fontSize = "14px";
    errorBanner.style.zIndex = "9999";
    errorBanner.textContent = message;
    document.body.appendChild(errorBanner);
  }
}

new App();
