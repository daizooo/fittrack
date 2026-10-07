import type {
  CircuitStation, Exercise, ExerciseDef, ExerciseKind, ExerciseType, MuscleGroup, WorkoutPlan, WorkoutRecord
} from '../types'

// ─── 部位・入力タイプ ────────────────────────────────────────────────────────

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'chest', label: '胸' },
  { id: 'back', label: '背中' },
  { id: 'shoulders', label: '肩' },
  { id: 'arms', label: '腕' },
  { id: 'core', label: '体幹' },
  { id: 'legs', label: '脚' },
  { id: 'glutes', label: 'お尻' },
  { id: 'cardio', label: '全身・有酸素' },
  { id: 'upper', label: '上半身' },
  { id: 'lower', label: '下半身' },
  { id: 'other', label: 'その他' }
]

/** 絞り込み用: 「上半身」「下半身」は、それに含まれる細かい部位の種目も対象にする */
const MUSCLE_FILTER_GROUPS: Partial<Record<MuscleGroup, MuscleGroup[]>> = {
  upper: ['upper', 'chest', 'back', 'shoulders', 'arms'],
  lower: ['lower', 'legs', 'glutes']
}
export const matchesMuscle = (m: MuscleGroup, filter: MuscleGroup) => (MUSCLE_FILTER_GROUPS[filter] ?? [filter]).includes(m)
export const muscleLabel = (m: MuscleGroup) => MUSCLE_GROUPS.find(g => g.id === m)?.label ?? 'その他'

export const KIND_LABELS: Record<ExerciseKind, string> = { reps: '回数', duration: '秒数', hiit: 'HIIT（ラウンド）' }

export const kindToType = (k: ExerciseKind): ExerciseType => (k === 'reps' ? 'normal' : k === 'duration' ? 'duration' : 'tabata')
export const typeToKind = (t: ExerciseType): ExerciseKind => (t === 'tabata' ? 'hiit' : t === 'duration' || t === 'circuit' ? 'duration' : 'reps')

// ─── 標準の種目カタログ（id は固定。変更しないこと） ──────────────────────────────

type Seed = [id: string, name: string, muscle: MuscleGroup, kind: ExerciseKind, equipmentType: string, aliases?: string[]]

const SEEDS: Seed[] = [
  // 胸
  ['push-up', 'プッシュアップ', 'chest', 'reps', 'bodyweight', ['腕立て伏せ', '腕立て']],
  ['knee-push-up', 'ニープッシュアップ', 'chest', 'reps', 'bodyweight', ['膝つき腕立て']],
  ['wide-push-up', 'ワイドプッシュアップ', 'chest', 'reps', 'bodyweight'],
  ['diamond-push-up', 'ダイヤモンドプッシュアップ', 'chest', 'reps', 'bodyweight'],
  ['tube-chest-press', 'チューブ・チェストプレス', 'chest', 'reps', 'tube'],
  ['assist-dips', 'アシスト・ディップス', 'chest', 'reps', 'assist', ['ディップス']],
  // 背中
  ['chin-up', 'チンニング', 'back', 'reps', 'assist', ['懸垂', 'プルアップ']],
  ['tube-bent-over-row', 'チューブ・ベントオーバーロウ', 'back', 'reps', 'tube', ['ベントオーバーロウ']],
  ['tube-lat-pulldown', 'チューブ・ラットプルダウン', 'back', 'reps', 'tube', ['ラットプルダウン']],
  ['inverted-row', 'インバーテッドロウ', 'back', 'reps', 'bodyweight', ['斜め懸垂']],
  ['superman', 'スーパーマン', 'back', 'duration', 'bodyweight'],
  // 肩
  ['pike-push-up', 'パイクプッシュアップ', 'shoulders', 'reps', 'bodyweight'],
  ['tube-overhead-press', 'チューブ・オーバーヘッドプレス', 'shoulders', 'reps', 'tube', ['ショルダープレス']],
  ['tube-side-raise', 'チューブ・サイドレイズ', 'shoulders', 'reps', 'tube', ['サイドレイズ']],
  ['tube-front-raise', 'チューブ・フロントレイズ', 'shoulders', 'reps', 'tube', ['フロントレイズ']],
  ['tube-face-pull', 'チューブ・フェイスプル', 'shoulders', 'reps', 'tube', ['フェイスプル']],
  // 腕
  ['tube-arm-curl', 'チューブ・アームカール', 'arms', 'reps', 'tube', ['アームカール']],
  ['tube-triceps-pushdown', 'チューブ・トライセプスPD', 'arms', 'reps', 'tube', ['トライセプスプッシュダウン']],
  ['bench-dips', 'ベンチディップス', 'arms', 'reps', 'bodyweight', ['椅子ディップス']],
  // 体幹
  ['plank', 'プランク', 'core', 'duration', 'bodyweight'],
  ['weighted-plank', 'ウエイトプランク', 'core', 'duration', 'vest'],
  ['side-plank', 'サイドプランク', 'core', 'duration', 'bodyweight'],
  ['hanging-knee-raise', 'ハンギングニーレイズ', 'core', 'reps', 'bodyweight'],
  ['crunch', 'クランチ', 'core', 'reps', 'bodyweight'],
  ['leg-raise', 'レッグレイズ', 'core', 'reps', 'bodyweight'],
  ['mountain-climber', 'マウンテンクライマー', 'core', 'duration', 'bodyweight'],
  ['dead-bug', 'デッドバグ', 'core', 'reps', 'bodyweight'],
  // 脚
  ['squat', 'スクワット', 'legs', 'reps', 'bodyweight', ['自重スクワット']],
  ['wide-squat', 'ワイドスクワット', 'legs', 'reps', 'bodyweight'],
  ['jump-squat', 'ジャンプスクワット', 'legs', 'reps', 'bodyweight'],
  ['lunge', 'ランジ', 'legs', 'reps', 'bodyweight'],
  ['bulgarian-squat', 'ブルガリアンスクワット', 'legs', 'reps', 'vest'],
  ['calf-raise', 'カーフレイズ', 'legs', 'reps', 'bodyweight'],
  ['wall-sit', 'ウォールシット', 'legs', 'duration', 'bodyweight'],
  ['tube-romanian-deadlift', 'チューブ・ルーマニアンDL', 'legs', 'reps', 'tube', ['ルーマニアンデッドリフト']],
  // お尻
  ['hip-thrust', 'ヒップスラスト', 'glutes', 'reps', 'bodyweight'],
  ['glute-bridge', 'グルートブリッジ', 'glutes', 'reps', 'bodyweight', ['ヒップリフト']],
  // 全身・有酸素
  ['burpee', 'バーピー', 'cardio', 'reps', 'bodyweight'],
  ['hiit-burpee', 'HIIT（バーピー）', 'cardio', 'hiit', 'bodyweight'],
  ['jumping-jack', 'ジャンピングジャック', 'cardio', 'duration', 'bodyweight'],
  ['high-knees', 'ハイニー', 'cardio', 'duration', 'bodyweight', ['もも上げ']]
]

export const BUILTIN_EXERCISES: ExerciseDef[] = SEEDS.map(([id, name, muscle, kind, equipmentType, aliases]) => ({
  id: `sys:${id}`, name, muscle, kind, equipmentType, note: '', builtin: true, aliases
}))

// ─── ライブラリ（標準＋自作） ────────────────────────────────────────────────

/** 名前の比較用に正規化する（全角半角・大文字小文字・空白の違いを無視） */
export const normName = (s: string) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '')

export const buildLibrary = (custom: ExerciseDef[]): ExerciseDef[] => [...custom, ...BUILTIN_EXERCISES]

/** 名前（別名を含む）→ 種目ID。自作の種目を標準より優先する */
export const buildNameIndex = (library: ExerciseDef[]): Map<string, string> => {
  const index = new Map<string, string>()
  ;[...library].reverse().forEach(def => {
    ;[def.name, ...(def.aliases ?? [])].forEach(n => index.set(normName(n), def.id))
  })
  return index
}

/** 同じ名前（別名を含む）を持つ既存の種目を返す */
export const findNameConflict = (library: ExerciseDef[], name: string, exceptId?: string) => {
  const key = normName(name)
  return library.find(d => d.id !== exceptId && [d.name, ...(d.aliases ?? [])].some(n => normName(n) === key))
}

export const isNameTaken = (library: ExerciseDef[], name: string, exceptId?: string) =>
  !!findNameConflict(library, name, exceptId)

/** 重複エラーの文言。別名で重複した場合は、既存の種目名も示す */
export const nameConflictMessage = (library: ExerciseDef[], name: string, exceptId?: string) => {
  const hit = findNameConflict(library, name, exceptId)
  if (!hit) return null
  return normName(hit.name) === normName(name)
    ? '同じ名前の種目が既にあります'
    : `「${name}」は既存の種目「${hit.name}」の別名です。その種目をそのまま使えます`
}

export interface ExerciseRow {
  id: string
  name: string
  muscle: MuscleGroup
  kind: ExerciseKind
  equipment_type: string
  note: string
}

export const defFromRow = (r: ExerciseRow): ExerciseDef => ({
  id: r.id, name: r.name, muscle: r.muscle, kind: r.kind, equipmentType: r.equipment_type, note: r.note ?? '', builtin: false
})

export const defToRow = (d: ExerciseDef, userId: string) => ({
  id: d.id, user_id: userId, name: d.name, muscle: d.muscle, kind: d.kind, equipment_type: d.equipmentType, note: d.note
})

// ─── プラン・記録への反映 ─────────────────────────────────────────────────────

const stationsOf = (ex: Exercise) => ex.stations ?? []

/** プランで使われている種目名のうち、ID が付いていないもの（旧データ）を集める */
export const unresolvedPlanNames = (plans: WorkoutPlan[], index: Map<string, string>) => {
  const found = new Map<string, { name: string; kind: ExerciseKind; equipmentType: string }>()
  const note = (name: string, kind: ExerciseKind, equipmentType: string) => {
    const key = normName(name)
    if (name.trim() && !index.has(key) && !found.has(key)) found.set(key, { name: name.trim(), kind, equipmentType })
  }
  plans.forEach(p => p.exercises.forEach(ex => {
    if (ex.type === 'circuit') stationsOf(ex).filter(st => !st.exerciseId).forEach(st => note(st.name, 'duration', st.equipmentType))
    else if (!ex.exerciseId) note(ex.name, typeToKind(ex.type), ex.equipmentType)
  }))
  return [...found.values()]
}

/** 記録の中の、ID が無く名前も未登録の種目（過去の記録だけに残っている種目）を集める */
export const unresolvedRecordNames = (records: WorkoutRecord[], index: Map<string, string>) => {
  const found = new Map<string, { name: string; kind: ExerciseKind; equipmentType: string }>()
  records.forEach(r => r.exercises.forEach(ex => {
    const key = normName(ex.name)
    if (!ex.exerciseId && ex.name.trim() && !index.has(key) && !found.has(key)) {
      found.set(key, { name: ex.name.trim(), kind: typeToKind(ex.type), equipmentType: ex.equipmentType })
    }
  }))
  return [...found.values()]
}

/** プランの種目に exerciseId を付け、表示名を種目マスタの最新の名前に揃える */
export const applyLibraryToPlans = (plans: WorkoutPlan[], library: ExerciseDef[]): WorkoutPlan[] => {
  const byId = new Map(library.map(d => [d.id, d]))
  const index = buildNameIndex(library)
  const link = <T extends { exerciseId?: string; name: string }>(item: T): T => {
    const id = item.exerciseId ?? index.get(normName(item.name))
    const def = id ? byId.get(id) : undefined
    if (!id) return item
    return { ...item, exerciseId: id, name: def?.name ?? item.name }
  }
  return plans.map(p => ({
    ...p,
    exercises: p.exercises.map(ex => (
      ex.type === 'circuit'
        ? { ...ex, stations: stationsOf(ex).map(link) as CircuitStation[] }
        : link(ex)
    ))
  }))
}

/** 記録の種目に exerciseId を付け、表示名を種目マスタの最新の名前に揃える（保存済みの記録は書き換えない） */
export const applyLibraryToRecords = (records: WorkoutRecord[], library: ExerciseDef[]): WorkoutRecord[] => {
  const byId = new Map(library.map(d => [d.id, d]))
  const index = buildNameIndex(library)
  return records.map(r => (r.exercises.length === 0 ? r : {
    ...r,
    exercises: r.exercises.map(ex => {
      const id = ex.exerciseId ?? index.get(normName(ex.name))
      if (!id) return ex
      return { ...ex, exerciseId: id, name: byId.get(id)?.name ?? ex.name }
    })
  }))
}

/** 種目マスタの種目を、プランに追加する種目（初期値つき）にする */
export const exerciseFromDef = (def: ExerciseDef, validEquipmentIds: string[], newId: (prefix: string) => string): Exercise => {
  const type = kindToType(def.kind)
  return {
    id: newId('ex'), exerciseId: def.id, name: def.name, type, targetSets: type === 'tabata' ? 2 : 3,
    defaultReps: type === 'duration' ? 30 : type === 'tabata' ? 0 : 10, defaultWeight: 0,
    interval: type === 'tabata' ? 120 : 60,
    equipmentType: validEquipmentIds.includes(def.equipmentType) ? def.equipmentType : 'bodyweight',
    ...(type === 'tabata' ? { tabataWork: 20, tabataRest: 10, tabataCycles: 8 } : {})
  }
}

/** 同じ種目か（ID があればIDで、無ければ名前で比較する） */
export const sameExercise = (a: { exerciseId?: string; name: string }, b: { exerciseId?: string; name: string }) =>
  a.exerciseId && b.exerciseId ? a.exerciseId === b.exerciseId : a.name.trim() === b.name.trim()

// ─── 種目の統合（重複種目の保険） ─────────────────────────────────────────────

/** 統合元の種目を指しているか（ID、または ID の無い旧データでは名前の一致） */
const pointsTo = (item: { exerciseId?: string; name: string }, src: ExerciseDef) =>
  item.exerciseId ? item.exerciseId === src.id : normName(item.name) === normName(src.name)

/** プランの中の統合元の種目を統合先に付け替える。変更のあったプランだけを返す */
export const mergeInPlans = (plans: WorkoutPlan[], src: ExerciseDef, target: ExerciseDef): WorkoutPlan[] => {
  const relink = <T extends { exerciseId?: string; name: string }>(item: T): T =>
    (pointsTo(item, src) ? { ...item, exerciseId: target.id, name: target.name } : item)
  const changed: WorkoutPlan[] = []
  plans.forEach(p => {
    let hit = false
    const exercises = p.exercises.map(ex => {
      if (ex.type === 'circuit') {
        const stations = stationsOf(ex).map(st => { const n = relink(st); if (n !== st) hit = true; return n })
        return { ...ex, stations }
      }
      const n = relink(ex)
      if (n !== ex) hit = true
      return n
    })
    if (hit) changed.push({ ...p, exercises })
  })
  return changed
}

/** 記録の中の統合元の種目を統合先に付け替える。変更のあった記録だけを返す */
export const mergeInRecords = (records: WorkoutRecord[], src: ExerciseDef, target: ExerciseDef): WorkoutRecord[] => {
  const changed: WorkoutRecord[] = []
  records.forEach(r => {
    let hit = false
    const exercises = r.exercises.map(ex => {
      if (!pointsTo(ex, src)) return ex
      hit = true
      return { ...ex, exerciseId: target.id, name: target.name }
    })
    if (hit) changed.push({ ...r, exercises })
  })
  return changed
}
