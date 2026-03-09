import { ModLoader } from "./src/framework/mods/mod-loader";

async function run() {
  const NUM_MODS = 100;
  const DELAY_MS = 20; // simulate network latency

  const mockFetch = async (url: string) => {
    await new Promise(r => setTimeout(r, DELAY_MS));
    if (url === "manifest.json") {
      const mods = Array.from({ length: NUM_MODS }, (_, i) => ({ id: `mod_${i}`, url: `mod_${i}.json` }));
      return { ok: true, status: 200, json: async () => ({ mods }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: url, content: {} }),
    };
  };

  const loader = new ModLoader(mockFetch);

  const start = performance.now();
  await loader.loadModsFromManifest("manifest.json");
  const end = performance.now();

  console.log(`Loaded ${NUM_MODS} mods in ${end - start}ms`);
}

run();
