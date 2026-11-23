/**
 * The composition root: the services the game provides to its features
 * (the "hosts" each feature asks for), and the features installed in order.
 * Moved out of game.ts (engine overhaul, Phase 1); the game hands over the
 * few private parts the wiring needs as an explicit `GameInternals`.
 */
import type { Game } from "../game";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AIState } from "../entities/npc";
import { applyDamageWithResistance } from "../systems/combat-shared";
import { getDesktopBridge } from "../platform/desktop-bridge";
import { Loot } from "../entities/loot";
import { VillageRaidFeature } from "../features/village-raids/raid-feature";
import { ActorsKey, AnimationKey, BuildingsKey, ClockKey, FeedbackKey, GameplayKey, InventoryKey, PurseKey, SkillsKey, LootKey, ModalKey, PlayerKey, QuestLogKey, ScheduleKey, SiteBuilderKey, WorldInfoKey, WorldStateKey } from "../features/services";
import { VillagesFeature } from "../features/villages/villages-feature";
import { WorldSitesFeature } from "../features/world-sites/world-sites-feature";
import { IndoorsFeature } from "../features/indoors/indoors-feature";
import { MountsFeature, MountHostKey } from "../features/mounts/mounts-feature";
import { WorldEventsFeature } from "../features/world-events/world-events-feature";
import { VillageJobsFeature } from "../features/village-jobs/jobs-feature";
import { spawnDragon } from "../world/dragon-lair";
import { TravelHostKey } from "../features/fast-travel/fast-travel-feature";
import { DeathFeature, DeathHostKey } from "../features/death/death-feature";
import { SpoilsFeature, SpoilsHostKey } from "../features/spoils/spoils-feature";
import { CharacterHostKey } from "../features/character/character-feature";
import { ProgressionHostKey } from "../features/progression/progression-feature";
import { DialogueServicesFeature, DialogueHostKey } from "../features/dialogue-services/dialogue-services-feature";
import { SurvivalHostKey } from "../features/survival/survival-feature";
import { SpellMakingFeature } from "../features/spell-making/spell-making-feature";
import { CharacterCreationUI } from "../ui/character-creation-ui";
import { persistSkipOnboardingTips } from "../onboarding-preferences";
import { OnboardingFeature, OnboardingHostKey } from "../features/onboarding/onboarding-feature";
import { ArrestFeature, LawKey } from "../features/arrest/arrest-feature";
import { setInstanceScale, setInstanceYaw } from "../systems/fantasy-asset-loader";
import { PetsFeature } from "../features/pets/pets-feature";
import { ThiefHostKey } from "../features/pickpocket/pickpocket-feature";
import { TradeHostKey } from "../features/trade/trade-feature";
import type { Item } from "../systems/inventory-system";
import { FollowersFeature } from "../features/followers/followers-feature";
import { ShoutsFeature, ShoutHostKey } from "../features/shouts/shouts-feature";
import { SettingsHostKey } from "../features/settings/settings-feature";

/** The game's private parts the wiring needs, nothing more. */
export interface GameInternals {
  readonly achievements: Game["_achievements"];
  readonly barterUI: Game["_barterUI"];
  readonly character: Game["_character"];
  readonly chunks: Game["_chunks"];
  readonly containerUI: Game["_containerUI"];
  readonly crafting: Game["_crafting"];
  readonly currentDialogueNpcName: Game["_currentDialogueNpcName"];
  readonly fastTravel: Game["_fastTravel"];
  readonly focus: Game["_focus"];
  inCharacterCreation: Game["_inCharacterCreation"];
  readonly npcVisuals: Game["_npcVisuals"];
  readonly pack: Game["_pack"];
  readonly progression: Game["_progression"];
  readonly roster: Game["_roster"];
  readonly settings: Game["_settings"];
  spellMaking: Game["_spellMaking"];
  readonly survival: Game["_survival"];
  readonly thief: Game["_thief"];
  readonly tips: Game["_tips"];
  readonly trade: Game["_trade"];
  despawnNpc: Game["_despawnNpc"];
  grantDynamicWorldEventReward: Game["_grantDynamicWorldEventReward"];
  grantPickpocketItem: Game["_grantPickpocketItem"];
  isCombatInputBlocked: Game["_isCombatInputBlocked"];
  isPlayerInCombat: Game["_isPlayerInCombat"];
  presentCell: Game["_presentCell"];
  restoreGameplayInput: Game["_restoreGameplayInput"];
  spawnArchetypeNpc: Game["_spawnArchetypeNpc"];
  suspendGameplayInput: Game["_suspendGameplayInput"];
  updateDynamicWorldEventsOnHourChange: Game["_updateDynamicWorldEventsOnHourChange"];
}

/**
 * Provide the services features use and install the features.  Services
 * resolve lazily, so systems created later in the game's constructor are fine.
 */
export function installGameFeatures(game: Game, gi: GameInternals): void {
      const k = game.kernel;
      k.services.provide(ClockKey, {
        hour: () => game.timeSystem.hour,
        elapsedHours: () => game.timeSystem.elapsedGameHours,
      });
      k.services.provide(PlayerKey, {
        position: () => game.player.camera.position,
        level: () => game.playerLevelSystem.characterLevel,
      });
      k.services.provide(FeedbackKey, {
        notify: (text, ms) => game.ui.showNotification(text, ms ?? 3000),
        grant: (reward) => gi.grantDynamicWorldEventReward(reward),
        addFame: (n) => game.fameSystem.addFame(n),
        markDirty: () => game.saveSystem.markDirty(),
      });
      k.services.provide(ActorsKey, {
        residents: (chunkKey) => gi.chunks.record(chunkKey)?.npcs ?? [],
        spawnArchetype: (chunkKey, archetype, x, z) => {
          const record = gi.chunks.record(chunkKey);
          return record ? gi.spawnArchetypeNpc(archetype, record, x, z) : null;
        },
        despawn: (npc) => gi.despawnNpc(npc),
        isTalkingTo: (npc) => npc.isInDialogue || npc.mesh.name === gi.currentDialogueNpcName,
        byName: (name) => game.scheduleSystem.npcs.find((n) => n.mesh.name === name),
        all: () => game.scheduleSystem.npcs,
      });
      k.services.provide(WorldInfoKey, {
        get chunkSize() { return game.world.chunkSize; },
        biome: (cx, cz) => game.world.getBiome(cx, cz),
        pondAt: (cx, cz) => !!game.world.pondAt(cx, cz),
      });
      k.services.provide(TravelHostKey, {
        position: () => game.player.camera.position,
        teleport: (to) => { game.player.camera.position.copyFrom(to); },
        inCombat: () => gi.isPlayerInCombat(),
        sneaking: () => game.stealthSystem.isCrouching,
        encumbered: () => game.player.isEncumbered,
        isInterior: (id) => game.cellManager.getCellDefinition(id)?.type === "interior",
        indoors: () => game.cellManager.isInterior,
        // Entered quietly (the trip has its own message), so present the cell here.
        enterCell: (id, at) => { if (game.cellManager.enterCellById(id, at, true)) gi.presentCell(id); },
        fade: (onBlack, onDone) => game.ui.playScreenFadeSequence({
          fadeOutMs: 400, holdMs: 120, fadeInMs: 450, onBlack, onComplete: onDone,
        }),
        passHours: (hours) => {
          game.timeSystem.advanceHours(hours);
          game.respawnSystem.update(game.timeSystem.elapsedGameTime);
          game.merchantRestockSystem.update(game.timeSystem.elapsedGameTime, game.barterSystem);
          gi.updateDynamicWorldEventsOnHourChange();
          return game.timeSystem.timeString;
        },
        arrivalEvent: (at) => game.travelEventSystem.rollEvent({
          gameTimeHours: game.timeSystem.elapsedGameHours % 24,
          activeBiomeIds: [game.world.getBiome(Math.floor(at.x / game.world.chunkSize), Math.floor(at.z / game.world.chunkSize))],
          weatherId: game.weatherSystem.state,
          playerLevel: game.playerLevelSystem.characterLevel,
          getFlag: (flag) => game.frameworkRuntime.getFlag(flag),
          setFlag: (flag, value) => game.frameworkRuntime.setFlag(flag, value),
        })?.notification ?? null,
        hasMark: () => game.markRecallSystem.hasMarked,
        recall: () => !!game.markRecallSystem.recall(),
      });
      k.install(gi.fastTravel);
      k.services.provide(DeathHostKey, {
        health: () => game.player.health,
        maxHealth: () => game.player.maxHealth,
        setHealth: (v) => { game.player.health = v; },
        position: () => game.player.camera.position,
        flash: () => game.ui.showHitFlash("rgba(180, 0, 0, 0.55)"),
        closeScreens: () => {
          if (game.dialogueSystem.isInDialogue) game.dialogueSystem.endDialogue();
          if (game.inventorySystem.isOpen) game.inventorySystem.toggleInventory();
          if (gi.containerUI.isVisible) gi.containerUI.onClose?.();
          if (gi.barterUI.isVisible) gi.barterUI.onClose?.();
          gi.restoreGameplayInput();
        },
        purgeEffects: () => {
          for (const effect of game.activeEffectsSystem.activeEffects) game.activeEffectsSystem.removeEffect(effect.id);
        },
        calmAttackers: () => {
          // So the waking place is not a fight (and fast travel isn't blocked).
          for (const npc of game.scheduleSystem.npcs) {
            if (npc.isDead) continue;
            if (npc.aiState === AIState.ALERT || npc.aiState === AIState.INVESTIGATE || npc.aiState === AIState.CHASE || npc.aiState === AIState.ATTACK) {
              npc.aiState = npc.patrolPoints.length > 0 ? AIState.RETURN : AIState.IDLE;
              npc.isAggressive = false;
            }
          }
        },
      });
      k.install(new DeathFeature());
      k.services.provide(ThiefHostKey, {
        crouching: () => game.stealthSystem.isCrouching,
        noticed: (npcId) => {
          const npc = game.scheduleSystem.npcs.find((n) => n.mesh.name === npcId);
          return npc ? game.stealthSystem.getDetectionLevel(npc) >= 30 : true;
        },
        reportTheft: (npcId) => {
          const npc = game.scheduleSystem.npcs.find((n) => n.mesh.name === npcId);
          game.crimeSystem.commitCrime("theft", npc?.factionId ?? "village_guard", game.timeSystem.elapsedGameTime);
        },
        receive: (itemId) => gi.grantPickpocketItem(itemId),
      });
      k.install(gi.thief);
      k.services.provide(TradeHostKey, {
        get barter() { return game.barterSystem; },
        get shops() { return game.shopSystem; },
        get containers() { return game.containerSystem; },
        items: () => game.inventorySystem.items,
        hour: () => game.timeSystem.hour,
        reputationFactor: (npcName) => {
          const fame = 1 - (game.fameSystem.dispositionModifier / 20) * 0.15;
          return fame * (npcName ? game.persuasionSystem.getMerchantPriceMultiplier(npcName) : 1.0);
        },
      });
      k.install(gi.trade);
      k.services.provide(SpoilsHostKey, {
        level: () => game.player.level,
        roll: (tableId, level) => game.lootTableSystem.rollTable(tableId, undefined, { playerLevel: level }).items.map((d) => ({
          id: d.id, name: d.name, description: d.description ?? "", stackable: d.stackable ?? false,
          quantity: d.quantity ?? 1, weight: d.weight, stats: d.stats, slot: d.slot as Item["slot"],
        })),
        resolveLeveled: (listId, level) => game.leveledListSystem.resolve(listId, level).value ?? null,
        drop: (at, item) => { new Loot(game.scene, at, item); },
      });
      k.install(new SpoilsFeature());
      const syncMax = () => {
        game.player.maxHealth = game.attributeSystem.maxHealth;
        game.player.maxMagicka = game.attributeSystem.maxMagicka;
        game.player.maxStamina = game.attributeSystem.maxStamina;
        game.player.maxCarryWeight = game.attributeSystem.carryWeight;
      };
      k.services.provide(CharacterHostKey, {
        get attributes() { return game.attributeSystem; },
        get skills() { return game.skillProgressionSystem; },
        syncMaxStats: syncMax,
        addMaxStats: (b) => {
          game.player.maxHealth += b.maxHealth;
          game.player.maxMagicka += b.maxMagicka;
          game.player.maxStamina += b.maxStamina;
          game.player.maxCarryWeight += b.carryWeight;
        },
        setRacialTraits: (t) => {
          game.swimSystem.hasWaterBreathing = t.waterBreathing;
          game.diseaseSystem.diseaseResistanceChance = t.diseaseImmune ? 1.0 : 0;
        },
        beginCreation: () => {
          gi.inCharacterCreation = true;
          game.isPaused = true;
          game.ui.toggleCrosshair(false);
          gi.focus.take("creation");
        },
        endCreation: () => {
          gi.inCharacterCreation = false;
          game.isPaused = false;
          game.ui.toggleCrosshair(true);
          gi.focus.give("creation");
        },
        ask: () => {
          const creator = new CharacterCreationUI();
          creator.setAnimator(game.uiAnimator);
          return creator.open();
        },
        becomeHero: (name, bonus) => {
          game.player.name = name;
          game.player.health = game.attributeSystem.maxHealth + bonus.maxHealth;
          game.player.magicka = game.attributeSystem.maxMagicka + bonus.maxMagicka;
          game.player.stamina = game.attributeSystem.maxStamina + bonus.maxStamina;
        },
        seedWorld: (seed) => {
          game.world.setSeed(seed);
          // Feature randomness (raids, …) derives from the world seed too.
          game.kernel.rng.reseed(seed.seedString);
        },
        welcome: (skipTips) => {
          if (skipTips !== null) persistSkipOnboardingTips(skipTips);
          gi.tips.start();
          gi.achievements?.unlock("ACH_TAKE_UP_THE_SWORD");
          if (game.workspaceDraftSystem.hasDraft()) {
            const result = game.workspaceDraftSystem.restore();
            if (result.restoredCount > 0) {
              const ts = result.savedAt ? new Date(result.savedAt).toLocaleTimeString() : "unknown";
              game.ui.showNotification(`Workspace draft restored (${result.restoredSystems.join(", ")}) — saved at ${ts}`, 4000);
            }
          }
        },
      });
      k.install(gi.character);
      k.services.provide(ProgressionHostKey, {
        get attributes() { return game.attributeSystem; },
        get classes() { return game.classSystem; },
        perks: () => game.perkSystem,
        syncMaxStats: syncMax,
        levelReached: () => game.trainerSystem.onCharacterLevelUp(),
        offerAttributes: () => {
          if (game.isPaused || game.ui.isAttributePanelOpen || gi.isCombatInputBlocked()) return;
          game.ui.toggleAttributePanel(true);
          game.ui.refreshAttributePanel(game.attributeSystem);
          gi.suspendGameplayInput();
        },
        sheet: () => {
          const sb = game.birthsignSystem.getStatBonuses();
          return {
            name: game.player.name,
            xpLevel: game.player.level,
            raceName: game.raceSystem.chosenRace?.name,
            className: game.classSystem.chosenClass?.name,
            birthsignName: game.birthsignSystem.chosenBirthsign?.name,
            specialization: game.classSystem.chosenClass?.specialization,
            attributes: game.attributeSystem.getAll(),
            skills: game.skillProgressionSystem.getAllSkills(),
            maxHealth: game.attributeSystem.maxHealth + sb.maxHealth,
            maxMagicka: game.attributeSystem.maxMagicka + sb.maxMagicka,
            maxStamina: game.attributeSystem.maxStamina + sb.maxStamina,
            carryWeight: game.attributeSystem.carryWeight + sb.carryWeight,
            fame: game.fameSystem.fame,
            infamy: game.fameSystem.infamy,
            fameLabel: game.fameSystem.fameLabel,
            infamyLabel: game.fameSystem.infamyLabel,
            gearCondition: game.smithing.getEquippedConditionSummary(),
          };
        },
        setSheetOpen: (open) => game.ui.setCharacterSheetOpen(open),
      });
      k.install(gi.progression);
      k.services.provide(SettingsHostKey, {
        tier: () => game.graphics.tier,
        applyTier: (tier) => { game.lodSystem?.setQuality(tier); location.reload(); },
        setDamageTaken: (m) => { game.combatSystem.difficultyMultiplier = m; },
        get audio() { return game.audioSystem; },
        setLookSensibility: (v) => { if (game.player?.camera) game.player.camera.angularSensibility = v; },
        toggleFullscreen: getDesktopBridge() ? () => { void getDesktopBridge()?.toggleFullscreen(); } : null,
        paused: () => game.isPaused,
      });
      k.install(gi.settings);
      k.services.provide(DialogueHostKey, {
        get trainers() { return game.trainerSystem; },
        skillName: (id) => game.skillProgressionSystem.getSkill(id as never)?.name ?? id,
        restAtInn: (hours) => {
          const result = game.waitSystem.rest(hours, game.timeSystem, game.player);
          if (!result.ok) return null;
          game.survivalSystem.rest(hours * 22);
          return result.message;
        },
      });
      k.install(new DialogueServicesFeature());
      k.services.provide(SurvivalHostKey, {
        body: () => game.player,
        isCold: () => {
          const p = game.player.camera.position;
          const biome = game.world.getBiome(Math.floor(p.x / game.world.chunkSize), Math.floor(p.z / game.world.chunkSize));
          const weather = game.weatherSystem?.state ?? "clear";
          return biome === "tundra" || weather === "rain" || weather === "storm";
        },
        setXpMultiplier: (m) => { game.skillProgressionSystem.globalXpMultiplier = m; },
      });
      k.install(gi.survival);
      k.services.provide(OnboardingHostKey, {
        // Space must never skip a tip while a menu, dialog or the editor is open.
        screenFree: () => !gi.isCombatInputBlocked()
          && !game.ui.isAttributePanelOpen && !game.ui.isWaitDialogOpen
          && !game.alchemyUI.isVisible && !game.enchantingUI.isVisible && !game.craftingUI.isVisible
          && !game.spellMakingUI.isVisible && !game.editorHubUI.isVisible,
      });
      k.install(new OnboardingFeature());
      game.saveSystem.setFastTravelSystem(gi.fastTravel.places);
      const record = (chunkKey: string) => gi.chunks.record(chunkKey);
      k.services.provide(SiteBuilderKey, {
        get scene() { return game.scene; },
        isLive: (chunkKey) => !!record(chunkKey),
        placeBuilding: (chunkKey, kind, origin) => {
          const r = record(chunkKey);
          if (r) gi.chunks.placeBuilding(chunkKey, r, kind, origin);
        },
        placeProp: (chunkKey, key, x, z, rot) => {
          const r = record(chunkKey);
          if (r) gi.chunks.placeProp(chunkKey, r, key, { x: 0, z: 0, rot: 0 }, x, z, rot);
        },
        placeSmithy: (chunkKey, x, z, rot) => {
          const r = record(chunkKey);
          if (r) gi.chunks.placeSmithy(chunkKey, r, x, z, rot);
        },
        ownStructure: (chunkKey, mesh) => {
          const r = record(chunkKey);
          if (r) gi.chunks.track(chunkKey, r, mesh, "structure");
          else mesh.dispose();
        },
        own: (chunkKey, mesh) => {
          const r = record(chunkKey);
          if (r) r.roots.push(mesh);
          else mesh.dispose();
        },
        addKeepOut: (fp) => {
          return gi.chunks.addKeepOut(fp);
        },
        nightFlame: (name, x, y, z) => gi.chunks.nightFlame(name, x, y, z),
        placeAsset: (chunkKey, key, at) => {
          if (!record(chunkKey)) return;
          game.fantasyAssets.getInstance(key, (root) => {
            if (!root) return;
            const r = record(chunkKey);
            if (!r) { root.dispose(); return; }
            root.position.set(at.x, at.y ?? 0, at.z);
            setInstanceYaw(root, at.yaw);
            if (at.scale !== undefined) setInstanceScale(root, at.scale);
            gi.chunks.track(chunkKey, r, root, at.tier ?? "prop");
          });
        },
        spawnDragon: (chunkKey, x, z, yaw) => spawnDragon({ scene: game.scene, chunks: gi.chunks, roster: gi.roster, assets: game.fantasyAssets, visuals: gi.npcVisuals }, chunkKey, x, z, yaw),
      });
      k.services.provide(InventoryKey, {
        count: (id) => game.inventorySystem.items.reduce((n, i) => (i.id === id ? n + i.quantity : n), 0),
        remove: (id, amount) => game.inventorySystem.removeQuantity(id, amount),
      });
      k.services.provide(QuestLogKey, {
        quests: () => game.questSystem.getQuests(),
        add: (quest) => game.questSystem.addQuest(quest, true),
      });
      k.services.provide(ScheduleKey, {
        behaviorOf: (npc) => game.scheduleSystem.behaviorOf(npc),
      });
      k.services.provide(BuildingsKey, {
        nearBuilding: (x, z, margin) => gi.chunks.nearBuilding(x, z, margin),
      });
      k.services.provide(ModalKey, {
        suspendGameplay: () => gi.suspendGameplayInput(),
        restoreGameplay: () => gi.restoreGameplayInput(),
      });

      k.services.provide(WorldStateKey, {
        weather: () => game.weatherSystem.state,
        hasBounty: () => game.crimeSystem.getTotalBounty() > 0,
        biomeAt: (x, z) => game.world.getBiome(Math.floor(x / game.world.chunkSize), Math.floor(z / game.world.chunkSize)),
      });
      const lootRng = k.rng.stream("loot-drops");
      k.services.provide(LootKey, {
        dropNear: (tableId, count) => {
          const context = { playerLevel: game.player.level };
          for (let i = 0; i < count; i++) {
            const drop = game.lootTableSystem.rollTable(tableId, undefined, context).items[0];
            if (!drop) continue;
            const angle = lootRng.next() * Math.PI * 2;
            const dist = 6 + lootRng.next() * 6;
            const p = game.player.camera.position;
            new Loot(game.scene, new Vector3(p.x + Math.cos(angle) * dist, 0.5, p.z + Math.sin(angle) * dist), {
              id: drop.id,
              name: drop.name,
              description: drop.description ?? "",
              stackable: drop.stackable ?? false,
              quantity: drop.quantity ?? 1,
              weight: drop.weight,
              stats: drop.stats,
              slot: drop.slot as Item["slot"],
            });
          }
        },
      });

      const worldEvents = new WorldEventsFeature();
      k.install(worldEvents);
      game.saveSystem.setDynamicWorldEventSystem(worldEvents.dynamic);
      // Persist flavor-event cooldowns so reloading can't reroll one-shots.
      game.saveSystem.setTravelEventSystem(worldEvents.travel);
      game.saveSystem.setAmbientEventSystem(worldEvents.ambient);

      k.services.provide(AnimationKey, {
        idle: (m) => game.animationSystem.playIdle(m),
        walk: (m) => game.animationSystem.playWalk(m),
        run: (m) => game.animationSystem.playRun(m),
        death: (m) => game.animationSystem.playDeath(m),
        release: (name) => game.animationSystem.unregisterMesh(name),
      });
      k.services.provide(GameplayKey, { canAct: () => !gi.isCombatInputBlocked() });
      k.services.provide(SkillsKey, {
        level: (id) => game.skillProgressionSystem?.getSkill(id)?.level ?? 0,
        gainXP: (id, base) => game.skillProgressionSystem?.gainXP(id, base * (game.classSystem?.xpMultiplierFor(id) ?? 1)),
      });
      k.install(gi.crafting);
      gi.spellMaking = new SpellMakingFeature(game.spellSystem);
      k.install(gi.spellMaking);
      k.services.provide(LawKey, {
        get crime() { return game.crimeSystem; },
        get persuasion() { return game.persuasionSystem; },
        serveJail: (bounty, factionId) => game.jailSystem.serveJailTime(
          bounty, factionId, game.timeSystem, game.skillProgressionSystem, game.crimeSystem, game.timeSystem.gameTime,
        ),
        addInfamy: (n) => game.fameSystem.addInfamy(n),
        now: () => game.timeSystem.elapsedGameTime,
      });
      k.install(new ArrestFeature());
      k.services.provide(PurseKey, {
        gold: () => gi.pack.gold(),
        spend: (amount) => gi.pack.spendGold(amount),
      });
      const pets = new PetsFeature(game.scene);
      k.install(pets);
      game.saveSystem.setPetSystem(pets.pets);
      k.services.provide(ShoutHostKey, {
        gameTime: () => game.timeSystem.gameTime,
        stance: () => {
          const forward = game.player.getForwardDirection(1);
          forward.y = 0;
          forward.normalize();
          return { origin: game.player.camera.position, forward };
        },
        targets: () => game.combatSystem.npcs,
        dash: (distance) => {
          const f = game.player.getForwardDirection(1);
          const flat = new Vector3(f.x, 0, f.z);
          if (flat.lengthSquared() <= 0.001) return;
          flat.normalize();
          // Stop short of any wall between the player and the dash target.
          const pick = game.player.raycastForward(distance);
          const reach = pick?.hit ? Math.max(1, pick.distance - 0.8) : distance;
          game.player.camera.position.addInPlace(flat.scale(reach));
        },
        addEffect: (effect) => game.activeEffectsSystem.addEffect(effect),
        damage: (npc, raw, type) => {
          if (npc.isDead) return;
          const damage = applyDamageWithResistance(raw, npc, type);
          npc.takeDamage(damage);
          game.combatSystem.notifyHostileHit(npc, damage);
          if (npc.isDead) {
            game.ui.showNotification(`${npc.mesh.name} defeated!`);
            game.combatSystem.onNPCDeath?.(npc.mesh.name, npc.xpReward, npc);
          }
        },
        setAttackSpeedMultiplier: (m) => { game.combatSystem.externalAttackSpeedMultiplier = m; },
        clearWeather: () => game.weatherSystem.forceWeather("clear"),
      });
      const shouts = new ShoutsFeature();
      k.install(shouts);
      game.saveSystem.setDragonShoutSystem(shouts.shouts);
      const followers = new FollowersFeature();
      k.install(followers);
      game.saveSystem.setFollowerSystem(followers.followers);
      // A starter wolf companion for new games.
      pets.pets.grantPet("pet_wolf");

      k.services.provide(MountHostKey, {
        canAct: () => !game.isPaused && !game.dialogueSystem.isInDialogue,
        setMoveSpeedMultiplier: (m) => { (game.player as unknown as { moveSpeedMultiplier?: number }).moveSpeedMultiplier = m; },
        unlockAchievement: (id) => { gi.achievements?.unlock(id as never); },
        give: (item) => { game.inventorySystem.addItem(item); },
      });
      const mounts = new MountsFeature();
      k.install(mounts);
      game.saveSystem.setHorseSystem(mounts.horses);

      k.install(new IndoorsFeature());
      k.install(new VillagesFeature());
      k.install(new WorldSitesFeature());

      const raids = new VillageRaidFeature();
      k.install(raids);
      game.saveSystem.setVillageRaids(raids.rules);

      const jobs = new VillageJobsFeature();
      k.install(jobs);
      game.saveSystem.setVillageJobs(jobs.rules);
  }
