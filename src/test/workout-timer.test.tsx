/**
 * ワークアウトのタイマー: サーキットの自動進行と一時停止
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { resetMockDB, getMockTable, TEST_USER_ID } from './__mocks__/supabase'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { createCircuit, planToRow } from '../lib/plans'
import type { WorkoutPlan } from '../types'

const PLAN_NAME = 'タイマー確認サーキット'

// 運動5秒 → 休憩3秒 → 次の種目、を2周
const circuitPlan = (rest = 3): WorkoutPlan => ({
  id: '00000000-0000-4000-8000-0000000000aa',
  name: PLAN_NAME,
  exercises: [{
    ...createCircuit(), id: 'ci-test', targetSets: 2, defaultReps: 5, interval: rest,
    stations: [
      { id: 'st-a', name: 'プッシュアップ', exerciseId: 'sys:push-up', equipmentType: 'bodyweight', defaultWeight: 0 },
      { id: 'st-b', name: 'スクワット', exerciseId: 'sys:squat', equipmentType: 'bodyweight', defaultWeight: 0 }
    ]
  }],
  warmup: [], cooldown: [], sortOrder: 99
})

async function startCircuitWorkout(rest?: number) {
  getMockTable('workout_plans').push(planToRow(circuitPlan(rest), TEST_USER_ID))
  render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(() => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(), { timeout: 3000 })
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(PLAN_NAME) }))
  fireEvent.click(screen.getByText('トレーニングを開始する'))
  await waitFor(() => expect(screen.getByText('サーキット')).toBeInTheDocument())
}

// 実機と同じく、再描画（次のタイマーの登録）を挟みながら少しずつ進める
const advance = async (ms: number) => {
  for (let t = 0; t < ms; t += 250) await act(async () => { vi.advanceTimersByTime(Math.min(250, ms - t)) })
}
const done = (name: string, round: number) => screen.getByLabelText(`${name} ${round}周目を完了`).className.includes('bg-green-500')

beforeEach(() => {
  resetMockDB()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers() })

describe('サーキットのタイマーは次の種目へ自動で進む', () => {
  it('運動 → 休憩 → 次の種目の運動、と続き、最後の種目で止まる', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    expect(screen.getByText('WORK')).toBeInTheDocument()

    await advance(6_000) // 運動5秒が終わり、1秒の間のあと休憩へ
    expect(done('プッシュアップ', 1)).toBe(true)
    await advance(1_000)
    expect(screen.getByText('REST')).toBeInTheDocument()

    await advance(3_500) // 休憩3秒が終わると、次の種目（スクワット1周目）の運動が始まる
    expect(screen.getByText('WORK')).toBeInTheDocument()
    expect(done('スクワット', 1)).toBe(false)

    await advance(6_000) // スクワット1周目が完了 → 休憩 → 2周目のプッシュアップ
    expect(done('スクワット', 1)).toBe(true)
    await advance(1_000 + 3_500)
    expect(screen.getByText('WORK')).toBeInTheDocument()

    await advance(6_000 + 1_000 + 3_500) // プッシュアップ2周目 → スクワット2周目
    expect(done('プッシュアップ', 2)).toBe(true)
    expect(screen.getByText('WORK')).toBeInTheDocument()

    await advance(6_000 + 1_000 + 3_500) // 最後の種目の休憩が終わっても、次は無いので止まる
    expect(done('スクワット', 2)).toBe(true)
    expect(screen.queryByText('WORK')).not.toBeInTheDocument()
    expect(screen.queryByText('REST')).not.toBeInTheDocument()
  })

  it('休憩が0秒でも次の種目へ進む', async () => {
    await startCircuitWorkout(0)
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(6_000 + 1_500)
    expect(done('プッシュアップ', 1)).toBe(true)
    expect(screen.getByText('WORK')).toBeInTheDocument()
  })

  it('完了済みの種目は飛ばして進む', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('スクワット 1周目を完了')) // 手動で完了（休憩タイマーが始まる）
    fireEvent.click(screen.getByLabelText('タイマーを止める'))
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(6_000 + 1_000 + 3_500) // スクワット1周目は飛ばして、プッシュアップ2周目へ
    expect(screen.getByText('WORK')).toBeInTheDocument()
    expect(done('プッシュアップ', 2)).toBe(false)
    await advance(6_000)
    expect(done('プッシュアップ', 2)).toBe(true)
    expect(done('スクワット', 1)).toBe(true)
  })
})

describe('タイマーの一時停止', () => {
  it('一時停止すると時間が進まず、再開すると残りから続きが動く', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(2_000)
    fireEvent.click(screen.getByLabelText('タイマーを一時停止'))
    expect(screen.getByText('PAUSE')).toBeInTheDocument()

    await advance(30_000) // 止めている間は完了しない
    expect(done('プッシュアップ', 1)).toBe(false)
    expect(screen.getByText('PAUSE')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('タイマーを再開'))
    expect(screen.getByText('WORK')).toBeInTheDocument()
    await advance(2_000) // 残り3秒のうち2秒。まだ終わらない
    expect(done('プッシュアップ', 1)).toBe(false)
    await advance(1_500)
    expect(done('プッシュアップ', 1)).toBe(true)
  })

  it('休憩中も一時停止でき、再開後に次の種目へ進む', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(6_000 + 1_500) // 休憩に入って1.5秒ほど
    expect(screen.getByText('REST')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('タイマーを一時停止'))
    await advance(20_000)
    expect(screen.getByText('PAUSE')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('タイマーを再開'))
    await advance(2_000)
    expect(screen.getByText('WORK')).toBeInTheDocument()
  })

  it('一時停止中に「止める」と、タイマーが消える', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    fireEvent.click(screen.getByLabelText('タイマーを一時停止'))
    fireEvent.click(screen.getByLabelText('タイマーを止める'))
    expect(screen.queryByText('PAUSE')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('タイマーを再開')).not.toBeInTheDocument()
  })
})
