# Mod Content Specification

Camelot mods are JSON descriptors loaded through a manifest file so browser runtimes can discover content deterministically.

## Folder Convention

- Manifest: `public/mods/mods-manifest.json`
- Mod descriptors: `public/mods/*.json`

## Manifest Shape

```json
{
  "mods": [
    { "id": "my_mod_id", "url": "./my-mod.json", "enabled": true }
  ]
}
```

Fields:
- `id` (string, required): unique manifest entry id.
- `url` (string, required): relative/absolute URL to mod descriptor JSON.
- `enabled` (boolean, optional): defaults to `true`; disabled entries are skipped.

## Mod Descriptor Shape

```json
{
  "id": "my_mod_id",
  "name": "My Mod",
  "version": "1.0.0",
  "content": {
    "dialogues": [],
    "quests": [],
    "items": [],
    "factions": []
  }
}
```

`content` is a **partial** bundle; omitted domains remain unchanged.

## Merge Rules

1. Base content loads first.
2. Mods load in manifest order.
3. On ID conflict within a domain (`dialogues`, `quests`, `items`, `factions`):
   - incoming mod entry replaces prior entry.
   - collision is recorded in the mod load report.

## Recommendations

- Namespace IDs by mod prefix (example: `acme_guard_token`) to avoid collisions.
- Treat collisions as deliberate overrides, not accidental duplicates.
- Keep descriptors small and focused by feature set.

## Failure Behavior

- If one mod fails to fetch/parse, loader records failure and continues loading remaining mods.
- Report contains:
  - loaded mod IDs
  - per-mod failures
  - collision records
