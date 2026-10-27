/**
 * 設定 > 前回引継ぎのリセット（記録は消さず、リセット前の記録を前回引継の対象から外す）
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetMockDB, getMockTable, TEST_USER_ID } from './__mocks__/supabase'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { buildSession, recordsForInheritance } from '../lib/plans'
import { initialWorkoutPlans } from './fixtures/plans'
import type { WorkoutRecord } from '../types'

const PULL_PLAN = '上半身・引く'

const chinUpRecord = (fullDate: string) => ({
  id: 1791968487605, user_id: TEST_USER_ID, full_date: fullDate, date: '10/14', day: '火', type: 'workout', category: PULL_PLAN, stretches: null,
  exercises: [{
    id: 'x', exerciseId: 'sys:chin-up', name: 'チンニング', type: 'normal', targetSets: 2, defaultReps: 8, defaultWeight: -47, interval: 90,
    equipmentType: 'assist', inherited: false, options: [],
    sets: [{ setNumber: 1, reps: 8, weight: -70, completed: true }, { setNumber: 2, reps: 8, weight: -70, completed: true }]
  }]
})

beforeEach(() => {
  resetMockDB()
  vi.useRealTimers()
})

async function load() {
  const user = userEvent.setup()
  render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(() => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(), { timeout: 3000 })
  return user
}

async function startPullPlan(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('ワークアウト'))
  await user.click(screen.getByRole('radio', { name: new RegExp(PULL_PLAN) }))
  await user.click(screen.getByText('トレーニングを開始する'))
}

describe('recordsForInheritance', () => {
  const rec = (fullDate: string) => ({ id: 1, fullDate }) as WorkoutRecord
  it('リセットしていなければ全部、リセットしたあとは、その日時より新しい記録だけ', () => {
    const records = [rec('2026-10-20T00:00:00Z'), rec('2026-10-14T00:00:00+00:00')]
    expect(recordsForInheritance(records, null)).toEqual(records)
    expect(recordsForInheritance(records, '2026-10-15T00:00:00.000Z')).toEqual([records[0]])
    expect(recordsForInheritance(records, '2026-10-21T00:00:00.000Z')).toEqual([])
  })

  it('リセット後は前回の負荷を引き継がず、プランの初期値から始まる', () => {
    const pull = { ...initialWorkoutPlans.find(p => p.name === PULL_PLAN)! }
    const optionsMap = new Map([['assist', [{ label: 'ー', weight: 0 }, { label: '2本 (-47kg)', weight: -47 }, { label: '3本 (-70kg)', weight: -70 }]]])
    const row = chinUpRecord('2026-10-14T00:00:00Z')
    const record = { ...row, fullDate: row.full_date } as unknown as WorkoutRecord
    const chin = (rs: WorkoutRecord[]) => buildSession(pull, rs, optionsMap).exercises.find(e => e.name === 'チンニング')!
    expect(chin([record]).sets[0].weight).toBe(-70)
    expect(chin(recordsForInheritance([record], '2026-10-27T00:00:00Z')).sets[0].weight).toBe(-47)
    expect(chin(recordsForInheritance([record], '2026-10-27T00:00:00Z')).inherited).toBe(false)
  })
})

describe('設定の「引継ぎをリセット」', () => {
  it('確認のあとリセットすると、日時が保存され、次のトレーニングで前回引継がなくなる。記録は消えない', async () => {
    getMockTable('records').push(chinUpRecord('2026-10-14T00:00:00Z'))
    const user = await load()

    // リセット前: 前回の負荷（3本 -70kg）が引き継がれる
    await startPullPlan(user)
    expect(screen.getAllByText('前回引継').length).toBeGreaterThan(0)
    expect(screen.getAllByDisplayValue('3本 (-70kg)').length).toBeGreaterThan(0)
    await user.click(screen.getByLabelText('トレーニングを中止'))
    await user.click(screen.getByText('中止する'))

    // 設定でリセット（確認で一度止まる）
    await user.click(screen.getByText('プロフィール'))
    expect(screen.getByText('まだリセットしていません')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /引継ぎをリセット/ }))
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(getMockTable('profiles')[0]).not.toHaveProperty('inherit_reset_at')
    await user.click(screen.getByRole('button', { name: /引継ぎをリセット/ }))
    await user.click(screen.getByRole('button', { name: 'リセットする' }))

    expect(await screen.findByRole('status')).toHaveTextContent('リセットしました')
    const saved = getMockTable('profiles')[0] as unknown as { inherit_reset_at: string; height: number }
    expect(new Date(saved.inherit_reset_at).getTime()).toBeLessThanOrEqual(Date.now())
    expect(saved.height).toBe(170) // プロフィールの他の項目は変わらない
    expect(getMockTable('records')).toHaveLength(1) // 記録は消えない
    expect(screen.queryByText('まだリセットしていません')).not.toBeInTheDocument()

    // リセット後: 引き継がれず、プランの負荷（2本 -47kg）から始まる
    await startPullPlan(user)
    expect(screen.queryByText('前回引継')).not.toBeInTheDocument()
    expect(screen.getAllByDisplayValue('2本 (-47kg)').length).toBeGreaterThan(0)
    expect(screen.queryByDisplayValue('3本 (-70kg)')).not.toBeInTheDocument()
  })

  it('リセット日時は次回の読み込みでも有効（保存済みの日時を読み込む）', async () => {
    getMockTable('records').push(chinUpRecord('2026-10-14T00:00:00Z'))
    ;(getMockTable('profiles')[0] as Record<string, unknown>).inherit_reset_at = '2026-10-20T00:00:00.000Z'
    const user = await load()
    await startPullPlan(user)
    expect(screen.queryByText('前回引継')).not.toBeInTheDocument()
  })
})
