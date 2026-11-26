/**
 * The sun-rays post-process (src/rendering/sun-rays.ts) does what it is for,
 * on WebGL2: light from the bright sky streams over the dark bars in front
 * of the sun, there is no change at zero exposure, and none with the sun
 * behind the camera.  (Its WGSL is validated in wgsl-shaders.spec.ts.)
 *
 * Run: npm run test:e2e -- sun-rays
 */
import { test, expect } from "@playwright/test";

test("sun rays stream over what stands in front of the sun", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tests/e2e/harness/sun-rays.html");
  await expect.poll(() => page.evaluate(() => typeof (window as any).__run), { timeout: 30_000 }).toBe("function");
  const r = await page.evaluate(() => (window as any).__run());
  console.log("sun rays:", JSON.stringify(r));
  expect(r.barColumns, "the bars are in view").toBeGreaterThan(20);
  expect(r.off.bars, "bars are dark without rays").toBeLessThan(20);
  expect(r.on.bars - r.off.bars, "rays brighten the bars").toBeGreaterThan(15);
  expect(Math.abs(r.behind.bars - r.off.bars), "no rays with the sun behind").toBeLessThan(2);
  expect(errors).toEqual([]);
});
