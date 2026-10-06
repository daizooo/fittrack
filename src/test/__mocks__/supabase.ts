import { vi } from 'vitest'
import type { EquipmentItem } from '../../types'
import { DEFAULT_LOAD_EQUIPMENT } from '../../lib/equipmentUtils'
import { planToRow } from '../../lib/plans'
import { initialWorkoutPlans } from '../fixtures/plans'

export const TEST_USER_ID = 'test-user-uuid-1234'

type Row = Record<string, unknown>

// In-memory stores
const stores: Record<string, Row[]> = {}

const completeProfile = (): Row => ({ user_id: TEST_USER_ID, height: 170, birth_date: '1990-01-01', gender: 'male' })

export const resetMockDB = (opts: { newUser?: boolean } = {}) => {
  stores.workout_plans = opts.newUser ? [] : initialWorkoutPlans.map(p => planToRow(p, TEST_USER_ID))
  stores.records = []
  stores.equipment = opts.newUser ? [] : DEFAULT_LOAD_EQUIPMENT.map(e => ({
    ...(e as EquipmentItem),
    user_id: TEST_USER_ID,
    created_at: new Date().toISOString(),
  }))
  stores.profiles = opts.newUser ? [] : [completeProfile()]
  stores.body_logs = []
}
resetMockDB()

const pk = (table: string) => (table === 'profiles' ? 'user_id' : 'id')

function write(table: string, op: 'insert' | 'upsert', data: unknown): Row[] {
  const items = (Array.isArray(data) ? data : [data]).map(d => ({ ...(d as Row) }))
  const rows = stores[table] ?? (stores[table] = [])
  items.forEach(item => {
    if (table === 'body_logs' && !item.id) item.id = `log-${rows.length + 1}`
    const key = pk(table)
    const idx = op === 'upsert' ? rows.findIndex(r => r[key] === item[key]) : -1
    if (idx >= 0) rows[idx] = { ...rows[idx], ...item }
    else rows.push(item)
  })
  return items
}

const makeQuery = (table: string) => {
  const filter: Row = {}
  let orderBy: { col: string; asc: boolean } | null = null
  let mode: 'many' | 'single' | 'maybeSingle' = 'many'
  let written: Row[] | null = null
  let del = false

  const run = () => {
    if (del) {
      stores[table] = (stores[table] ?? []).filter(r => !Object.entries(filter).every(([k, v]) => r[k] === v))
      return { data: null, error: null }
    }
    let rows = written ?? [...(stores[table] ?? [])]
    if (!written) {
      for (const [k, v] of Object.entries(filter)) rows = rows.filter(r => r[k] === v)
      if (orderBy) {
        const { col, asc } = orderBy
        rows = rows.sort((a, b) => {
          const av = a[col] as string, bv = b[col] as string
          return asc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1)
        })
      }
    }
    if (mode !== 'many') return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }

  const q = {
    eq: (col: string, val: unknown) => { filter[col] = val; return q },
    order: (col: string, opts?: { ascending?: boolean }) => { orderBy = { col, asc: opts?.ascending ?? true }; return q },
    single: () => { mode = 'single'; return q },
    maybeSingle: () => { mode = 'maybeSingle'; return q },
    select: (_cols?: string) => q,
    upsert: (data: unknown, _opts?: unknown) => { written = write(table, 'upsert', data); return q },
    insert: (data: unknown) => { written = write(table, 'insert', data); return q },
    delete: () => { del = true; return q },
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(run()).then(resolve, reject),
  }
  return q
}

export const getMockRecords = () => stores.records
export const getMockTable = (table: string) => stores[table] ?? []

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
