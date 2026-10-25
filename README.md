# Camelot Rift

A King Arthur **3v3 mobile MOBA**. Three lanes, minion waves, towers, and a throne at each end. You play one champion. The other five are bots.

The look is chunky and saturated: bright grass, toy-like trees, hard shadows underfoot, and a high three-quarter camera, in the spirit of Megabonk.

## Play

```bash
npm install
npm run dev
```

Open the page, pick a champion and a lane, then **To the rift**.

- Drag the stick (or use WASD) to move. The camera follows.
- Attacks land on their own. A creep you can finish is taken before a hero.
- On a phone, **Q W E R** cast toward the stick. On a keyboard, **Q 2 E R** cast toward the mouse (W walks). They bend toward a nearby foe.
- **R** unlocks at level 4.
- **Focus** chases one enemy hero.
- **Recall** channels you back to your well. Damage breaks it.
- **Shop** works only while you stand in your healing well. The enemy well burns.
- Win by destroying the Black Throne. Lose if the Round Table falls.

| Lane | Road |
| --- | --- |
| Top | Saxon Road |
| Mid | King's Way |
| Bot | Lake Road |

| Champion | Role |
| --- | --- |
| Arthur | Fighter |
| Lancelot | Assassin |
| Gawain | Bruiser |
| Merlin | Mage |
| Morgan le Fay | Enchanter |
| Tristan | Marksman |

Champions on the field use the KayKit Adventurers models (CC0). Minions, towers, and the island are built from simple meshes so the match stays light on a phone.

## Checks

```bash
npm test
npm run build
```
