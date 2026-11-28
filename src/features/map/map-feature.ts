/**
 * The map as a kernel feature (M): a chart of the land around the player
 * with the places discovered.  The panel loads on first use.
 *
 * Inputs:   services world-info, player, fast-travel, gameplay, modal,
 *           landmarks (which have been cleared).
 * Outputs:  the `map` service (toggle it, whether it is open).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { LazyPanel } from "../../ui/lazy-panel";
import type { MapPanelView, MapSource } from "../../ui/map-panel";
import { FastTravelKey, GameplayKey, LandmarksKey, ModalKey, PlayerKey, WorldInfoKey, declareStateless } from "../services";

export interface MapService {
  /** M: open the map over play, or close it. */
  toggle(): void;
  readonly isOpen: boolean;
}

export const MapKey = createServiceKey<MapService>("map");

export class MapFeature implements Feature {
  public readonly id = "map";
  public readonly panel = new LazyPanel<MapPanelView>(async () => {
    const { MapPanelView } = await import("../../ui/map-panel");
    return new MapPanelView();
  });

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "the map is drawn from the world and the places discovered");
    const s = ctx.kernel.services;
    const source: MapSource = {
      get chunkSize() { return s.get(WorldInfoKey).chunkSize; },
      biome: (cx, cz) => s.get(WorldInfoKey).biome(cx, cz),
      pond: (cx, cz) => s.get(WorldInfoKey).pondAt(cx, cz),
      player: () => {
        const p = s.get(PlayerKey);
        const at = p.position();
        return { x: at.x, z: at.z, heading: p.heading?.() ?? 0 };
      },
      places: () => (s.tryGet(FastTravelKey)?.places?.() ?? []).map((p) => {
        // Landmark ids are "site_<kind>_<cx>_<cz>"; anything else is a village.
        const kind = p.id.startsWith("site_") ? p.id.split("_")[1] : "village";
        return { ...p, kind, cleared: s.tryGet(LandmarksKey)?.isCleared?.(p.id) ?? false };
      }),
    };
    const close = () => {
      this.panel.close();
      s.get(ModalKey).restoreGameplay();
    };
    const panel = this.panel;
    ctx.provide(MapKey, {
      toggle: () => {
        if (panel.isVisible) { close(); return; }
        if (!s.get(GameplayKey).canAct()) return;
        s.get(ModalKey).suspendGameplay();
        panel.openWith((view) => view.open(source, close), () => s.get(ModalKey).restoreGameplay());
      },
      get isOpen() { return panel.isVisible; },
    });
    ctx.scope.add(() => this.panel.close());
  }
}
