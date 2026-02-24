import { Player } from "./player";

export interface IInteractable {
  interact(player: Player): void;
}
