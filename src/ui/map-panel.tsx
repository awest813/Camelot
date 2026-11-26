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

export interface MapPlace {
  id: string; name: string; x: number; z: number;
  /** "village", or a landmark's site kind ("obelisk", "bandit-camp", …). */
  kind?: string;
  /** A camp or roost cleared: drawn faded. */
  cleared?: boolean;
}

/** Each kind of place's mark (14×14 SVG paths, drawn in ink) and its legend label. */
export const PLACE_MARKS: Record<string, { label: string; path: string }> = {
  village: { label: "Village", path: "M7 1 L13 7 L7 13 L1 7 Z" },
  "forest-inn": { label: "Inn", path: "M2 7 L7 2 L12 7 L12 13 L2 13 Z M9 9 L12 9 L12 11 L9 11 Z" },
  homestead: { label: "Homestead", path: "M2 7 L7 2 L12 7 L12 13 L2 13 Z" },
  "haunted-house": { label: "Manor", path: "M2 13 L2 5 L4 5 L4 3 L6 3 L6 5 L8 5 L8 3 L10 3 L10 5 L12 5 L12 13 Z" },
  obelisk: { label: "Obelisk", path: "M6 1 L8 1 L9.5 13 L4.5 13 Z" },
  graveyard: { label: "Graveyard", path: "M6 1 L8 1 L8 4 L11 4 L11 6 L8 6 L8 13 L6 13 L6 6 L3 6 L3 4 L6 4 Z" },
  "bandit-camp": { label: "Bandit camp", path: "M2 1 L13 12 L12 13 L1 2 Z M12 1 L13 2 L2 13 L1 12 Z" },
  dragon: { label: "Dragon roost", path: "M7 4 L13 1 L10 7 L13 8 L7 13 L1 8 L4 7 L1 1 Z" },
};
const markOf = (kind: string | undefined) => PLACE_MARKS[kind ?? "village"] ?? PLACE_MARKS.village;

function PlaceMark({ kind, className }: { kind?: string; className: string }) {
  return (
    <svg class={className} viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
      <path d={markOf(kind).path} fill-rule="evenodd" />
    </svg>
  );
}

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

/** Where a label sits beside its mark, or null: no free spot (the list at the side still names it). */
export type LabelSpot = { side: "right" | "left"; dy: number } | null;

/**
 * Place each label beside its mark so none covers another label or a mark:
 * to the right, then a line above or below, then the same on the left.  A
 * label with no free spot is left off.  Widths are estimated from the name.
 */
export function labelSpots(
  marks: ReadonlyArray<{ id: string; name: string; px: number; py: number }>,
  others: ReadonlyArray<{ px: number; py: number }> = [],
  line = 16,
): Map<string, LabelSpot> {
  type Box = { x0: number; x1: number; y0: number; y1: number };
  const hits = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const taken: Box[] = [...marks, ...others].map((m) => ({ x0: m.px - 8, x1: m.px + 8, y0: m.py - 8, y1: m.py + 8 }));
  const out = new Map<string, LabelSpot>();
  const tries: Array<{ side: "right" | "left"; dy: number }> = [
    { side: "right", dy: 0 }, { side: "right", dy: -line }, { side: "right", dy: line },
    { side: "left", dy: 0 }, { side: "left", dy: -line }, { side: "left", dy: line },
  ];
  for (const m of [...marks].sort((a, b) => a.py - b.py || a.px - b.px)) {
    const w = m.name.length * 7.5;
    let spot: LabelSpot = null;
    for (const t of tries) {
      const x0 = t.side === "right" ? m.px + 11 : m.px - 11 - w;
      const box = { x0, x1: x0 + w, y0: m.py + t.dy - line / 2 + 1, y1: m.py + t.dy + line / 2 - 1 };
      if (taken.some((b) => hits(box, b))) continue;
      taken.push(box);
      spot = t;
      break;
    }
    out.set(m.id, spot);
  }
  return out;
}

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
  const shown = places.map((pl) => ({ ...pl, ...at(pl) })).filter((q) => q.px >= -40 && q.px <= W + 40 && q.py >= -20 && q.py <= H + 20);
  const spots = labelSpots(shown, [at(me)]);
  const biomesShown = (Object.keys(BIOME_WASH) as BiomeType[]);
  // The legend lists the kinds of place known so far, in the marks' order.
  const kindsKnown = Object.keys(PLACE_MARKS).filter((k) => places.some((pl) => (pl.kind ?? "village") === k));

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
          {shown.map((q) => {
            const spot = spots.get(q.id) ?? null;
            return (
              <button key={q.id} type="button" class={`map-panel__place${q.cleared ? " is-cleared" : ""}`} style={{ left: `${q.px}px`, top: `${q.py}px` }}
                title={spot ? undefined : q.name}
                onClick={() => setCentre({ x: q.x, z: q.z })}
                aria-label={`${q.name}, ${markOf(q.kind).label.toLowerCase()}${q.cleared ? ", cleared" : ""} (centre the map here)`}>
                <PlaceMark kind={q.kind} className="map-panel__place-mark" />
                {spot && (
                  <span class={`map-panel__place-name map-panel__place-name--${spot.side}`} style={spot.dy ? { marginTop: `${spot.dy}px` } : undefined}>{q.name}</span>
                )}
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
                  <button type="button" class={`map-panel__places-btn${pl.cleared ? " is-cleared" : ""}`} onClick={() => setCentre({ x: pl.x, z: pl.z })}>
                    <PlaceMark kind={pl.kind} className="map-panel__places-icon" />{pl.name}{pl.cleared ? " (cleared)" : ""}
                  </button>
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
            {kindsKnown.map((k) => (
              <li key={k}><span class="map-panel__legend-mark"><PlaceMark kind={k} className="map-panel__legend-icon" /></span>{PLACE_MARKS[k].label}</li>
            ))}
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
