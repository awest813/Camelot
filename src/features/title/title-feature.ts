/**
 * The title screen: what the game opens on.  Continue (when there is a
 * save), New Game, Settings, Credits, and Quit on the desktop.  Play is
 * paused and input held until a choice is made.
 *
 * Inputs:   services title-host.
 * Outputs:  the `title` service (show it).
 */
import type { Feature, FeatureContext } from "../../core/kernel";
import { createServiceKey } from "../../core/kernel";
import { TitleHostKey, declareStateless } from "../services";
import { TitleScreenView } from "../../ui/title-screen";
import { dismissBootCover } from "../../ui/boot-cover";

export interface TitleService {
  /** Open the title (or, when the host says so, go straight to a new game). */
  show(): void;
  readonly isOpen: boolean;
}

export const TitleKey = createServiceKey<TitleService>("title");

export class TitleFeature implements Feature {
  public readonly id = "title";
  public readonly view = new TitleScreenView();

  public install(ctx: FeatureContext): void {
    declareStateless(ctx, "the title is shown once, at start-up");
    const host = () => ctx.kernel.services.get(TitleHostKey);
    const leave = (then: () => void) => {
      this.view.close();
      host().hold(false);
      then();
    };
    const view = this.view;
    ctx.provide(TitleKey, {
      show: () => {
        dismissBootCover();
        const h = host();
        if (h.skip()) { h.newGame(); return; }
        h.hold(true);
        view.open({
          saved: h.savedGame(),
          onContinue: () => leave(() => { if (!host().continueGame()) host().newGame(); }),
          onNewGame: () => leave(() => host().newGame()),
          onSettings: () => host().settings(),
          onCredits: () => host().credits(),
          onQuit: h.quit ? () => host().quit?.() : null,
        });
      },
      get isOpen() { return view.isOpen; },
    });
    ctx.scope.add(() => view.close());
  }
}
