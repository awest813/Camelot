import { describe, expect, it } from "vitest";
import { FireFxPort, type FireInfo } from "./fire-fx-port";

const fire = (gone = false) => ({ flame: { isDisposed: () => gone }, light: {}, kind: "torch" }) as unknown as FireInfo;

describe("FireFxPort", () => {
  it("holds fires until the effects arrive, then hands them over (not the ones already gone) and passes the rest straight on", () => {
    const port = new FireFxPort();
    const a = fire(), gone = fire(true), b = fire();
    port.attach(a);
    port.attach(gone);
    expect(port.waiting).toBe(2);
    const got: FireInfo[] = [];
    port.connect({ attach: (i) => { got.push(i); } });
    expect(got).toEqual([a]);
    expect(port.waiting).toBe(0);
    port.attach(b);
    expect(got).toEqual([a, b]);
  });
});
