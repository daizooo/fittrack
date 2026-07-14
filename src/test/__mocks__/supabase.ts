import { vi } from 'vitest'
import type { EquipmentItem } from '../../types'
import { DEFAULT_LOAD_EQUIPMENT } from '../../lib/equipmentUtils'
import { initialWorkoutPlans } from '../fixtures/plans'

export const TEST_USER_ID = 'test-user-uuid-1234'

// In-memory stores
let _plans = initialWorkoutPlans.map((p, i) => ({
  id: `plan-${i}`,
  user_id: TEST_USER_ID,
  day: p.day,
  category: p.category,
  exercises: p.exercises,
}))

let _records: unknown[] = []

let _equipment: (EquipmentItem & { user_id: string; created_at: string })[] =
  DEFAULT_LOAD_EQUIPMENT.map(e => ({
    ...e,
    user_id: TEST_USER_ID,
    created_at: new Date().toISOString(),
  }))

let _profiles: unknown[] = []
let _bodyLogs: unknown[] = []

const makeQuery = (table: string) => {
  let _filter: Record<string, unknown> = {}
  let _orderBy: { col: string; asc: boolean } | null = null
  let _single = false

  const q = {
    eq: (col: string, val: unknown) => { _filter[col] = val; return q },
    order: (col: string, opts?: { ascending?: boolean }) => {
      _orderBy = { col, asc: opts?.ascending ?? true }
      return q
    },
    single: () => { _single = true; return q },
    select: (_cols: string) => q,
    upsert: (data: unknown, _opts?: unknown) => {
      handleWrite(table, 'upsert', data)
      return Promise.resolve({ error: null })
    },
    insert: (data: unknown) => {
      handleWrite(table, 'insert', data)
      return Promise.resolve({ error: null })
    },
    then: (resolve: (v: unknown) => unknown) => {
      const rows = getRows(table, _filter, _orderBy)
      if (_single) {
        return Promise.resolve({ data: rows[0] ?? null, error: null }).then(resolve)
      }
      return Promise.resolve({ data: rows, error: null }).then(resolve)
    },
  }
  return q
}

function getRows(
  table: string,
  filter: Record<string, unknown>,
  order: { col: string; asc: boolean } | null,
) {
  let rows: unknown[]
  if (table === 'plans') rows = [..._plans]
  else if (table === 'records') rows = [..._records]
  else if (table === 'equipment') rows = [..._equipment]
  else if (table === 'profiles') rows = [..._profiles]
  else if (table === 'body_logs') rows = [..._bodyLogs]
  else rows = []

  for (const [k, v] of Object.entries(filter)) {
    rows = rows.filter(r => (r as Record<string, unknown>)[k] === v)
  }
  if (order) {
    rows = rows.sort((a, b) => {
      const av = (a as Record<string, unknown>)[order.col] as string
      const bv = (b as Record<string, unknown>)[order.col] as string
      return order.asc ? av < bv ? -1 : 1 : av > bv ? -1 : 1
    })
  }
  return rows
}

function handleWrite(table: string, op: 'insert' | 'upsert', data: unknown) {
  const items = Array.isArray(data) ? data : [data]
  if (table === 'records') {
    if (op === 'insert') _records = [..._records, ...items]
  } else if (table === 'plans') {
    if (op === 'upsert') {
      items.forEach(item => {
        const d = item as Record<string, unknown>
        const idx = (_plans as Record<string, unknown>[]).findIndex(
          p => p.user_id === d.user_id && p.day === d.day,
        )
        if (idx >= 0) _plans[idx] = { ..._plans[idx], ...d }
        else _plans.push(d as typeof _plans[0])
      })
    }
  }
}

// Reset stores between tests
export const resetMockDB = () => {
  _plans = initialWorkoutPlans.map((p, i) => ({
    id: `plan-${i}`,
    user_id: TEST_USER_ID,
    day: p.day,
    category: p.category,
    exercises: p.exercises,
  }))
  _records = []
  _equipment = DEFAULT_LOAD_EQUIPMENT.map(e => ({
    ...e,
    user_id: TEST_USER_ID,
    created_at: new Date().toISOString(),
  }))
  _profiles = []
  _bodyLogs = []
}

export const getMockRecords = () => _records

export const supabase = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { user: { id: TEST_USER_ID } } },
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
  },
  from: (table: string) => makeQuery(table),
}
