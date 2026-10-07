import { createContext, useContext, useEffect } from 'react'

/**
 * 編集中（未保存）の状態をアプリ全体へ知らせるための仕組み。
 * 編集フォームが useUnsavedGuard(key, dirty) を呼ぶと、FitTrack がタブ移動の前に
 * 「編集を破棄しますか？」と確認できる。Provider が無い場所（単体テスト等）では何もしない。
 */
export interface UnsavedGuard {
  setDirty: (key: string, dirty: boolean) => void
}

export const UnsavedGuardContext = createContext<UnsavedGuard | null>(null)

export const useUnsavedGuard = (key: string, dirty: boolean) => {
  const guard = useContext(UnsavedGuardContext)
  useEffect(() => {
    guard?.setDirty(key, dirty)
    return () => guard?.setDirty(key, false)
  }, [guard, key, dirty])
}
