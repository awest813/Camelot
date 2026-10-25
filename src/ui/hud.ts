import { HERO_LIST, HEROES, ITEM_LIST, ULT_LEVEL } from "../moba/content";
import { FOUNTAIN, FOUNTAIN_RADIUS, RECALL_TIME } from "../moba/map";
import { dist } from "../moba/math";
import type { Match, SimEvent } from "../moba/sim";
import type { AbilitySlot, HeroId, ItemId, Lane } from "../moba/types";

export interface StickSample {
  sx: number;
  sy: number;
  cast: AbilitySlot | null;
  recall: boolean;
  buy: ItemId | null;
  focus: boolean;
  mouseAim: boolean;
  mouseX: number;
  mouseY: number;
}

const LANE_COPY: Record<Lane, { name: string; road: string }> = {
  top: { name: "Top", road: "Saxon Road" },
  mid: { name: "Mid", road: "King's Way" },
  bot: { name: "Bot", road: "Lake Road" },
};

export class Hud {
  private hero: HeroId = "arthur";
  private lane: Lane = "mid";
  private readonly keys = new Set<string>();
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stick = { x: 0, y: 0 };
  private pendingCast: AbilitySlot | null = null;
  private pendingRecall = false;
  private pendingBuy: ItemId | null = null;
  private pendingFocus = false;
  private mouseAim = false;
  private mouseX = 0;
  private mouseY = 0;
  private feed: string[] = [];
  private ended = false;

  private readonly selectEl: HTMLElement;
  private readonly hudEl: HTMLElement;
  private readonly endEl: HTMLElement;
  private readonly bootEl: HTMLElement;
  private readonly fatalEl: HTMLElement;
  private readonly floatEl: HTMLElement;
  private readonly knob: HTMLElement;
  private readonly minimap: HTMLCanvasElement;
  private readonly shopEl: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="boot">Raising the banners…</div>
      <section class="select" hidden>
        <div class="select-card">
          <header class="select-copy">
            <p class="eyebrow">3 v 3 · lanes · minions</p>
            <h1>Camelot Rift</h1>
            <p class="lede">Mordred holds the far throne. Pick a knight of the Table, take a lane, and break the towers before his does.</p>
            <div class="lanes" role="group" aria-label="Lane"></div>
            <button type="button" class="start">To the rift</button>
            <p class="keys">Desktop: WASD move · mouse aim · Q 2 E R · F recall · B shop · Space focus</p>
          </header>
          <div class="heroes" role="list"></div>
        </div>
      </section>
      <section class="hud" hidden>
        <header class="top">
          <div class="throne camelot"><span>Round Table</span><i></i></div>
          <div class="clock"><b class="time">0:00</b><em class="kills">0 — 0</em></div>
          <div class="throne mordred"><span>Black Throne</span><i></i></div>
        </header>
        <canvas class="minimap" width="160" height="160" aria-label="Minimap"></canvas>
        <div class="feed" aria-live="polite"></div>
        <div class="you">
          <b class="who">Arthur</b>
          <span class="lvl">1</span>
          <div class="vitals"><i class="hp"></i><i class="mp"></i></div>
          <em class="gold">0g</em>
        </div>
        <p class="respawn" hidden>Returning to the well</p>
        <div class="stick" aria-label="Move"><i class="knob"></i></div>
        <div class="actions">
          <button type="button" class="util recall">Recall</button>
          <button type="button" class="util shop-toggle">Shop</button>
          <button type="button" class="util focus-btn">Focus</button>
          <div class="abilities"></div>
        </div>
        <div class="shop" hidden>
          <h2>The well</h2>
          <p class="shop-note">Buy beside your healing well.</p>
          <div class="wares"></div>
        </div>
        <button type="button" class="score-toggle">Table</button>
        <div class="board" hidden></div>
        <div class="channel" hidden><i></i></div>
      </section>
      <section class="end" hidden>
        <div class="end-card">
          <p class="eyebrow">Camlann</p>
          <h2 class="verdict">The Table stands</h2>
          <div class="results"></div>
          <button type="button" class="again">Fight again</button>
        </div>
      </section>
      <div class="floaters"></div>
      <div class="fatal" hidden></div>
    `;
    this.bootEl = this.must(".boot");
    this.selectEl = this.must(".select");
    this.hudEl = this.must(".hud");
    this.endEl = this.must(".end");
    this.fatalEl = this.must(".fatal");
    this.floatEl = this.must(".floaters");
    this.knob = this.must(".knob");
    this.minimap = this.root.querySelector("canvas.minimap") as HTMLCanvasElement;
    this.shopEl = this.must(".shop");
    this.buildSelect();
    this.buildAbilities();
    this.buildShop();
    this.bind();
  }

  ready(onStart: (hero: HeroId, lane: Lane) => void): void {
    this.bootEl.hidden = true;
    this.selectEl.hidden = false;
    this.must(".start").addEventListener("click", () => onStart(this.hero, this.lane));
  }

  showMatch(): void {
    this.selectEl.hidden = true;
    this.endEl.hidden = true;
    this.hudEl.hidden = false;
    this.shopEl.hidden = true;
    this.feed = [];
    this.ended = false;
    this.stick = { x: 0, y: 0 };
    this.knob.style.transform = "translate(0, 0)";
  }

  showSelect(): void {
    this.hudEl.hidden = true;
    this.endEl.hidden = true;
    this.selectEl.hidden = false;
  }

  fatal(message: string): void {
    this.bootEl.hidden = true;
    this.fatalEl.hidden = false;
    this.fatalEl.textContent = message;
  }

  sample(edges: boolean): StickSample {
    let x = this.stick.x;
    let y = this.stick.y;
    let kx = 0;
    let ky = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) kx -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) kx += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) ky += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) ky -= 1;
    if (kx !== 0 || ky !== 0) {
      const mag = Math.hypot(kx, ky) || 1;
      x = kx / mag;
      y = ky / mag;
    }
    const cast = edges ? this.pendingCast : null;
    const recall = edges ? this.pendingRecall : false;
    const buy = edges ? this.pendingBuy : null;
    const focus = edges ? this.pendingFocus : false;
    if (edges) {
      this.pendingCast = null;
      this.pendingRecall = false;
      this.pendingBuy = null;
      this.pendingFocus = false;
    }
    return {
      sx: x,
      sy: y,
      cast,
      recall,
      buy,
      focus,
      mouseAim: this.mouseAim,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
    };
  }

  update(match: Match, events: SimEvent[], project: (x: number, y: number, z: number) => { x: number; y: number } | null): void {
    const player = match.player;
    const def = HEROES[player.heroId ?? "arthur"];
    this.text(".time", formatTime(match.time));
    const kills = countKills(match);
    this.text(".kills", `${kills.camelot} — ${kills.mordred}`);
    this.bar(".throne.camelot i", nexusRatio(match, "camelot"));
    this.bar(".throne.mordred i", nexusRatio(match, "mordred"));
    this.text(".who", player.name);
    this.text(".lvl", `${player.level}`);
    this.bar(".vitals .hp", player.hp / player.maxHp);
    this.bar(".vitals .mp", player.maxMana > 0 ? player.mana / player.maxMana : 0);
    this.text(".gold", `${Math.floor(player.gold)}g`);

    const respawn = this.must(".respawn");
    respawn.hidden = player.alive;
    if (!player.alive) {
      const left = Math.max(0, player.respawnAt - match.time);
      respawn.textContent = `Returning in ${left.toFixed(1)}s`;
    }

    const channel = this.must(".channel");
    channel.hidden = player.recallT <= 0;
    const fill = channel.querySelector("i") as HTMLElement;
    if (fill) fill.style.width = `${Math.min(100, (player.recallT / RECALL_TIME) * 100)}%`;

    const buttons = this.root.querySelectorAll<HTMLButtonElement>(".ability");
    buttons.forEach((button) => {
      const slot = Number(button.dataset.slot) as AbilitySlot;
      const ability = def.abilities[slot];
      const locked = slot === 3 && player.level < ULT_LEVEL;
      const cd = player.cooldowns[slot];
      const ratio = cd > 0 ? cd / ability.cooldown : 0;
      button.style.setProperty("--p", `${Math.round(ratio * 100)}`);
      button.classList.toggle("locked", locked);
      button.classList.toggle("dry", player.mana < ability.mana);
      const label = button.querySelector(".cd");
      if (label) label.textContent = locked || cd <= 0.15 ? ability.key : cd.toFixed(cd >= 10 ? 0 : 1);
      button.title = locked ? `${ability.name} unlocks at level ${ULT_LEVEL}` : ability.name;
    });

    const home = dist(player, FOUNTAIN.camelot) <= FOUNTAIN_RADIUS + 0.3;
    this.shopEl.classList.toggle("away", !home);
    for (const item of ITEM_LIST) {
      const button = this.shopEl.querySelector<HTMLButtonElement>(`[data-item="${item.id}"]`);
      if (!button) continue;
      const owned = player.items.includes(item.id);
      button.disabled = owned || !home || player.gold < item.cost;
      button.classList.toggle("owned", owned);
    }

    for (const event of events) {
      if (event.type === "text") {
        const at = project(event.x, 1.7, event.z);
        if (at) this.floater(at.x, at.y, event.text, event.color);
      }
      if (event.type === "killfeed") {
        this.feed.unshift(event.text);
        this.feed.length = 4;
        const feed = this.must(".feed");
        feed.replaceChildren();
        for (const line of this.feed) {
          const row = document.createElement("p");
          row.textContent = line;
          feed.appendChild(row);
        }
      }
    }
    this.drawMap(match);
    this.drawBoard(match);
    if (match.winner && !this.ended) {
      this.ended = true;
      this.showEnd(match);
    }
  }

  private showEnd(match: Match): void {
    const win = match.winner === "camelot";
    this.text(".verdict", win ? "The Table stands" : "Mordred takes the field");
    this.endEl.classList.toggle("loss", !win);
    const results = this.must(".results");
    results.replaceChildren();
    const heroes = match.units.filter((u) => u.kind === "hero");
    for (const hero of heroes) {
      const row = document.createElement("p");
      row.textContent = `${hero.team === "camelot" ? "Camelot" : "Mordred"}  ${hero.name}   ${hero.kills}/${hero.deaths}/${hero.assists}   ${hero.cs} cs   lv ${hero.level}`;
      results.appendChild(row);
    }
    this.endEl.hidden = false;
  }

  onAgain(run: () => void): void {
    this.must(".again").addEventListener("click", run);
  }

  private buildSelect(): void {
    const lanes = this.must(".lanes");
    for (const lane of ["top", "mid", "bot"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "lane-btn";
      button.dataset.lane = lane;
      button.innerHTML = `<b>${LANE_COPY[lane].name}</b><small>${LANE_COPY[lane].road}</small>`;
      if (lane === this.lane) button.classList.add("on");
      button.addEventListener("click", () => {
        this.lane = lane;
        lanes.querySelectorAll(".lane-btn").forEach((other) => other.classList.toggle("on", other === button));
      });
      lanes.appendChild(button);
    }
    const heroes = this.must(".heroes");
    for (const hero of HERO_LIST) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "hero-card";
      card.dataset.hero = hero.id;
      card.setAttribute("role", "listitem");
      if (hero.id === this.hero) card.classList.add("on");
      const skills = hero.abilities.map((ability) => `<li><b>${ability.key}</b> ${ability.name}</li>`).join("");
      card.innerHTML = `
        <span class="sigil sigil-${hero.id}" aria-hidden="true"></span>
        <span class="hero-name">${hero.name}</span>
        <span class="hero-title">${hero.title}</span>
        <span class="role">${hero.role}</span>
        <span class="blurb">${hero.blurb}</span>
        <ul>${skills}</ul>
      `;
      card.addEventListener("click", () => {
        this.hero = hero.id;
        heroes.querySelectorAll(".hero-card").forEach((other) => other.classList.toggle("on", other === card));
      });
      heroes.appendChild(card);
    }
  }

  private buildAbilities(): void {
    const row = this.must(".abilities");
    const order: Array<{ slot: AbilitySlot; key: string }> = [
      { slot: 3, key: "R" },
      { slot: 0, key: "Q" },
      { slot: 1, key: "W" },
      { slot: 2, key: "E" },
    ];
    for (const entry of order) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ability";
      button.dataset.key = entry.key;
      button.dataset.slot = String(entry.slot);
      button.innerHTML = `<span class="sweep"></span><span class="cd">${entry.key}</span>`;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.pendingCast = entry.slot;
      });
      row.appendChild(button);
    }
  }

  private buildShop(): void {
    const wares = this.must(".wares");
    for (const item of ITEM_LIST) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.item = item.id;
      button.innerHTML = `<b>${item.name}</b><small>${item.blurb}</small><em>${item.cost}g</em>`;
      button.addEventListener("click", () => {
        this.pendingBuy = item.id;
      });
      wares.appendChild(button);
    }
  }

  private bind(): void {
    const stick = this.must(".stick");
    const move = (event: PointerEvent) => {
      if (this.stickId !== event.pointerId) return;
      let dx = event.clientX - this.stickOrigin.x;
      let dy = this.stickOrigin.y - event.clientY;
      const max = 48;
      const mag = Math.hypot(dx, dy) || 1;
      if (mag > max) {
        dx = (dx / mag) * max;
        dy = (dy / mag) * max;
      }
      this.stick = { x: dx / max, y: dy / max };
      this.knob.style.transform = `translate(${dx}px, ${-dy}px)`;
    };
    stick.addEventListener("pointerdown", (event) => {
      this.stickId = event.pointerId;
      this.stickOrigin = { x: event.clientX, y: event.clientY };
      stick.setPointerCapture(event.pointerId);
      move(event);
    });
    stick.addEventListener("pointermove", move);
    const release = (event: PointerEvent) => {
      if (this.stickId !== event.pointerId) return;
      this.stickId = null;
      this.stick = { x: 0, y: 0 };
      this.knob.style.transform = "translate(0, 0)";
    };
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);

    this.must(".recall").addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.pendingRecall = true;
    });
    this.must(".focus-btn").addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.pendingFocus = true;
    });
    this.must(".shop-toggle").addEventListener("click", () => {
      this.shopEl.hidden = !this.shopEl.hidden;
    });
    this.must(".score-toggle").addEventListener("click", () => {
      const board = this.must(".board");
      board.hidden = !board.hidden;
    });

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      this.keys.add(key);
      if (event.repeat) return;
      // W stays a move key. The blue skill is 2 on a keyboard and W on the pad.
      const cast: Record<string, AbilitySlot> = { q: 0, "2": 1, e: 2, r: 3 };
      if (key in cast && !this.hudEl.hidden) this.pendingCast = cast[key];
      if (key === "f") this.pendingRecall = true;
      if (key === "b") this.shopEl.hidden = !this.shopEl.hidden;
      if (event.key === " ") {
        this.pendingFocus = true;
        event.preventDefault();
      }
      if (key.startsWith("arrow")) event.preventDefault();
    });
    window.addEventListener("keyup", (event) => this.keys.delete(event.key.toLowerCase()));
    window.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      this.mouseAim = true;
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
    });
    window.addEventListener("contextmenu", (event) => event.preventDefault());
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.stick = { x: 0, y: 0 };
      this.knob.style.transform = "translate(0, 0)";
    });
  }

  private drawMap(match: Match): void {
    const ctx = this.minimap.getContext("2d");
    if (!ctx) return;
    const w = this.minimap.width;
    const h = this.minimap.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#1c3d28";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#e2b15a";
    ctx.lineWidth = 3;
    const plot = (x: number, z: number) => [(x + 42) / 84 * w, (42 - z) / 84 * h];
    ctx.beginPath();
    for (const lane of ["top", "mid", "bot"] as const) {
      const path = lane === "mid"
        ? [{ x: -24, z: -24 }, { x: 24, z: 24 }]
        : lane === "top"
          ? [{ x: -33, z: -22 }, { x: -33, z: 33 }, { x: 28, z: 33 }]
          : [{ x: -22, z: -33 }, { x: 33, z: -33 }, { x: 33, z: 28 }];
      const start = plot(path[0].x, path[0].z);
      ctx.moveTo(start[0], start[1]);
      for (const point of path.slice(1)) {
        const at = plot(point.x, point.z);
        ctx.lineTo(at[0], at[1]);
      }
    }
    ctx.stroke();
    for (const unit of match.units) {
      if (!unit.alive) continue;
      const [x, y] = plot(unit.x, unit.z);
      ctx.fillStyle = unit.team === "camelot" ? "#ffd15a" : "#ff4d6a";
      const r = unit.kind === "hero" ? (unit.player ? 5 : 3.5) : unit.kind === "minion" ? 1.6 : unit.kind === "nexus" ? 6 : 3.2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (unit.player) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  private drawBoard(match: Match): void {
    const board = this.must(".board");
    if (board.hidden) return;
    board.replaceChildren();
    for (const hero of match.units.filter((u) => u.kind === "hero")) {
      const row = document.createElement("p");
      row.textContent = `${hero.name}  ${hero.kills}/${hero.deaths}/${hero.assists}  ${hero.cs} cs  ${Math.floor(hero.gold)}g`;
      row.className = hero.team;
      board.appendChild(row);
    }
  }

  private floater(x: number, y: number, text: string, color: string): void {
    const node = document.createElement("span");
    node.className = "floater";
    node.textContent = text;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.color = color;
    this.floatEl.appendChild(node);
    window.setTimeout(() => node.remove(), 700);
  }

  private must(selector: string): HTMLElement {
    const node = this.root.querySelector(selector);
    if (!(node instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
    return node;
  }

  private text(selector: string, value: string): void {
    const node = this.must(selector);
    if (node.textContent !== value) node.textContent = value;
  }

  private bar(selector: string, ratio: number): void {
    const node = this.must(selector);
    node.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  }
}

function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function countKills(match: Match): { camelot: number; mordred: number } {
  let camelot = 0;
  let mordred = 0;
  for (const unit of match.units) {
    if (unit.kind !== "hero") continue;
    if (unit.team === "camelot") camelot += unit.kills;
    else mordred += unit.kills;
  }
  return { camelot, mordred };
}

function nexusRatio(match: Match, team: "camelot" | "mordred"): number {
  const nexus = match.units.find((unit) => unit.kind === "nexus" && unit.team === team);
  if (!nexus || !nexus.alive) return 0;
  return nexus.hp / nexus.maxHp;
}
