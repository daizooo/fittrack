import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Video, X } from 'lucide-react'
import { resolveVideos, videoEmbedUrl, videoOpenUrl, type ExerciseVideo } from '../lib/exerciseVideos'

/** 解説動画を再生するダイアログ。動画が複数あるときは上のボタンで切り替える */
const VideoDialog = ({ name, videos, onClose }: { name: string; videos: ExerciseVideo[]; onClose: () => void }) => {
  const [idx, setIdx] = useState(0)
  const video = videos[idx]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label={`${name}の解説動画`}
      onClick={onClose}
      className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
    >
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 p-4 pb-2">
          <h3 className="font-black text-gray-800 leading-tight min-w-0 break-words">{name}</h3>
          <button onClick={onClose} aria-label="動画を閉じる" className="p-1.5 -mr-1 text-gray-400 rounded-lg active:scale-95 flex-shrink-0"><X size={20} /></button>
        </div>
        {videos.length > 1 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2" role="tablist" aria-label="動画の切り替え">
            {videos.map((v, i) => (
              <button
                key={v.id} role="tab" aria-selected={i === idx} onClick={() => setIdx(i)}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${i === idx ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
              >
                {v.title}
              </button>
            ))}
          </div>
        )}
        <iframe
          key={video.id} title={video.title} src={videoEmbedUrl(video)}
          allow="autoplay; fullscreen" allowFullScreen
          className="w-full h-[58vh] max-h-[560px] bg-black border-0"
        />
        <div className="p-3 text-center">
          <a
            href={videoOpenUrl(video)} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600"
          >
            <ExternalLink size={12} />再生できないときはGoogleドライブで開く
          </a>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * 解説動画のボタン。動画が無い（videoIds が空・カタログに無い）ときは何も出さない。
 * 押すと、その場でダイアログ再生できる。
 */
export function VideoButton({ videoIds, name }: { videoIds?: string[]; name: string }) {
  const videos = resolveVideos(videoIds)
  const [open, setOpen] = useState(false)
  if (videos.length === 0) return null
  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        aria-label={`${name}の解説動画を見る`}
        className="w-7 h-7 flex-shrink-0 inline-flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 active:scale-95 transition-transform"
      >
        <Video size={14} />
      </button>
      {open && <VideoDialog name={name} videos={videos} onClose={() => setOpen(false)} />}
    </>
  )
}
