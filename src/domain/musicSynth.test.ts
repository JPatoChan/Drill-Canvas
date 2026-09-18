import { getNotesStartingInRange, midiToFrequencyHz, MusicSynthesizer } from './musicSynth'
import type { MusicScore } from './music'

const score: MusicScore = {
  title: 'Test',
  tempoMap: [{ beat: 0, bpm: 120 }],
  timeSignatures: [{ beat: 0, numerator: 4, denominator: 4 }],
  measures: [{ index: 0, startBeat: 0, beatsInMeasure: 4 }],
  events: [
    { type: 'note', startBeat: 0, durationBeats: 1, midiPitch: 60 },
    { type: 'rest', startBeat: 1, durationBeats: 1, midiPitch: null },
    { type: 'note', startBeat: 2, durationBeats: 2, midiPitch: 64 },
  ],
  totalBeats: 4,
}

describe('midiToFrequencyHz', () => {
  it('converts MIDI pitch 69 (A4) to 440 Hz', () => {
    expect(midiToFrequencyHz(69)).toBeCloseTo(440)
  })

  it('converts MIDI pitch 60 (C4) to approximately 261.63 Hz', () => {
    expect(midiToFrequencyHz(60)).toBeCloseTo(261.63, 1)
  })
})

describe('getNotesStartingInRange', () => {
  it('returns only notes (not rests) starting within the range', () => {
    expect(getNotesStartingInRange(score, 0, 1.5)).toEqual([
      { type: 'note', startBeat: 0, durationBeats: 1, midiPitch: 60 },
    ])
  })

  it('excludes notes outside the range', () => {
    expect(getNotesStartingInRange(score, 2, 4)).toEqual([
      { type: 'note', startBeat: 2, durationBeats: 2, midiPitch: 64 },
    ])
  })
})

describe('MusicSynthesizer', () => {
  it('does not throw when no Web Audio API is available (test environment)', () => {
    const synth = new MusicSynthesizer()
    expect(() => synth.sync(score, 0, 500)).not.toThrow()
    expect(() => synth.silence()).not.toThrow()
    expect(() => synth.resumeContext()).not.toThrow()
  })

  it('silence clears scheduling state without throwing when called repeatedly', () => {
    const synth = new MusicSynthesizer()
    synth.sync(score, 0, 500)
    synth.silence()
    synth.silence()
    expect(() => synth.sync(null, 0, 500)).not.toThrow()
  })
})
