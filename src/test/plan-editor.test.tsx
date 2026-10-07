/**
 * プランエディタ: －＋ボタン／負荷（重さ）選択／サーキット／編集破棄の確認
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetMockDB, getMockTable, TEST_USER_ID } from './__mocks__/supabase'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import type { Exercise } from '../types'

beforeEach(() => {
  resetMockDB()
  vi.useRealTimers()
})

async function openNewPlan() {
  const user = userEvent.setup()
  render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(() => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(), { timeout: 3000 })
  await user.click(screen.getByText('プラン'))
  await user.click(screen.getByText('新しいプランを作成'))
  return user
}

const savedPlan = (name: string) => {
  const row = getMockTable('workout_plans').find(r => r.name === name)
  return row as unknown as { exercises: Exercise[] }
}

describe('－＋ボタン（秒数以外）', () => {
  it('セット数・回数を－＋で増減でき、下限・上限で止まる', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('種目を追加'))

    const sets = screen.getByLabelText('セット数')
    expect(sets).toHaveValue(3)
    await user.click(screen.getByLabelText('セット数を増やす'))
    expect(sets).toHaveValue(4)
    await user.click(screen.getByLabelText('セット数を減らす'))
    await user.click(screen.getByLabelText('セット数を減らす'))
    await user.click(screen.getByLabelText('セット数を減らす'))
    expect(sets).toHaveValue(1)
    expect(screen.getByLabelText('セット数を減らす')).toBeDisabled()

    await user.click(screen.getByLabelText('回数を増やす'))
    expect(screen.getByLabelText('回数')).toHaveValue(11)
  })

  it('秒数の欄には－＋ボタンが付かない', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('種目を追加'))
    expect(screen.queryByLabelText('休憩秒数を増やす')).not.toBeInTheDocument()
    await user.selectOptions(screen.getByDisplayValue('通常（回数）'), 'duration')
    expect(screen.queryByLabelText('回数を増やす')).not.toBeInTheDocument()
    expect(screen.getByLabelText('秒数')).toBeInTheDocument()
    expect(screen.queryByLabelText('秒数を増やす')).not.toBeInTheDocument()
  })
})

describe('負荷（チューブ・補助チューブの重さ）を選べる', () => {
  it('機材を選ぶとその機材の負荷が選べ、保存される', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), '懸垂の日')
    await user.click(screen.getByText('種目を追加'))
    await user.type(screen.getByLabelText('種目名'), '懸垂')

    const equip = screen.getByLabelText('使用する機材')
    const weight = screen.getByLabelText('負荷（初期値）')
    expect(weight).toBeDisabled() // 自重のみ → 選択肢なし

    await user.selectOptions(equip, 'assist')
    expect(weight).toBeEnabled()
    expect(within(weight).getAllByRole('option').map(o => o.textContent)).toEqual(['ー', '1本 (-24kg)', '2本 (-47kg)', '3本 (-70kg)'])
    await user.selectOptions(weight, '-47')

    await user.selectOptions(equip, 'tube')
    expect(weight).toHaveValue('0') // 機材を変えると負荷は「ー」に戻る
    await user.selectOptions(weight, '28')

    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('懸垂の日')).toBeTruthy())
    expect(savedPlan('懸垂の日').exercises[0]).toMatchObject({ equipmentType: 'tube', defaultWeight: 28 })
  })
})

describe('サーキット', () => {
  it('運動・休憩・周回数を一括設定でき、全種目に反映して保存される', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'サーキット')
    await user.click(screen.getByText('サーキット追加'))

    // 既定: 2種目 / 40秒 / 休憩20秒 / 3周
    expect(screen.getByLabelText('サーキットの運動秒数')).toHaveValue(40)
    expect(screen.getByLabelText('サーキットの休憩秒数')).toHaveValue(20)
    expect(screen.getByLabelText('周回数')).toHaveValue(3)

    await user.click(screen.getByText('このサーキットに種目を追加'))
    const names = screen.getAllByLabelText('種目名')
    expect(names).toHaveLength(3)
    await user.type(names[0], '懸垂')
    await user.type(names[1], 'プッシュアップ')
    await user.type(names[2], 'ヒップスラスト')

    // 一括変更が全ステーションに効く（追加済みの3種目すべて）
    const work = screen.getByLabelText('サーキットの運動秒数')
    await user.clear(work)
    await user.type(work, '45')
    await user.click(screen.getByLabelText('周回数を増やす'))

    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('サーキット')).toBeTruthy())
    const { exercises } = savedPlan('サーキット')
    expect(exercises.map(e => e.name)).toEqual(['懸垂', 'プッシュアップ', 'ヒップスラスト'])
    expect(exercises.every(e => e.circuit && e.type === 'duration' && e.defaultReps === 45 && e.interval === 20 && e.targetSets === 4)).toBe(true)
    expect(new Set(exercises.map(e => e.supersetGroup)).size).toBe(1)
  })

  it('サーキットの種目にも負荷を設定できる', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('サーキット追加'))
    const [equip] = screen.getAllByLabelText('使用する機材')
    await user.selectOptions(equip, 'assist')
    await user.selectOptions(screen.getAllByLabelText('負荷（初期値）')[0], '-24')
    expect(screen.getAllByLabelText('負荷（初期値）')[0]).toHaveValue('-24')
    expect(screen.getAllByLabelText('負荷（初期値）')[1]).toHaveValue('0')
  })

  it('サーキット内の並べ替え・削除、ブロックごとの移動ができる', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('種目を追加'))
    await user.type(screen.getAllByLabelText('種目名')[0], '単独A')
    await user.click(screen.getByText('サーキット追加'))
    let names = screen.getAllByLabelText('種目名')
    await user.type(names[1], 'S1')
    await user.type(names[2], 'S2')

    await user.click(screen.getAllByLabelText('種目を下へ')[0])
    names = screen.getAllByLabelText('種目名')
    expect(names.map(n => (n as HTMLInputElement).value)).toEqual(['単独A', 'S2', 'S1'])

    // サーキットごと上へ（単独Aの前に出る。ステーションが分断されない）
    const ups = screen.getAllByLabelText('上へ')
    await user.click(ups[ups.length - 1])
    expect(screen.getAllByLabelText('種目名').map(n => (n as HTMLInputElement).value)).toEqual(['S2', 'S1', '単独A'])

    await user.click(screen.getAllByLabelText('種目を削除')[0])
    expect(screen.getAllByLabelText('種目名').map(n => (n as HTMLInputElement).value)).toEqual(['S1', '単独A'])
  })

  it('セッションでは各ステーションの完了後に休憩が始まる（スーパーセットと違う）', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'サーキット')
    await user.click(screen.getByText('サーキット追加'))
    const names = screen.getAllByLabelText('種目名')
    await user.type(names[0], '懸垂')
    await user.type(names[1], 'プッシュアップ')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('サーキット')).toBeTruthy())

    await user.click(screen.getByText('ワークアウト'))
    await user.click(screen.getByRole('radio', { name: /サーキット/ }))
    await user.click(screen.getByText('トレーニングを開始する'))
    expect(screen.getAllByText('CIR').length).toBeGreaterThan(0)

    // 1つ目のステーションのセット完了 → グループ最後の種目ではないが休憩が始まる
    await user.click(screen.getAllByTestId('set-check')[0])
    expect(screen.getByText('REST')).toBeInTheDocument()
  })
})

describe('編集中のタブ移動・キャンセルは破棄確認を挟む', () => {
  it('プラン編集中に他のタブへ移ろうとすると確認が出て、続けるを選ぶと留まる', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), '作りかけ')
    await user.click(screen.getByText('記録'))

    expect(screen.getByRole('alertdialog')).toHaveTextContent('編集内容を破棄しますか？')
    await user.click(screen.getByText('編集を続ける'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('プラン名')).toHaveValue('作りかけ')
  })

  it('破棄して移動を選ぶと移動し、プランは保存されない', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), '作りかけ')
    await user.click(screen.getByText('ワークアウト'))
    await user.click(screen.getByText('破棄して移動'))

    expect(screen.getByText('今日のプランを選ぶ')).toBeInTheDocument()
    expect(getMockTable('workout_plans').some(r => r.name === '作りかけ')).toBe(false)
    // 戻ってもエディタは残っていない
    await user.click(screen.getByText('プラン'))
    expect(screen.getByText('マイプラン')).toBeInTheDocument()
  })

  it('変更が無ければ確認なしで移動できる', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('ワークアウト'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('今日のプランを選ぶ')).toBeInTheDocument()
  })

  it('保存後は確認なしで移動できる', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), '保存済み')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('保存済み')).toBeTruthy())
    await user.click(screen.getByText('記録'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('キャンセルも、変更があるときだけ確認する', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('キャンセル'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText('マイプラン')).toBeInTheDocument()

    await user.click(screen.getByText('新しいプランを作成'))
    await user.type(screen.getByLabelText('プラン名'), 'x')
    await user.click(screen.getByText('キャンセル'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByText('破棄する'))
    expect(screen.getByText('マイプラン')).toBeInTheDocument()
  })

  it('プロフィールの入力途中でも、タブ移動前に確認する', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('キャンセル'))
    await user.click(screen.getByText('プロフィール'))
    await user.type(screen.getByPlaceholderText('例: 心拍計'), 'メモ')
    await user.click(screen.getByText('プラン'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})
