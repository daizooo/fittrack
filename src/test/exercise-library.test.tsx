/**
 * 種目マスタ（標準カタログ＋自作）: ピッカー／種目タブ／ID による記録の蓄積／旧データの移行
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetMockDB, getMockTable, getMockRecords, TEST_USER_ID } from './__mocks__/supabase'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { addExercisesViaPicker, createInPicker, editorExerciseNames, selectInPicker } from './helpers'
import {
  BUILTIN_EXERCISES, applyLibraryToRecords, buildLibrary, buildNameIndex, isNameTaken, normName
} from '../lib/exerciseLibrary'
import type { Exercise, SessionExercise, WorkoutRecord } from '../types'

beforeEach(() => {
  resetMockDB()
  vi.useRealTimers()
})

async function load() {
  const user = userEvent.setup()
  const view = render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(() => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(), { timeout: 3000 })
  return { user, view }
}
async function openNewPlan() {
  const { user } = await load()
  await user.click(screen.getByText('プラン'))
  await user.click(screen.getByText('新しいプランを作成'))
  return user
}
const exerciseRows = () => getMockTable('exercises') as unknown as { id: string; name: string; muscle: string; kind: string }[]
const planRow = (name: string) => getMockTable('workout_plans').find(r => r.name === name) as unknown as { exercises: Exercise[] }

describe('標準カタログ', () => {
  it('IDは一意で、名前・別名も重複しない', () => {
    const ids = BUILTIN_EXERCISES.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every(id => id.startsWith('sys:'))).toBe(true)
    const names = BUILTIN_EXERCISES.flatMap(d => [d.name, ...(d.aliases ?? [])]).map(normName)
    expect(new Set(names).size).toBe(names.length)
  })

  it('名前の照合は表記ゆれ（全角半角・空白・別名）を吸収する', () => {
    const index = buildNameIndex(buildLibrary([]))
    expect(index.get(normName('懸垂'))).toBe('sys:chin-up')
    expect(index.get(normName(' チンニング '))).toBe('sys:chin-up')
    expect(index.get(normName('ＨＩＩＴ（バーピー）'))).toBe('sys:hiit-burpee')
    expect(isNameTaken(buildLibrary([]), 'プッシュアップ ')).toBe(true)
    expect(isNameTaken(buildLibrary([]), '新しい種目')).toBe(false)
  })

  it('ID の無い旧記録は名前から種目に結び付き、名前は種目マスタの名前に揃う', () => {
    const ex = (name: string): SessionExercise => ({
      id: 'x', name, type: 'normal', targetSets: 1, defaultReps: 1, defaultWeight: 0, interval: 0,
      equipmentType: 'bodyweight', inherited: false, options: [], sets: []
    })
    const rec: WorkoutRecord = { id: 1, date: '1/1', fullDate: '2026-01-01', day: '木', type: 'workout', exercises: [ex('懸垂'), ex('未登録の種目')] }
    const [out] = applyLibraryToRecords([rec], buildLibrary([]))
    expect(out.exercises[0]).toMatchObject({ exerciseId: 'sys:chin-up', name: 'チンニング' })
    expect(out.exercises[1].exerciseId).toBeUndefined()
  })
})

describe('種目の追加（一覧から選ぶ）', () => {
  it('「種目を追加」で一覧が開き、検索（別名も可）して複数選んで追加できる', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('種目を追加'))
    const dialog = screen.getByRole('dialog', { name: '種目を選ぶ' })
    expect(within(dialog).getByRole('checkbox', { name: /^プッシュアップ/ })).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('種目を検索'), '懸垂') // 別名
    expect(within(dialog).getByRole('checkbox', { name: /^チンニング/ })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('checkbox').length).toBeLessThan(4)

    await selectInPicker(user, 'チンニング', 'プッシュアップ')
    expect(within(dialog).getByText('2件を追加')).toBeInTheDocument()
    await user.click(within(dialog).getByText('2件を追加'))
    expect(screen.queryByRole('dialog', { name: '種目を選ぶ' })).not.toBeInTheDocument()
    expect(editorExerciseNames()).toEqual(['チンニング', 'プッシュアップ'])
  })

  it('部位で絞り込める', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('種目を追加'))
    const dialog = screen.getByRole('dialog', { name: '種目を選ぶ' })
    await user.click(within(dialog).getByRole('button', { name: '体幹' }))
    const names = within(dialog).getAllByRole('checkbox').map(c => c.textContent ?? '')
    expect(names.length).toBeGreaterThan(3)
    expect(names.some(n => n.startsWith('プランク'))).toBe(true)
    expect(names.some(n => n.startsWith('プッシュアップ'))).toBe(false)
  })

  it('一覧に無い種目はその場でカスタム作成して追加でき、IDつきで保存される', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), '腕の日')
    await user.click(screen.getByText('種目を追加'))
    await createInPicker(user, 'ダンベルカール', '腕')
    expect(editorExerciseNames()).toEqual(['ダンベルカール'])

    const created = exerciseRows().filter(r => r.name === 'ダンベルカール')
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ muscle: 'arms', kind: 'reps' })
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(planRow('腕の日')).toBeTruthy())
    expect(planRow('腕の日').exercises[0].exerciseId).toBe(created[0].id)
  })

  it('作った種目は次のプランで候補として出てくる（同じIDで使い回せる）', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), 'プランA')
    await user.click(screen.getByText('種目を追加'))
    await createInPicker(user, 'ダンベルカール', '腕')
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(planRow('プランA')).toBeTruthy())

    await user.click(screen.getByText('プラン一覧'))
    await user.click(screen.getByText('新しいプランを作成'))
    await user.type(screen.getByLabelText('プラン名'), 'プランB')
    await user.click(screen.getByText('種目を追加'))
    const dialog = screen.getByRole('dialog', { name: '種目を選ぶ' })
    const row = within(dialog).getByRole('checkbox', { name: /^ダンベルカール/ })
    expect(within(row).getByText('自作')).toBeInTheDocument()
    await selectInPicker(user, 'ダンベルカール')
    await user.click(screen.getByText('1件を追加'))
    await user.click(screen.getByText('保存'))
    await waitFor(() => expect(planRow('プランB')).toBeTruthy())
    expect(planRow('プランB').exercises[0].exerciseId).toBe(planRow('プランA').exercises[0].exerciseId)
    expect(exerciseRows().filter(r => r.name === 'ダンベルカール')).toHaveLength(1) // 重複して作られない
  })

  it('既にある種目名では作成できない', async () => {
    const user = await openNewPlan()
    await user.click(screen.getByText('種目を追加'))
    await createInPicker(user, 'プッシュアップ')
    expect(screen.getByRole('alert')).toHaveTextContent('同じ名前の種目が既にあります')
    expect(exerciseRows().some(r => r.name === 'プッシュアップ')).toBe(false)
  })

  it('追加済みの種目の名前を押すと、一覧から別の種目へ差し替えられる', async () => {
    const user = await openNewPlan()
    await addExercisesViaPicker(user, 'プッシュアップ')
    await user.click(screen.getByLabelText('種目を変更: プッシュアップ'))
    const dialog = screen.getByRole('dialog', { name: '種目を選ぶ' })
    await user.click(within(dialog).getByRole('button', { name: /^スクワット/ })) // 1件選ぶと確定
    expect(editorExerciseNames()).toEqual(['スクワット'])
  })

  it('種目を選ばないと保存できない（自由入力はできない）', async () => {
    const user = await openNewPlan()
    await user.type(screen.getByLabelText('プラン名'), '空')
    expect(screen.queryByPlaceholderText('種目名')).not.toBeInTheDocument()
    await user.click(screen.getByText('保存'))
    // 種目ゼロのプランは保存できる（種目は任意）
    await waitFor(() => expect(planRow('空')).toBeTruthy())
  })
})

describe('旧データの移行（種目名 → 種目ID）', () => {
  it('標準に無い名前は自作の種目として初回に登録され、標準と一致する名前は登録されない', async () => {
    await load()
    const names = exerciseRows().map(r => r.name)
    expect(names).toContain('ブルガリアンSS（左）') // 標準に無い → 自作として登録
    expect(names).toContain('ブルガリアンSS（右）')
    expect(names).not.toContain('プッシュアップ') // 標準
    expect(names).not.toContain('チンニング')
    expect(new Set(names).size).toBe(names.length)
  })

  it('再読み込みしても重複して登録されない', async () => {
    const { view } = await load()
    const before = exerciseRows().length
    view.unmount()
    await load()
    expect(exerciseRows()).toHaveLength(before)
  })

  it('既存プランの種目にも IDが付いて表示・記録される', async () => {
    const { user } = await load()
    await user.click(screen.getByText('ワークアウト'))
    await user.click(screen.getByRole('radio', { name: /上半身・引く/ }))
    await user.click(screen.getByText('トレーニングを開始する'))
    await user.click(screen.getAllByTestId('set-check')[0])
    await user.click(screen.getByText('完了して保存'))
    await waitFor(() => expect(getMockRecords()).toHaveLength(1))
    const rec = getMockRecords()[0] as unknown as { exercises: { name: string; exerciseId: string }[] }
    expect(rec.exercises[0]).toMatchObject({ name: 'チンニング', exerciseId: 'sys:chin-up' })
  })
})

describe('種目タブ', () => {
  const customRow = (over: Record<string, unknown> = {}) => ({
    id: 'ex-custom-1', user_id: TEST_USER_ID, name: 'ダンベルカール', muscle: 'arms', kind: 'reps',
    equipment_type: 'bodyweight', note: 'ゆっくり下ろす', created_at: '2026-01-01', ...over
  })

  it('標準＋自作の種目が一覧され、部位・実施状況が見える', async () => {
    getMockTable('exercises').push(customRow())
    const { user } = await load()
    await user.click(screen.getByRole('button', { name: '種目' }))
    expect(screen.getByRole('heading', { name: '種目' })).toBeInTheDocument()
    const custom = screen.getByRole('button', { name: /^ダンベルカール/ })
    expect(within(custom).getByText('自作')).toBeInTheDocument()
    expect(within(custom).getByText('腕')).toBeInTheDocument()
    expect(within(custom).getByText('未実施')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^プッシュアップ/ })).toBeInTheDocument()
  })

  it('種目詳細から、別プランでの実施をまとめた履歴を見られる（改名しても履歴は残る）', async () => {
    getMockTable('exercises').push(customRow({ name: '新しい名前' }))
    const rec = (id: number, planName: string, day: number) => ({
      id, user_id: TEST_USER_ID, full_date: new Date(2026, 5, day, 12).toISOString(), date: `6/${day}`, day: '月',
      type: 'workout', category: planName,
      exercises: [{
        id: 'e', exerciseId: 'ex-custom-1', name: '古い名前', type: 'normal', targetSets: 1, defaultReps: 10, defaultWeight: 0,
        interval: 60, equipmentType: 'bodyweight', inherited: false, options: [],
        sets: [{ setNumber: 1, reps: 10, weight: 0, completed: true }]
      }]
    })
    getMockRecords().push(rec(1, 'プランA', 1), rec(2, 'プランB', 8))
    const { user } = await load()
    await user.click(screen.getByRole('button', { name: '種目' }))
    const row = screen.getByRole('button', { name: /^新しい名前/ })
    expect(within(row).getByText(/2回/)).toBeInTheDocument()
    await user.click(row)
    await user.click(screen.getByRole('button', { name: /実施履歴・推移を見る（2回）/ }))
    expect(await screen.findByText('これまで 2 回実施')).toBeInTheDocument()
    expect(screen.getByText('プランA')).toBeInTheDocument()
    expect(screen.getByText('プランB')).toBeInTheDocument()
  })

  it('自作の種目を作成・編集（改名がプランにも反映）・削除できる。標準の種目は編集できない', async () => {
    const { user } = await load()
    await user.click(screen.getByRole('button', { name: '種目' }))

    await user.click(screen.getByText('新しい種目を作成'))
    await user.type(screen.getByLabelText('種目名'), 'ケトルベルスイング')
    await user.click(screen.getByRole('button', { name: '全身・有酸素' }))
    await user.click(screen.getByRole('button', { name: '秒数' }))
    await user.click(screen.getByText('作成'))
    expect(await screen.findByRole('heading', { name: 'ケトルベルスイング' })).toBeInTheDocument()
    expect(exerciseRows().find(r => r.name === 'ケトルベルスイング')).toMatchObject({ muscle: 'cardio', kind: 'duration' })

    // 改名
    await user.click(screen.getByText('編集'))
    const nameInput = screen.getByLabelText('種目名')
    await user.clear(nameInput)
    await user.type(nameInput, 'ケトルスイング')
    await user.click(screen.getByText('保存'))
    expect(await screen.findByRole('heading', { name: 'ケトルスイング' })).toBeInTheDocument()

    // 使われていなければ削除できる
    await user.click(screen.getByLabelText('種目を削除'))
    await user.click(screen.getByText('削除する'))
    await waitFor(() => expect(exerciseRows().some(r => r.name === 'ケトルスイング')).toBe(false))

    // 標準の種目には編集・削除が無い
    await user.click(screen.getByRole('button', { name: /^プッシュアップ/ }))
    expect(screen.getByRole('heading', { name: 'プッシュアップ' })).toBeInTheDocument()
    expect(screen.queryByText('編集')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('種目を削除')).not.toBeInTheDocument()
  })

  it('プランで使用中・実施記録のある種目は削除できない', async () => {
    getMockTable('exercises').push(customRow())
    getMockRecords().push({
      id: 1, user_id: TEST_USER_ID, full_date: new Date(2026, 5, 1, 12).toISOString(), date: '6/1', day: '月', type: 'workout', category: 'x',
      exercises: [{
        id: 'e', exerciseId: 'ex-custom-1', name: 'ダンベルカール', type: 'normal', targetSets: 1, defaultReps: 10, defaultWeight: 0,
        interval: 60, equipmentType: 'bodyweight', inherited: false, options: [], sets: [{ setNumber: 1, reps: 10, weight: 0, completed: true }]
      }]
    })
    const { user } = await load()
    await user.click(screen.getByRole('button', { name: '種目' }))
    await user.click(screen.getByRole('button', { name: /^ダンベルカール/ }))
    await user.click(screen.getByLabelText('種目を削除'))
    fireEvent.click(screen.getByText('削除する'))
    expect(await screen.findByRole('alert')).toHaveTextContent('実施記録があるため削除できません')
    expect(exerciseRows().some(r => r.name === 'ダンベルカール')).toBe(true)
  })
})
