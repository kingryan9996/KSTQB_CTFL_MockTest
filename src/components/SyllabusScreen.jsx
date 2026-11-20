import { Fragment, useMemo, useRef, useState } from 'react'
import { CHAPTERS } from '../data/syllabusData.js'

/* ───────── 강조 문법 렌더링: **굵게** / ==빨간 배지== ───────── */
function Rich({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|==[^=]+==)/g).filter(Boolean)
  return parts.map((p, i) => {
    if (p.startsWith('**')) return <b key={i} className="font-bold text-ink">{p.slice(2, -2)}</b>
    if (p.startsWith('=='))
      return (
        <span key={i} className="mx-0.5 inline-block rounded-md bg-alti/10 px-1.5 py-[1px] text-[0.93em] font-bold leading-snug text-alti">
          {p.slice(2, -2)}
        </span>
      )
    return <Fragment key={i}>{p}</Fragment>
  })
}

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨']

function BlockTitle({ children }) {
  return <p className="mb-1.5 text-[12px] font-extrabold tracking-wide text-ink/60">{children}</p>
}

function Block({ b }) {
  if (b.type === 'text')
    return (
      <p className="text-[14.5px] leading-[1.75] text-ink/90">
        <Rich text={b.text} />
      </p>
    )
  if (b.type === 'list')
    return (
      <div>
        {b.title && <BlockTitle>{b.title}</BlockTitle>}
        <ul className="space-y-1.5">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-2 text-[14.5px] leading-[1.7] text-ink/90">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/35" />
              <span>
                <Rich text={t} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  if (b.type === 'steps')
    return (
      <div>
        {b.title && <BlockTitle>{b.title}</BlockTitle>}
        <ol className="space-y-2">
          {b.items.map((t, i) => (
            <li key={i} className="flex gap-2 text-[14.5px] leading-[1.7] text-ink/90">
              <span className="w-5 shrink-0 text-[15px] font-bold text-alti">{CIRCLED[i]}</span>
              <span>
                <Rich text={t} />
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  if (b.type === 'vs')
    return (
      <div>
        {b.title && <BlockTitle>{b.title}</BlockTitle>}
        <div className="grid grid-cols-2 gap-2">
          {[b.left, b.right].map((side, i) => (
            <div key={i} className={`rounded-xl p-3 ${i === 0 ? 'bg-ink/[0.06]' : 'bg-alti/[0.06]'}`}>
              <p className={`mb-1 text-[13px] font-extrabold ${i === 0 ? 'text-ink' : 'text-alti'}`}>{side.head}</p>
              <p className="text-[13.5px] leading-[1.6] text-ink/85">
                <Rich text={side.text} />
              </p>
            </div>
          ))}
        </div>
      </div>
    )
  if (b.type === 'formula')
    return (
      <div>
        {b.title && <BlockTitle>{b.title}</BlockTitle>}
        <div className="space-y-1 rounded-xl border border-ink/15 bg-canvas px-3.5 py-2.5">
          {b.items.map((t, i) => (
            <p key={i} className="text-[14px] font-bold leading-relaxed tracking-tight text-ink">
              {t}
            </p>
          ))}
        </div>
      </div>
    )
  return null
}

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-ink/50 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function SectionCard({ s, open, onToggle }) {
  return (
    <section className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-shadow ${open ? 'ring-alti/30' : 'ring-black/5'}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-black/[0.03]">
        <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-extrabold tabular-nums ${open ? 'bg-alti text-white' : 'bg-alti/10 text-alti'}`}>{s.id}</span>
        <span className="flex-1 text-[15.5px] font-bold leading-snug text-ink">{s.title}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="anim-fade space-y-4 border-t border-black/5 px-4 pb-5 pt-4">
          {s.blocks.map((b, i) => (
            <Block key={i} b={b} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ───────── SYLLABUS 화면 ───────── */
export default function SyllabusScreen({ onBack }) {
  const [filter, setFilter] = useState(0) // 0 = 전체
  const chapters = useMemo(() => (filter === 0 ? CHAPTERS : CHAPTERS.filter((c) => c.id === filter)), [filter])
  const keys = useMemo(() => chapters.flatMap((c) => c.sections.map((s) => `${c.id}-${s.id}`)), [chapters])
  const [open, setOpen] = useState(() => new Set([`${CHAPTERS[0].id}-${CHAPTERS[0].sections[0].id}`]))
  const scrollRef = useRef(null)
  const tabsRef = useRef(null)
  const allOpen = keys.every((k) => open.has(k))

  const pick = (id, el) => {
    setFilter(id)
    // 선택한 탭을 가운데로 — 0 ~ 최대 스크롤 범위로 제한해 [전체]·마지막 탭이 잘리지 않게 함
    const nav = tabsRef.current
    if (nav && el) {
      const target = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2
      const max = nav.scrollWidth - nav.clientWidth
      nav.scrollTo({ left: Math.max(0, Math.min(target, max)), behavior: 'smooth' })
    }
    const first = id === 0 ? CHAPTERS[0] : CHAPTERS.find((c) => c.id === id)
    setOpen(new Set([`${first.id}-${first.sections[0].id}`])) // 장 전환 시 첫 절만 펼침
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }
  const toggle = (k) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      return next
    })
  const toggleAll = () => setOpen(allOpen ? new Set() : new Set(keys))

  const tabs = [{ id: 0, tab: '전체' }, ...CHAPTERS]

  return (
    <div className="flex h-full w-full justify-center">
      <div className="relative flex h-[100dvh] min-h-[100dvh] w-full max-w-[393px] flex-col overflow-hidden bg-canvas text-ink sm:shadow-[0_10px_40px_rgba(74,85,96,0.18)]">
        {/* 상단 고정 헤더 + 챕터 탭 */}
        <header className="relative z-20 shrink-0 bg-white pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(0,0,0,0.06)]">
          <div className="relative flex h-14 items-center justify-center px-4">
            <button onClick={onBack} aria-label="홈으로" className="absolute left-2 flex h-10 items-center gap-0.5 rounded-lg px-2 text-[14px] font-semibold text-ink active:bg-black/5">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
              홈
            </button>
            <h1 className="text-[16px] font-extrabold tracking-tight text-ink">
              CTFL v4.0 핵심 <span className="text-alti">실러버스</span>
            </h1>
          </div>
          <nav
            ref={tabsRef}
            className="no-scrollbar relative flex items-center justify-start gap-2 overflow-x-auto border-t border-black/5 px-4 py-3"
            aria-label="챕터 선택"
          >
            {tabs.map((t) => {
              const on = filter === t.id
              return (
                <button
                  key={t.id}
                  onClick={(e) => pick(t.id, e.currentTarget)}
                  aria-pressed={on}
                  className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-bold transition-colors ${
                    on ? 'border-alti bg-alti text-white' : 'border-ink/25 bg-white text-ink active:bg-black/5'
                  }`}
                >
                  {t.tab}
                </button>
              )
            })}
            {/* iOS Safari는 스크롤 컨테이너의 오른쪽 패딩을 무시하므로 끝 여백용 스페이서 */}
            <span aria-hidden="true" className="w-px shrink-0" />
          </nav>
        </header>

        {/* 본문: 아코디언 카드 리스트 */}
        <main ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[12px] font-medium text-ink/50">{keys.length}개 섹션</span>
            <button onClick={toggleAll} className="h-8 rounded-lg px-2 text-[12.5px] font-bold text-ink/70 active:bg-black/5">
              {allOpen ? '모두 접기' : '모두 펼치기'}
            </button>
          </div>
          {chapters.map((c) => (
            <div key={c.id} className="mb-5">
              <div className="mb-2 px-1">
                <p className="text-[15px] font-extrabold text-ink">{c.title}</p>
                <p className="text-[11.5px] font-medium text-ink/45">{c.en}</p>
              </div>
              <div className="space-y-2.5">
                {c.sections.map((s) => {
                  const k = `${c.id}-${s.id}`
                  return <SectionCard key={k} s={s} open={open.has(k)} onToggle={() => toggle(k)} />
                })}
              </div>
            </div>
          ))}
          <p className="pt-2 text-center text-[11px] text-ink/40">ISTQB CTFL v4.0.1 · KSTQB 실러버스 용어 기준 요약</p>
        </main>
      </div>
    </div>
  )
}
