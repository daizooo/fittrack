import type { Stretch, WorkoutPlan } from '../types'

type PlanSeed = Omit<WorkoutPlan, 'id' | 'sortOrder'>

const upperWarmup: Stretch[] = [
  { id: 'wu-arm-circle', name: 'アームサークル', seconds: 30 },
  { id: 'wu-shoulder', name: '肩甲骨まわし', seconds: 30 },
  { id: 'wu-cat-cow', name: 'キャット＆カウ', seconds: 30 }
]
const upperCooldown: Stretch[] = [
  { id: 'cd-chest', name: '胸のストレッチ', seconds: 30, bilateral: true },
  { id: 'cd-lat', name: '広背筋ストレッチ', seconds: 30, bilateral: true },
  { id: 'cd-triceps', name: '上腕三頭筋ストレッチ', seconds: 20, bilateral: true }
]
const lowerWarmup: Stretch[] = [
  { id: 'wu-leg-swing', name: 'レッグスイング', seconds: 20, bilateral: true },
  { id: 'wu-hip-circle', name: '股関節まわし', seconds: 30 },
  { id: 'wu-squat', name: '自重スクワット（軽め）', seconds: 30 }
]
const lowerCooldown: Stretch[] = [
  { id: 'cd-hamstring', name: 'ハムストリング', seconds: 30, bilateral: true },
  { id: 'cd-quad', name: '大腿四頭筋', seconds: 30, bilateral: true },
  { id: 'cd-hip-flexor', name: '腸腰筋', seconds: 30, bilateral: true }
]

/** 新規アカウント作成時に用意するサンプルプラン（自由に編集・削除できる） */
export const defaultPlanSeeds: PlanSeed[] = [
  {
    name: '上半身・引く', warmup: upperWarmup, cooldown: upperCooldown, exercises: [
      { id: 'pull-1', name: 'チンニング', type: 'normal', targetSets: 5, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'pull-2', name: 'チューブ・ベントオーバーロウ', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'pull-3', name: 'チューブ・アームカール', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' },
      { id: 'pull-4', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 3, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }
    ]
  },
  {
    name: '上半身・押す', warmup: upperWarmup, cooldown: upperCooldown, exercises: [
      { id: 'push-1', name: 'プッシュアップ', type: 'normal', targetSets: 5, defaultReps: 12, defaultWeight: 0, interval: 90, equipmentType: 'bodyweight' },
      { id: 'push-2', name: 'アシスト・ディップス', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'push-3', name: 'チューブ・トライセプスPD', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'push-4', name: 'パイクプッシュアップ', type: 'normal', targetSets: 3, defaultReps: 8, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }
    ]
  },
  {
    name: 'VO₂MAX＋体幹', warmup: lowerWarmup, cooldown: lowerCooldown, exercises: [
      { id: 'vo2-1', name: 'HIIT（バーピー）', type: 'tabata', targetSets: 2, defaultReps: 0, defaultWeight: 0, interval: 120, tabataWork: 20, tabataRest: 10, tabataCycles: 8, equipmentType: 'bodyweight' },
      { id: 'vo2-2', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 5, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' },
      { id: 'vo2-3', name: 'プランク', type: 'duration', targetSets: 5, defaultReps: 45, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' }
    ]
  },
  {
    name: '上半身・肩', warmup: upperWarmup, cooldown: upperCooldown, exercises: [
      { id: 'sh-1', name: 'チューブ・オーバーヘッドプレス', type: 'normal', targetSets: 5, defaultReps: 12, defaultWeight: 28, interval: 90, equipmentType: 'tube' },
      { id: 'sh-2', name: 'チューブ・サイドレイズ', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' },
      { id: 'sh-3', name: 'チューブ・フェイスプル', type: 'normal', targetSets: 4, defaultReps: 12, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'sh-4', name: 'チューブ・フロントレイズ', type: 'normal', targetSets: 3, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' }
    ]
  },
  {
    name: '下半身＋VO₂MAX＋体幹', warmup: lowerWarmup, cooldown: lowerCooldown, exercises: [
      { id: 'low-1', name: 'ブルガリアンSS（左）', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: 5.25, interval: 180, equipmentType: 'vest', supersetGroup: 'low-bss-lr' },
      { id: 'low-2', name: 'ブルガリアンSS（右）', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: 5.25, interval: 180, equipmentType: 'vest', supersetGroup: 'low-bss-lr' },
      { id: 'low-3', name: 'チューブ・ルーマニアンDL', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 66.5, interval: 120, equipmentType: 'tube' },
      { id: 'low-4', name: 'HIIT（バーピー）', type: 'tabata', targetSets: 2, defaultReps: 0, defaultWeight: 5.25, interval: 120, tabataWork: 20, tabataRest: 10, tabataCycles: 8, equipmentType: 'vest' },
      { id: 'low-5', name: 'ウエイトプランク', type: 'duration', targetSets: 4, defaultReps: 45, defaultWeight: 5.25, interval: 60, equipmentType: 'vest' }
    ]
  }
]
