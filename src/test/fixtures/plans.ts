import type { WorkoutPlan } from '../../types'

export const initialWorkoutPlans: WorkoutPlan[] = [
  { day: '月', category: '完全休養', exercises: [] },
  {
    day: '火', category: '上半身・引く', exercises: [
      { id: 'tue-1', name: 'チンニング', type: 'normal', targetSets: 5, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'tue-2', name: 'チューブ・ベントオーバーロウ', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'tue-3', name: 'チューブ・アームカール', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' },
      { id: 'tue-4', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 3, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' },
    ]
  },
  {
    day: '水', category: '上半身・押す', exercises: [
      { id: 'wed-1', name: 'プッシュアップ', type: 'normal', targetSets: 5, defaultReps: 12, defaultWeight: 0, interval: 90, equipmentType: 'bodyweight' },
      { id: 'wed-2', name: 'アシスト・ディップス', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'wed-3', name: 'チューブ・トライセプスPD', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'wed-4', name: 'パイクプッシュアップ', type: 'normal', targetSets: 3, defaultReps: 8, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' },
    ]
  },
  {
    day: '木', category: 'VO₂MAX＋体幹', exercises: [
      { id: 'thu-1', name: 'HIIT（バーピー）', type: 'tabata', targetSets: 2, defaultReps: 0, defaultWeight: 0, interval: 120, tabataWork: 20, tabataRest: 10, tabataCycles: 8, equipmentType: 'bodyweight' },
      { id: 'thu-2', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 5, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' },
      { id: 'thu-3', name: 'プランク', type: 'duration', targetSets: 5, defaultReps: 45, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' },
    ]
  },
  {
    day: '金', category: '上半身・肩', exercises: [
      { id: 'fri-1', name: 'チューブ・オーバーヘッドプレス', type: 'normal', targetSets: 5, defaultReps: 12, defaultWeight: 28, interval: 90, equipmentType: 'tube' },
      { id: 'fri-2', name: 'チューブ・サイドレイズ', type: 'normal', targetSets: 5, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' },
      { id: 'fri-3', name: 'チューブ・フェイスプル', type: 'normal', targetSets: 4, defaultReps: 12, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'fri-4', name: 'チューブ・フロントレイズ', type: 'normal', targetSets: 3, defaultReps: 15, defaultWeight: 9, interval: 60, equipmentType: 'tube' },
    ]
  },
  {
    day: '土', category: '上半身（押す・引く・肩）＋体幹', exercises: [
      { id: 'sat-1', name: 'チンニング', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'sat-2', name: 'プッシュアップ', type: 'normal', targetSets: 4, defaultReps: 12, defaultWeight: 0, interval: 90, equipmentType: 'bodyweight' },
      { id: 'sat-3', name: 'チューブ・ベントオーバーロウ', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 28, interval: 60, equipmentType: 'tube' },
      { id: 'sat-4', name: 'アシスト・ディップス', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: -47, interval: 90, equipmentType: 'assist' },
      { id: 'sat-5', name: 'チューブ・オーバーヘッドプレス', type: 'normal', targetSets: 4, defaultReps: 12, defaultWeight: 28, interval: 90, equipmentType: 'tube' },
      { id: 'sat-6', name: 'ハンギングニーレイズ', type: 'normal', targetSets: 4, defaultReps: 10, defaultWeight: 0, interval: 60, equipmentType: 'bodyweight' },
    ]
  },
  {
    day: '日', category: '下半身＋VO₂MAX＋体幹', exercises: [
      { id: 'sun-1', name: 'ブルガリアンSS（左）', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: 5.25, interval: 180, equipmentType: 'vest' },
      { id: 'sun-2', name: 'ブルガリアンSS（右）', type: 'normal', targetSets: 4, defaultReps: 8, defaultWeight: 5.25, interval: 180, equipmentType: 'vest' },
      { id: 'sun-3', name: 'チューブ・ルーマニアンDL', type: 'normal', targetSets: 4, defaultReps: 15, defaultWeight: 66.5, interval: 120, equipmentType: 'tube' },
      { id: 'sun-4', name: 'HIIT（バーピー）', type: 'tabata', targetSets: 2, defaultReps: 0, defaultWeight: 5.25, interval: 120, tabataWork: 20, tabataRest: 10, tabataCycles: 8, equipmentType: 'vest' },
      { id: 'sun-5', name: 'ウエイトプランク', type: 'duration', targetSets: 4, defaultReps: 45, defaultWeight: 5.25, interval: 60, equipmentType: 'vest' },
    ]
  },
]

export const sundayPlan = initialWorkoutPlans.find(p => p.day === '日')!
export const ssExerciseLeft = sundayPlan.exercises.find(e => e.name === 'ブルガリアンSS（左）')!
export const ssExerciseRight = sundayPlan.exercises.find(e => e.name === 'ブルガリアンSS（右）')!
