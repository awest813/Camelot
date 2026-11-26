/**
 * The map (M): a parchment chart of the land around the player, drawn from
 * the world's own biome layout, with the places discovered and the player's
 * mark.  Wheel or the buttons zoom; drag pans; "Centre on me" comes back.
 *
 * Loaded on first use (see features/map/map-feature.ts).
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { BiomeType } from "../world/world-manager";
import { ModalDialog } from "./preact/modal-dialog";
import { PanelHost } from "./preact/panel-host";

export interface MapPlace { id: string; name: string; x: number; z: number }

/** What the map reads (the world, the player, the places known). */
export interface MapSource {
  chunkSize: number;
  biome(cx: number, cz: number): BiomeType;
  pond(cx: number, cz: number): boolean;
  player(): { x: number; z: number; heading: number };
  places(): readonly MapPlace[];
}

/** Washes of colour under the ink, one per biome (drawn over parchment). */
export const BIOME_WASH: Record<BiomeType, string> = {
  plains: "rgba(176, 160, 84, 0.42)",
  forest: "rgba(88, 112, 56, 0.55)",
  desert: "rgba(214, 172, 96, 0.5)",
  tundra: "rgba(214, 222, 214, 0.75)",
};
export const BIOME_LABEL: Record<BiomeType, string> = { plains: "Plains", forest: "Forest", desert: "Desert", tundra: "Tundra" };

/** Chunks across the sheet, by zoom level. */
export const ZOOM_CHUNKS = [12, 24, 48, 96] as const;

/** World → sheet pixels (north up: +z is up the page). */
export function project(at: { x: number; z: number }, centre: { x: number; z: number }, metresPerPx: number, w: number, h: number) {
  return { px: w / 2 + (at.x - centre.x) / metresPerPx, py: h / 2 - (at.z - centre.z) / metresPerPx };
}

const INK = "rgba(52, 34, 18, 0.55)";

function drawSheet(canvas: HTMLCanvasElement, src: MapSource, centre: { x: number; z: number }, chunksAcross: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return; // (no canvas in a headless test)
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const size = src.chunkSize;
  const mpp = (chunksAcross * size) / w;
  const cell = size / mpp;
  const half = { x: (w / 2) * mpp, z: (h / 2) * mpp };
  const cx0 = Math.floor((centre.x - half.x) / size), cx1 = Math.floor((centre.x + half.x) / size);
  const cz0 = Math.floor((centre.z - half.z) / size), cz1 = Math.floor((centre.z + half.z) / size);
  // Washes first, softened so biomes bleed into each other like watercolour.
  ctx.filter = `blur(${Math.max(2, Math.round(cell * 0.18))}px)`;
  for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
    for (let cz = cz0 - 1; cz <= cz1 + 1; cz++) {
      const { px, py } = project({ x: cx * size, z: (cz + 1) * size }, centre, mpp, w, h);
      ctx.fillStyle = BIOME_WASH[src.biome(cx, cz)];
      ctx.fillRect(px - 0.5, py - 0.5, cell + 1, cell + 1);
    }
  }
  ctx.filter = "none";
  for (let cx = cx0; cx <= cx1; cx++) {
    for (let cz = cz0; cz <= cz1; cz++) {
      const biome = src.biome(cx, cz);
      const { px, py } = project({ x: cx * size, z: (cz + 1) * size }, centre, mpp, w, h);
      // Ink marks, sparse enough to read at every zoom.
      if (cell >= 10) {
        ctx.strokeStyle = INK;
        ctx.fillStyle = INK;
        ctx.lineWidth = 1;
        const m = cell / 2, ox = px + m, oy = py + m;
        if (biome === "forest") {
          for (const [dx, dy] of [[-0.22, -0.18], [0.2, -0.05], [-0.05, 0.22]]) {
            ctx.beginPath();
            ctx.arc(ox + dx * cell, oy + dy * cell, Math.max(1.5, cell * 0.08), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (biome === "desert") {
          for (const [dx, dy] of [[-0.25, -0.2], [0.1, -0.25], [0.25, 0.1], [-0.15, 0.2], [0.05, 0.05]]) ctx.fillRect(ox + dx * cell, oy + dy * cell, 1, 1);
        } else if (biome === "tundra") {
          ctx.beginPath();
          ctx.moveTo(ox - cell * 0.2, oy); ctx.lineTo(ox + cell * 0.2, oy);
          ctx.stroke();
        }
      }
      if (src.pond(cx, cz)) {
        ctx.fillStyle = "rgba(58, 92, 120, 0.55)";
        ctx.beginPath();
        ctx.ellipse(px + cell / 2, py + cell / 2, cell * 0.32, cell * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // A faint graticule every eight chunks.
  ctx.strokeStyle = "rgba(52, 34, 18, 0.16)";
  ctx.lineWidth = 1;
  for (let cx = Math.ceil(cx0 / 8) * 8; cx <= cx1; cx += 8) {
    const { px } = project({ x: cx * size, z: 0 }, centre, mpp, w, h);
    ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
  }
  for (let cz = Math.ceil(cz0 / 8) * 8; cz <= cz1; cz += 8) {
    const { py } = project({ x: 0, z: cz * size }, centre, mpp, w, h);
    ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
  }
}

export function MapPanel(p: { source: MapSource; onClose(): void; size?: { w: number; h: number } }) {
  const src = p.source;
  const me = src.player();
  const [zoom, setZoom] = useState(1);
  const [centre, setCentre] = useState({ x: me.x, z: me.z });
  const canvas = useRef<HTMLCanvasElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cz: number } | null>(null);
  const W = p.size?.w ?? 720, H = p.size?.h ?? 520;
  const chunksAcross = ZOOM_CHUNKS[zoom];
  const mpp = (chunksAcross * src.chunkSize) / W;

  useEffect(() => {
    if (canvas.current) drawSheet(canvas.current, src, centre, chunksAcross);
  }, [centre.x, centre.z, chunksAcross]);

  const zoomBy = (d: number) => setZoom((z) => Math.max(0, Math.min(ZOOM_CHUNKS.length - 1, z + d)));
  const at = (pt: { x: number; z: number }) => project(pt, centre, mpp, W, H);
  const mine = at(me);
  const places = src.places();
  const biomesShown = (Object.keys(BIOME_WASH) as BiomeType[]);

  return (
    <ModalDialog id="map-title" title="Map of the Realm" className="craft-panel map-panel" panelClassName="map-panel__panel" onClose={p.onClose}>
      <div class="map-panel__layout">
        <div
          ref={sheet}
          class="map-panel__sheet"
          style={{ width: `${W}px`, height: `${H}px` }}
          onWheel={(e) => { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1 : -1); }}
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, cx: centre.x, cz: centre.z }; }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || (e.buttons & 1) === 0) return;
            setCentre({ x: d.cx - (e.clientX - d.x) * mpp, z: d.cz + (e.clientY - d.y) * mpp });
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; }}
        >
          <canvas ref={canvas} class="map-panel__canvas" width={W} height={H} aria-hidden="true" />
          {places.map((pl) => {
            const q = at(pl);
            if (q.px < -40 || q.px > W + 40 || q.py < -20 || q.py > H + 20) return null;
            return (
              <button key={pl.id} type="button" class="map-panel__place" style={{ left: `${q.px}px`, top: `${q.py}px` }}
                onClick={() => setCentre({ x: pl.x, z: pl.z })} aria-label={`${pl.name} (centre the map here)`}>
                <span class="map-panel__place-mark" aria-hidden="true">◆</span>
                <span class="map-panel__place-name">{pl.name}</span>
              </button>
            );
          })}
          <span class="map-panel__me" role="img" aria-label="You are here"
            style={{ left: `${mine.px}px`, top: `${mine.py}px`, transform: `translate(-50%, -50%) rotate(${me.heading}rad)` }}>▲</span>
          <div class="map-panel__rose" aria-hidden="true"><span>N</span></div>
        </div>
        <aside class="map-panel__side">
          <div class="map-panel__controls">
            <button type="button" class="craft-panel__btn" onClick={() => zoomBy(-1)} disabled={zoom === 0} aria-label="Zoom in">＋</button>
            <button type="button" class="craft-panel__btn" onClick={() => zoomBy(1)} disabled={zoom === ZOOM_CHUNKS.length - 1} aria-label="Zoom out">－</button>
            <button type="button" class="craft-panel__btn" onClick={() => setCentre({ x: me.x, z: me.z })}>Centre on me</button>
          </div>
          <h3 class="craft-panel__section-title">Places known</h3>
          {places.length === 0 ? (
            <p class="map-panel__empty">None yet. Places you discover are marked here.</p>
          ) : (
            <ul class="map-panel__places">
              {places.map((pl) => (
                <li key={pl.id}>
                  <button type="button" class="map-panel__places-btn" onClick={() => setCentre({ x: pl.x, z: pl.z })}>{pl.name}</button>
                </li>
              ))}
            </ul>
          )}
          <h3 class="craft-panel__section-title">Legend</h3>
          <ul class="map-panel__legend">
            {biomesShown.map((b) => (
              <li key={b}><span class="map-panel__swatch" style={{ backgroundImage: `linear-gradient(${BIOME_WASH[b]}, ${BIOME_WASH[b]})` }} />{BIOME_LABEL[b]}</li>
            ))}
            <li><span class="map-panel__swatch map-panel__swatch--pond" />Water</li>
            <li><span class="map-panel__legend-mark">◆</span>A place known</li>
            <li><span class="map-panel__legend-mark map-panel__legend-mark--me">▲</span>You</li>
          </ul>
          <p class="map-panel__hint">Wheel to zoom · drag to pan · M or Esc to close</p>
        </aside>
      </div>
    </ModalDialog>
  );
}

/** Opened and closed by the map feature. */
export class MapPanelView {
  private readonly _host = new PanelHost();
  private _open = false;

  public get isVisible(): boolean {
    return this._open;
  }

  public open(source: MapSource, onClose: () => void): void {
    this._open = true;
    this._host.show(<MapPanel source={source} onClose={onClose} />);
  }

  public close(): void {
    if (!this._open) return;
    this._open = false;
    this._host.hide();
  }
}
