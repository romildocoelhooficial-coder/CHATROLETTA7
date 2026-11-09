// Audio synthesizers for telephone ringtones and call feedback using Web Audio API
// Safely handles browser autoplay policies and Chrome vibration interventions

class SoundService {
  private ctx: AudioContext | null = null;
  private ringInterval: any = null;
  private isRinging = false;
  private hasUserInteracted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const handleInteraction = () => {
        this.hasUserInteracted = true;
        this.unlockAudio();
      };

      // Listen for user gesture across standard touch/click/key events
      window.addEventListener('click', handleInteraction, { passive: true });
      window.addEventListener('touchstart', handleInteraction, { passive: true });
      window.addEventListener('pointerdown', handleInteraction, { passive: true });
      window.addEventListener('keydown', handleInteraction, { passive: true });
    }
  }

  // Safe wrapper for navigator.vibrate that prevents Chrome Intervention errors
  private safeVibrate(pattern: number | number[]) {
    if (!this.hasUserInteracted) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Silently ignore if blocked by browser policy
      }
    }
  }

  public unlockAudio() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch {
      // Audio context restricted until next user gesture
    }
  }

  private getAudioContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Realistic phone outgoing ringback tone: 440Hz + 480Hz dual tone
  public startOutgoingRing() {
    this.stopAll();
    this.unlockAudio();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isRinging = true;

    const playToneBurst = () => {
      if (!this.isRinging || !this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.8);
        gain.gain.linearRampToValueAtTime(0.0001, now + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      } catch {
        // Audio playback deferred
      }
    };

    playToneBurst();
    this.ringInterval = setInterval(playToneBurst, 3500);
  }

  // Melodic, loud and distinct ringtone for incoming calls
  public startIncomingRing() {
    this.stopAll();
    this.unlockAudio();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.isRinging = true;
    this.safeVibrate([400, 200, 400, 200, 600]);

    // Classic pleasant phone melody: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz) repeated
    const melody = [
      { freq: 523.25, time: 0.00, dur: 0.18 },
      { freq: 659.25, time: 0.18, dur: 0.18 },
      { freq: 783.99, time: 0.36, dur: 0.18 },
      { freq: 1046.5, time: 0.54, dur: 0.30 },
      { freq: 783.99, time: 0.90, dur: 0.18 },
      { freq: 1046.5, time: 1.08, dur: 0.40 },
    ];

    const playCycle = () => {
      if (!this.isRinging || !this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        const now = this.ctx.currentTime;

        melody.forEach((note) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();

          osc.type = 'triangle'; // Richer, louder audible tone than sine
          osc.frequency.setValueAtTime(note.freq, now + note.time);

          gain.gain.setValueAtTime(0.0001, now + note.time);
          gain.gain.linearRampToValueAtTime(0.24, now + note.time + 0.03);
          gain.gain.linearRampToValueAtTime(0.0001, now + note.time + note.dur);

          osc.connect(gain);
          gain.connect(this.ctx!.destination);

          osc.start(now + note.time);
          osc.stop(now + note.time + note.dur + 0.05);
        });

        this.safeVibrate([400, 200, 400, 200, 600]);
      } catch {
        // Audio playback deferred
      }
    };

    playCycle();
    this.ringInterval = setInterval(playCycle, 2000);
  }

  // Two-tone connected chime
  public playConnectedChime() {
    this.stopAll();
    this.unlockAudio();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const notes = [587.33, 880.0]; // D5, A5
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.0001, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
        gain.gain.linearRampToValueAtTime(0.0001, now + i * 0.12 + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.26);
      });
      this.safeVibrate(150);
    } catch {
      // ignore
    }
  }

  // Descending hangup tone
  public playHangupTone() {
    this.stopAll();
    this.unlockAudio();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const notes = [440.0, 329.63, 220.0]; // A4, E4, A3
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.0001, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.14, now + i * 0.12 + 0.02);
        gain.gain.linearRampToValueAtTime(0.0001, now + i * 0.12 + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.22);
      });
      this.safeVibrate([80, 50, 80]);
    } catch {
      // ignore
    }
  }

  // Roulette Next skip swoosh
  public playNextSkip() {
    this.unlockAudio();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // ignore
    }
  }

  // Stop all repeating sounds and safe cancel vibration
  public stopAll() {
    this.isRinging = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    // Only call vibrate(0) if user interaction has occurred
    if (this.hasUserInteracted) {
      this.safeVibrate(0);
    }
  }
}

export const sounds = new SoundService();
