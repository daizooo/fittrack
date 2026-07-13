import type { EquipmentItem, EquipmentOption } from '../types'

/** Generate the EquipmentOption list for a given equipment item. */
export const generateEquipmentOptions = (item: EquipmentItem): EquipmentOption[] => {
  if (!item.weight) return [{ label: 'ー', weight: 0 }]
  const w = item.weight

  if (w.type === 'fixed') {
    return w.options ?? [{ label: 'ー', weight: 0 }]
  }

  // variable (e.g. weight vest)
  const opts: EquipmentOption[] = [{ label: 'ー', weight: 0 }]
  const sign = item.direction === '-' ? -1 : 1
  const min = w.min ?? 0
  const max = w.max ?? 0
  const step = w.step ?? 1
  let i = 1
  for (let v = min; v <= max + 0.001; v = Math.round((v + step) * 1000) / 1000) {
    const rounded = Math.round(v * 100) / 100
    opts.push({
      label: `${i} (${item.direction ?? '+'}${rounded}kg)`,
      weight: sign * rounded
    })
    i++
  }
  return opts
}

/** Default equipment — IDs match the legacy equipmentType string keys for backward compat. */
export const DEFAULT_LOAD_EQUIPMENT: EquipmentItem[] = [
  {
    id: 'bodyweight',
    name: '自重のみ',
    category: 'load',
    direction: null,
    weight: { type: 'fixed', options: [{ label: 'ー', weight: 0 }] }
  },
  {
    id: 'tube',
    name: 'チューブ',
    category: 'load',
    direction: '+',
    weight: {
      type: 'fixed',
      options: [
        { label: 'ー', weight: 0 },
        { label: '赤 (+9kg)', weight: 9 },
        { label: '黒 (+28kg)', weight: 28 },
        { label: '紫 (+49.5kg)', weight: 49.5 },
        { label: '緑 (+66.5kg)', weight: 66.5 }
      ]
    }
  },
  {
    id: 'assist',
    name: '補助チューブ',
    category: 'load',
    direction: '-',
    weight: {
      type: 'fixed',
      options: [
        { label: 'ー', weight: 0 },
        { label: '1本 (-24kg)', weight: -24 },
        { label: '2本 (-47kg)', weight: -47 },
        { label: '3本 (-70kg)', weight: -70 }
      ]
    }
  },
  {
    id: 'vest',
    name: 'ウェイトベスト',
    category: 'load',
    direction: '+',
    weight: { type: 'variable', min: 5.25, max: 30, step: 2.75 }
  }
]
