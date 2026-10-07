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
// タイマーは種目の行の中にだけ出る。運動中は残り秒数（timer）、休憩中は次の種目の NEXT
const working = () => screen.queryByRole('timer')
const resting = () => screen.queryByText(/^NEXT/)

// 畳まれている周は開いてから確認する
const done = (name: string, round: number) => {
  const label = `${name} ${round}周目を完了`
  if (!screen.queryByLabelText(label)) fireEvent.click(screen.getByLabelText(`${round}周目を開く`))
  return screen.getByLabelText(label).className.includes('bg-green-500')
}

beforeEach(() => {
  resetMockDB()
  vi.useFakeTimers({ shouldAdvanceTime: true })
})
afterEach(() => { vi.useRealTimers() })

describe('サーキットのタイマーは次の種目へ自動で進む', () => {
  it('運動 → 休憩 → 次の種目の運動、と続き、最後の種目で止まる', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    expect(working()).toBeInTheDocument()

    await advance(6_000) // 運動5秒が終わり、1秒の間のあと休憩へ
    expect(done('プッシュアップ', 1)).toBe(true)
    await advance(1_000)
    expect(resting()).toBeInTheDocument()

    await advance(3_500) // 休憩3秒が終わると、次の種目（スクワット1周目）の運動が始まる
    expect(working()).toBeInTheDocument()
    expect(done('スクワット', 1)).toBe(false)

    await advance(6_000) // スクワット1周目が完了 → 休憩 → 2周目のプッシュアップ
    expect(done('スクワット', 1)).toBe(true)
    await advance(1_000 + 3_500)
    expect(working()).toBeInTheDocument()

    await advance(6_000 + 1_000 + 3_500) // プッシュアップ2周目 → スクワット2周目
    expect(done('プッシュアップ', 2)).toBe(true)
    expect(working()).toBeInTheDocument()

    await advance(6_000 + 1_000 + 3_500) // 最後の種目の休憩が終わっても、次は無いので止まる
    expect(done('スクワット', 2)).toBe(true)
    expect(working()).not.toBeInTheDocument()
    expect(resting()).not.toBeInTheDocument()
  })

  it('休憩が0秒でも次の種目へ進む', async () => {
    await startCircuitWorkout(0)
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(6_000 + 1_500)
    expect(done('プッシュアップ', 1)).toBe(true)
    expect(working()).toBeInTheDocument()
  })

  it('完了済みの種目は飛ばして進む', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('スクワット 1周目を完了')) // 手動で完了（休憩タイマーが始まる）
    fireEvent.click(screen.getByLabelText('タイマーを止める'))
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(6_000 + 1_000 + 3_500) // スクワット1周目は飛ばして、プッシュアップ2周目へ
    expect(working()).toBeInTheDocument()
    expect(done('プッシュアップ', 2)).toBe(false)
    await advance(6_000)
    expect(done('プッシュアップ', 2)).toBe(true)
    expect(done('スクワット', 1)).toBe(true)
  })
})

describe('動いているタイマーが、どの種目か分かる', () => {
  const rowOf = (el: HTMLElement) => el.closest('div.rounded-xl') as HTMLElement

  it('実行中の種目だけがオレンジのベタ塗りで強調され、ほかの行は薄くなる', async () => {
    await startCircuitWorkout()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(rowOf(screen.getByLabelText('スクワット 1周目を完了')).className).not.toContain('opacity-40')

    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    const running = rowOf(screen.getByRole('timer'))
    expect(running).toHaveTextContent('プッシュアップ')
    expect(running).toHaveTextContent('実施中')
    expect(running.className).toContain('bg-orange-500')
    expect(running.className).not.toContain('opacity-40')
    expect(screen.getByLabelText('プッシュアップ 1周目のタイマーを一時停止')).toBeInTheDocument()
    // 同じサーキットのほかの種目は薄くなり、枠は付かない
    const other = rowOf(screen.getByLabelText('スクワット 1周目を完了'))
    expect(other.className).toContain('opacity-40')
    expect(other.className).not.toContain('bg-orange-500')
  })

  it('休憩中は強調が消え、次の種目に NEXT が付き、運動が始まると強調がそちらへ移る', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))

    await advance(6_000 + 1_000) // 運動が終わり、休憩へ
    expect(screen.queryByRole('timer')).not.toBeInTheDocument() // いま運動中の種目は無い
    const next = rowOf(screen.getByText(/^NEXT/))
    expect(next).toHaveTextContent('スクワット')
    expect(next).toHaveTextContent('休憩')
    expect(next.className).not.toContain('opacity-40')
    expect(next.className).not.toContain('bg-orange-500')

    await advance(3_500) // 次の種目の運動が始まる
    expect(screen.queryByText(/^NEXT/)).not.toBeInTheDocument()
    const moved = rowOf(screen.getByRole('timer'))
    expect(moved).toHaveTextContent('スクワット')
    expect(moved.className).toContain('bg-orange-500')
  })

  it('タイマーは種目の行の中にだけ出て、下に浮かぶ表示は出ない（休憩だけのときを除く）', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    expect(screen.getAllByRole('timer')).toHaveLength(1)
    expect(screen.queryByText('WORK')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('タイマーを止める')).not.toBeInTheDocument()

    await advance(6_000 + 1_000) // サーキットの休憩は、次の種目の行に出る
    expect(resting()).toBeInTheDocument()
    expect(screen.queryByText('REST')).not.toBeInTheDocument()

    // 行が無い休憩（手動で完了したとき）だけ、下の表示で残り時間を出す
    fireEvent.click(screen.getByLabelText('スクワット 1周目を完了'))
    expect(screen.getByText('REST')).toBeInTheDocument()
  })

  it('実行中の周を手動で閉じても、タイマーが見えるよう開いたままになる', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    fireEvent.click(screen.getByLabelText('1周目を閉じる'))
    expect(working()).toBeInTheDocument()
    expect(screen.getByLabelText('1周目を閉じる')).toHaveAttribute('aria-expanded', 'true')
  })

  it('行の一時停止ボタンで止めて、再開できる', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを一時停止'))
    expect(rowOf(screen.getByRole('timer'))).toHaveTextContent('一時停止中')
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを再開'))
    expect(rowOf(screen.getByRole('timer'))).toHaveTextContent('実施中')
  })
})

describe('タイマーの一時停止', () => {
  it('一時停止すると時間が進まず、再開すると残りから続きが動く', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(2_000)
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを一時停止'))
    expect(working()).toHaveTextContent('一時停止中')

    await advance(30_000) // 止めている間は完了しない
    expect(done('プッシュアップ', 1)).toBe(false)
    expect(working()).toHaveTextContent('一時停止中')

    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを再開'))
    expect(working()).toBeInTheDocument()
    await advance(2_000) // 残り3秒のうち2秒。まだ終わらない
    expect(done('プッシュアップ', 1)).toBe(false)
    await advance(1_500)
    expect(done('プッシュアップ', 1)).toBe(true)
  })

  it('休憩中も、次の種目の行のボタンで一時停止でき、再開後に次の種目へ進む', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(6_000 + 1_500) // 休憩に入って1.5秒ほど
    expect(resting()).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('スクワット 1周目のタイマーを一時停止'))
    await advance(20_000)
    expect(resting()).toHaveTextContent('一時停止中')
    expect(working()).not.toBeInTheDocument() // 止めている間は次へ進まない
    fireEvent.click(screen.getByLabelText('スクワット 1周目のタイマーを再開'))
    await advance(2_000)
    expect(working()).toBeInTheDocument()
  })

  it('休憩中に「止める」と、次の種目へ自動で進まず止まる', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    await advance(6_000 + 1_500)
    fireEvent.click(screen.getByLabelText('スクワット 1周目のタイマーを止める'))
    await advance(10_000)
    expect(resting()).not.toBeInTheDocument()
    expect(working()).not.toBeInTheDocument()
  })

  it('一時停止中に「止める」と、タイマーが消える', async () => {
    await startCircuitWorkout()
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを開始'))
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを一時停止'))
    fireEvent.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを止める'))
    expect(working()).not.toBeInTheDocument()
    expect(screen.queryByText('一時停止中')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('プッシュアップ 1周目のタイマーを再開')).not.toBeInTheDocument()
  })
})
