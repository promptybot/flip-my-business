import { useState, useRef } from 'react'
import Head from 'next/head'

const OUTPUT_SECTIONS = [
  { key: 'title',                label: 'Presentation Title'                    },
  { key: 'uvp_statement',        label: 'Unique Value Proposition'              },
  { key: 'landscape',            label: 'Market Landscape: Statistics & Trends' },
  { key: 'pain1_narrative',      label: 'Pain Point 1'                          },
  { key: 'pain2_narrative',      label: 'Pain Point 2'                          },
  { key: 'pain3_narrative',      label: 'Pain Point 3'                          },
  { key: 'strategy1_narrative',  label: 'Strategy 1'                            },
  { key: 'strategy2_narrative',  label: 'Strategy 2'                            },
  { key: 'strategy3_narrative',  label: 'Strategy 3'                            },
  { key: 'positioning_narrative','label': 'Positioning'                          },
  { key: 'sponsor_narrative',    label: 'Offer & Call to Action'                },
]

const AI_REVIEW_GROUPS = [
  {
    heading: 'Target market & positioning',
    keys: [
      { key: 'target',     label: 'Ideal client / target market'    },
      { key: 'uvp',        label: 'Unique value proposition'         },
      { key: 'objections', label: 'Common buying objections'         },
    ],
  },
  {
    heading: 'Market landscape — WOW statistics',
    keys: [
      { key: 'stat1', label: 'WOW statistic #1' },
      { key: 'stat2', label: 'WOW statistic #2' },
      { key: 'stat3', label: 'WOW statistic #3' },
    ],
  },
  {
    heading: 'Pain points',
    keys: [
      { key: 'pain1', label: 'Pain point #1' },
      { key: 'pain2', label: 'Pain point #2' },
      { key: 'pain3', label: 'Pain point #3' },
    ],
  },
  {
    heading: 'Steps & strategies',
    keys: [
      { key: 'step1', label: 'Strategy #1' },
      { key: 'step2', label: 'Strategy #2' },
      { key: 'step3', label: 'Strategy #3' },
    ],
  },
  {
    heading: 'Competitive positioning',
    keys: [
      { key: 'pos_unique',        label: 'What competitors miss'           },
      { key: 'pos_proof',         label: 'Client results & transformation' },
      { key: 'pos_criteria',      label: 'Ideal buying criteria'           },
      { key: 'investment_frame',  label: 'Investment / ROI framing'        },
    ],
  },
]

export default function Home() {
  const [step,        setStep]        = useState('intake')
  const [analyzing,   setAnalyzing]   = useState(false)
  const [generating,  setGenerating]  = useState(false)
  const [genMessage,  setGenMessage]  = useState('Crafting your Core Story...')
  const [showHelp,    setShowHelp]    = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [answers,     setAnswers]     = useState({})
  const [story,       setStory]       = useState(null)
  const [pdfBase64,   setPdfBase64]   = useState(null)
  const [emailSent,   setEmailSent]   = useState(false)
  const [error,       setError]       = useState('')

  const outputRef = useRef(null)

  // Business info (top of form)
  const [biz, setBiz] = useState({
    businessName:        '',
    websiteUrl:          '',
    businessDescription: '',
    cta:                 '',
  })

  // Contact info (bottom of form — gated)
  const [contact, setContact] = useState({
    ownerName: '',
    phone:     '',
    email:     '',
  })

  const ub = (k, v) => setBiz(p => ({ ...p, [k]: v }))
  const uc = (k, v) => setContact(p => ({ ...p, [k]: v }))
  const ua = (k, v) => setAnswers(p => ({ ...p, [k]: v }))

  const allAnswers = { ...biz, ...contact, ...answers }

  // ── Validate intake ────────────────────────────────────────────────────────
  function validateIntake() {
    if (!biz.businessName.trim()) return 'Please enter your business name.'
    if (!biz.businessDescription.trim()) return 'Please tell us about your business.'
    if (!contact.ownerName.trim()) return 'Please enter your name.'
    if (!contact.phone.trim()) return 'Please enter your phone number.'
    if (!contact.email.trim()) return 'Please enter your email address.'
    if (!/\S+@\S+\.\S+/.test(contact.email)) return 'Please enter a valid email address.'
    return null
  }

  // ── Step 1: Analyze ────────────────────────────────────────────────────────
  async function handleAnalyze() {
    const err = validateIntake()
    if (err) { setError(err); return }
    setError('')
    setAnalyzing(true)
    try {
      const res  = await fetch('/api/story', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'analyze', payload: { ...biz, ...contact } }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnswers(data.prefilled)
      setStep('review')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError('Analysis failed: ' + e.message)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Step 2: Generate ───────────────────────────────────────────────────────
  async function handleGenerate() {
    setStep('generating')
    const msgs = [
      'Analyzing your market landscape...',
      'Identifying your buyer psychology...',
      'Crafting steps and strategies...',
      'Writing your positioning...',
      'Generating your Core Story...',
      'Building your branded PDF...',
    ]
    let i = 0
    const iv = setInterval(() => setGenMessage(msgs[Math.min(++i, msgs.length - 1)]), 2200)
    try {
      const res  = await fetch('/api/story', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'generate', payload: allAnswers }),
      })
      const data = await res.json()
      clearInterval(iv)
      if (data.error) throw new Error(data.error)
      setStory(data.story)
      setPdfBase64(data.pdfBase64)
      setEmailSent(data.emailSent)
      setStep('output')
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e) {
      clearInterval(iv)
      setError('Generation failed: ' + e.message)
      setStep('review')
    }
  }

  // ── Download PDF ───────────────────────────────────────────────────────────
  function handleDownloadPDF() {
    if (!pdfBase64) return
    const bytes = atob(pdfBase64)
    const arr   = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
    const blob = new Blob([arr], { type: 'application/pdf' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${biz.businessName.replace(/[^a-zA-Z0-9]/g, '_')}_Core_Story.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Copy plain text ────────────────────────────────────────────────────────
  function getPlainText() {
    if (!story) return ''
    let t = `${biz.businessName.toUpperCase()} — CORE STORY\nGenerated by Flip My Business · by Promptly\n${'='.repeat(60)}\n\n`
    if (story.stadium_pitch) t += `STADIUM PITCH\n${'='.repeat(13)}\n${story.stadium_pitch}\n\n`
    OUTPUT_SECTIONS.forEach(({ key, label }) => {
      if (story[key]) t += `${label.toUpperCase()}\n${'-'.repeat(label.length)}\n${story[key]}\n\n`
    })
    return t
  }

  function handleCopy() {
    navigator.clipboard.writeText(getPlainText()).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const progressSteps = ['intake', 'review', 'output']

  return (
    <>
      <Head>
        <title>Flip My Business — Free Core Story Generator</title>
        <meta name="description" content="Tell us what you do. We'll tell you how to sell it. Get your free Core Story in minutes." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%231D9E75'/><text x='50%' y='55%' dominant-baseline='middle' text-anchor='middle' font-size='18' font-weight='700' fill='white' font-family='system-ui'>F</text></svg>" />
      </Head>

      {/* Help popup */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-7 relative">
            <button onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            <h3 className="text-base font-semibold text-gray-900 mb-3">What to include here</h3>
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              Don't worry about being perfect — write in your own words. The more detail you give, the more accurate your Core Story will be.
            </p>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-2"><span className="text-brand-500 font-bold flex-shrink-0">→</span><span><strong>What you sell or deliver</strong> — roofing, financial planning, a SaaS app, coaching, software, a service</span></div>
              <div className="flex gap-2"><span className="text-brand-500 font-bold flex-shrink-0">→</span><span><strong>Who you serve</strong> — homeowners, small businesses, law firms, parents, contractors</span></div>
              <div className="flex gap-2"><span className="text-brand-500 font-bold flex-shrink-0">→</span><span><strong>How you deliver it</strong> — in-person, remotely, subscription, one-time project, retainer</span></div>
              <div className="flex gap-2"><span className="text-brand-500 font-bold flex-shrink-0">→</span><span><strong>What makes you different</strong> — faster, specialized, tech-enabled, more personal</span></div>
              <div className="flex gap-2"><span className="text-brand-500 font-bold flex-shrink-0">→</span><span><strong>Your stage</strong> — existing business, new startup, or just an idea you're exploring</span></div>
              <div className="flex gap-2"><span className="text-brand-500 font-bold flex-shrink-0">→</span><span><strong>Specific offer or pricing</strong> — if you have a package or price point, mention it here</span></div>
            </div>
            <div className="mt-5 p-3 bg-brand-50 rounded-xl border border-brand-100">
              <p className="text-xs text-brand-700 leading-relaxed">
                <strong>Don't have a website yet?</strong> No problem. This description is enough for our AI to fully understand your market and write your complete Core Story.
              </p>
            </div>
            <button onClick={() => setShowHelp(false)}
              className="btn-primary w-full mt-5 text-sm py-2.5">Got it</button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">

        {/* ── Nav ── */}
        <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-gray-900 text-sm tracking-tight">Flip My Business</span>
              <span className="text-gray-300 text-xs hidden sm:block">by Promptly</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden sm:block">Powered by Claude AI</span>
            {step !== 'intake' && (
              <button onClick={() => { setStep('intake'); setStory(null); setAnswers({}); setPdfBase64(null) }}
                className="btn-ghost text-xs">Start over</button>
            )}
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-4 py-10">

          {/* ── HERO ── */}
          {step === 'intake' && (
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-5 leading-tight tracking-tight">
                Flip My Business
              </h1>
              <p className="text-xl text-gray-500 mb-2 leading-relaxed max-w-lg mx-auto">
                Tell us what you do.<br className="hidden sm:block" />
                We'll tell you how to sell it.
              </p>
              <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                Answer a few simple questions. Our AI analyzes your market, your buyers, and your competition — then writes your complete business narrative and delivers it as a free branded PDF.
              </p>
            </div>
          )}

          {/* ── Progress ── */}
          {(step === 'review' || step === 'output') && (
            <div className="mb-8 flex items-center gap-3">
              {progressSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    step === s ? 'bg-brand-500 text-white' :
                    progressSteps.indexOf(step) > i ? 'bg-brand-100 text-brand-700' :
                    'bg-gray-100 text-gray-400'}`}>
                    {progressSteps.indexOf(step) > i ? '✓' : i + 1}
                  </div>
                  <span className="text-xs text-gray-500 hidden sm:block">
                    {s === 'intake' ? 'Your Info' : s === 'review' ? 'Review & Edit' : 'Core Story'}
                  </span>
                  {i < 2 && <div className="w-8 h-px bg-gray-200"/>}
                </div>
              ))}
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* ════════════════════════════════════════
              INTAKE — top business fields
          ═════════════════════════════════════════ */}
          {step === 'intake' && (
            <div className="space-y-4">

              {/* Business info card */}
              <div className="card p-7">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Your business</h2>
                <p className="text-xs text-gray-400 mb-6">Tell us the basics — our AI handles the rest.</p>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Business name <span className="text-brand-500">*</span>
                    </label>
                    <input className="input-field" placeholder="e.g. Northstar Roofing"
                      value={biz.businessName} onChange={e => ub('businessName', e.target.value)}/>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Website URL
                      <span className="ml-2 font-normal text-gray-400">optional</span>
                    </label>
                    <input className="input-field" placeholder="https://yourwebsite.com"
                      value={biz.websiteUrl} onChange={e => ub('websiteUrl', e.target.value)}/>
                    <p className="text-xs text-gray-400 mt-1.5">Don't have one yet? No problem — your description below is enough.</p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-gray-600">
                        Tell us about your business <span className="text-brand-500">*</span>
                      </label>
                      <button onClick={() => setShowHelp(true)}
                        className="text-xs text-brand-500 hover:text-brand-600 font-medium flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full border border-brand-400 flex items-center justify-center text-xs leading-none">?</span>
                        What to include
                      </button>
                    </div>
                    <textarea className="input-field" rows={7}
                      placeholder="Describe what your business does, delivers, or sells — in your own words. You can describe an existing business, a new idea, a service, a product, software, or even just a concept you're exploring. Include who you serve, how you deliver it, what makes you different, and any specific offer or pricing if you have it. The more detail you share, the more accurate your Core Story will be."
                      value={biz.businessDescription} onChange={e => ub('businessDescription', e.target.value)}/>
                    <p className="text-xs text-gray-400 mt-1.5">Go deep. This is the most important field — our AI builds your entire story from this.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Call to action
                      <span className="ml-2 font-normal text-gray-400">optional</span>
                    </label>
                    <input className="input-field" placeholder="e.g. Book a Free Demo, Call Now, Get a Free Quote, Schedule a Consultation"
                      value={biz.cta} onChange={e => ub('cta', e.target.value)}/>
                  </div>
                </div>
              </div>

              {/* Contact info card — gated below */}
              <div className="card p-7">
                <div className="flex items-start gap-3 mb-6">
                  <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M7.5 1l1.5 3L13 4.5 10 7.5l.7 4L7.5 9.8 4.3 11.5l.7-4L2 4.5 6 4z" fill="#1D9E75"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 mb-0.5">Get your free Core Story</h2>
                    <p className="text-xs text-gray-400 leading-relaxed">We'll generate your complete Core Story and deliver it as a branded PDF to your inbox — free.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Your name <span className="text-brand-500">*</span>
                    </label>
                    <input className="input-field" placeholder="e.g. John Smith"
                      value={contact.ownerName} onChange={e => uc('ownerName', e.target.value)}/>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Phone <span className="text-brand-500">*</span>
                      </label>
                      <input className="input-field" type="tel" placeholder="e.g. (555) 123-4567"
                        value={contact.phone} onChange={e => uc('phone', e.target.value)}/>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Email <span className="text-brand-500">*</span>
                        <span className="ml-1 font-normal text-gray-400">(PDF delivered here)</span>
                      </label>
                      <input className="input-field" type="email" placeholder="e.g. john@business.com"
                        value={contact.email} onChange={e => uc('email', e.target.value)}/>
                    </div>
                  </div>
                </div>

                <div className="mt-7">
                  <button onClick={handleAnalyze} disabled={analyzing}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-base py-4">
                    {analyzing ? (
                      <>
                        <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                        </svg>
                        Analyzing your business...
                      </>
                    ) : (
                      <span className="font-bold tracking-wide">Flip My Business</span>
                    )}
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-3">
                    Free · No credit card · PDF delivered to your inbox
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ════════════════════════════════════════
              REVIEW & EDIT
          ═════════════════════════════════════════ */}
          {step === 'review' && (
            <div>
              <div className="card p-5 mb-5 flex items-start gap-3">
                <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1l1.5 3 3.5.5-2.5 2.4.6 3.6L7 9 4.4 10.5l.6-3.6L2.5 4.5 6 4z" fill="#1D9E75"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 mb-1">AI analysis complete</h2>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    We've pre-filled your Core Story using deep market knowledge
                    {biz.websiteUrl ? ' and your website' : ''}. 
                    Review each section, edit anything that doesn't fit your specific situation, 
                    then generate your story.
                  </p>
                </div>
              </div>

              {AI_REVIEW_GROUPS.map(group => (
                <div key={group.heading} className="card p-6 mb-4">
                  <h3 className="section-label mb-4">{group.heading}</h3>
                  <div className="space-y-4">
                    {group.keys.map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
                        <textarea className="input-field" rows={3}
                          value={answers[key] || ''}
                          onChange={e => ua(key, e.target.value)}/>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-col sm:flex-row gap-3 mt-6">
                <button onClick={handleGenerate}
                  className="btn-primary flex items-center justify-center gap-2 text-base font-bold py-4 px-8 tracking-wide">
                  Flip My Business
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button onClick={() => setStep('intake')} className="btn-secondary">← Edit business info</button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              GENERATING
          ═════════════════════════════════════════ */}
          {step === 'generating' && (
            <div className="card p-16 text-center">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Flipping your business</h2>
              <p className="text-sm text-gray-500 mb-6">{genMessage}</p>
              <div className="flex justify-center gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-brand-300 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}/>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════
              OUTPUT
          ═════════════════════════════════════════ */}
          {step === 'output' && story && (
            <div ref={outputRef}>

              {/* Email confirmation */}
              {emailSent && (
                <div className="mb-5 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l2.5 2.5L10 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="text-sm text-brand-700">
                    <strong>PDF delivered!</strong> Your Core Story was emailed to <strong>{contact.email}</strong>
                  </p>
                </div>
              )}

              {/* Action bar */}
              <div className="card p-4 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">{biz.businessName} — Core Story</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {contact.ownerName}{contact.email ? ` · ${contact.email}` : ''}{contact.phone ? ` · ${contact.phone}` : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {pdfBase64 && (
                    <button onClick={handleDownloadPDF}
                      className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M6.5 1v7M3.5 5.5l3 3 3-3M1 10.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Download PDF
                    </button>
                  )}
                  <button onClick={handleCopy} className="btn-secondary text-sm py-2 px-4">
                    {copied ? '✓ Copied!' : 'Copy text'}
                  </button>
                  <button onClick={() => setStep('review')} className="btn-secondary text-sm py-2 px-4">
                    Edit answers
                  </button>
                </div>
              </div>

              {/* Stadium pitch */}
              {story.stadium_pitch && (
                <div className="bg-brand-500 rounded-2xl p-6 mb-5 text-white">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-2">30-Second Stadium Pitch</p>
                  <p className="text-sm leading-relaxed">{story.stadium_pitch}</p>
                </div>
              )}

              {/* Story sections */}
              {OUTPUT_SECTIONS.map(({ key, label }) =>
                story[key] ? (
                  <div key={key} className="card p-6 mb-4">
                    <p className="section-label mb-3">{label}</p>
                    {key === 'title' || key === 'uvp_statement'
                      ? <p className="text-gray-900 font-semibold text-base leading-relaxed">{story[key]}</p>
                      : <div className="text-gray-700 text-sm leading-relaxed space-y-3">
                          {story[key].split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
                        </div>
                    }
                  </div>
                ) : null
              )}

              {/* Footer */}
              <div className="card p-4 mt-4 bg-gray-50 text-center">
                <p className="text-xs text-gray-400">
                  <span className="text-brand-500 font-semibold">Flip My Business</span>
                  <span className="text-gray-300 mx-2">·</span>
                  by <span className="text-gray-500 font-medium">Promptly</span>
                </p>
              </div>

            </div>
          )}

        </main>
      </div>
    </>
  )
}
