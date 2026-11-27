# Plan: replace the content taken from The Elder Scrolls

Camelot borrows a great deal from *Oblivion* and *Skyrim*. The genre's mechanics are
fine to keep: use-based skills, level scaling, an alchemy bench, a spellmaking altar,
wait and rest, fame and infamy, radiant jobs. What has to go is everything that is
theirs by name or by set: races, birthsigns, standing stones, shouts and their dragon
words, named followers, diseases, ingredients, spells, gear tiers, soul gems,
creatures, places and lore. The game is called Camelot, and Arthurian legend and
British folklore are public domain. This plan replaces the borrowed content with
an Arthurian setting of the game's own, without breaking saves.

This is a plan for the content, not legal advice; the store copy and any
trademark question deserve a lawyer's read before release.

## 1. What is borrowed (audit, 2026-11-27)

| Area | What it copies | Where | Size | In saves? |
|---|---|---|---|---|
| Races | The ten playable races of the series by name (Nord, Imperial, Breton, Redguard, Altmer, Bosmer, Dunmer, Orsimer, Khajiit, Argonian), their lore text ("best archers in Tamriel") and racial powers ("Voice of the Emperor", "Nord's Fury") | `systems/race-system.ts`; creator text; Argonian disease immunity and water breathing (`disease-system.ts`, `swimming-system.ts`, `setup-world.ts`) | 10 | race id |
| Birthsigns | Oblivion's thirteen signs by name (The Warrior … The Serpent) and their powers ("Mara's Gift", "Moonshadow", "Lover's Kiss") | `systems/birthsign-system.ts`, creator | 13 | birthsign id |
| Standing stones | Skyrim's thirteen Guardian Stones (parked, not wired) | `systems/standing-stone-system.ts`, README | 13 | (unwired) |
| Shouts | Skyrim's Thu'um: the shouts by name (Unrelenting Force, Whirlwind Sprint, Become Ethereal, Fire Breath, Ice Form, Slow Time, Clear Skies, Elemental Fury), the three-word dragon-language words (FUS RO DAH …), dragon souls, "Thu'um" | `systems/dragon-shout-system.ts`, `features/shouts`, `ui/shout-ui.ts`, help overlay | 8 | shout ids, words, souls |
| Followers | Skyrim's followers by name (Lydia, Aela the Huntress, Jenassa, J'zargo, Farkas, Borgakh, Marcurio, Uthgerd) and their homes ("whiterun_dragonsreach") | `systems/follower-system.ts`, `ui/follower-ui.ts`, creator | 8 named | template ids |
| Classes | Oblivion's class list (Warrior, Knight, Barbarian, Crusader, Archer, Mage, Sorcerer, Healer, Spellsword, Battlemage, Thief, Assassin, Scout, Rogue, Nightblade, Bard, Monk) | `systems/class-system.ts`; "Battlemage Instructor" | 17 | class id |
| Diseases | The series' diseases (Rust Chancre, Swamp Rot, Witbane, Collywobbles, Brain Rot, Yellow Tick, Porphyric Hemophilia) | `systems/disease-system.ts`, README | 7 | disease ids |
| Ingredients | Oblivion's ingredients (Imp Gall, Cairn Bolete Cap, Clannfear Claws, Spiddal Stick, Harrada, Wisp Stalk Caps …) | `systems/alchemy-system.ts` | 15 | ingredient ids (inventory) |
| Spells | Skyrim's spell names (Flames, Frostbite, Spark, Oakflesh, Ice Spike, Chain Lightning, Bound Sword, Turn Undead, Calm, Heal Other …) | `systems/spell-system.ts` | 17 | spell ids |
| Gear tiers | Daedric, Elven, Orcish, Glass, Dwarven material tiers; "daedric arrows" | `content/leveled-gear.ts`, loot tables, crafting, projectiles | ~12 items | item ids |
| Soul gems | Petty / Lesser / Common / Greater / Grand soul gems | enchanting, loot | 5 | item ids |
| Effect names | Series vocabulary: Feather, Burden, Night Eye, "Fortify / Restore / Damage <stat>" | alchemy, spellmaking, enchanting | ~20 | effect ids |
| Skills, attributes, schools | Oblivion's skill names (Blade, Blunt, Marksman, Armorer, Speechcraft, Mercantile …), seven of its eight attributes (Strength, Endurance, Intelligence, Agility, Willpower, Speed, Luck), its magic schools (Destruction, Restoration, Alteration, Conjuration, Illusion, Mysticism) | `skill-progression-system.ts`, `attribute-system.ts`, perks, UI | many | skill/attribute ids |
| Creatures and places | Draugr; Cyrodiil, Tamriel, Whiterun in comments and text; "Septim" | `entities/npc.ts`, `rendering/character-models.ts`, `ui/icon-utils.ts`, `world-manager.ts`, `journal-system.ts` | few | no |
| Copy | "Bethesda-lite", "Oblivion-style", "Skyrim-style", "Skyrim AE-inspired" | README, ROADMAP, CHANGELOG, code comments (47 source files) | — | no |

Already original, keep: the title, the tome UI, villages, landmarks and their
names, bandit camps, job boards, raids, the achievements, the survival needs.

## 2. The new setting: Arthurian Britain, as the game's own

One idea ties the replacements together: **the Matter of Britain**. Knights, the
Otherworld (Annwn), the Fair Folk, holy wells and stone circles, the Red Dragon.
All of it is public domain. Use the legend's *public-domain* figures and places
(Malory, the Mabinogion, Geoffrey of Monmouth), not any modern adaptation's.

Draft names below are starting points for review, not final.

### Heritages (replace races)

Invented peoples of the realm rather than real ethnic groups (no real-world
peoples with stat bonuses). Eight is enough; each keeps a distinct power so the
creator still offers real choices.

| New | Takes the role of | Power |
|---|---|---|
| Hill-folk | Nord | Stone-skin (resist damage) |
| Lowland-born | Imperial | Kingsvoice (calm, barter) |
| Fen-folk | Argonian | Marsh-breath (water breathing, disease ward) |
| Sea-born | Redguard | Second Wind (stamina) |
| Fae-blooded | Altmer / Breton | Glamour (magicka, spell ward) |
| Forest-kin | Bosmer | Hunter's Eye (archery, beast calm) |
| Ash-kin (from the burnt marches) | Dunmer | Ember-blood (fire ward) |
| Giant-blooded | Orsimer | Berserk (strength) |

Khajiit has no direct counterpart; its night eye goes to Forest-kin.

### Omens (replace birthsigns)

Signs read at a child's birth, drawn from the legend's objects and beasts:
**The Sword in the Stone** (warrior), **The Grail** (healing), **The Lady of the
Lake** (magicka), **The Red Dragon** (fire), **The White Hart** (speed),
**The Raven** (stealth), **The Round Table** (all skills a little), **The Isle of
Apples** (regeneration), **The Hunt** (archery). Nine signs, each with one bonus
and, for a few, one daily power.

### Stone circles (replace the standing stones)

Either delete the parked system, or redesign it as **stone circles and holy
wells**: a switchable blessing, each with a boon *and* a cost (a well's
water-blessing that weakens fire spells, a circle's warding that slows stamina).
Six, placed as landmarks (the landmark system already discovers sites).
Recommendation: delete now, design the circles later as new content.

### Words of the Old Tongue (replace shouts)

Keep the *idea* of learned power words; drop the three-word dragon language, the
named shouts and dragon souls.

- **The source:** *awen*, the bardic gift of inspiration. It is earned at stone
  circles and from great deeds (clearing a roost), not taken from dragon souls.
- **Teachings:** each is one word in an invented Brittonic-flavoured tongue, with
  up to three ranks of mastery. Draft teachings:
  - **Gwynt** (a gust that staggers foes);
  - **Tân** (flame);
  - **Rhew** (frost);
  - **Cysgod** (fade from sight);
  - **Llais** (a voice that calms beasts);
  - **Amser** (a slowed moment).
- **Names:** rename the system to "Words" in code and UI, with no "Thu'um" or
  "shout".

### Companions (replace followers)

Figures from the legend, who are public domain:
- Sir Kay;
- Sir Bedivere;
- Lynette;
- Sir Gareth (Beaumains);
- Sir Dagonet;
- Sir Percival;
- Dame Ragnelle;
- Sir Lamorak.

Their homes are Caerleon, Tintagel and Camelot itself. Mercenary companions (paid,
not named) can stay generic.

### The rest

- **Callings (classes):** fewer and in-setting:
  - Knight;
  - Man-at-arms;
  - Forester (ranger);
  - Druid;
  - Bard;
  - Hedge-witch;
  - Cutpurse;
  - Pilgrim (healer);
  - Battle-priest.
- **Diseases:** medieval ailments, plus one curse from the Breton lays:
  - Marsh Ague;
  - Sweating Sickness;
  - St Anthony's Fire;
  - Quinsy;
  - Wasting Cough;
  - Falling Sickness;
  - Moon-curse (from *Bisclavret*), in place of vampirism.
- **Ingredients:** real British hedgerow herbs and finds:
  - Mugwort, Yarrow, Feverfew, Foxglove, Henbane, Comfrey;
  - Elderflower, Rowan Berries, Meadowsweet, Vervain, St John's Wort;
  - Wolfsbane, Fly Agaric, Adder's Tongue, Toad Skin.
- **Spells:** plain names of the game's own:
  - Ember Bolt, Hoarfrost, Thunderlash, Mending, Mend Another;
  - Bark-skin, Breath of the Lake, Fade, Hush, Spirit Blade;
  - Banish the Dead, Will-o'-the-Wisp.
- **Gear tiers:**
  - kept: Iron, Steel, Silver;
  - Saxon, in place of Orcish;
  - Fae-wrought, in place of Elven;
  - Crystal, in place of Glass;
  - Annwn-forged (the Otherworld), in place of Daedric.
- **Soul gems:** "spirit vessels", in tiers of Clay, Pewter, Silver, Gold and Grail.
- **Effect names:**
  - Feather becomes Lightfoot;
  - Burden becomes Weight;
  - Night Eye becomes Owl-sight;
  - Fortify / Restore / Damage become Strengthen / Mend / Sap.
- **Skills:**
  - Blade becomes Swordplay;
  - Blunt becomes Maces & Hammers;
  - Marksman becomes Archery;
  - Armorer becomes Smithing;
  - Speechcraft becomes Persuasion;
  - Mercantile becomes Haggling.
- **Attributes:** the generic words can stay; dropping Luck and adding Presence
  (for persuasion and companions) would break the copied set.
- **Magic schools:** Evocation, Mending, Warding, Glamour.
- **Creatures:** Draugr become barrow-dead.
- **Coins:** the coin icon's "Septim" becomes "crown".

## 3. How to change it without breaking saves

1. **Ids migrate, names change freely.** Display names and text are just
   replaced. Saved ids (race, birthsign, class, follower templates, spells,
   items, ingredients, diseases, shout ids) get an **alias table**
   (`systems/id-aliases.ts`, old id → new id) applied when a save loads. The save
   version goes up by one. Mods referencing old ids go through the same table.
2. **A guardrail keeps it out.** `tools/check-guardrails.mjs` gains a denylist
   (Tamriel, Skyrim, Oblivion, Daedric, Thu'um, Argonian, Khajiit, Lydia,
   Draugr …). It is enforced on `src/` (code and comments) and README, with only
   the alias table allowed to mention old ids. It starts as a count baseline that
   may only go down, then goes to zero.
3. **One area per commit**, each with its tests updated and a save written before
   it loading after it (a migration test per area).
4. **Screenshots** of the creator, the sheet, the words window, the companion
   window and the alchemy bench after each player-facing phase.

## 4. Phases

| Phase | Content | Why first | Size |
|---|---|---|---|
| 0 | Alias table + save-version bump + guardrail baseline | Everything after relies on it | S |
| 1 | Heritages, omens, callings (the creator) | The first screen a player sees | L |
| 2 | Companions; delete the parked standing stones | Named characters are the most recognisable | M |
| 3 | Words of the Old Tongue (shouts) | The most distinctive borrowing | L |
| 4 | Spells, ingredients, diseases, effect names | Systemic names, many ids | M |
| 5 | Gear tiers, spirit vessels, creatures, coins | Items in saves and loot tables | M |
| 6 | Skills and magic schools (ids stay, names change) | Touches perks and UI everywhere | M |
| 7 | README, ROADMAP, CHANGELOG, store copy, code comments; guardrail to zero | Nothing left to find | S |

Each phase ends with unit tests, guardrails, the bundle check and the browser
tests green, and the phase's migration test passing.

## 5. Decisions for you

1. **Setting:** Arthurian Britain as above, or something else entirely?
2. **Heritages:** invented peoples (recommended), or none at all, with a
   background-and-calling creator instead?
3. **Standing stones:** delete the parked system now (recommended), or redesign
   them as stone circles in phase 2?
4. **Words:** keep a learned-power system at all? Dropping it is simpler, and the
   spells already cover the same ground.
5. **Old saves:** migrate (recommended), or accept that saves from before the
   change won't load?
