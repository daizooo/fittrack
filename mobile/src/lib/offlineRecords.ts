import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildRestRecord, buildWorkoutRecord, insertRecord } from './records'
import type { SessionData, WorkoutRecord } from '../types'

/**
 * 簡易オフライン対応（docs/native-app-rewrite.md §4）。
 * ジム内の電波不良でSupabaseへの書き込みが失敗した場合、記録を端末内
 * （AsyncStorage）に一時保存し、次にオンラインになったタイミングで送信する。
 * FITTRACKは単一ユーザーの記録のため、sukusukuのような複数端末間の同期
 * 競合は起きない前提の簡易実装。
 */

const STORAGE_KEY = 'fittrack:pendingRecords'

interface PendingRecordEntry {
  userId: string
  record: WorkoutRecord
}

async function loadQueue(): Promise<PendingRecordEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PendingRecordEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.error('Failed to load pending records queue:', e)
    return []
  }
}

async function saveQueue(queue: PendingRecordEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to persist pending records queue:', e)
  }
}

export async function pendingRecordCountFor(userId: string): Promise<number> {
  const queue = await loadQueue()
  return queue.filter(e => e.userId === userId).length
}

/** まだサーバーへ送信できていない記録（アプリ再起動をまたいだ分も含む）を取得する。 */
export async function pendingRecordsFor(userId: string): Promise<WorkoutRecord[]> {
  const queue = await loadQueue()
  return queue.filter(e => e.userId === userId).map(e => e.record)
}

/** 送信に失敗したワークアウト記録を一時保存する。楽観的にidを確定させて返す。 */
export async function queueWorkoutRecord(userId: string, session: SessionData): Promise<WorkoutRecord> {
  const record = buildWorkoutRecord(session)
  const queue = await loadQueue()
  queue.push({ userId, record })
  await saveQueue(queue)
  return record
}

export async function queueRestRecord(userId: string, day: string): Promise<WorkoutRecord> {
  const record = buildRestRecord(day)
  const queue = await loadQueue()
  queue.push({ userId, record })
  await saveQueue(queue)
  return record
}

/**
 * 未送信の記録をSupabaseへ再送信する。1件ずつ送信し、成功した分だけ
 * キューから取り除く（途中で再びオフラインになっても、成功済みの分は
 * 二重送信されない）。
 */
export async function flushPendingRecords(userId: string): Promise<{ sent: number; remaining: number }> {
  let queue = await loadQueue()
  const own = queue.filter(e => e.userId === userId)
  let sent = 0

  for (const entry of own) {
    try {
      await insertRecord(entry.userId, entry.record)
      sent++
      queue = queue.filter(e => e !== entry)
      await saveQueue(queue)
    } catch (e) {
      console.error('Failed to flush pending record (will retry later):', e)
      break // 送信順を保つため、失敗したら以降は次回に回す
    }
  }

  const remaining = queue.filter(e => e.userId === userId).length
  return { sent, remaining }
}

interface UsePendingRecordsFlushResult {
  pendingCount: number
  retry: () => Promise<void>
}

/**
 * マウント時とアプリがフォアグラウンドに復帰したタイミングで未送信記録の
 * 再送信を試みる。送信できたレコードはonFlushedへ渡すので、呼び出し側は
 * 記録一覧の重複排除・並べ替えに使う。
 */
export function usePendingRecordsFlush(
  userId: string, onFlushed: (records: WorkoutRecord[]) => void
): UsePendingRecordsFlushResult {
  const [pendingCount, setPendingCount] = useState(0)
  const onFlushedRef = useRef(onFlushed)
  useEffect(() => { onFlushedRef.current = onFlushed }, [onFlushed])

  const runFlush = useCallback(async () => {
    let queue = await loadQueue()
    const own = queue.filter(e => e.userId === userId)
    if (own.length === 0) {
      setPendingCount(0)
      return
    }

    const flushedRecords: WorkoutRecord[] = []
    for (const entry of own) {
      try {
        await insertRecord(entry.userId, entry.record)
        flushedRecords.push(entry.record)
        queue = queue.filter(e => e !== entry)
        await saveQueue(queue)
      } catch (e) {
        console.error('Failed to flush pending record (will retry later):', e)
        break
      }
    }

    if (flushedRecords.length > 0) onFlushedRef.current(flushedRecords)
    setPendingCount(queue.filter(e => e.userId === userId).length)
  }, [userId])

  useEffect(() => {
    runFlush()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runFlush()
    })
    return () => subscription.remove()
  }, [runFlush])

  return { pendingCount, retry: runFlush }
}
