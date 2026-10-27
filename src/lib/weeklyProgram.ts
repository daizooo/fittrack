import type { CircuitStation, Exercise, Stretch, WorkoutPlan } from '../types'

type PlanSeed = Omit<WorkoutPlan, 'id' | 'sortOrder'>

/**
 * 育児期のための1日10〜15分 週間トレーニング（月〜日の7プラン）。
 * 元の資料: Google ドライブ「トレーニング」フォルダの weekly_training_guide.md。
 *
 * - 種目は標準の種目（sys:）を参照する。解説動画は種目マスタ側で紐付く（exerciseVideos.ts）
 * - ストレッチは種目マスタに無いので、動画があるものは videoIds を直接持つ
 * - 回数・休憩は資料の範囲（例: 8〜10回 / 休憩45〜60秒）の下限から始める。余裕が出たら上限へ
 *   （セット数の範囲は上限。木曜のデフィシット・プッシュアップは「2〜3セット」の3セット）
 * - 資料が回数で書いているウォームアップ（例: 股関節サークル左右各5周）は、1回あたりの目安から秒数に直している
 * - チューブは資料どおり一番軽い赤（+9kg）から始める
 */

const RED_TUBE = 9
const ASSIST_2 = -47

const stretch = (id: string, name: string, seconds: number, opts: { bilateral?: boolean; video?: string } = {}): Stretch => ({
  id, name, seconds,
  ...(opts.bilateral ? { bilateral: true } : {}),
  ...(opts.video ? { videoIds: [opts.video] } : {})
})

type ExerciseInput = Pick<Exercise, 'id' | 'exerciseId' | 'name' | 'type' | 'targetSets' | 'defaultReps' | 'interval'>
  & Partial<Pick<Exercise, 'defaultWeight' | 'equipmentType' | 'supersetGroup' | 'tabataWork' | 'tabataRest' | 'tabataCycles'>>

const exercise = (e: ExerciseInput): Exercise => ({ defaultWeight: 0, equipmentType: 'bodyweight', ...e })

const station = (id: string, exerciseId: string, name: string): CircuitStation => ({
  id, exerciseId, name, equipmentType: 'bodyweight', defaultWeight: 0
})

/** サーキット: 運動秒数・休憩・周回数は1つだけ持つ（defaultReps = 運動秒数 / interval = 休憩 / targetSets = 周回） */
const circuit = (id: string, work: number, rest: number, rounds: number, stations: CircuitStation[]): Exercise => ({
  id, name: 'サーキット', type: 'circuit', targetSets: rounds, defaultReps: work, interval: rest,
  defaultWeight: 0, equipmentType: 'bodyweight', stations
})

export const weeklyProgramPlans: PlanSeed[] = [
  {
    name: '月曜：下半身筋力＆股関節',
    warmup: [
      stretch('mon-wu-hip', '股関節サークル', 20, { bilateral: true, video: '01_monday_warmup_hip_circle' }),
      stretch('mon-wu-ankle', '足首の背屈ストレッチ', 20, { bilateral: true, video: '02_monday_warmup_ankle_stretch' })
    ],
    exercises: [
      // 左右を交互に行う（脚間の休憩30秒）
      exercise({ id: 'mon-1', exerciseId: 'sys:bulgarian-squat-left', name: 'ブルガリアンスクワット（左）', type: 'normal', targetSets: 3, defaultReps: 8, interval: 30, equipmentType: 'vest', supersetGroup: 'mon-bss-lr' }),
      exercise({ id: 'mon-2', exerciseId: 'sys:bulgarian-squat-right', name: 'ブルガリアンスクワット（右）', type: 'normal', targetSets: 3, defaultReps: 8, interval: 30, equipmentType: 'vest', supersetGroup: 'mon-bss-lr' }),
      exercise({ id: 'mon-3', exerciseId: 'sys:tube-good-morning', name: 'チューブ・グッドモーニング', type: 'normal', targetSets: 2, defaultReps: 12, defaultWeight: RED_TUBE, interval: 30, equipmentType: 'tube' })
    ],
    cooldown: [
      stretch('mon-cd-quad', '太もも前とお尻のストレッチ', 30, { bilateral: true, video: '05_monday_cooldown_quad_stretch' }),
      stretch('mon-cd-breath', '腹式呼吸（4秒吸って8秒吐く×4回）', 48)
    ]
  },
  {
    name: '火曜：上半身プル＆肩甲帯',
    warmup: [
      stretch('tue-wu-catcow', 'キャット＆カウ', 30, { video: '06_tuesday_warmup_cat_cow' }),
      stretch('tue-wu-arm', 'アームサークル', 30, { video: '07_tuesday_warmup_arm_circle' })
    ],
    exercises: [
      exercise({ id: 'tue-1', exerciseId: 'sys:chin-up', name: 'チンニング', type: 'normal', targetSets: 3, defaultReps: 4, defaultWeight: ASSIST_2, interval: 45, equipmentType: 'assist' }),
      exercise({ id: 'tue-2', exerciseId: 'sys:kneeling-face-pull', name: 'ニーリング・フェイスプル', type: 'normal', targetSets: 3, defaultReps: 12, defaultWeight: RED_TUBE, interval: 30, equipmentType: 'tube' })
    ],
    cooldown: [
      stretch('tue-cd-lat', '広背筋ストレッチ', 30, { bilateral: true, video: '10_tuesday_cooldown_lat_stretch' }),
      stretch('tue-cd-breath', '深呼吸', 30)
    ]
  },
  {
    name: '水曜：VO₂max HIIT（タバタ）',
    warmup: [
      stretch('wed-wu-march', '足踏み腕振り', 30, { video: '11_wednesday_warmup_march_in_place' }),
      stretch('wed-wu-wgs', 'ワールド・グレイテスト・ストレッチ', 30, { bilateral: true, video: '12_wednesday_warmup_worlds_greatest_stretch' })
    ],
    exercises: [
      // 20秒全力 / 10秒休息 × 8ラウンド（アプリのタバタ）。奇数ラウンド＝スロール、偶数ラウンド＝マウンテンクライマー
      exercise({ id: 'wed-1', exerciseId: 'sys:tabata-sprawl-mountain-climber', name: 'タバタ（奇数R:スロール／偶数R:マウンテンクライマー）', type: 'tabata', targetSets: 1, defaultReps: 0, interval: 0, tabataWork: 20, tabataRest: 10, tabataCycles: 8 })
    ],
    cooldown: [
      stretch('wed-cd-child', 'チャイルドポーズ', 60, { video: '15_wednesday_cooldown_childs_pose' }),
      stretch('wed-cd-shake', '立って足腰を揺らす', 20)
    ]
  },
  {
    name: '木曜：上半身プッシュ＆胸郭',
    warmup: [
      stretch('thu-wu-wrist', '手首回し＆前腕ストレッチ', 30, { video: '16_thursday_warmup_wrist_forearm_stretch' }),
      stretch('thu-wu-chest', '胸郭オープンストレッチ', 30, { bilateral: true, video: '17_thursday_warmup_chest_open_stretch' })
    ],
    exercises: [
      exercise({ id: 'thu-1', exerciseId: 'sys:assist-dips', name: 'アシスト・ディップス', type: 'normal', targetSets: 3, defaultReps: 6, defaultWeight: ASSIST_2, interval: 45, equipmentType: 'assist' }),
      exercise({ id: 'thu-2', exerciseId: 'sys:deficit-push-up', name: 'デフィシット・プッシュアップ', type: 'normal', targetSets: 3, defaultReps: 8, interval: 45 })
    ],
    cooldown: [
      stretch('thu-cd-chest', '胸のストレッチ（後ろで手を組む）', 30, { video: '20_thursday_cooldown_chest_triceps_stretch' }),
      stretch('thu-cd-triceps', '上腕三頭筋ストレッチ', 30, { bilateral: true, video: '20_thursday_cooldown_chest_triceps_stretch' })
    ]
  },
  {
    name: '金曜：下半身・体幹＆インターバル',
    warmup: [
      stretch('fri-wu-inchworm', 'インチウォーム', 30, { video: '21_friday_warmup_inchworm' })
    ],
    exercises: [
      // 30秒運動 / 30秒休憩 × 3周（バックランジ → ニーレイズ）
      circuit('fri-interval', 30, 30, 3, [
        station('fri-st-1', 'sys:back-lunge', 'オルタネイティング・バックランジ'),
        station('fri-st-2', 'sys:hanging-knee-raise', 'ハンギングニーレイズ')
      ])
    ],
    cooldown: [
      stretch('fri-cd-cobra', 'コブラポーズ', 45, { video: '25_friday_cooldown_cobra_pose' }),
      stretch('fri-cd-breath', '正座で深呼吸', 30)
    ]
  },
  {
    name: '土曜：全身連動＆背部筋力',
    warmup: [
      stretch('sat-wu-squat', '自重スクワット', 30, { video: '26_saturday_warmup_bodyweight_squat' }),
      stretch('sat-wu-thoracic', '胸椎ローテーション', 20, { bilateral: true, video: '27_saturday_warmup_thoracic_rotation' })
    ],
    exercises: [
      exercise({ id: 'sat-1', exerciseId: 'sys:tube-squat-press', name: 'チューブ・スクワット＆プレス', type: 'normal', targetSets: 3, defaultReps: 10, defaultWeight: RED_TUBE, interval: 45, equipmentType: 'tube' }),
      exercise({ id: 'sat-2', exerciseId: 'sys:seated-tube-row', name: 'シーテッド・チューブローイング', type: 'normal', targetSets: 3, defaultReps: 12, defaultWeight: RED_TUBE, interval: 30, equipmentType: 'tube' })
    ],
    cooldown: [
      stretch('sat-cd-side', '体側伸ばしストレッチ', 30, { bilateral: true, video: '30_saturday_cooldown_side_bend_stretch' }),
      stretch('sat-cd-shoulder', '肩を大きく回して脱力', 20)
    ]
  },
  {
    name: '日曜：フルモビリティ＆リカバリー',
    warmup: [],
    exercises: [
      // 激しい運動は行わない。すべて1回ずつ（左右のあるものは左→右の2種目に分ける）
      exercise({ id: 'sun-1', exerciseId: 'sys:cat-cow', name: 'キャット＆カウ', type: 'duration', targetSets: 1, defaultReps: 60, interval: 0 }),
      exercise({ id: 'sun-2', exerciseId: 'sys:scorpion-chest-stretch-left', name: 'スコーピオン・チェストストレッチ（左）', type: 'duration', targetSets: 1, defaultReps: 60, interval: 0 }),
      exercise({ id: 'sun-3', exerciseId: 'sys:scorpion-chest-stretch-right', name: 'スコーピオン・チェストストレッチ（右）', type: 'duration', targetSets: 1, defaultReps: 60, interval: 0 }),
      exercise({ id: 'sun-4', exerciseId: 'sys:90-90-hip-stretch-left', name: '90-90 ヒップストレッチ（左）', type: 'duration', targetSets: 1, defaultReps: 90, interval: 0 }),
      exercise({ id: 'sun-5', exerciseId: 'sys:90-90-hip-stretch-right', name: '90-90 ヒップストレッチ（右）', type: 'duration', targetSets: 1, defaultReps: 90, interval: 0 }),
      exercise({ id: 'sun-6', exerciseId: 'sys:couch-stretch-left', name: 'カウチストレッチ（左）', type: 'duration', targetSets: 1, defaultReps: 90, interval: 0 }),
      exercise({ id: 'sun-7', exerciseId: 'sys:couch-stretch-right', name: 'カウチストレッチ（右）', type: 'duration', targetSets: 1, defaultReps: 90, interval: 0 }),
      exercise({ id: 'sun-8', exerciseId: 'sys:downdog-to-cobra', name: 'ダウンドッグ〜コブラ', type: 'duration', targetSets: 1, defaultReps: 120, interval: 0 }),
      exercise({ id: 'sun-9', exerciseId: 'sys:supine-deep-breathing', name: '仰向けディープブリージング', type: 'duration', targetSets: 1, defaultReps: 120, interval: 0 })
    ],
    cooldown: []
  }
]

/** まだ作られていない週間プラン（プラン名で判定する。作り直しても重複しない） */
export const missingWeeklyPlans = (existing: Pick<WorkoutPlan, 'name'>[]): PlanSeed[] =>
  weeklyProgramPlans.filter(seed => !existing.some(p => p.name === seed.name))
