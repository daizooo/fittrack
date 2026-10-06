import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import type { EquipmentOption } from '../types'
import type { PeriodMode } from '../lib/stats'

/**
 * 数値入力。入力中は文字列のまま保持し、空欄や途中入力（"1." など）でも
 * カーソルが飛ばないようにする。確定値は有効な数値になった時点で親へ通知し、
 * フォーカスを外したときに min/max に丸める。
 */
export const NumberField = ({ value, onChange, min = 0, max = 9999, className = '', ...rest }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  className?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'min' | 'max'>) => {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    // 外部から値が変わったときだけ同期（入力途中の文字列は保持）
    setText(prev => (Number(prev) === value && prev !== '' ? prev : String(value)))
  }, [value])
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={text}
      onChange={e => {
        setText(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value !== '' && !isNaN(n)) onChange(n)
      }}
      onBlur={() => {
        let n = Number(text)
        if (text === '' || isNaN(n)) n = min
        n = Math.max(min, Math.min(max, n))
        setText(String(n))
        onChange(n)
      }}
      className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
    />
  )
}

export const NumberInputStepper = ({ value, onChange, min, max, step, label }: {
  value: number; onChange: (v: number) => void
  min: number; max: number; step: number; label: string
}) => (
  <div className="flex flex-col items-center flex-1">
    <span className="text-[10px] text-gray-500 mb-1">{label}</span>
    <div className="flex items-center bg-gray-100 rounded-lg p-1 shadow-inner h-[40px] border border-gray-200 w-full max-w-[100px]">
      <button
        onClick={() => onChange(Math.max(min, Number(value) - step))}
        className="w-8 h-full flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-md transition-colors"
      >
        <Minus size={16} />
      </button>
      <NumberField
        value={value} min={min} max={max} onChange={onChange}
        className="w-full h-full bg-transparent text-center font-bold text-gray-800 text-sm outline-none min-w-0"
      />
      <button
        onClick={() => onChange(Math.min(max, Number(value) + step))}
        className="w-8 h-full flex items-center justify-center text-gray-500 active:bg-gray-200 rounded-md transition-colors"
      >
        <Plus size={16} />
      </button>
    </div>
  </div>
)

export const EquipmentSelector = ({ value, options, onChange, label }: {
  value: number; options: EquipmentOption[]
  onChange: (v: number) => void; label: string
}) => (
  <div className="flex flex-col items-center flex-1 min-w-[90px]">
    <span className="text-[10px] text-gray-500 mb-1">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-[40px] px-1 bg-gray-100 border border-gray-200 rounded-lg text-[10px] sm:text-[11px] font-bold text-gray-800 outline-none shadow-inner cursor-pointer appearance-none text-center w-full max-w-[110px]"
    >
      {options.map((opt, i) => (
        <option key={i} value={opt.weight}>{opt.label}</option>
      ))}
    </select>
  </div>
)

export const PeriodFilter = ({ mode, setMode, anchor, shift }: {
  mode: PeriodMode
  setMode: (m: PeriodMode) => void
  anchor: Date
  shift: (dir: number) => void
}) => (
  <div className="bg-white px-4 py-3 sticky top-14 z-30 shadow-sm border-b border-gray-100">
    <div className="flex bg-gray-100 p-1 rounded-xl mb-3">
      {(['month', 'year'] as const).map(m => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
        >
          {m === 'month' ? '月単位' : '年単位'}
        </button>
      ))}
    </div>
    <div className="flex items-center justify-between px-2">
      <button onClick={() => shift(-1)} aria-label="前の期間" className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-600"><ChevronLeft size={24} /></button>
      <div className="font-extrabold text-gray-800 text-lg">
        {mode === 'month' ? `${anchor.getFullYear()}年 ${anchor.getMonth() + 1}月` : `${anchor.getFullYear()}年`}
      </div>
      <button onClick={() => shift(1)} aria-label="次の期間" className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-600"><ChevronRight size={24} /></button>
    </div>
  </div>
)
