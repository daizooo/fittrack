import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock AudioContext (not available in jsdom)
const mockOscillator = {
  type: 'sine' as OscillatorType,
  frequency: { setValueAtTime: vi.fn() },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}
const mockGain = {
  gain: {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
}

class MockAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  createOscillator() { return mockOscillator }
  createGain() { return mockGain }
  resume() { return Promise.resolve() }
}

Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: MockAudioContext,
})
