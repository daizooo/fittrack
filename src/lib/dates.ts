export const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土']

/** ローカルタイムゾーンでの YYYY-MM-DD（toISOString は UTC なので朝9時前に前日になる） */
export const localISODate = (d: Date = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** 今日から見て何日前か（日付単位） */
export const daysAgo = (iso: string, now: Date = new Date()) => {
  const d = new Date(iso)
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((b - a) / 86400000)
}

export const formatDaysAgo = (n: number) => (n === 0 ? '今日' : n === 1 ? '昨日' : `${n}日前`)

export const calcAge = (birthDate: string, now: Date = new Date()) => {
  const b = new Date(birthDate)
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}
