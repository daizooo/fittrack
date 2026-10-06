/**
 * プラン自由作成・ストレッチ・オンボーディング・記録タブ統合のテスト
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetMockDB, getMockTable, getMockRecords, TEST_USER_ID } from './__mocks__/supabase'
import { LOWER_PLAN_NAME } from './fixtures/plans'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { computeStats, monthCalendarCells } from '../lib/stats'
import { expandStretches, recommendPlanId } from '../lib/plans'
import { initialWorkoutPlans } from './fixtures/plans'
import type { WorkoutRecord } from '../types'

beforeEach(() => {
  resetMockDB()
  vi.useRealTimers()
})

async function renderAndWaitLoad() {
  render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(
    () => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(),
    { timeout: 3000 },
  )
}

describe('プラン編集 – 入力が1文字で途切れない（回帰テスト）', () => {
  it('プラン名・種目名・ストレッチ名を続けて入力できる', async () => {
    const user = userEvent.setup()
    await renderAndWaitLoad()
    await user.click(screen.getByText('プラン'))
    await user.click(screen.getByText('新しいプランを作成'))

    const nameInput = screen.getByLabelText('プラン名')
    await user.type(nameInput, '脚の日スペシャル')
    expect(nameInput).toHaveValue('脚の日スペシャル')
    expect(document.activeElement).toBe(nameInput)

    await user.click(screen.getByText('種目を追加'))
    const exName = screen.getByLabelText('種目名')
    await user.type(exName, 'スクワット')
    expect(exName).toHaveValue('スクワット')

    await user.click(screen.getAllByText('追加')[0]) // ウォームアップの「追加」
    const stName = screen.getByLabelText('ウォームアップストレッチ名')
    await user.type(stName, '足首まわし')
    expect(stName).toHaveValue('足首まわし')
  })

  it('数値欄は一度空にして打ち直せる', async () => {
    const user = userEvent.setup()
    await renderAndWaitLoad()
    await user.click(screen.getByText('プラン'))
    await user.click(screen.getByText('新しいプランを作成'))
    await user.click(screen.getByText('種目を追加'))

    const restInput = screen.getAllByRole('spinbutton').find(el => (el as HTMLInputElement).value === '60')!
    await user.clear(restInput)
    await user.type(restInput, '120')
    expect(restInput).toHaveValue(120)
  })
})

describe('プランの作成・保存', () => {
  it('ストレッチ付きの新しいプランを保存できる', async () => {
    const user = userEvent.setup()
    await renderAndWaitLoad()
    await user.click(screen.getByText('プラン'))
    await user.click(screen.getByText('新しいプランを作成'))

    await user.type(screen.getByLabelText('プラン名'), '全身サーキット')
    await user.click(screen.getByText('種目を追加'))
    await user.type(screen.getByLabelText('種目名'), 'バーピー')
    await user.selectOptions(screen.getByLabelText('ウォームアップの定番から追加'), '0')
    await user.selectOptions(screen.getByLabelText('クールダウンの定番から追加'), '0')
    await user.click(screen.getByText('保存'))

    await waitFor(() => expect(screen.getByRole('heading', { name: '全身サーキット' })).toBeInTheDocument())
    const saved = getMockTable('workout_plans').find(r => r.name === '全身サーキット')!
    expect(saved).toBeDefined()
    expect((saved.exercises as { name: string }[])[0].name).toBe('バーピー')
    expect((saved.warmup as { name: string }[])[0].name).toBe('アームサークル')
    expect((saved.cooldown as { name: string; bilateral?: boolean }[])[0]).toMatchObject({ name: '胸のストレッチ', bilateral: true })
  })

  it('プラン名が空だと保存できない', async () => {
    const user = userEvent.setup()
    await renderAndWaitLoad()
    await user.click(screen.getByText('プラン'))
    await user.click(screen.getByText('新しいプランを作成'))
    await user.click(screen.getByText('保存'))
    expect(screen.getByRole('alert')).toHaveTextContent('プラン名を入力してください')
  })

  it('プランを削除できる', async () => {
    const user = userEvent.setup()
    await renderAndWaitLoad()
    await user.click(screen.getByText('プラン'))
    await user.click(screen.getByText('上半身・肩'))
    await user.click(screen.getByLabelText('プランを削除'))
    await user.click(screen.getByText('削除する'))
    await waitFor(() => expect(screen.getByText('マイプラン')).toBeInTheDocument())
    expect(screen.queryByText('上半身・肩')).not.toBeInTheDocument()
    expect(getMockTable('workout_plans').some(r => r.name === '上半身・肩')).toBe(false)
  })
})

describe('ワークアウト – プラン選択とストレッチ', () => {
  it('作成済みプランが一覧表示され、未実施の先頭がおすすめになる', async () => {
    await renderAndWaitLoad()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(initialWorkoutPlans.length)
    expect(within(radios[0]).getByText('おすすめ')).toBeInTheDocument()
    expect(radios[0]).toHaveAttribute('aria-checked', 'true')
  })

  it('左右ストレッチは左・右の2行に展開され、完了状態が記録に残る', async () => {
    await renderAndWaitLoad()
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(LOWER_PLAN_NAME) }))
    fireEvent.click(screen.getByText('トレーニングを開始する'))

    await waitFor(() => expect(screen.getByText('ウォームアップ')).toBeInTheDocument())
    expect(screen.getByText('レッグスイング（左）')).toBeInTheDocument()
    expect(screen.getByText('レッグスイング（右）')).toBeInTheDocument()
    expect(screen.getByText('ハムストリング（左）')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('レッグスイング（左）を完了'))
    await act(async () => { fireEvent.click(screen.getByText('完了して保存')) })

    await waitFor(() => expect(getMockRecords()).toHaveLength(1))
    const rec = getMockRecords()[0] as { stretches: { warmup: { name: string; completed: boolean }[] } }
    expect(rec.stretches.warmup.find(s => s.name === 'レッグスイング（左）')?.completed).toBe(true)
    expect(rec.stretches.warmup.find(s => s.name === 'レッグスイング（右）')?.completed).toBe(false)
  })

  it('ストレッチのタイマー終了で自動的に完了になり、まとめて開始は次へ進む', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await renderAndWaitLoad()
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(LOWER_PLAN_NAME) }))
    fireEvent.click(screen.getByText('トレーニングを開始する'))
    await waitFor(() => expect(screen.getByText('ウォームアップ')).toBeInTheDocument())

    fireEvent.click(screen.getAllByText('まとめて開始')[0])
    expect(screen.getByText('STRETCH')).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(21_000) }) // レッグスイング（左）20秒
    await waitFor(() =>
      expect(screen.getByLabelText('レッグスイング（左）を完了').className).toContain('bg-green-500'))

    await act(async () => { vi.advanceTimersByTime(1_600) }) // 次のストレッチへの間
    expect(screen.getByText('STRETCH')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('オンボーディング（アカウント作成時の身体情報）', () => {
  it('新規ユーザーは身体情報を登録すると、プロフィール・体重ログ・サンプルプランが作られる', async () => {
    resetMockDB({ newUser: true })
    const user = userEvent.setup()
    await renderAndWaitLoad()

    expect(screen.getByText('はじめに身体情報を登録')).toBeInTheDocument()
    const submit = screen.getByText('登録してはじめる')
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/生年月日/), { target: { value: '1990-04-01' } })
    await user.click(screen.getByText('男性'))
    await user.type(screen.getByLabelText(/身長/), '172')
    await user.type(screen.getByLabelText(/現在の体重/), '68.5')
    await user.click(submit)

    await waitFor(() => expect(screen.getByText('今日のプランを選ぶ')).toBeInTheDocument())
    expect(getMockTable('profiles')[0]).toMatchObject({ height: 172, birth_date: '1990-04-01', gender: 'male' })
    expect(getMockTable('body_logs')[0]).toMatchObject({ weight: 68.5 })
    expect(getMockTable('workout_plans').length).toBeGreaterThan(0)
  })

  it('登録済みユーザーにはオンボーディングを出さず、プロフィールは表示のみ（目標・スケジュールは無い）', async () => {
    await renderAndWaitLoad()
    expect(screen.queryByText('はじめに身体情報を登録')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('プロフィール'))
    expect(screen.getByText('170')).toBeInTheDocument()
    expect(screen.queryByText('身体情報を保存')).not.toBeInTheDocument()
    expect(screen.queryByText('目標・スケジュール')).not.toBeInTheDocument()
    expect(screen.getByText('登録内容を修正')).toBeInTheDocument()
  })
})

describe('記録タブ（履歴＋分析の統合）', () => {
  it('ナビは4タブで、休養を記録すると記録タブに一覧とサマリーが出る', async () => {
    await renderAndWaitLoad()
    expect(screen.queryByText('履歴')).not.toBeInTheDocument()
    expect(screen.queryByText('分析')).not.toBeInTheDocument()

    await act(async () => { fireEvent.click(screen.getByText('今日は休養する')) })
    await waitFor(() => expect(screen.getByText('記録一覧')).toBeInTheDocument())
    expect(screen.getByText('活動カレンダー')).toBeInTheDocument()
    expect(screen.getByText('休養日')).toBeInTheDocument()
  })
})

describe('集計ロジック（純粋関数）', () => {
  const rec = (over: Partial<WorkoutRecord>): WorkoutRecord => ({
    id: 1, date: '1/1', fullDate: '2026-01-01T00:00:00Z', day: '木', type: 'workout', exercises: [], ...over
  })

  it('computeStats はプラン別回数と実行率を返す', () => {
    const s = computeStats([
      rec({ category: 'A' }), rec({ category: 'A' }), rec({ category: 'B' }), rec({ type: 'rest' })
    ])
    expect(s.workoutDays).toBe(3)
    expect(s.restDays).toBe(1)
    expect(s.consistencyRate).toBe(75)
    expect(s.planBreakdown[0]).toEqual({ name: 'A', count: 2, pct: 67 })
  })

  it('monthCalendarCells は日曜始まりで7の倍数のマスを返す', () => {
    const cells = monthCalendarCells(new Date(2026, 9, 1)) // 2026年10月1日は木曜
    expect(cells.length % 7).toBe(0)
    expect(cells.slice(0, 4).every(c => c === null)).toBe(true)
    expect(cells[4]?.getDate()).toBe(1)
  })

  it('expandStretches は左右指定を2行に展開する', () => {
    const out = expandStretches([{ id: 'a', name: '腸腰筋', seconds: 30, bilateral: true }, { id: 'b', name: '前屈', seconds: 20 }])
    expect(out.map(s => s.name)).toEqual(['腸腰筋（左）', '腸腰筋（右）', '前屈'])
  })

  it('recommendPlanId は最も前回から日が空いたプランを選ぶ', () => {
    const plans = initialWorkoutPlans.slice(0, 2)
    const records = [
      rec({ category: plans[0].name, fullDate: '2026-10-05T00:00:00Z' }),
      rec({ category: plans[1].name, fullDate: '2026-10-01T00:00:00Z' })
    ]
    expect(recommendPlanId(plans, records)).toBe(plans[1].id)
  })
})
