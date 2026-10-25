/** Tiny synthesized bonks. No samples, so a phone can play the whole match offline. */
export class Sfx {
  private ctx: AudioContext | null = null;
  private unlocked = false;

  unlock(): void {
    const ctx = this.ensure();
    if (!ctx) return;
    this.unlocked = true;
    if (ctx.state === "suspended") void ctx.resume();
  }

  bonk(heavy = false): void {
    this.tone(heavy ? 110 : 168, heavy ? 48 : 70, heavy ? 0.16 : 0.09, "triangle", heavy ? 0.12 : 0.07);
  }

  blip(high = false): void {
    this.tone(high ? 620 : 380, high ? 880 : 240, 0.1, "square", 0.04);
  }

  boom(): void {
    this.tone(90, 36, 0.28, "sine", 0.14);
  }

  fanfare(win: boolean): void {
    const notes = win ? [523, 659, 784, 1046] : [392, 349, 311, 233];
    notes.forEach((freq, i) => {
      window.setTimeout(() => this.tone(freq, freq * 0.8, 0.16, "triangle", 0.06), i * 110);
    });
  }

  private ensure(): AudioContext | null {
    if (!this.unlocked) return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  private tone(from: number, to: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, to), ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }
}
