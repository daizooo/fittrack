/**
 * ブルガリアンSS（スプリットスクワット）機能テスト – セッション記録
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { resetMockDB, getMockRecords, TEST_USER_ID } from './__mocks__/supabase'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { generateEquipmentOptions, DEFAULT_LOAD_EQUIPMENT } from '../lib/equipmentUtils'

const vestEquipment = DEFAULT_LOAD_EQUIPMENT.find(e => e.id === 'vest')!
const SUNDAY_DAY = '日'

beforeEach(() => {
  resetMockDB()
  // フェイクタイマーはセッション完了テストのみで使用するため
  // ここでは実タイマーを使用
  vi.useRealTimers()
})

// Helper: コンポーネントをレンダリングしデータロード完了を待つ
async function renderAndWaitLoad() {
  render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(
    () => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(),
    { timeout: 3000 },
  )
}

// Helper: 日曜セッションを開始状態にする
async function openSundayWorkoutTab() {
  await renderAndWaitLoad()
  // ワークアウトタブへ
  fireEvent.click(screen.getByText('ワークアウト'))
  // 日曜を選択（ワークアウトタブの曜日ボタン）
  const dayButtons = screen.getAllByRole('button', { name: SUNDAY_DAY })
  fireEvent.click(dayButtons[dayButtons.length - 1])
  await waitFor(
    () => expect(screen.getByText('下半身＋VO₂MAX＋体幹')).toBeInTheDocument(),
    { timeout: 3000 },
  )
}

async function startSundaySession() {
  await openSundayWorkoutTab()
  fireEvent.click(screen.getByText('トレーニングを開始する'))
  await waitFor(
    () => expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument(),
    { timeout: 3000 },
  )
}

// ─────────────────────────────────────────────────────────────────────────────

describe('FitTrack – SS プランタブ表示', () => {
  it('日曜メニューにブルガリアンSSが2種目表示される', async () => {
    await renderAndWaitLoad()

    const dayButtons = screen.getAllByRole('button', { name: SUNDAY_DAY })
    fireEvent.click(dayButtons[0])

    await waitFor(() => {
      expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument()
      expect(screen.getByText('ブルガリアンSS（右）')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('日曜カテゴリは「下半身＋VO₂MAX＋体幹」', async () => {
    await renderAndWaitLoad()

    const dayButtons = screen.getAllByRole('button', { name: SUNDAY_DAY })
    fireEvent.click(dayButtons[0])

    await waitFor(
      () => expect(screen.getByText('下半身＋VO₂MAX＋体幹')).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })

  it('SS種目のインターバル表示（180s）が確認できる', async () => {
    await renderAndWaitLoad()

    const dayButtons = screen.getAllByRole('button', { name: SUNDAY_DAY })
    fireEvent.click(dayButtons[0])

    await waitFor(
      () => expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument(),
      { timeout: 3000 },
    )
    // インターバルタグ "180s" が複数ある（左右それぞれ）
    const intervalBadges = screen.getAllByText('180s')
    expect(intervalBadges.length).toBeGreaterThanOrEqual(2)
  })
})

describe('FitTrack – SS ワークアウト開始', () => {
  it('日曜セッション開始ボタンが表示される', async () => {
    await openSundayWorkoutTab()
    expect(screen.getByText('トレーニングを開始する')).toBeInTheDocument()
  })

  it('セッション開始でSS左右種目が表示される', async () => {
    await startSundaySession()
    expect(screen.getByText('ブルガリアンSS（左）')).toBeInTheDocument()
    expect(screen.getByText('ブルガリアンSS（右）')).toBeInTheDocument()
  })

  it('SS各種目に「4 Sets」バッジが表示される', async () => {
    await startSundaySession()
    const setBadges = screen.getAllByText('4 Sets')
    // SS左右それぞれ4セット
    expect(setBadges.length).toBeGreaterThanOrEqual(2)
  })

  it('前回引継バッジは初回セッションでは表示されない', async () => {
    await startSundaySession()
    expect(screen.queryByText('前回引継')).not.toBeInTheDocument()
  })
})

describe('FitTrack – SS セット完了・重量操作', () => {
  it('負荷セレクタにベストの重量オプション(+5.25kg)が存在する', async () => {
    await startSundaySession()

    const selects = document.querySelectorAll('select')
    const vestSelects = Array.from(selects).filter(s =>
      Array.from(s.options).some(o => o.text.includes('+5.25kg')),
    )
    expect(vestSelects.length).toBeGreaterThan(0)
  })

  it('SSのデフォルト重量が5.25kg（ベスト1段階目）', async () => {
    await startSundaySession()

    const selects = document.querySelectorAll('select')
    const vestSelects = Array.from(selects).filter(s =>
      Array.from(s.options).some(o => o.text.includes('+5.25kg')),
    )
    expect(Number((vestSelects[0] as HTMLSelectElement).value)).toBe(5.25)
  })

  it('完了ボタン押下でグリーンのボタンが出現する', async () => {
    await startSundaySession()

    const firstCheck = document.querySelectorAll('button[class*="w-12"]')[0] as HTMLElement
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
    await startSundaySession()

    await act(async () => {
      fireEvent.click(document.querySelectorAll('button[class*="w-12"]')[0])
    })

    await waitFor(
      () => {
        const greenButtons = document.querySelectorAll('button.bg-green-500')
        expect(greenButtons.length).toBeGreaterThan(0)
      },
      { timeout: 3000 },
    )
  })
})

describe('FitTrack – SS セッション保存', () => {
  it('「完了して保存」でrecordsにSSデータが記録される', async () => {
    await startSundaySession()

    // 1セット完了
    const checkButtons = document.querySelectorAll('button[class*="w-12"]')
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
    // session.day は「今日の曜日」が記録される（プランで選んだ曜日ではない）
    expect(typeof record.day).toBe('string')

    const exercises = record.exercises as Array<{ name: string; sets: Array<{ completed: boolean; weight: number }> }>
    // 日曜プランのSS種目が記録されている
    const ssLeft = exercises.find(e => e.name === 'ブルガリアンSS（左）')
    expect(ssLeft).toBeDefined()
    expect(ssLeft!.sets[0].weight).toBe(5.25)
  })

  it('中止確認ダイアログが表示される', async () => {
    await startSundaySession()

    // 戻るボタン（ChevronLeft）をクリック
    const backButton = document.querySelector('button[class*="p-1 hover"]') as HTMLElement
    fireEvent.click(backButton)

    await waitFor(
      () => expect(screen.getByText('トレーニングを中止しますか？')).toBeInTheDocument(),
      { timeout: 3000 },
    )
  })

  it('中止後はワークアウト待機画面に戻る', async () => {
    await startSundaySession()

    const backButton = document.querySelector('button[class*="p-1 hover"]') as HTMLElement
    fireEvent.click(backButton)

    await waitFor(
      () => screen.getByText('中止する'),
      { timeout: 3000 },
    )
    fireEvent.click(screen.getByText('中止する'))

    await waitFor(
      () => expect(screen.getByText('トレーニングを開始する')).toBeInTheDocument(),
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
