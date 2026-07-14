/**
 * ブルガリアンSS（スプリットスクワット）機能テスト – 機材・重量計算
 */
import { describe, it, expect } from 'vitest'
import { generateEquipmentOptions, DEFAULT_LOAD_EQUIPMENT } from '../lib/equipmentUtils'
import { ssExerciseLeft, ssExerciseRight, sundayPlan } from './fixtures/plans'

describe('ウェイトベスト機材', () => {
  const vestEquipment = DEFAULT_LOAD_EQUIPMENT.find(e => e.id === 'vest')!

  it('vestアイテムが存在する', () => {
    expect(vestEquipment).toBeDefined()
    expect(vestEquipment.name).toBe('ウェイトベスト')
    expect(vestEquipment.direction).toBe('+')
  })

  it('ベストのオプション一覧が正しく生成される', () => {
    const opts = generateEquipmentOptions(vestEquipment)
    // min=5.25, max=30, step=2.75 → 10 ステップ + "ー"
    expect(opts[0]).toEqual({ label: 'ー', weight: 0 })
    expect(opts[1]).toEqual({ label: '1 (+5.25kg)', weight: 5.25 })
    expect(opts[2]).toEqual({ label: '2 (+8kg)', weight: 8 })
    expect(opts[3]).toEqual({ label: '3 (+10.75kg)', weight: 10.75 })
  })

  it('最大重量オプションが30kg以下', () => {
    const opts = generateEquipmentOptions(vestEquipment)
    const maxWeight = Math.max(...opts.map(o => o.weight))
    expect(maxWeight).toBeLessThanOrEqual(30)
  })

  it('全オプションの重量が非負', () => {
    const opts = generateEquipmentOptions(vestEquipment)
    opts.forEach(opt => expect(opt.weight).toBeGreaterThanOrEqual(0))
  })
})

describe('日曜日プラン – ブルガリアンSS種目', () => {
  it('日曜プランにSSが2種目含まれる', () => {
    const ssExercises = sundayPlan.exercises.filter(e => e.name.includes('ブルガリアンSS'))
    expect(ssExercises).toHaveLength(2)
  })

  it('ブルガリアンSS（左）のデフォルト設定', () => {
    expect(ssExerciseLeft.type).toBe('normal')
    expect(ssExerciseLeft.targetSets).toBe(4)
    expect(ssExerciseLeft.defaultReps).toBe(8)
    expect(ssExerciseLeft.defaultWeight).toBe(5.25)
    expect(ssExerciseLeft.interval).toBe(180)
    expect(ssExerciseLeft.equipmentType).toBe('vest')
  })

  it('ブルガリアンSS（右）のデフォルト設定', () => {
    expect(ssExerciseRight.type).toBe('normal')
    expect(ssExerciseRight.targetSets).toBe(4)
    expect(ssExerciseRight.defaultReps).toBe(8)
    expect(ssExerciseRight.defaultWeight).toBe(5.25)
    expect(ssExerciseRight.interval).toBe(180)
    expect(ssExerciseRight.equipmentType).toBe('vest')
  })

  it('SS種目のインターバルは180秒（他より長い）', () => {
    const ssExercises = sundayPlan.exercises.filter(e => e.name.includes('ブルガリアンSS'))
    const otherExercises = sundayPlan.exercises.filter(e => !e.name.includes('ブルガリアンSS'))
    ssExercises.forEach(ex => {
      expect(ex.interval).toBe(180)
    })
    otherExercises.forEach(ex => {
      expect(ex.interval).toBeLessThan(180)
    })
  })

  it('SS左右の設定が一致している', () => {
    const keys = ['type', 'targetSets', 'defaultReps', 'defaultWeight', 'interval', 'equipmentType'] as const
    keys.forEach(key => {
      expect(ssExerciseLeft[key]).toEqual(ssExerciseRight[key])
    })
  })
})
