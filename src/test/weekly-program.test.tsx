/**
 * 週間トレーニング（月〜日）のプラン作成と、解説動画（Google ドライブ）の表示
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetMockDB, getMockTable, TEST_USER_ID } from './__mocks__/supabase'

vi.mock('../lib/supabase', () => import('./__mocks__/supabase'))

import FitTrack from '../components/FitTrack'
import { BUILTIN_EXERCISES, applyLibraryToPlans, buildLibrary } from '../lib/exerciseLibrary'
import { BUILTIN_EXERCISE_VIDEOS, EXERCISE_VIDEOS, resolveVideos, videoEmbedUrl, videoOpenUrl } from '../lib/exerciseVideos'
import { buildSession, planToRow, recommendPlanId } from '../lib/plans'
import { missingWeeklyPlans, weeklyProgramPlans } from '../lib/weeklyProgram'
import type { WorkoutPlan, WorkoutRecord } from '../types'

beforeEach(() => {
  resetMockDB()
  vi.useRealTimers()
})

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const asPlans = (): WorkoutPlan[] => weeklyProgramPlans.map((p, i) => ({ ...p, id: `weekly-${i}`, sortOrder: i + 1 }))
const libraryPlans = () => applyLibraryToPlans(asPlans(), buildLibrary([]))

async function load() {
  const user = userEvent.setup()
  render(<FitTrack userId={TEST_USER_ID} />)
  await waitFor(() => expect(screen.queryByText('データを読み込み中...')).not.toBeInTheDocument(), { timeout: 3000 })
  return user
}

describe('解説動画カタログ', () => {
  it('01〜35の35本が重複なく並び、再生用・ドライブで開くURLを作れる', () => {
    expect(EXERCISE_VIDEOS).toHaveLength(35)
    expect(EXERCISE_VIDEOS.map((v, i) => v.id.startsWith(String(i + 1).padStart(2, '0') + '_'))).not.toContain(false)
    expect(new Set(EXERCISE_VIDEOS.map(v => v.id)).size).toBe(35)
    expect(new Set(EXERCISE_VIDEOS.map(v => v.driveId)).size).toBe(35)
    const v = EXERCISE_VIDEOS[0]
    expect(videoEmbedUrl(v)).toBe(`https://drive.google.com/file/d/${v.driveId}/preview`)
    expect(videoOpenUrl(v)).toBe(`https://drive.google.com/file/d/${v.driveId}/view`)
  })

  it('カタログに無いIDは捨て、標準種目への紐付けはすべて実在する', () => {
    expect(resolveVideos(undefined)).toEqual([])
    expect(resolveVideos(['nope', EXERCISE_VIDEOS[2].id]).map(x => x.id)).toEqual([EXERCISE_VIDEOS[2].id])
    const builtinIds = new Set(BUILTIN_EXERCISES.map(d => d.id.replace('sys:', '')))
    Object.entries(BUILTIN_EXERCISE_VIDEOS).forEach(([seed, ids]) => {
      expect(builtinIds.has(seed), seed).toBe(true)
      expect(resolveVideos(ids), seed).toHaveLength(ids.length)
    })
  })
})

describe('週間トレーニングのプラン定義', () => {
  it('月〜日の7プランで、名前が重複せず、どれも実施できる内容がある', () => {
    expect(weeklyProgramPlans.map(p => p.name.slice(0, 2))).toEqual(WEEKDAYS.map(d => `${d}曜`))
    expect(new Set(weeklyProgramPlans.map(p => p.name)).size).toBe(7)
    weeklyProgramPlans.forEach(p => expect(p.exercises.length, p.name).toBeGreaterThan(0))
  })

  it('種目はすべて標準の種目を参照し、名前が種目マスタと一致する（表示名がずれない）', () => {
    const byId = new Map(BUILTIN_EXERCISES.map(d => [d.id, d]))
    weeklyProgramPlans.flatMap(p => p.exercises).forEach(ex => {
      const items = ex.type === 'circuit' ? ex.stations ?? [] : [ex]
      expect(items.length).toBeGreaterThan(0)
      items.forEach(it => {
        const def = byId.get(it.exerciseId ?? '')
        expect(def, `${it.name} (${it.exerciseId})`).toBeTruthy()
        expect(it.name).toBe(def!.name)
      })
    })
  })

  it('1本の動画も余らない（35本すべてが、どこかの種目・ストレッチから見られる）', () => {
    const used = new Set<string>()
    libraryPlans().forEach(p => {
      p.warmup.concat(p.cooldown).forEach(s => (s.videoIds ?? []).forEach(id => used.add(id)))
      p.exercises.forEach(ex => {
        ;(ex.type === 'circuit' ? ex.stations ?? [] : [ex]).forEach(it => (it.videoIds ?? []).forEach(id => used.add(id)))
      })
    })
    expect([...used].sort()).toEqual(EXERCISE_VIDEOS.map(v => v.id).sort())
  })

  it('メインの種目のセット数・回数・休憩が、ガイド（weekly_training_guide.md）の数値と一致する', () => {
    // [種目名, セット数, 回数または秒数, 休憩秒]。資料が範囲のものは下限（セット数の範囲は上限）
    const main = (i: number) => weeklyProgramPlans[i].exercises.map(e => [e.name, e.type, e.targetSets, e.defaultReps, e.interval])
    expect(main(0)).toEqual([
      ['ブルガリアンスクワット（左）', 'normal', 3, 8, 30], // 左右各3セット・8〜10回・脚間30秒
      ['ブルガリアンスクワット（右）', 'normal', 3, 8, 30],
      ['チューブ・グッドモーニング', 'normal', 2, 12, 30]
    ])
    expect(main(1)).toEqual([
      ['チンニング', 'normal', 3, 4, 45], // 3セット・4〜8回・45〜60秒
      ['ニーリング・フェイスプル', 'normal', 3, 12, 30] // 3セット・12〜15回・30秒
    ])
    expect(main(3)).toEqual([
      ['アシスト・ディップス', 'normal', 3, 6, 45], // 3セット・6〜10回・45〜60秒
      ['デフィシット・プッシュアップ', 'normal', 3, 8, 45] // 2〜3セット・8〜12回・45秒
    ])
    expect(main(5)).toEqual([
      ['チューブ・スクワット＆プレス', 'normal', 3, 10, 45], // 3セット・10〜12回・45秒
      ['シーテッド・チューブローイング', 'normal', 3, 12, 30] // 3セット・12〜15回・30秒
    ])
  })

  it('水曜は20秒全力/10秒休息×8ラウンドのタバタ1セット', () => {
    const [wed, ...rest] = weeklyProgramPlans[2].exercises
    expect(rest).toEqual([])
    expect(wed).toMatchObject({ type: 'tabata', targetSets: 1, tabataWork: 20, tabataRest: 10, tabataCycles: 8 })
    // 奇数R=スロール、偶数R=マウンテンクライマーの両方の動画が見られる
    expect(resolveVideos(libraryPlans()[2].exercises[0].videoIds).map(v => v.title)).toEqual(['スロール（プッシュアップバー）', 'マウンテンクライマー'])
  })

  it('金曜は30秒運動/30秒休憩×3周（バックランジ→ニーレイズ）', () => {
    const [fri, ...rest] = weeklyProgramPlans[4].exercises
    expect(rest).toEqual([])
    expect(fri).toMatchObject({ type: 'circuit', defaultReps: 30, interval: 30, targetSets: 3 })
    expect(fri.stations?.map(st => st.name)).toEqual(['オルタネイティング・バックランジ', 'ハンギングニーレイズ'])
  })

  it('日曜はすべて1回ずつで、左右ありは左→右の2種目（合計 60/60/60/90/90/90/90/120/120 秒）', () => {
    const sun = weeklyProgramPlans[6].exercises
    expect(sun.every(e => e.type === 'duration' && e.targetSets === 1 && e.interval === 0)).toBe(true)
    expect(sun.map(e => e.defaultReps)).toEqual([60, 60, 60, 90, 90, 90, 90, 120, 120])
    expect(sun.map(e => e.name)).toEqual([
      'キャット＆カウ', 'スコーピオン・チェストストレッチ（左）', 'スコーピオン・チェストストレッチ（右）',
      '90-90 ヒップストレッチ（左）', '90-90 ヒップストレッチ（右）', 'カウチストレッチ（左）', 'カウチストレッチ（右）',
      'ダウンドッグ〜コブラ', '仰向けディープブリージング'
    ])
  })

  it('missingWeeklyPlans は、すでにある週間プランを除く', () => {
    expect(missingWeeklyPlans([])).toHaveLength(7)
    expect(missingWeeklyPlans([{ name: weeklyProgramPlans[0].name }, { name: '自作プラン' }]).map(p => p.name)).toEqual(weeklyProgramPlans.slice(1).map(p => p.name))
    expect(missingWeeklyPlans(weeklyProgramPlans)).toEqual([])
  })
})

describe('セッションへの動画の引き継ぎ', () => {
  it('ストレッチは左右に展開しても動画を持ち、サーキットの種目も動画を持つ', () => {
    const plans = libraryPlans()
    const mon = buildSession(plans[0], [], new Map())
    expect(mon.stretches.warmup.map(s => s.name)).toEqual(['股関節サークル（左）', '股関節サークル（右）', '足首の背屈ストレッチ（左）', '足首の背屈ストレッチ（右）'])
    expect(mon.stretches.warmup.every(s => (s.videoIds ?? []).length === 1)).toBe(true)
    expect(mon.stretches.cooldown[mon.stretches.cooldown.length - 1].videoIds).toBeUndefined() // 腹式呼吸には専用動画が無い

    const fri = buildSession(plans[4], [], new Map())
    expect(fri.exercises.map(e => e.name)).toEqual(['オルタネイティング・バックランジ', 'ハンギングニーレイズ'])
    expect(fri.exercises[1].videoIds).toHaveLength(2) // ぶら下がり／ディップスバーの2本
  })

  it('標準の種目を使う自作プランにも、種目マスタの動画が付く', () => {
    const custom: WorkoutPlan = {
      id: 'c', name: '自作', sortOrder: 1, warmup: [], cooldown: [],
      exercises: [{ id: 'x', name: 'ブルガリアンスクワット', type: 'normal', targetSets: 3, defaultReps: 8, defaultWeight: 0, interval: 60, equipmentType: 'vest' }]
    }
    const [out] = applyLibraryToPlans([custom], buildLibrary([]))
    expect(out.exercises[0].videoIds).toEqual(['03_monday_main_bulgarian_squat'])
    // プラン側に動画の指定があれば、そちらを優先する
    const [own] = applyLibraryToPlans([{ ...custom, exercises: [{ ...custom.exercises[0], videoIds: ['01_monday_warmup_hip_circle'] }] }], buildLibrary([]))
    expect(own.exercises[0].videoIds).toEqual(['01_monday_warmup_hip_circle'])
  })
})

describe('前回の記録の引き継ぎ（負荷だけ。セット数・回数はプランの内容）', () => {
  const optionsMap = new Map([
    ['assist', [{ label: 'ー', weight: 0 }, { label: '2本 (-47kg)', weight: -47 }, { label: '3本 (-70kg)', weight: -70 }]],
    ['bodyweight', [{ label: 'ー', weight: 0 }]]
  ])
  const tuesday = () => libraryPlans()[1]
  const record = (over: Partial<WorkoutRecord['exercises'][number]>): WorkoutRecord => ({
    id: 1, date: '10/14', fullDate: '2026-10-14T00:00:00Z', day: '火', category: '療養トレ', type: 'workout', exercises: [{
      id: 'x', exerciseId: 'sys:chin-up', name: 'チンニング', type: 'duration', targetSets: 2, defaultReps: 40, defaultWeight: 0, interval: 60,
      equipmentType: 'assist', inherited: false, options: [],
      sets: [{ setNumber: 1, reps: 40, weight: -70, completed: true }, { setNumber: 2, reps: 40, weight: -70, completed: true }], ...over
    }]
  })

  it('別のプランで2セット×40秒だった種目でも、火曜のチンニングはプランどおり3セット×4回', () => {
    const chin = buildSession(tuesday(), [record({})], optionsMap).exercises[0]
    expect(chin.inherited).toBe(true)
    expect(chin.targetSets).toBe(3)
    expect(chin.sets.map(s => [s.reps, s.weight])).toEqual([[4, -70], [4, -70], [4, -70]]) // 回数はプラン、負荷は前回
    expect(chin.sets.every(s => !s.completed)).toBe(true)
  })

  it('前回と機材が違うときは負荷を引き継がず、プランの初期値にする', () => {
    const chin = buildSession(tuesday(), [record({ equipmentType: 'bodyweight' })], optionsMap).exercises[0]
    expect(chin.sets.map(s => s.weight)).toEqual([-47, -47, -47])
  })

  it('前回のセットごとの負荷は順に引き継ぎ、足りない分は最後のセットの負荷', () => {
    const sets = [{ setNumber: 1, reps: 4, weight: -24, completed: true }, { setNumber: 2, reps: 4, weight: -47, completed: true }]
    const chin = buildSession(tuesday(), [record({ type: 'normal', sets })], optionsMap).exercises[0]
    expect(chin.sets.map(s => s.weight)).toEqual([-24, -47, -47])
  })

  it('タバタは前回の記録があっても、プランの 20秒/10秒×8 になる', () => {
    const wed = libraryPlans()[2]
    const prev: WorkoutRecord = record({})
    prev.exercises = [{ ...prev.exercises[0], exerciseId: 'sys:tabata-sprawl-mountain-climber', name: wed.exercises[0].name, type: 'tabata', equipmentType: 'bodyweight',
      sets: [{ setNumber: 1, reps: 0, weight: 0, completed: true, tabataWork: 30, tabataRest: 15, tabataCycles: 4 }] }]
    const [t] = buildSession(wed, [prev], optionsMap).exercises
    expect(t.sets).toHaveLength(1)
    expect(t.sets[0]).toMatchObject({ tabataWork: 20, tabataRest: 10, tabataCycles: 8 })
  })
})

describe('今日のおすすめ', () => {
  it('今日の曜日で始まる名前のプランをおすすめし、実施済みなら別のプランになる', () => {
    const plans = asPlans()
    const wed = new Date(2026, 9, 28, 12) // 水曜
    expect(wed.getDay()).toBe(3)
    expect(recommendPlanId(plans, [], wed)).toBe(plans[2].id)
    const done: WorkoutRecord = { id: 1, date: '10/28', fullDate: new Date(2026, 9, 28, 7).toISOString(), day: '水', category: plans[2].name, type: 'workout', exercises: [] }
    expect(recommendPlanId(plans, [done], wed)).not.toBe(plans[2].id)
  })

  it('曜日の付いたプランが無ければ、これまでどおり前回から日が空いたプラン', () => {
    const plans: WorkoutPlan[] = [
      { id: 'a', name: '脚の日', sortOrder: 1, warmup: [], cooldown: [], exercises: [{ id: 'e', name: 'スクワット', type: 'normal', targetSets: 1, defaultReps: 1, defaultWeight: 0, interval: 0, equipmentType: 'bodyweight' }] }
    ]
    expect(recommendPlanId(plans, [], new Date(2026, 9, 28, 12))).toBe('a')
  })
})

describe('プランタブ: 週間トレーニングの追加', () => {
  it('ボタン1つで7プランが作られ、もう一度は出ない（重複しない）', async () => {
    const user = await load()
    await user.click(screen.getByText('プラン'))
    expect(screen.getByText('週間トレーニング（月〜日）を追加')).toBeInTheDocument()
    const before = getMockTable('workout_plans').length

    await user.click(screen.getByRole('button', { name: '7つのプランを追加する' }))
    await waitFor(() => expect(getMockTable('workout_plans')).toHaveLength(before + 7))

    const rows = getMockTable('workout_plans') as unknown as { name: string; user_id: string; sort_order: number }[]
    weeklyProgramPlans.forEach(p => expect(rows.some(r => r.name === p.name && r.user_id === TEST_USER_ID)).toBe(true))
    const orders = rows.map(r => r.sort_order)
    expect(new Set(orders).size).toBe(orders.length) // 並び順が既存のプランと重ならない
    expect(await screen.findByRole('status')).toHaveTextContent('7つのプランを追加しました')
    expect(screen.queryByText('週間トレーニング（月〜日）を追加')).not.toBeInTheDocument()
    expect(screen.getByText(weeklyProgramPlans[6].name)).toBeInTheDocument()
  })

  it('一部だけ作成済みなら、足りない分だけ追加する', async () => {
    getMockTable('workout_plans').push(planToRow({ ...asPlans()[0], id: '00000000-0000-4000-8000-0000000000aa' }, TEST_USER_ID))
    const user = await load()
    await user.click(screen.getByText('プラン'))
    await user.click(screen.getByRole('button', { name: '6つのプランを追加する' }))
    await waitFor(() => expect(getMockTable('workout_plans').filter(r => String(r.name).includes('曜：'))).toHaveLength(7))
  })
})

describe('解説動画の再生', () => {
  async function startPlan(planName: string) {
    weeklyProgramPlans.forEach((p, i) => {
      getMockTable('workout_plans').push(planToRow({ ...p, id: `00000000-0000-4000-8000-00000000010${i}`, sortOrder: 10 + i }, TEST_USER_ID))
    })
    const user = await load()
    await user.click(screen.getByRole('radio', { name: new RegExp(planName) }))
    return user
  }

  it('ワークアウトの開始前の一覧から、種目の動画を見られる', async () => {
    const user = await startPlan('土曜')
    await user.click(screen.getByRole('button', { name: 'チューブ・スクワット＆プレスの解説動画を見る' }))
    const dialog = screen.getByRole('dialog', { name: 'チューブ・スクワット＆プレスの解説動画' })
    const frame = within(dialog).getByTitle('チューブ・スクワット＆プレス') as HTMLIFrameElement
    expect(frame.src).toBe(videoEmbedUrl(EXERCISE_VIDEOS[27]))
    expect(within(dialog).getByRole('link', { name: /Googleドライブで開く/ })).toHaveAttribute('href', videoOpenUrl(EXERCISE_VIDEOS[27]))

    await user.click(within(dialog).getByRole('button', { name: '動画を閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('セッション中は、ウォームアップ・種目・クールダウンのそれぞれから動画を見られる', async () => {
    const user = await startPlan('月曜')
    await user.click(screen.getByText('トレーニングを開始する'))

    // 種目（左右の2種目とも同じブルガリアンスクワットの動画）
    await user.click(screen.getByRole('button', { name: 'ブルガリアンスクワット（右）の解説動画を見る' }))
    expect((within(screen.getByRole('dialog')).getByTitle('ブルガリアンスクワット') as HTMLIFrameElement).src).toBe(videoEmbedUrl(EXERCISE_VIDEOS[2]))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // ウォームアップ／クールダウン（左右に展開した行にも動画が付く）
    await user.click(screen.getByRole('button', { name: '股関節サークル（左）の解説動画を見る' }))
    expect((within(screen.getByRole('dialog')).getByTitle('股関節サークル') as HTMLIFrameElement).src).toBe(videoEmbedUrl(EXERCISE_VIDEOS[0]))
    await user.click(screen.getByRole('button', { name: '動画を閉じる' }))
    expect(screen.getByRole('button', { name: '太もも前とお尻のストレッチ（右）の解説動画を見る' })).toBeInTheDocument()
    // 専用動画が無い項目には、ボタンを出さない
    expect(screen.queryByRole('button', { name: /腹式呼吸.*解説動画/ })).not.toBeInTheDocument()
  })

  it('サーキットの種目の動画を見られ、動画が2本ある種目は切り替えられる', async () => {
    const user = await startPlan('金曜')
    await user.click(screen.getByText('トレーニングを開始する'))
    await user.click(screen.getAllByRole('button', { name: 'ハンギングニーレイズの解説動画を見る' })[0])
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByTitle('ハンギング・ニーレイズ') as HTMLIFrameElement).src).toBe(videoEmbedUrl(EXERCISE_VIDEOS[22]))

    await user.click(within(dialog).getByRole('tab', { name: /ディップスバー・ニーレイズ/ }))
    expect((within(dialog).getByTitle(/ディップスバー・ニーレイズ/) as HTMLIFrameElement).src).toBe(videoEmbedUrl(EXERCISE_VIDEOS[23]))
  })

  it('種目タブの詳細から、標準種目の動画を見られる', async () => {
    const user = await load()
    await user.click(screen.getByText('種目'))
    await user.click(screen.getByText('チューブ・グッドモーニング'))
    await user.click(screen.getByRole('button', { name: 'チューブ・グッドモーニングの解説動画を見る' }))
    expect(within(screen.getByRole('dialog')).getByTitle('チューブ・グッドモーニング')).toBeInTheDocument()
  })
})
