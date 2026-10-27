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

  it('水曜は20秒/10秒×8ラウンド（スロールとマウンテンクライマーを交互）、金曜は30秒/30秒×3周', () => {
    const wed = weeklyProgramPlans[2].exercises[0]
    expect(wed).toMatchObject({ type: 'circuit', defaultReps: 20, interval: 10, targetSets: 4 })
    expect(wed.stations).toHaveLength(2)
    expect((wed.stations!.length) * wed.targetSets).toBe(8)
    const fri = weeklyProgramPlans[4].exercises[0]
    expect(fri).toMatchObject({ type: 'circuit', defaultReps: 30, interval: 30, targetSets: 3 })
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
