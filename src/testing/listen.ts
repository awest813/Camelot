/**
 * Tests: listen to what a system reports on its event bus.  Gives the
 * system a bus if it has none, and calls `fn` with each payload.
 */
import { GameEventBus, type GameEventCallback, type GameEventType } from "../systems/event-bus";

export function listen<T extends GameEventType>(system: { events: GameEventBus | null }, event: T, fn: GameEventCallback<T>): () => void {
  system.events ??= new GameEventBus();
  return system.events.on(event, fn);
}
