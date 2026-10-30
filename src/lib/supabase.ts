/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env.local and fill in your values.'
  )
}

// 統合プロジェクト「Persol」の fittrack スキーマ専任。全クエリ（.from()）がこのスキーマを参照する。
// 型引数で 'fittrack' を指定しないと db.schema が 'public' 固定の型になる。
export const supabase = createClient<any, 'fittrack'>(supabaseUrl || '', supabaseAnonKey || '', {
  db: { schema: 'fittrack' }
})
