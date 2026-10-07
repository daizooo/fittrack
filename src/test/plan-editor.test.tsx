/**
 * プランエディタ: －＋ボタン／負荷（重さ）選択／サーキット／編集破棄の確認
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetMockDB, getMockTable, TEST_USER_ID } from './__mocks__/supabase'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { addCircuitViaPicker, addExercisesViaPicker, editorExerciseNames, selectInPicker } from './helpers'
import { planFromRow, buildSession } from '../lib/plans'
import { DEFAULT_LOAD_EQUIPMENT, generateEquipmentOptions } from '../lib/equipmentUtils'
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
    await addExercisesViaPicker(user, 'プッシュアップ')

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
    await addExercisesViaPicker(user, 'プッシュアップ')
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
    await addExercisesViaPicker(user, 'プッシュアップ')

    const equip = screen.getByLabelText('使用する機材')
    const weight = screen.getByLabelText('負荷（初期値）')
    expect(weight).toBeDisabled() // プッシュアップの標準は自重のみ → 選択肢なし

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
    // 追加と同時に種目一覧が開く。3種目をまとめて選ぶ
    await selectInPicker(user, 'チンニング', 'プッシュアップ', 'ヒップスラスト')
    await user.click(screen.getByText(/件を追加/))

    // 既定: 40秒 / 休憩20秒 / 3周
    expect(screen.getByLabelText('サーキットの運動秒数')).toHaveValue(40)
    expect(screen.getByLabelText('サーキットの休憩秒数')).toHaveValue(20)
    expect(screen.getByLabelText('周回数')).toHaveValue(3)

    // 一括変更が全ステーションに効く（追加済みの3種目すべて）
    const work = screen.getByLabelText('サーキットの運動秒数')
    await user.clear(work)
    await user.type(work, '45')
    await user.click(screen.getByLabelText('周回数を増やす'))

    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('サーキット')).toBeTruthy())
    const { exercises } = savedPlan('サーキット')
    // サーキットは1項目。運動・休憩・周回数は1つだけ持ち、種目は名前と機材・負荷だけ
    expect(exercises).toHaveLength(1)
    expect(exercises[0]).toMatchObject({ type: 'circuit', defaultReps: 45, interval: 20, targetSets: 4 })
    expect(exercises[0].stations?.map(st => st.name)).toEqual(['チンニング', 'プッシュアップ', 'ヒップスラスト'])
    expect(exercises[0].stations?.map(st => st.exerciseId)).toEqual(['sys:chin-up', 'sys:push-up', 'sys:hip-thrust'])
    for (const st of exercises[0].stations!) {
      expect(Object.keys(st).sort()).toEqual(['defaultWeight', 'equipmentType', 'exerciseId', 'id', 'name'])
    }
  })

  it('サーキットの種目にも負荷を設定できる', async () => {
    const user = await openNewPlan()
    await addCircuitViaPicker(user, 'チンニング', 'プッシュアップ')
    const [equip] = screen.getAllByLabelText('使用する機材')
    await user.selectOptions(equip, 'assist')
    await user.selectOptions(screen.getAllByLabelText('負荷（初期値）')[0], '-24')
    expect(screen.getAllByLabelText('負荷（初期値）')[0]).toHaveValue('-24')
    expect(screen.getAllByLabelText('負荷（初期値）')[1]).toHaveValue('0')
  })

  it('サーキット内の並べ替え・削除、サーキットごとの移動ができる', async () => {
    const user = await openNewPlan()
    await addExercisesViaPicker(user, 'スクワット')
    await addCircuitViaPicker(user, 'プランク', 'クランチ')
    expect(editorExerciseNames()).toEqual(['スクワット', 'プランク', 'クランチ'])

    await user.click(screen.getAllByLabelText('種目を下へ')[0])
    expect(editorExerciseNames()).toEqual(['スクワット', 'クランチ', 'プランク'])

    // サーキットごと上へ（スクワットの前に出る）
    const ups = screen.getAllByLabelText('上へ')
    await user.click(ups[ups.length - 1])
    expect(editorExerciseNames()).toEqual(['クランチ', 'プランク', 'スクワット'])

    await user.click(screen.getAllByLabelText('種目を削除')[0])
    expect(editorExerciseNames()).toEqual(['プランク', 'スクワット'])
  })

  it('サーキットの種目をあとから追加・差し替えできる', async () => {
    const user = await openNewPlan()
    await addCircuitViaPicker(user, 'プランク')
    await user.click(screen.getByText('このサーキットに種目を追加'))
    await selectInPicker(user, 'クランチ')
    await user.click(screen.getByText(/件を追加/))
    expect(editorExerciseNames()).toEqual(['プランク', 'クランチ'])

    await user.click(screen.getByLabelText('種目を変更: プランク'))
    await user.click(within(screen.getByRole('dialog', { name: '種目を選ぶ' })).getByRole('button', { name: /^レッグレイズ/ }))
    expect(editorExerciseNames()).toEqual(['レッグレイズ', 'クランチ'])
  })

  it('サーキットに種目が無いと保存できない', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), '空サーキット')
    await user.click(screen.getByText('サーキット追加'))
    await user.click(screen.getByLabelText('閉じる')) // 種目を選ばずに閉じる
    await user.click(screen.getByText('保存'))
    expect(screen.getByRole('alert')).toHaveTextContent('サーキットに種目がありません')
  })

  it('セッションでは各ステーションの完了後に休憩が始まる（スーパーセットと違う）', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'サーキット')
    await addCircuitViaPicker(user, 'チンニング', 'プッシュアップ')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('サーキット')).toBeTruthy())

    await user.click(screen.getByText('ワークアウト'))
    await user.click(screen.getByRole('radio', { name: /サーキット/ }))
    await user.click(screen.getByText('トレーニングを開始する'))

    // 種目ごとのカード（セット数・インターバル）ではなく、1枚のサーキットカードにまとまる
    expect(screen.getByText('1周目')).toBeInTheDocument()
    expect(screen.getAllByText(/休憩 20秒/)).toHaveLength(1)
    expect(screen.queryByText(/Sets/)).not.toBeInTheDocument()
    expect(screen.getByText('3 周')).toBeInTheDocument()
    expect(screen.getAllByText(/周目$/)).toHaveLength(3)
    expect(screen.getAllByTestId('set-check')).toHaveLength(2) // 開いているのは現在の周（2種目）だけ。同じ一覧が3回並ばない

    // 1つ目のステーションの完了 → グループ最後の種目ではないが休憩が始まる
    await user.click(screen.getAllByTestId('set-check')[0])
    expect(screen.getByRole('timer')).toHaveTextContent('休憩')
  })

  it('記録は種目ごとに保存される（サーキット1回というまとまりにはしない）', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'サーキット')
    await addCircuitViaPicker(user, 'チンニング', 'プッシュアップ')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('サーキット')).toBeTruthy())

    await user.click(screen.getByText('ワークアウト'))
    await user.click(screen.getByRole('radio', { name: /サーキット/ }))
    await user.click(screen.getByText('トレーニングを開始する'))
    await user.click(screen.getByLabelText('チンニング 1周目を完了'))
    await user.click(screen.getByLabelText('プッシュアップ 1周目を完了'))
    await user.click(screen.getByLabelText('チンニング 2周目を完了')) // 1周目が終わると2周目が開く
    await user.click(screen.getByText('完了して保存'))

    await waitFor(() => expect(getMockTable('records')).toHaveLength(1))
    const rec = getMockTable('records')[0] as unknown as { category: string; exercises: { name: string; exerciseId: string; type: string; sets: { reps: number; completed: boolean }[] }[] }
    expect(rec.category).toBe('サーキット')
    expect(rec.exercises.map(e => [e.name, e.exerciseId])).toEqual([['チンニング', 'sys:chin-up'], ['プッシュアップ', 'sys:push-up']])
    expect(rec.exercises[0].sets.map(x => x.completed)).toEqual([true, true, false])
    expect(rec.exercises[1].sets.map(x => x.completed)).toEqual([true, false, false])
    expect(rec.exercises.every(e => e.type === 'duration' && e.sets.every(x => x.reps === 40))).toBe(true)
  })

  it('セッションで周回数を増減すると全種目の周が増減する', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'サーキット')
    await addCircuitViaPicker(user, 'チンニング', 'プッシュアップ')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('サーキット')).toBeTruthy())

    await user.click(screen.getByText('ワークアウト'))
    await user.click(screen.getByRole('radio', { name: /サーキット/ }))
    await user.click(screen.getByText('トレーニングを開始する'))
    await user.click(screen.getByLabelText('周回を減らす'))
    expect(screen.getByText('2 周')).toBeInTheDocument()
    expect(screen.getAllByText(/周目$/)).toHaveLength(2)
    await user.click(screen.getByLabelText('周回を増やす'))
    await user.click(screen.getByLabelText('周回を増やす'))
    expect(screen.getAllByText(/周目$/)).toHaveLength(4)
    await user.click(screen.getByLabelText('4周目を開く'))
    expect(screen.getByLabelText('チンニング 4周目を完了')).toBeInTheDocument() // 増えた周にも全種目が入る
    expect(screen.getByLabelText('プッシュアップ 4周目を完了')).toBeInTheDocument()
  })

  it('サーキットは現在の周だけ開き、ほかの周は1行に畳まれてタップで開閉できる', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'サーキット')
    await addCircuitViaPicker(user, 'チンニング', 'プッシュアップ')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(savedPlan('サーキット')).toBeTruthy())

    await user.click(screen.getByText('ワークアウト'))
    await user.click(screen.getByRole('radio', { name: /サーキット/ }))
    await user.click(screen.getByText('トレーニングを開始する'))

    expect(screen.getByLabelText('チンニング 1周目を完了')).toBeInTheDocument()
    expect(screen.queryByLabelText('チンニング 2周目を完了')).not.toBeInTheDocument()
    expect(screen.getByLabelText('2周目を開く')).toHaveAttribute('aria-expanded', 'false')

    // 畳まれた周も、タップで開いて先に記録できる
    await user.click(screen.getByLabelText('2周目を開く'))
    expect(screen.getByLabelText('チンニング 2周目を完了')).toBeInTheDocument()
    await user.click(screen.getByLabelText('2周目を閉じる'))
    expect(screen.queryByLabelText('チンニング 2周目を完了')).not.toBeInTheDocument()

    // 1周目が終わると、1周目は畳まれて「完了」表示になり、2周目が開く
    await user.click(screen.getByLabelText('チンニング 1周目を完了'))
    await user.click(screen.getByLabelText('プッシュアップ 1周目を完了'))
    await user.click(screen.getByLabelText('プッシュアップ 1周目のタイマーを止める')) // 休憩の間は、その行が見えるよう開いたまま
    expect(screen.queryByLabelText('チンニング 1周目を完了')).not.toBeInTheDocument()
    expect(screen.getByLabelText('1周目を開く')).toHaveTextContent('2/2')
    expect(screen.getByLabelText('チンニング 2周目を完了')).toBeInTheDocument()
    expect(screen.queryByLabelText('チンニング 3周目を完了')).not.toBeInTheDocument()
  })

  it('プラン詳細でも種目ごとのセット数ではなく、共通の周回数・運動・休憩を1回だけ表示する', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'サーキット')
    await addCircuitViaPicker(user, 'チンニング', 'プッシュアップ')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'サーキット' })).toBeInTheDocument())

    expect(screen.getByText('🔁 3周')).toBeInTheDocument()
    expect(screen.getAllByText(/運動 40秒/)).toHaveLength(1)
    expect(screen.getAllByText(/休憩 20秒/)).toHaveLength(1)
    expect(screen.queryByText(/Sets/)).not.toBeInTheDocument()
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


describe('サーキットのデータ（旧形式の移行・セッション展開）', () => {
  const tube = DEFAULT_LOAD_EQUIPMENT.find(e => e.id === 'assist')!
  const optionsMap = new Map([['assist', generateEquipmentOptions(tube)]])
  const circuit = (): Exercise => ({
    id: 'ci-1', name: 'サーキット', type: 'circuit', targetSets: 3, defaultReps: 40, interval: 20,
    defaultWeight: 0, equipmentType: 'bodyweight',
    stations: [
      { id: 's1', name: '懸垂', equipmentType: 'assist', defaultWeight: -24 },
      { id: 's2', name: 'プッシュアップ', equipmentType: 'bodyweight', defaultWeight: 0 }
    ]
  })

  it('旧形式（種目ごとに秒数・休憩を持つ）は1つのサーキットに変換される', () => {
    const legacy = (id: string, name: string) => ({
      id, name, type: 'duration', targetSets: 3, defaultReps: 40, defaultWeight: 0, interval: 20,
      equipmentType: 'bodyweight', supersetGroup: 'g1', circuit: true
    })
    const plan = planFromRow({
      id: 'p', name: 'x', warmup: null, cooldown: null, sort_order: 1,
      exercises: [{ id: 'n', name: '通常', type: 'normal', targetSets: 3, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }, legacy('a', '懸垂'), legacy('b', 'ディップス')] as unknown as Exercise[]
    })
    expect(plan.exercises).toHaveLength(2)
    expect(plan.exercises[1]).toMatchObject({ type: 'circuit', targetSets: 3, defaultReps: 40, interval: 20 })
    expect(plan.exercises[1].stations?.map(s => s.name)).toEqual(['懸垂', 'ディップス'])
  })

  it('セッションでは種目ごとの記録（周回数＝セット数）に展開され、初期負荷が入る', () => {
    const session = buildSession({ id: 'p', name: 'サーキット', exercises: [circuit()], warmup: [], cooldown: [], sortOrder: 1 }, [], optionsMap)
    expect(session.exercises.map(e => e.name)).toEqual(['懸垂', 'プッシュアップ'])
    expect(session.exercises[0].sets).toHaveLength(3)
    expect(session.exercises[0].sets.map(s => [s.reps, s.weight])).toEqual([[40, -24], [40, -24], [40, -24]])
    expect(session.exercises[0].options.map(o => o.weight)).toContain(-47)
    expect(session.exercises.every(e => e.interval === 20 && e.circuit)).toBe(true)
  })

  it('前回の記録から負荷だけを引き継ぐ（周回数・秒数はプランの現在の設定）', () => {
    const prev = buildSession({ id: 'p', name: 'サーキット', exercises: [circuit()], warmup: [], cooldown: [], sortOrder: 1 }, [], optionsMap)
    prev.exercises[0].sets.forEach(s => { s.weight = -47; s.completed = true })
    const record = { ...prev, id: 1, type: 'workout' as const, stretches: null }
    const c = circuit()
    c.targetSets = 4
    c.defaultReps = 45
    const next = buildSession({ id: 'p', name: 'サーキット', exercises: [c], warmup: [], cooldown: [], sortOrder: 1 }, [record], optionsMap)
    expect(next.exercises[0].inherited).toBe(true)
    expect(next.exercises[0].sets.map(s => [s.reps, s.weight])).toEqual([[45, -47], [45, -47], [45, -47], [45, -47]])
  })
})
