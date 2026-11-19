import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QUESTIONS from './data/questions.json'

const EXAM_SIZE = 40
const EXAM_SECONDS = 60 * 60
const PASS_COUNT = 26
const LABELS = ['a', 'b', 'c', 'd', 'e']

/* ───────── utils ───────── */
function fisherYates(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function fmtTime(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const AUTO_NEXT_MS = 250

// 응답 완료 여부: 정답 개수(복수 정답이면 2개 등)만큼 모두 선택해야 완료
const isDone = (q, picked) => Array.isArray(picked) && picked.length === q.answer.length

// 보기 선택 결과 계산 — 단일: 교체 / 복수(k개): 토글, k개 초과 시 가장 먼저 고른 것 해제
function nextSelection(cur, v, k) {
  const sel = Array.isArray(cur) ? cur : []
  if (k === 1) return [v]
  if (sel.includes(v)) return sel.filter((x) => x !== v)
  return [...sel, v].slice(-k)
}

// 스마트 점프: 현재 이후 → (없으면) 처음부터 순환하여 가장 가까운 미답변 문항. 없으면 -1
function findNextUnanswered(questions, answers, from) {
  const n = questions.length
  for (let step = 1; step < n; step++) {
    const i = (from + step) % n
    if (!isDone(questions[i], answers[i])) return i
  }
  return -1
}

const isCorrect = (q, picked) =>
  Array.isArray(picked) && picked.length === q.answer.length && q.answer.every((a) => picked.includes(a))

/* ───────── swipe + keyboard navigation ───────── */
function useSwipeNav(onPrev, onNext, enabled = true) {
  const start = useRef(null)
  useEffect(() => {
    if (!enabled) return
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext, enabled])

  return {
    onTouchStart: (e) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    },
    onTouchEnd: (e) => {
      if (!start.current || !enabled) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      const dt = Date.now() - start.current.t
      start.current = null
      if (dt > 700 || Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx < 0) onNext()
      else onPrev()
    },
  }
}

/* ───────── shared UI ───────── */
function Frame({ children }) {
  return (
    <div className="flex h-full w-full justify-center">
      <div className="relative flex h-[100dvh] min-h-[100dvh] w-full max-w-[393px] flex-col overflow-hidden bg-canvas text-ink sm:shadow-[0_10px_40px_rgba(74,85,96,0.18)]">
        {children}
      </div>
    </div>
  )
}

function Brand({ className = '' }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      KSTQB 모의시험 <span className="text-alti">Alti</span>
    </span>
  )
}

function Chevron({ dir = 'left', className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  )
}

function BottomNav({ onPrev, onNext, canPrev, canNext, center }) {
  return (
    <nav className="relative z-20 flex shrink-0 items-stretch border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)]">
      <button
        onClick={onPrev}
        disabled={!canPrev}
        aria-label="이전 문제"
        className="flex h-16 flex-1 items-center justify-center text-ink active:bg-black/5 disabled:opacity-25"
      >
        <Chevron dir="left" className="h-8 w-8" />
      </button>
      <div className="flex w-24 items-center justify-center">
        <span className="h-7 w-px bg-ink/20" />
        {center && <span className="absolute text-[11px] font-semibold tabular-nums text-ink/50">{center}</span>}
      </div>
      <button
        onClick={onNext}
        disabled={!canNext}
        aria-label="다음 문제"
        className="flex h-16 flex-1 items-center justify-center text-ink active:bg-black/5 disabled:opacity-25"
      >
        <Chevron dir="right" className="h-8 w-8" />
      </button>
    </nav>
  )
}

function EdgeZones({ onPrev, onNext, canPrev, canNext }) {
  return (
    <>
      <button
        aria-label="이전 문제"
        onClick={onPrev}
        disabled={!canPrev}
        className="group absolute inset-y-0 left-0 z-10 flex w-6 items-center justify-start disabled:pointer-events-none"
      >
        <Chevron dir="left" className="h-5 w-5 text-ink/15 transition group-active:text-alti" />
      </button>
      <button
        aria-label="다음 문제"
        onClick={onNext}
        disabled={!canNext}
        className="group absolute inset-y-0 right-0 z-10 flex w-6 items-center justify-end disabled:pointer-events-none"
      >
        <Chevron dir="right" className="h-5 w-5 text-ink/15 transition group-active:text-alti" />
      </button>
    </>
  )
}

function Modal({ title, desc, yes, no, onYes, onNo }) {
  return (
    <div className="anim-fade absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-8 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" onClick={onNo}>
      <div className="anim-pop w-full rounded-2xl bg-white p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <p className="text-[17px] font-bold text-ink">{title}</p>
        {desc && <p className="mt-2 text-sm leading-relaxed text-ink/70">{desc}</p>}
        <div className="mt-6 flex gap-3">
          <button onClick={onNo} className="h-12 flex-1 rounded-xl bg-canvas text-[16px] font-bold text-ink ring-1 ring-black/10 active:bg-black/5">
            {no}
          </button>
          <button onClick={onYes} className="h-12 flex-1 rounded-xl bg-alti text-[16px] font-bold text-white active:bg-alti-dark">
            {yes}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuestionHeader({ q, label, onZoom }) {
  const parts = q.question.split('{{IMG}}')
  const src = q.source === '덤프' ? '덤프' : `${q.source} #${q.num}`
  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-md bg-alti/10 px-2 py-0.5 text-[12px] font-bold text-alti">{label}</span>
        <span className="text-[12px] font-medium text-ink/50">{q.chapter}</span>
        <span className="rounded bg-ink/[0.07] px-1.5 py-0.5 text-[11px] font-semibold text-ink/55">{src}</span>
        {q.answer.length > 1 && (
          <span className="rounded bg-alti px-1.5 py-0.5 text-[11px] font-bold text-white">{q.answer.length}개 선택</span>
        )}
      </div>
      {parts.map((t, i) => (
        <div key={i}>
          {t.trim() && <p className="whitespace-pre-line text-[16.5px] font-semibold leading-[1.6] text-ink">{t.trim()}</p>}
          {i < parts.length - 1 && q.images[i] && (
            <button onClick={() => onZoom(q.images[i])} className="relative my-3 block w-full overflow-hidden rounded-lg bg-white ring-1 ring-black/10">
              <img src={q.images[i]} alt="문제 그림" className="block h-auto w-full" draggable="false" />
              <span className="absolute bottom-1.5 right-1.5 rounded bg-ink/75 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">탭하여 확대</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function ImageZoom({ src, onClose }) {
  if (!src) return null
  return (
    <div className="anim-fade absolute inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex shrink-0 justify-end p-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button onClick={onClose} className="h-9 rounded-lg bg-white/15 px-4 text-[13px] font-bold text-white active:bg-white/25">닫기</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-3" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
        <img src={src} alt="확대 그림" className="max-w-none rounded bg-white" style={{ width: 720 }} />
      </div>
      <p className="shrink-0 pb-[max(12px,env(safe-area-inset-bottom))] text-center text-[12px] text-white/60">좌우·상하로 밀어서 보기</p>
    </div>
  )
}

/* ───────── START ───────── */
function StartScreen({ onStart }) {
  return (
    <Frame>
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+40px)]">
        <Brand className="text-[26px] text-ink" />
        <p className="mt-1 text-[13px] font-medium text-ink/55">ISTQB CTFL v4.0 Foundation Level</p>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={onStart}
          className="anim-pop flex h-44 w-44 flex-col items-center justify-center rounded-full bg-alti text-white shadow-[0_14px_30px_rgba(230,0,45,0.35)] transition active:scale-95 active:bg-alti-dark"
        >
          <span className="text-[26px] font-extrabold tracking-tight">시험시작</span>
          <span className="mt-1 text-[12px] font-medium text-white/80">START</span>
        </button>
        <dl className="mt-12 grid w-full grid-cols-3 divide-x divide-black/5 rounded-2xl bg-white py-4 text-center shadow-sm ring-1 ring-black/5">
          <div>
            <dt className="text-[11px] font-medium text-ink/50">문항 수</dt>
            <dd className="mt-0.5 text-[17px] font-bold">{EXAM_SIZE}문항</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-ink/50">제한 시간</dt>
            <dd className="mt-0.5 text-[17px] font-bold">60분</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium text-ink/50">합격 기준</dt>
            <dd className="mt-0.5 text-[17px] font-bold">{PASS_COUNT}문항</dd>
          </div>
        </dl>
        <p className="mt-4 text-[12px] text-ink/45">문제 은행 {QUESTIONS.length}문항 중 무작위 출제</p>
      </main>
    </Frame>
  )
}

/* ───────── EXAM ───────── */
function ExamScreen({ questions, answers, setAnswer, deadline, onSubmit }) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState('next')
  const [left, setLeft] = useState(() => Math.round((deadline - Date.now()) / 1000))
  const [confirm, setConfirm] = useState(false)
  const [zoom, setZoom] = useState(null)
  const [doneBanner, setDoneBanner] = useState(false)
  const scrollRef = useRef(null)
  const submitted = useRef(false)
  const autoTimer = useRef(null) // 자동 이동 타이머
  const locked = useRef(false) // 자동 이동 대기(250ms) 중 중복 입력 잠금

  const cancelAuto = useCallback(() => {
    clearTimeout(autoTimer.current)
    autoTimer.current = null
    locked.current = false
  }, [])
  useEffect(() => cancelAuto, [cancelAuto]) // 언마운트 시 타이머 정리

  const submit = useCallback(() => {
    if (submitted.current) return
    submitted.current = true
    onSubmit()
  }, [onSubmit])

  useEffect(() => {
    const tick = () => {
      const remain = Math.round((deadline - Date.now()) / 1000)
      setLeft(remain)
      if (remain <= 0) submit()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadline, submit])

  const total = questions.length
  const go = useCallback(
    (n) => {
      if (n < 0 || n >= total) return
      cancelAuto() // 수동 이동 시 대기 중인 자동 이동 취소 → 두 문제가 한꺼번에 넘어가지 않음
      setDir(n > idx ? 'next' : 'prev')
      setIdx(n)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    },
    [idx, total, cancelAuto],
  )
  // 수동 이동(하단 < | >, 좌우 터치·스와이프, 방향키)은 순차 이동 유지
  const prev = useCallback(() => go(idx - 1), [go, idx])
  const next = useCallback(() => go(idx + 1), [go, idx])
  const swipe = useSwipeNav(prev, next, !confirm && !zoom)

  const q = questions[idx]

  // 보기 선택 → 필요한 개수를 모두 고르면 250ms 후 다음 미답변 문항으로 자동 이동
  const choose = (i) => {
    if (locked.current) return
    const k = q.answer.length
    const sel = nextSelection(answers[idx], i, k)
    setAnswer(idx, sel)
    if (sel.length !== k) return // 복수 정답 문항: 아직 덜 고름
    const updated = answers.slice()
    updated[idx] = sel
    const target = findNextUnanswered(questions, updated, idx)
    if (target === -1) {
      setDoneBanner(true) // 전 문항 응답 완료 → 이동하지 않고 제출 안내
      return
    }
    locked.current = true
    autoTimer.current = setTimeout(() => {
      autoTimer.current = null
      locked.current = false
      setDir(target > idx ? 'next' : 'prev')
      setIdx(target)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    }, AUTO_NEXT_MS)
  }

  const answered = questions.reduce((n, qq, i) => n + (isDone(qq, answers[i]) ? 1 : 0), 0)
  const allDone = answered === total
  const urgent = left <= 300

  return (
    <Frame>
      <header className="relative z-20 shrink-0 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 ${urgent ? 'bg-alti text-white' : 'bg-alti/10 text-alti'}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2M9 2h6" />
              </svg>
              <span className="text-[16px] font-bold tabular-nums">{fmtTime(left)}</span>
            </div>
            <span className="text-[16px] font-bold tabular-nums text-ink">
              {idx + 1} <span className="text-ink/40">/ {total}</span>
            </span>
          </div>
          <button
            onClick={() => setConfirm(true)}
            className="h-9 rounded-lg border border-alti px-3 text-[13px] font-bold text-alti active:bg-alti active:text-white"
          >
            시험종료(제출)
          </button>
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-black/5">
          <div className="h-full rounded-full bg-alti transition-[width] duration-300" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-right text-[11px] font-medium text-ink/45 tabular-nums">응답 {answered} / {total}</p>
      </header>

      <main className="relative min-h-0 flex-1" {...swipe}>
        <EdgeZones onPrev={prev} onNext={next} canPrev={idx > 0} canNext={idx < total - 1} />
        <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain px-7 pb-6 pt-5">
          <div key={idx} className={dir === 'next' ? 'anim-next' : 'anim-prev'}>
            <QuestionHeader q={q} label={`Q.${idx + 1}`} onZoom={setZoom} />
            <ul className="space-y-2.5">
              {q.options.map((opt, i) => {
                const sel = Array.isArray(answers[idx]) && answers[idx].includes(i)
                return (
                  <li key={i}>
                    <button
                      onClick={() => choose(i)}
                      aria-pressed={sel}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 px-3.5 py-3 text-left transition-colors ${
                        sel ? 'border-alti bg-alti/[0.06]' : 'border-transparent bg-white shadow-sm ring-1 ring-black/5 active:bg-black/[0.03]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                          sel ? 'bg-alti text-white' : 'bg-canvas text-ink/60 ring-1 ring-black/10'
                        }`}
                      >
                        {LABELS[i]}
                      </span>
                      <span className={`whitespace-pre-line text-[15px] leading-[1.55] ${sel ? 'font-semibold text-ink' : 'text-ink'}`}>{opt}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </main>

      {allDone && doneBanner && (
        <div className="anim-pop absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 rounded-2xl bg-ink p-4 text-white shadow-xl" role="status">
          <p className="text-[15px] font-bold">모든 문항을 풀었습니다. 제출하시겠습니까?</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setDoneBanner(false)} className="h-10 flex-1 rounded-xl bg-white/15 text-[14px] font-bold active:bg-white/25">
              계속 검토
            </button>
            <button onClick={submit} className="h-10 flex-1 rounded-xl bg-alti text-[14px] font-bold active:bg-alti-dark">
              제출하기
            </button>
          </div>
        </div>
      )}

      <BottomNav onPrev={prev} onNext={next} canPrev={idx > 0} canNext={idx < total - 1} />

      {confirm && (
        <Modal
          title="시험을 종료하고 제출할까요?"
          desc={total - answered > 0 ? `아직 풀지 않은 문항이 ${total - answered}개 있습니다.` : '모든 문항에 응답했습니다.'}
          yes="제출"
          no="계속 풀기"
          onYes={submit}
          onNo={() => setConfirm(false)}
        />
      )}
      <ImageZoom src={zoom} onClose={() => setZoom(null)} />
    </Frame>
  )
}

/* ───────── RESULT ───────── */
function ResultScreen({ correct, total, onReview, onHome }) {
  const score = (correct / total) * 100
  const pass = correct >= PASS_COUNT
  const wrong = total - correct
  const pct = Math.round(score)
  const R = 62
  const C = 2 * Math.PI * R

  return (
    <Frame>
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+32px)]">
        <Brand className="text-[18px] text-ink" />
        <p className="mt-0.5 text-[13px] font-medium text-ink/55">시험 결과</p>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="anim-pop relative h-44 w-44">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
            <circle cx="80" cy="80" r={R} fill="none" stroke="#E9ECEF" strokeWidth="14" />
            <circle
              cx="80" cy="80" r={R} fill="none"
              stroke={pass ? '#E6002D' : '#4A5560'}
              strokeWidth="14" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
              style={{ transition: 'stroke-dashoffset .8s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[38px] font-extrabold leading-none tabular-nums text-ink">
              {Number.isInteger(score) ? score : score.toFixed(1)}
              <span className="text-[18px] font-bold">점</span>
            </span>
            <span className="mt-1.5 text-[14px] font-semibold tabular-nums text-ink/60">
              ({correct} / {total}문항)
            </span>
          </div>
        </div>

        <div
          className={`mt-8 w-full rounded-2xl px-5 py-4 text-center ${
            pass ? 'bg-alti text-white shadow-[0_10px_24px_rgba(230,0,45,0.25)]' : 'bg-white text-ink ring-1 ring-black/10'
          }`}
        >
          {pass ? (
            <p className="text-[18px] font-extrabold">합격입니다! 축하합니다.</p>
          ) : (
            <>
              <p className="text-[18px] font-extrabold">불합격입니다.</p>
              <p className="mt-1 text-[13px] font-medium text-ink/60">(합격 기준: 65점 / {PASS_COUNT}문항 이상)</p>
            </>
          )}
        </div>

        <div className="mt-4 grid w-full grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-white py-3 ring-1 ring-black/5">
            <p className="text-[11px] font-medium text-ink/50">정답</p>
            <p className="text-[18px] font-bold tabular-nums text-ok">{correct}</p>
          </div>
          <div className="rounded-xl bg-white py-3 ring-1 ring-black/5">
            <p className="text-[11px] font-medium text-ink/50">오답·미응답</p>
            <p className="text-[18px] font-bold tabular-nums text-alti">{wrong}</p>
          </div>
        </div>
      </main>
      <footer className="shrink-0 px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {wrong > 0 ? (
          <button onClick={onReview} className="h-14 w-full rounded-2xl bg-alti text-[17px] font-bold text-white active:bg-alti-dark">
            오답풀이
          </button>
        ) : (
          <button onClick={onHome} className="h-14 w-full rounded-2xl bg-alti text-[17px] font-bold text-white active:bg-alti-dark">
            처음으로
          </button>
        )}
      </footer>
    </Frame>
  )
}

/* ───────── REVIEW ───────── */
function ReviewScreen({ items, onExit }) {
  const [idx, setIdx] = useState(0)
  const [dir, setDir] = useState('next')
  const [exitOpen, setExitOpen] = useState(false)
  const [zoom, setZoom] = useState(null)
  const scrollRef = useRef(null)
  const total = items.length

  const go = useCallback(
    (n) => {
      if (n < 0 || n >= total) return
      setDir(n > idx ? 'next' : 'prev')
      setIdx(n)
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    },
    [idx, total],
  )
  const prev = useCallback(() => go(idx - 1), [go, idx])
  const next = useCallback(() => go(idx + 1), [go, idx])
  const swipe = useSwipeNav(prev, next, !exitOpen && !zoom)

  const { q, picked, no } = items[idx]

  return (
    <Frame>
      <header className="relative z-20 flex shrink-0 items-center justify-between bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <div>
          <p className="text-[16px] font-bold tabular-nums text-ink">
            오답 <span className="text-alti">{idx + 1}</span> / {total}
          </p>
          <p className="text-[12px] font-medium tabular-nums text-ink/55">(원래 문제 번호: Q.{no})</p>
        </div>
        <button onClick={() => setExitOpen(true)} className="h-9 rounded-lg bg-ink px-4 text-[13px] font-bold text-white active:opacity-80">
          나가기
        </button>
      </header>

      <main className="relative min-h-0 flex-1" {...swipe}>
        <EdgeZones onPrev={prev} onNext={next} canPrev={idx > 0} canNext={idx < total - 1} />
        <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain px-7 pb-6 pt-5">
          <div key={idx} className={dir === 'next' ? 'anim-next' : 'anim-prev'}>
            <QuestionHeader q={q} label={`Q.${no}`} onZoom={setZoom} />
            {(!picked || picked.length === 0) && (
              <p className="mb-2.5 inline-block rounded-md bg-ink/10 px-2 py-0.5 text-[12px] font-bold text-ink/70">미선택 문항</p>
            )}
            <ul className="space-y-2.5">
              {q.options.map((opt, i) => {
                const isAns = q.answer.includes(i)
                const isMine = Array.isArray(picked) && picked.includes(i)
                const tone = isAns
                  ? 'border-ok bg-ok/[0.07]'
                  : isMine
                    ? 'border-alti bg-alti/[0.06]'
                    : 'border-transparent bg-white ring-1 ring-black/5 opacity-70'
                return (
                  <li key={i} className={`flex items-start gap-3 rounded-xl border-2 px-3.5 py-3 ${tone}`}>
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                        isAns ? 'bg-ok text-white' : isMine ? 'bg-alti text-white' : 'bg-canvas text-ink/60 ring-1 ring-black/10'
                      }`}
                    >
                      {isAns ? '✓' : isMine ? '✕' : LABELS[i]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="whitespace-pre-line text-[15px] leading-[1.55] text-ink">{LABELS[i]}. {opt}</span>
                      {(isAns || isMine) && (
                        <span className={`mt-1 block text-[11.5px] font-bold ${isAns ? 'text-ok' : 'text-alti'}`}>
                          {isAns && isMine ? '정답 (내가 선택함)' : isAns ? '정답' : '내가 선택한 답'}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <section className="mt-5 rounded-xl border-l-4 border-alti bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-extrabold text-alti">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                </svg>
                상세 해설
              </h3>
              <p className="mb-2 text-[14px] font-semibold text-ink">
                정답: <b className="text-ok">{q.answer.map((a) => LABELS[a]).join(', ')}</b>
                {q.source !== '덤프' && <span className="ml-1.5 text-[11.5px] font-medium text-ink/50">KSTQB 공식 해설</span>}
              </p>
              <p className="whitespace-pre-line text-[14px] leading-[1.7] text-ink">{q.explanation}</p>
            </section>
          </div>
        </div>
      </main>

      <BottomNav onPrev={prev} onNext={next} canPrev={idx > 0} canNext={idx < total - 1} />

      {exitOpen && (
        <Modal
          title="오답풀이를 종료합니다."
          yes="네"
          no="아니오"
          onYes={onExit}
          onNo={() => setExitOpen(false)}
        />
      )}
      <ImageZoom src={zoom} onClose={() => setZoom(null)} />
    </Frame>
  )
}

/* ───────── App (state machine: START → EXAM → RESULT → REVIEW) ───────── */
export default function App() {
  const [screen, setScreen] = useState('START')
  const [exam, setExam] = useState(null) // { questions, deadline }
  const [answers, setAnswers] = useState([])

  const start = () => {
    const picked = fisherYates(QUESTIONS).slice(0, EXAM_SIZE)
    setExam({ questions: picked, deadline: Date.now() + EXAM_SECONDS * 1000 })
    setAnswers(Array(picked.length).fill(null))
    setScreen('EXAM')
  }

  const reset = () => {
    setExam(null)
    setAnswers([])
    setScreen('START')
  }

  // ExamScreen에서 계산한 선택 배열을 그대로 저장 (빈 배열은 미응답 null)
  const setAnswer = useCallback((i, sel) => {
    setAnswers((prev) => {
      const next = prev.slice()
      next[i] = sel && sel.length ? sel : null
      return next
    })
  }, [])

  const submit = useCallback(() => setScreen('RESULT'), [])

  const result = useMemo(() => {
    if (!exam) return null
    const wrong = []
    let correct = 0
    exam.questions.forEach((q, i) => {
      if (isCorrect(q, answers[i])) correct++
      else wrong.push({ q, picked: answers[i], no: i + 1 })
    })
    return { correct, wrong }
  }, [exam, answers])

  if (screen === 'EXAM' && exam)
    return <ExamScreen questions={exam.questions} answers={answers} setAnswer={setAnswer} deadline={exam.deadline} onSubmit={submit} />
  if (screen === 'RESULT' && result)
    return <ResultScreen correct={result.correct} total={exam.questions.length} onReview={() => setScreen('REVIEW')} onHome={reset} />
  if (screen === 'REVIEW' && result && result.wrong.length)
    return <ReviewScreen items={result.wrong} onExit={reset} />
  return <StartScreen onStart={start} />
}
