import type { MusicEvent, MusicScore } from './music'

export const midiToFrequencyHz = (midiPitch: number): number => 440 * 2 ** ((midiPitch - 69) / 12)

/** Pure helper: notes that should be sounding or starting within [fromBeat, toBeat). */
export const getNotesStartingInRange = (
  score: MusicScore,
  fromBeat: number,
  toBeat: number,
): MusicEvent[] => score.events.filter(
  (event) => event.type === 'note'
    && event.midiPitch !== null
    && event.startBeat >= fromBeat
    && event.startBeat < toBeat,
)

type ActiveVoice = {
  oscillator: OscillatorNode
  gain: GainNode
}

const scheduleLookaheadBeats = 0.5
const releaseSeconds = 0.03
const noteGainPeak = 0.18

/**
 * First-pass Web Audio synthesizer for imported score playback. Driven externally by the same
 * clock that advances drill animation (via `sync`), rather than an independent timer, to avoid drift.
 */
export class MusicSynthesizer {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private activeVoices = new Map<number, ActiveVoice>()
  private scheduledEventIndices = new Set<number>()

  private ensureContext(): AudioContext | null {
    if (this.audioContext) {
      return this.audioContext
    }

    if (typeof AudioContext === 'undefined') {
      return null
    }

    this.audioContext = new AudioContext()
    const compressor = this.audioContext.createDynamicsCompressor()
    const masterGain = this.audioContext.createGain()
    masterGain.gain.value = 1
    masterGain.connect(compressor)
    compressor.connect(this.audioContext.destination)
    this.masterGain = masterGain

    return this.audioContext
  }

  /** Resumes the underlying audio context (required after user interaction / on resume). */
  resumeContext(): void {
    void this.ensureContext()?.resume()
  }

  /** Immediately stops all currently sounding notes and clears scheduling state. */
  silence(): void {
    for (const voice of this.activeVoices.values()) {
      try {
        voice.oscillator.stop()
      } catch {
        // Already stopped.
      }
    }
    this.activeVoices.clear()
    this.scheduledEventIndices.clear()
  }

  /**
   * Schedules any notes starting within a short lookahead window of `currentBeat`. Call this once
   * per animation frame while playback is active, passing the current tempo in ms-per-beat.
   */
  sync(score: MusicScore | null, currentBeat: number, millisecondsPerBeat: number): void {
    const audioContext = this.ensureContext()
    if (!audioContext || !score || !this.masterGain) {
      return
    }

    const toBeat = currentBeat + scheduleLookaheadBeats

    for (let index = 0; index < score.events.length; index += 1) {
      const event = score.events[index]
      if (
        this.scheduledEventIndices.has(index)
        || event.type !== 'note'
        || event.midiPitch === null
        || event.startBeat < currentBeat
        || event.startBeat >= toBeat
      ) {
        continue
      }

      this.scheduledEventIndices.add(index)
      const startDelaySeconds = ((event.startBeat - currentBeat) * millisecondsPerBeat) / 1000
      const durationSeconds = (event.durationBeats * millisecondsPerBeat) / 1000
      this.playNote(audioContext, this.masterGain, index, event.midiPitch, startDelaySeconds, durationSeconds)
    }
  }

  private playNote(
    audioContext: AudioContext,
    masterGain: GainNode,
    eventIndex: number,
    midiPitch: number,
    startDelaySeconds: number,
    durationSeconds: number,
  ): void {
    const startTime = audioContext.currentTime + Math.max(0, startDelaySeconds)
    const stopTime = startTime + Math.max(0.05, durationSeconds)
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.value = midiToFrequencyHz(midiPitch)
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(noteGainPeak, startTime + 0.01)
    gain.gain.setValueAtTime(noteGainPeak, Math.max(startTime + 0.01, stopTime - releaseSeconds))
    gain.gain.linearRampToValueAtTime(0, stopTime)

    oscillator.connect(gain).connect(masterGain)
    oscillator.start(startTime)
    oscillator.stop(stopTime)
    oscillator.onended = () => this.activeVoices.delete(eventIndex)

    this.activeVoices.set(eventIndex, { oscillator, gain })
  }
}
