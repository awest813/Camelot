# Third-party notices

Camelot's own code is Apache License 2.0 (see `LICENSE`). The desktop build
also ships the following works. The pause-menu Credits dialog names them
in-game.

## Babylon.js

Apache License 2.0. Copyright Babylon.js contributors.

## Havok Physics

Distributed as `@babylonjs/havok`. Use is covered by that package's license
in `node_modules/@babylonjs/havok` after install.

## Recast Navigation

`recast-detour` wraps Recast Navigation. See that package's license after install.

## bitECS

Mozilla Public License 2.0. Copyright Nathaniel Martin and contributors.
Used unmodified from the `bitecs` package (0.4); its source and license are
in `node_modules/bitecs` after install, and at
https://github.com/NateTheGreatt/bitECS.

## Preact

MIT License. Copyright Jason Miller and contributors.

## meshoptimizer (glTF decoder)

MIT License. Copyright (C) 2016-2026, Arseny Kapoulkine. The models are
meshopt-compressed (`tools/optimize-models.mjs`); its decoder ships as
`public/vendor/meshopt_decoder.js`.

## KayKit Character Packs: Adventurers and Skeletons

CC0 1.0 Universal. Kay Lousberg, kaylousberg.com. Credit is not required and
is given anyway. License text: `public/model/kaykit/LICENSE.txt`. Textures are
colour-graded for Camelot's look (`tools/grade-kaykit-textures.mjs`).

## Quaternius models

CC0 1.0 Universal / public domain, by Quaternius (quaternius.com). Credit is
not required and is given anyway. From the free Standard versions of: Fantasy
Props MegaKit, Medieval Village MegaKit, Stylized Nature MegaKit, Modular
Character Outfits – Fantasy, Universal Base Characters, Universal Animation
Library, Characters – Fantasy Races, and Bestiary – Dungeon Monsters Kit.
They live in `public/model/quaternius/`; `quaternius-import-manifest.json`
lists which model fills each slot. Textures are downscaled and colour-graded.
Slots without an imported model use generated stand-ins (also CC0).

## Babylon.js sample meshes

CC BY 4.0. These are fetched from the Babylon.js asset CDN only when
`VITE_ENABLE_REMOTE_PROPS=true`. The Steam build does not set that flag, so
they are not part of the depot. If you turn the flag on, keep the attribution.

## Fonts

Cinzel (Natanael Gama) and Inter (Rasmus Andersson) are shipped as
`src/assets/fonts/cinzel.woff2` and `src/assets/fonts/inter.woff2` under the
SIL Open Font License, Version 1.1.

The license is at https://openfontlicense.org/open-font-license-official-text/
and the font files may be used, embedded, and redistributed under that
license. The fonts cannot be sold on their own. Reserved font names stay
with their authors.
