import Anthropic from '@anthropic-ai/sdk'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { Resend } from 'resend'
import CoreStoryPDF from '../../components/CoreStoryPDF'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const resend  = new Resend(process.env.RESEND_API_KEY)

const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL  || ''
const FROM_EMAIL      = process.env.FROM_EMAIL        || 'Flip My Business <onboarding@resend.dev>'
const INTERNAL_EMAIL  = process.env.INTERNAL_EMAIL    || 'dana@promptly.bot'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { action, payload } = req.body
  try {
    if (action === 'analyze')  return await analyzeWebsite(req, res, payload)
    if (action === 'generate') return await generateStory(req, res, payload)
    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('[API error]', err)
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scrubHtml(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000) // keep short so AI response has plenty of room
}

function safeParseJSON(text) {
  // Strip markdown fences
  let raw = text.replace(/```json|```/g, '').trim()

  // Try direct parse first
  try { return JSON.parse(raw) } catch (_) {}

  // Find the outermost { ... } and try again
  const start = raw.indexOf('{')
  const end   = raw.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)) } catch (_) {}
  }

  throw new Error('Could not parse AI response as JSON. Please try again.')
}

// ─── Step 1: Analyze business — split into 2 API calls to avoid truncation ───
async function analyzeWebsite(req, res, payload) {
  const { websiteUrl, businessName, businessDescription, cta } = payload

  // Scrape website
  let websiteContent = ''
  if (websiteUrl) {
    try {
      const r = await fetch(websiteUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FlipMyBusinessBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      websiteContent = scrubHtml(await r.text())
    } catch {
      websiteContent = ''
    }
  }

  const context = `
BUSINESS NAME: ${businessName}
WEBSITE: ${websiteUrl || 'Not provided'}
WEBSITE CONTENT: ${websiteContent || 'Not provided'}
BUSINESS DESCRIPTION: ${(businessDescription || '').slice(0, 1500)}
CALL TO ACTION: ${cta || 'Not provided'}`.trim()

  const systemPrompt = `You are a world-class business strategist trained in the Chet Holmes Core Story methodology. You analyze businesses and answer questions as a market expert — not as the business owner. Be specific and concise. Every answer must be 2-3 sentences maximum. Always return only valid JSON with no extra text.`

  // ── API call A: target, uvp, objections, 3 stats, 3 pains ────────────────
  const promptA = `${context}

Answer these 9 questions about this business. Each answer: 2-3 sentences MAX. Be specific, use real statistics with sources.

Return ONLY this JSON (no other text):
{
  "target": "Precise ideal customer profile: who they are, their emotional state, and the specific trigger that makes them ready to buy",
  "uvp": "The single most defensible competitive advantage framed as a buyer outcome, not a feature",
  "objections": "The 3 deepest psychological resistance points with the false belief behind each one",
  "stat1": "The most jaw-dropping industry statistic that reframes the cost of inaction — with source",
  "stat2": "A macro trend showing this problem gets worse every month a business waits — with source",
  "stat3": "A counterintuitive statistic that shifts buyers from I do not need this to I cannot afford to not have this",
  "pain1": "The single most universal daily frustration written from inside the buyers head",
  "pain2": "The hidden root cause most buyers never connect to their surface frustration",
  "pain3": "The full cost of 12 more months of inaction — financial, emotional, relational"
}`

  // ── API call B: steps, positioning, investment frame ─────────────────────
  const promptB = `${context}

Answer these 7 questions about this business. Each answer: 2-3 sentences MAX.

Return ONLY this JSON (no other text):
{
  "step1": "The first foundational practice this business type SHOULD do but most do not — tell WHAT not HOW",
  "step2": "The second strategy that separates winners from losers in this category — teach WHAT not HOW",
  "step3": "The capstone insight that makes hiring a professional feel urgent — bridges education to action",
  "pos_unique": "The single biggest blind spot generic competitors have that an educated buyer would see as a red flag",
  "pos_proof": "The realistic before-and-after transformation in measurable and emotional terms after 90 days",
  "pos_criteria": "3 evaluative criteria a smart buyer should use that naturally favor this business over alternatives",
  "investment_frame": "How to reframe this cost as an investment with a specific measurable ROI that resonates with this buyer"
}`

  const [msgA, msgB] = await Promise.all([
    client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: promptA }],
    }),
    client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: promptB }],
    }),
  ])

  const partA = safeParseJSON(msgA.content[0].text)
  const partB = safeParseJSON(msgB.content[0].text)

  return res.status(200).json({ prefilled: { ...partA, ...partB } })
}

// ─── Step 2: Generate Core Story + PDF + emails + GHL ────────────────────────
async function generateStory(req, res, answers) {
  const {
    businessName, businessDescription, websiteUrl, cta,
    ownerName, email, phone,
    target, uvp, objections,
    stat1, stat2, stat3,
    pain1, pain2, pain3,
    step1, step2, step3,
    pos_unique, pos_proof, pos_criteria, investment_frame,
  } = answers

  // ── 1. Generate Core Story text ───────────────────────────────────────────
  const storyPrompt = `You are a master Core Story writer trained in the Empire Research Group / Chet Holmes methodology.

A Core Story is a structured educational buying narrative — NOT a sales pitch. Sequence:
Title → UVP → Market Landscape → Pain Points (3) → Strategies (3) → Positioning → Offer/CTA → Stadium Pitch

Write a complete polished Core Story. Tone: trusted market expert educating the reader. Each section flows into the next. By the end the reader thinks: "They understand my world better than anyone. They are the only logical choice."

BUSINESS: ${businessName}
DESCRIPTION: ${(businessDescription || '').slice(0, 800)}
WEBSITE: ${websiteUrl || 'N/A'}
CTA: ${cta || 'N/A'}
TARGET: ${target}
UVP: ${uvp}
OBJECTIONS: ${objections}
STAT1: ${stat1} | STAT2: ${stat2} | STAT3: ${stat3}
PAIN1: ${pain1} | PAIN2: ${pain2} | PAIN3: ${pain3}
STEP1: ${step1} | STEP2: ${step2} | STEP3: ${step3}
BLIND SPOT: ${pos_unique}
TRANSFORMATION: ${pos_proof}
BUYING CRITERIA: ${pos_criteria}
INVESTMENT FRAME: ${investment_frame}

Return ONLY this JSON (no other text, no markdown):
{
  "title": "Compelling presentation title for the target market — makes reader think that is about me — never a company name",
  "uvp_statement": "One powerful sentence that resets buying criteria",
  "landscape": "2 paragraphs using the stats to create urgency for the skeptical 90 percent",
  "pain1_narrative": "One vivid paragraph from inside the buyers head — make the reader feel seen",
  "pain2_narrative": "One paragraph on the hidden root cause that reframes everything",
  "pain3_narrative": "One paragraph on the full weight of inaction — end with quiet recognition",
  "strategy1_narrative": "One educational paragraph — WHAT not HOW — builds authority",
  "strategy2_narrative": "One educational paragraph — makes DIY feel risky",
  "strategy3_narrative": "One educational paragraph — bridges naturally to the solution",
  "positioning_narrative": "Two paragraphs — exposes competitor blind spot then establishes buying criteria",
  "sponsor_narrative": "One to two paragraphs — introduces offer as logical conclusion, frames ROI, ends with CTA",
  "stadium_pitch": "Exactly 4 sentences: market truth, what we do and for whom, our secret sauce, specific offer and CTA"
}`

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    messages: [{ role: 'user', content: storyPrompt }],
  })

  const story = safeParseJSON(message.content[0].text)

  // ── 2. Generate PDF ───────────────────────────────────────────────────────
  let pdfBase64 = null
  let pdfError  = null
  try {
    const element   = createElement(CoreStoryPDF, { story, intake: answers })
    const pdfBuffer = await renderToBuffer(element)
    pdfBase64 = pdfBuffer.toString('base64')
  } catch (e) {
    console.error('[PDF error]', e)
    pdfError = e.message
  }

  const fileName = `${(businessName || 'Business').replace(/[^a-zA-Z0-9]/g, '_')}_Core_Story.pdf`

  // ── 3. Email owner ────────────────────────────────────────────────────────
  let emailSent  = false
  let emailError = null
  if (email && pdfBase64 && process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from:        FROM_EMAIL,
        to:          email,
        subject:     `Your Core Story is ready — ${businessName}`,
        html:        buildOwnerEmail({ ownerName, businessName, story, cta }),
        attachments: [{ filename: fileName, content: pdfBase64 }],
      })
      emailSent = true
    } catch (e) {
      console.error('[Owner email error]', e)
      emailError = e.message
    }
  }

  // ── 4. Email internal notification ───────────────────────────────────────
  let internalSent  = false
  let internalError = null
  if (process.env.RESEND_API_KEY) {
    try {
      await resend.emails.send({
        from:        FROM_EMAIL,
        to:          INTERNAL_EMAIL,
        subject:     `New Flip My Business Lead — ${businessName}`,
        html:        buildInternalEmail({ ownerName, email, phone, businessName, websiteUrl, businessDescription, cta, story }),
        attachments: pdfBase64 ? [{ filename: fileName, content: pdfBase64 }] : [],
      })
      internalSent = true
    } catch (e) {
      console.error('[Internal email error]', e)
      internalError = e.message
    }
  }

  // ── 5. GHL webhook ────────────────────────────────────────────────────────
  let ghlSent  = false
  let ghlError = null
  if (GHL_WEBHOOK_URL) {
    try {
      const nameParts = (ownerName || '').trim().split(' ')
      await fetch(GHL_WEBHOOK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName:           nameParts[0] || '',
          lastName:            nameParts.slice(1).join(' ') || '',
          fullName:            ownerName           || '',
          email:               email               || '',
          phone:               phone               || '',
          businessName:        businessName        || '',
          website:             websiteUrl          || '',
          businessDescription: (businessDescription || '').slice(0, 500),
          cta:                 cta                 || '',
          source:              'Flip My Business',
          tags:                ['flip-my-business', 'core-story', 'web-lead'],
          customFields: {
            stadiumPitch:      story.stadium_pitch || '',
            uvp:               story.uvp_statement || '',
            presentationTitle: story.title         || '',
          },
        }),
        signal: AbortSignal.timeout(5000),
      })
      ghlSent = true
    } catch (e) {
      console.error('[GHL error]', e)
      ghlError = e.message
    }
  }

  return res.status(200).json({
    story, pdfBase64, emailSent, internalSent, ghlSent,
    ...(pdfError      && { pdfError      }),
    ...(emailError    && { emailError    }),
    ...(internalError && { internalError }),
    ...(ghlError      && { ghlError      }),
  })
}

// ─── Owner email HTML ─────────────────────────────────────────────────────────
function buildOwnerEmail({ ownerName, businessName, story, cta }) {
  const first = ownerName ? ownerName.split(' ')[0] : null
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;max-width:600px">
<tr><td style="background:#1D9E75;padding:32px 40px">
  <p style="margin:0 0 8px;color:rgba(255,255,255,0.7);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase">Flip My Business · by Promptly</p>
  <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700">${businessName}</h1>
  <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px">Your Core Story is ready — see attached PDF</p>
</td></tr>
<tr><td style="padding:32px 40px">
  <p style="margin:0 0 16px;color:#111827;font-size:15px;font-weight:500">${first ? `Hi ${first},` : 'Hi there,'}</p>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.75">Your complete Core Story for <strong>${businessName}</strong> is attached as a branded PDF. This is your foundation document — the language that should drive your website, sales conversations, email campaigns, and presentations.</p>
  ${story.stadium_pitch ? `<div style="background:#f0faf6;border-left:4px solid #1D9E75;padding:16px 20px;margin-bottom:24px"><p style="margin:0 0 6px;color:#1D9E75;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Your 30-Second Stadium Pitch</p><p style="margin:0;color:#111827;font-size:13px;line-height:1.75;font-style:italic">${story.stadium_pitch}</p></div>` : ''}
  ${cta ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 18px;margin-bottom:24px"><p style="margin:0 0 4px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">Next Step</p><p style="margin:0;color:#1D9E75;font-size:14px;font-weight:600">${cta}</p></div>` : ''}
  <hr style="border:none;border-top:1px solid #f3f4f6;margin:24px 0">
  <p style="margin:0;color:#9CA3AF;font-size:12px">Generated by <strong style="color:#1D9E75">Flip My Business</strong> · by Promptly</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

// ─── Internal lead email HTML ─────────────────────────────────────────────────
function buildInternalEmail({ ownerName, email, phone, businessName, websiteUrl, businessDescription, cta, story }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;max-width:600px">
<tr><td style="background:#111827;padding:24px 36px">
  <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px;text-transform:uppercase">Flip My Business · New Lead</p>
  <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">${businessName}</h1>
</td></tr>
<tr><td style="padding:28px 36px">
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
    <tr><td style="padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb"><p style="margin:0 0 2px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">Name</p><p style="margin:0;color:#111827;font-size:14px;font-weight:600">${ownerName || '—'}</p></td></tr>
    <tr><td style="padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb"><p style="margin:0 0 2px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">Email</p><p style="margin:0;color:#1D9E75;font-size:13px">${email || '—'}</p></td></tr>
    <tr><td style="padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb"><p style="margin:0 0 2px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">Phone</p><p style="margin:0;color:#111827;font-size:13px">${phone || '—'}</p></td></tr>
    <tr><td style="padding:10px 14px;background:#f9fafb"><p style="margin:0 0 2px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">Website</p><p style="margin:0;color:#1D9E75;font-size:13px">${websiteUrl || '—'}</p></td></tr>
  </table>
  <div style="margin-bottom:20px"><p style="margin:0 0 6px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">Business Description</p><p style="margin:0;color:#374151;font-size:13px;line-height:1.7;background:#f9fafb;padding:12px;border-radius:6px;border:1px solid #e5e7eb">${(businessDescription || '—').slice(0, 500)}</p></div>
  ${story.stadium_pitch ? `<div style="background:#f0faf6;border-left:4px solid #1D9E75;padding:14px 18px;margin-bottom:20px"><p style="margin:0 0 5px;color:#1D9E75;font-size:10px;font-weight:700;text-transform:uppercase">Stadium Pitch</p><p style="margin:0;color:#111827;font-size:13px;line-height:1.7;font-style:italic">${story.stadium_pitch}</p></div>` : ''}
  ${story.uvp_statement ? `<div style="margin-bottom:20px"><p style="margin:0 0 6px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">UVP</p><p style="margin:0;color:#374151;font-size:13px;line-height:1.7">${story.uvp_statement}</p></div>` : ''}
  ${cta ? `<div style="margin-bottom:20px"><p style="margin:0 0 4px;color:#6B7280;font-size:10px;font-weight:700;text-transform:uppercase">CTA</p><p style="margin:0;color:#1D9E75;font-size:13px;font-weight:600">${cta}</p></div>` : ''}
  <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0">
  <p style="margin:0;color:#9CA3AF;font-size:11px">Full Core Story PDF attached · Flip My Business by Promptly</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}
