/**
 * Start-up, the last wiring: quest and kill reactions, combat input, the keyboard, the pause menu's actions, features, modals and the editors.
 *
 * Part of the composition root: a stretch of the game's start-up, moved out
 * of game.ts.
 */
import type { Game } from "../game";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { KeyboardEventTypes } from "@babylonjs/core/Events/keyboardEvents";
import { getDesktopBridge } from "../platform/desktop-bridge";
import { seedGameRandomness } from "./game-services";
import { SettingsKey } from "../features/settings/settings-feature";
import { isSettlementNpc } from "./npcs";
import { forwardDialogToggleKey, openSaveImportPicker, wireInputAdapter } from "./input-wiring";
import { isCombatInputBlocked, registerModals } from "./play-focus";
import { loadGamepadOnConnect } from "../systems/gamepad-loader";

export function wireGameplay(g: Game): void {
  // Prevent browser context menu from capturing right-click combat input.
  g.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  // Wire quest event callbacks
  g.eventBus.on("npc:killed", ({ npcName: name, xp, npc }) => {
      const npcName = /dragon/i.test(npc.key) ? npc.key : name;
      const p = npc.mesh.position;
      g.eventBus.emit("player:kill", {
        npcId: npc.key, npcName, xp, at: { x: p.x, y: p.y, z: p.z }, lootTableId: npc.lootTableId ?? undefined,
        civilian: isSettlementNpc(g, npc), factionId: npc.factionId ?? "village_guard",
      });
      // Bandit Bounty: activate on the first bandit kill so that kill counts.
      if (!g._banditQuestStarted && g._quests.targetId(name) === "Bandit") {
          g._banditQuestStarted = true;
          g.frameworkRuntime.questEngine.activateQuest("quest_bandit_bounty");
          g.ui.showNotification("📜 New quest: Bandit Bounty — bring proof to collect.", 3500);
      }
      g._quests.apply("kill", g._quests.targetId(name));
      // Killing someone a quest needed alive fails the dependent quests.
      g._quests.failForDead(name);
      g.player.addExperience(xp);
      g.ui.showNotification(`+${xp} XP`, 2000);
      g.audioSystem.playNPCDeath();

  });
  // (Arrow and spell kills report npc:killed too.)
  // Striking a peaceful settler is an assault (the arrest feature books it).
  g.eventBus.on("combat:npcDamaged", ({ npc }) => {
    if (npc.isDead || !isSettlementNpc(g, npc)) return;
    g.eventBus.emit("player:assault", { npcId: npc.key, factionId: npc.factionId ?? "village_guard" });
  });
  g.eventBus.on("combat:playerStruck", () => {
      g.audioSystem.playPlayerHit();
      // Small chance to contract a random disease on each hit (Oblivion-style).
      // ~5 % base chance per strike; resistance is factored inside contractDisease().
      const contagion = g.kernel.rng.stream("disease");
      if (contagion.chance(0.05)) {
          g.diseaseSystem.contractDisease(contagion.pick(["rust_chancre", "swamp_rot", "witbane", "collywobbles", "yellow_tick"]), () => contagion.next());
      }
  });
  g.eventBus.on("combat:blocked", () => {
      g.skillProgressionSystem.gainXP("block", 5 * g.classSystem.xpMultiplierFor("block"));
  });
  g.eventBus.on("loot:pickedUp", ({ itemId: id }) => {
      g._quests.apply("pickup", id);
      g.saveSystem.markDirty();
      g._tips.did("interact");
  });
  g.dialogueSystem.events = g.eventBus;
  g.eventBus.on("dialogue:started", ({ npcName }) => {
      g._quests.apply("talk", g._quests.targetId(npcName));
      // Speechcraft XP each time dialogue is initiated
      g.skillProgressionSystem.gainXP("speechcraft", 8 * g.classSystem.xpMultiplierFor("speechcraft"));
      g._tips.did("interact");
  });
  // After the features' dialogue:closed handlers: forget who we spoke to.
  g.eventBus.on("dialogue:closed", () => { g._currentDialogueNpcName = null; });

  // Quest XP and fame callbacks are wired in the v9 block above.
  // Note: player.onLevelUp is wired above in the v2 system wiring block

  // Gameplay rolls draw from the kernel's seeded streams (replays).
  seedGameRandomness(g);

  // Input handling for combat
  g.scene.onPointerObservable.add((pointerInfo) => {
      if (isCombatInputBlocked(g)) return;

      if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          g._inputAdapter.handlePointerEvent(pointerInfo.event.button, "down");
          if (pointerInfo.event.button === 2) {
              pointerInfo.event.preventDefault();
          }
      } else if (pointerInfo.type === PointerEventTypes.POINTERUP) {
          g._inputAdapter.handlePointerEvent(pointerInfo.event.button, "up");
          // Left mouse up looses a drawn arrow.
          if (pointerInfo.event.button === 0) g._combatControls.releaseBow();
      }
  });

  // DOM dialogs take keyboard focus from the canvas, and the observable below
  // only hears the canvas — so a panel opened with P/G/N/K/… could not be
  // closed with the same key. Forward panel-toggle keys from inside dialogs.
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", (ev) => forwardDialogToggleKey(g, ev));
  }

  // Keys: the input adapter's bindings for the live context (play or the
  // map editor) first; whatever they don't take is the editors' (map editor
  // chords, Shift+F-key creator tools).
  g.scene.onKeyboardObservable.add((kbInfo) => {
      const ev = kbInfo.event as KeyboardEvent;
      const down = kbInfo.type === KeyboardEventTypes.KEYDOWN;
      if (!down && kbInfo.type !== KeyboardEventTypes.KEYUP) return;
      const handled = g._inputAdapter.handleKeyEvent(ev.key, down ? "down" : "up", {
        shift: ev.shiftKey, ctrlOrMeta: ev.ctrlKey || ev.metaKey, repeat: ev.repeat,
      });
      if (handled !== null) { ev.preventDefault(); return; }
      if (down) g.editors?.handleKey(ev);
  });

  // What the pause menu's buttons do.
  const desktop = getDesktopBridge();
  g.ui.setPauseActions({
    resume: () => g.togglePause(),
    save: () => g.saveSystem.save(),
    load: () => g.saveSystem.load(),
    // Export the CURRENT state, not the last persisted one.
    exportSave: () => { g.saveSystem.save(true); g.saveSystem.exportToFile(); },
    importSave: () => openSaveImportPicker(g),
    settings: () => g.kernel.services.get(SettingsKey).open(),
    credits: () => g.kernel.services.get(SettingsKey).openCredits(),
    quit: desktop ? () => desktop.quit() : () => window.location.reload(),
    quitLabel: desktop ? "Quit to Desktop" : "Quit to Menu",
  });

  // Wire decoupled input adapter after all systems are initialized
  registerModals(g);
  wireInputAdapter(g);
  loadGamepadOnConnect(g._inputAdapter, () => g.player.camera, (pad) => { g._gamepadInput = pad; });

  // Game loop logic will go here
  g.scene.onBeforeRenderObservable.add(() => {
      g.update();
  });
}
