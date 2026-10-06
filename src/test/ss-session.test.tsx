/**
 * ブルガリアンSS（スプリットスクワット）機能テスト – セッション記録
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { resetMockDB, getMockRecords, TEST_USER_ID } from './__mocks__/supabase'
import { LOWER_PLAN_NAME } from './fixtures/plans'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { generateEquipmentOptions, DEFAULT_LOAD_EQUIPMENT } from '../lib/equipmentUtils'

const vestEquipment = DEFAULT_LOAD_EQUIPMENT.find(e => e.id === 'vest')!

beforeEach(() => {
  resetMockDB()
  vi.useRealTimers()
})

const setChecks = () => screen.getAllByTestId('set-check')

// Helper: コンポーネントをレンダリングしデータロード完了を待つ
async function renderAndWaitLoad() {
  render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(
    () => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(),
    { timeout: 3000 },
  )
}

// Helper: ワークアウトタブで下半身プランを選んだ状態にする
async function openLowerPlanWorkoutTab() {
  await renderAndWaitLoad()
  fireEvent.click(screen.getByText('ワークアウト'))
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(LOWER_PLAN_NAME) }))
  await waitFor(
    () => expect(screen.getByText('トレーニングを開始する')).toBeInTheDocument(),
    { timeout: 3000 },
  )
}

async function startLowerPlanSession() {
  await openLowerPlanWorkoutTab()
  fireEvent.click(screen.getByText('トレーニングを開始する'))
  await waitFor(
    () => expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument(),
    { timeout: 3000 },
  )
}

async function openLowerPlanDetail() {
  await renderAndWaitLoad()
  fireEvent.click(screen.getByText('プラン'))
  fireEvent.click(screen.getByText(LOWER_PLAN_NAME))
}

// ─────────────────────────────────────────────────────────────────────────────

describe('FitTrack – SS プランタブ表示', () => {
  it('下半身プランにブルガリアンSSが2種目表示される', async () => {
    await openLowerPlanDetail()
    await waitFor(() => {
      expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument()
      expect(screen.getByText('ブルガリアンSS（右）')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('プラン詳細の見出しはプラン名', async () => {
    await openLowerPlanDetail()
    await waitFor(
      () => expect(screen.getByRole('heading', { name: LOWER_PLAN_NAME })).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })

  it('SS種目のインターバル表示（180s）が確認できる', async () => {
    await openLowerPlanDetail()
    await waitFor(
      () => expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument(),
      { timeout: 3000 },
    )
    // インターバルタグ "180s" が複数ある（左右それぞれ）
    expect(screen.getAllByText('180s').length).toBeGreaterThanOrEqual(2)
  })
})

describe('FitTrack – SS ワークアウト開始', () => {
  it('下半身プラン選択で開始ボタンが表示される', async () => {
    await openLowerPlanWorkoutTab()
    expect(screen.getByText('トレーニングを開始する')).toBeInTheDocument()
  })

  it('セッション開始でSS左右種目が表示される', async () => {
    await startLowerPlanSession()
    expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument()
    expect(screen.getByText('ブルガリアンSS（右）')).toBeInTheDocument()
  })

  it('SS各種目に「4 Sets」バッジが表示される', async () => {
    await startLowerPlanSession()
    const setBadges = screen.getAllByText('4 Sets')
    // SS左右それぞれ4セット
    expect(setBadges.length).toBeGreaterThanOrEqual(2)
  })

  it('前回引継バッジは初回セッションでは表示されない', async () => {
    await startLowerPlanSession()
    expect(screen.queryByText('前回引継')).not.toBeInTheDocument()
  })
})

describe('FitTrack – SS セット完了・重量操作', () => {
  it('負荷セレクタにベストの重量オプション(+5.25kg)が存在する', async () => {
    await startLowerPlanSession()

    const selects = document.querySelectorAll('select')
    const vestSelects = Array.from(selects).filter(s =>
      Array.from(s.options).some(o => o.text.includes('+5.25kg')),
    )
    expect(vestSelects.length).toBeGreaterThan(0)
  })

  it('SSのデフォルト重量が5.25kg（ベスト1段階目）', async () => {
    await startLowerPlanSession()

    const selects = document.querySelectorAll('select')
    const vestSelects = Array.from(selects).filter(s =>
      Array.from(s.options).some(o => o.text.includes('+5.25kg')),
    )
    expect(Number((vestSelects[0] as HTMLSelectElement).value)).toBe(5.25)
  })

  it('完了ボタン押下でグリーンのボタンが出現する', async () => {
    await startLowerPlanSession()

    const firstCheck = setChecks()[0]
    await act(async () => {
      fireEvent.click(firstCheck)
    })

    // Re-query after state update
    await waitFor(
      () => {
        const greenButtons = document.querySelectorAll('button.bg-green-500')
        expect(greenButtons.length).toBeGreaterThan(0)
      },
      { timeout: 3000 },
    )
  })

  it('完了後はCheckCircleアイコンが緑に切り替わる', async () => {
    await startLowerPlanSession()

    await act(async () => {
      fireEvent.click(setChecks()[0])
    })

    await waitFor(
      () => {
        const greenButtons = document.querySelectorAll('button.bg-green-500')
        expect(greenButtons.length).toBeGreaterThan(0)
      },
      { timeout: 3000 },
    )
  })

  it('左（1セット目）完了だけではレストが始まらない', async () => {
    await startLowerPlanSession()

    // 最初のチェックボタン = ブルガリアンSS（左）の1セット目
    const checkButtons = setChecks()
    await act(async () => {
      fireEvent.click(checkButtons[0])
    })

    // 左右で1セット扱いのため、左だけではレストタイマーが起動しない
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(screen.queryByText('REST')).not.toBeInTheDocument()
  })

  it('左右とも1セット目を完了するとレストが始まる', async () => {
    await startLowerPlanSession()

    // ブルガリアンSS（左）の4セット分、続けて（右）の4セット分のチェックボタンが並ぶ
    await act(async () => {
      fireEvent.click(setChecks()[0]) // 左 1セット目
    })
    await act(async () => {
      // 左の完了で行が再レンダリングされるため、都度DOMを再取得する
      fireEvent.click(setChecks()[4]) // 右 1セット目（左が4セット分なのでindex4から）
    })

    await waitFor(
      () => expect(screen.getByText('REST')).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })
})

describe('FitTrack – SS セッション保存', () => {
  it('「完了して保存」でrecordsにSSデータが記録される', async () => {
    await startLowerPlanSession()

    // 1セット完了
    const checkButtons = setChecks()
    fireEvent.click(checkButtons[0])

    await act(async () => {
      fireEvent.click(screen.getByText('完了して保存'))
    })

    await waitFor(
      () => {
        const saved = getMockRecords() as Array<Record<string, unknown>>
        expect(saved).toHaveLength(1)
      },
      { timeout: 3000 },
    )

    const saved = getMockRecords() as Array<Record<string, unknown>>
    const record = saved[0]
    expect(record.type).toBe('workout')
    // session.day は「今日の曜日」が記録される
    expect(typeof record.day).toBe('string')

    const exercises = record.exercises as Array<{ name: string; sets: Array<{ completed: boolean; weight: number }> }>
    expect(record.category).toBe(LOWER_PLAN_NAME)
    // 下半身プランのSS種目が記録されている
    const ssLeft = exercises.find(e => e.name === 'ブルガリアンSS（左）')
    expect(ssLeft).toBeDefined()
    expect(ssLeft!.sets[0].weight).toBe(5.25)
  })

  it('中止確認ダイアログが表示される', async () => {
    await startLowerPlanSession()

    // 戻るボタン（ChevronLeft）をクリック
    fireEvent.click(screen.getByLabelText('トレーニングを中止'))

    await waitFor(
      () => expect(screen.getByText('トレーニングを中止しますか？')).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })

  it('中止後はワークアウト待機画面に戻る', async () => {
    await startLowerPlanSession()

    fireEvent.click(screen.getByLabelText('トレーニングを中止'))

    await waitFor(
      () => screen.getByText('中止する'),
      { timeout: 3000 },
    )
    fireEvent.click(screen.getByText('中止する'))

    await waitFor(
      () => expect(screen.getByText('今日のプランを選ぶ')).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })
})

describe('ベスト重量オプション生成（純粋関数）', () => {
  it('generateEquipmentOptions が11個（ー + 10段階）を返す', () => {
    const opts = generateEquipmentOptions(vestEquipment)
    expect(opts).toHaveLength(11)
  })

  it('重量が昇順で並んでいる', () => {
    const opts = generateEquipmentOptions(vestEquipment)
    for (let i = 1; i < opts.length; i++) {
      expect(opts[i].weight).toBeGreaterThan(opts[i - 1].weight)
    }
  })

  it('5.25 → 8 → 10.75 → 13.5 のステップが正確', () => {
    const opts = generateEquipmentOptions(vestEquipment)
    expect(opts[1].weight).toBe(5.25)
    expect(opts[2].weight).toBe(8)
    expect(opts[3].weight).toBe(10.75)
    expect(opts[4].weight).toBe(13.5)
  })

  it('最大値30kg以下', () => {
    const opts = generateEquipmentOptions(vestEquipment)
    expect(Math.max(...opts.map(o => o.weight))).toBeLessThanOrEqual(30)
  })
})
