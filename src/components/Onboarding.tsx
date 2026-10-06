import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { localISODate } from '../lib/dates'

export interface OnboardingValues {
  birth_date: string
  gender: 'male' | 'female'
  height: number
  weight: number | null
  body_fat: number | null
}

/**
 * 初回（profiles 行が無いとき）だけ表示する身体情報の登録画面。
 * 身長・生年月日・性別はここで1度だけ入力し、体重・体脂肪はその日の
 * 初回ログとして body_logs に記録する（以降の変化はログで追う）。
 */
export default function Onboarding({ onSubmit }: { onSubmit: (v: OnboardingValues) => Promise<string | null> }) {
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | ''>('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const heightNum = Number(height)
  const valid = !!birthDate && !!gender && height !== '' && heightNum >= 80 && heightNum <= 250

  const submit = async () => {
    if (!valid || !gender) return
    setSaving(true)
    setError(null)
    const err = await onSubmit({
      birth_date: birthDate,
      gender,
      height: heightNum,
      weight: weight ? Number(weight) : null,
      body_fat: bodyFat ? Number(bodyFat) : null
    })
    if (err) { setError(err); setSaving(false) }
  }

  const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-400'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-2xl text-xl font-black mx-auto mb-3">F</div>
          <h1 className="text-xl font-black text-gray-900">はじめに身体情報を登録</h1>
          <p className="text-gray-500 text-xs mt-2">登録は最初の1回だけ。体重・体脂肪の変化はプロフィールのログで記録していきます。</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="ob-birth" className="text-[11px] font-bold text-gray-500 block mb-1">生年月日 <span className="text-red-400">*</span></label>
            <input id="ob-birth" type="date" value={birthDate} max={localISODate()} onChange={e => setBirthDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-gray-500 block mb-1">性別 <span className="text-red-400">*</span></span>
            <div className="flex gap-2">
              {(['male', 'female'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-colors ${gender === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                >
                  {g === 'male' ? '男性' : '女性'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="ob-height" className="text-[11px] font-bold text-gray-500 block mb-1">身長 (cm) <span className="text-red-400">*</span></label>
            <input id="ob-height" type="number" inputMode="decimal" placeholder="170" value={height} onChange={e => setHeight(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ob-weight" className="text-[11px] font-bold text-gray-500 block mb-1">現在の体重 (kg)</label>
              <input id="ob-weight" type="number" inputMode="decimal" placeholder="70.5" value={weight} onChange={e => setWeight(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="ob-fat" className="text-[11px] font-bold text-gray-500 block mb-1">体脂肪率 (%)</label>
              <input id="ob-fat" type="number" inputMode="decimal" placeholder="18.5" value={bodyFat} onChange={e => setBodyFat(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!valid || saving}
          className="w-full mt-6 bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition-transform disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? '登録中...' : '登録してはじめる'}
        </button>
      </div>
    </div>
  )
}
