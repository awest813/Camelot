import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";

export type EditorGizmoMode = "position" | "rotation" | "scale";

/**
 * Phase-1 map editor scaffold:
 * - runtime-safe edit mode toggle
 * - transform gizmos with grid snapping
 * - placement of simple marker blocks
 */
export class MapEditorSystem {
  public isEnabled: boolean = false;
  public snapSize: number = 1;

  private readonly scene: Scene;
  private readonly gizmoManager: GizmoManager;
  private readonly gridMesh: Mesh;
  private _mode: EditorGizmoMode = "position";
  private _markerCount: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.gizmoManager = new GizmoManager(scene);
    this.gizmoManager.clearGizmoOnEmptyPointerEvent = false;
    this.gizmoManager.positionGizmoEnabled = true;
    this.gizmoManager.rotationGizmoEnabled = false;
    this.gizmoManager.scaleGizmoEnabled = false;

    this.gizmoManager.gizmos.positionGizmo?.xGizmo.dragBehavior.onDragEndObservable.add(() => this._snapAttachedMesh());
    this.gizmoManager.gizmos.positionGizmo?.yGizmo.dragBehavior.onDragEndObservable.add(() => this._snapAttachedMesh());
    this.gizmoManager.gizmos.positionGizmo?.zGizmo.dragBehavior.onDragEndObservable.add(() => this._snapAttachedMesh());
    this.gizmoManager.gizmos.scaleGizmo?.xGizmo.dragBehavior.onDragEndObservable.add(() => this._snapAttachedMesh());
    this.gizmoManager.gizmos.scaleGizmo?.yGizmo.dragBehavior.onDragEndObservable.add(() => this._snapAttachedMesh());
    this.gizmoManager.gizmos.scaleGizmo?.zGizmo.dragBehavior.onDragEndObservable.add(() => this._snapAttachedMesh());

    this.gridMesh = this._createGridMesh();
    this.gridMesh.setEnabled(false);

    this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.isEnabled || pointerInfo.type !== PointerEventTypes.POINTERDOWN) return;
      const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
        if (!mesh || mesh === this.gridMesh) return false;
        return mesh.metadata?.editable === true;
      });

      if (pick?.hit && pick.pickedMesh) {
        this.gizmoManager.attachToMesh(pick.pickedMesh as Mesh);
      } else {
        this.gizmoManager.attachToMesh(null);
      }
    });
  }

  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    this.gridMesh.setEnabled(this.isEnabled);
    if (!this.isEnabled) {
      this.gizmoManager.attachToMesh(null);
    }
    return this.isEnabled;
  }

  cycleGizmoMode(): EditorGizmoMode {
    this._mode = this._mode === "position" ? "rotation" : this._mode === "rotation" ? "scale" : "position";
    this.gizmoManager.positionGizmoEnabled = this._mode === "position";
    this.gizmoManager.rotationGizmoEnabled = this._mode === "rotation";
    this.gizmoManager.scaleGizmoEnabled = this._mode === "scale";
    return this._mode;
  }

  get mode(): EditorGizmoMode {
    return this._mode;
  }

  placeMarkerAt(position: Vector3): Mesh {
    const snapped = this._snapVector(position);
    const marker = MeshBuilder.CreateBox(`editor_marker_${this._markerCount++}`, { size: 1 }, this.scene);
    marker.position = snapped;
    marker.metadata = { ...(marker.metadata ?? {}), editable: true, editorMarker: true };

    const mat = new StandardMaterial(`editor_marker_mat_${this._markerCount}`, this.scene);
    mat.diffuseColor = new Color3(0.25, 0.7, 1);
    mat.emissiveColor = new Color3(0.08, 0.18, 0.25);
    marker.material = mat;

    this.gizmoManager.attachToMesh(marker);
    return marker;
  }

  private _snapAttachedMesh(): void {
    const attached = this.gizmoManager.attachedMesh;
    if (!attached) return;
    attached.position = this._snapVector(attached.position);
  }

  private _snapVector(value: Vector3): Vector3 {
    const s = this.snapSize;
    return new Vector3(
      Math.round(value.x / s) * s,
      Math.round(value.y / s) * s,
      Math.round(value.z / s) * s
    );
  }

  private _createGridMesh(): Mesh {
    const lines: Vector3[][] = [];
    const half = 50;
    for (let i = -half; i <= half; i++) {
      lines.push([new Vector3(-half, 0.05, i), new Vector3(half, 0.05, i)]);
      lines.push([new Vector3(i, 0.05, -half), new Vector3(i, 0.05, half)]);
    }
    const grid = MeshBuilder.CreateLineSystem("editor_grid", { lines, updatable: false }, this.scene);
    grid.color = new Color3(0.2, 0.6, 0.9);
    grid.isPickable = false;
    return grid;
  }
}
