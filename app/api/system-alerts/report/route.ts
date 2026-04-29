import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import {
  createDailyReportEmailHtml,
  createDailyReportPdf,
  createInlineEmailCharts,
  getTelemetryRecordsForDate,
  isValidEmailAddress,
  isValidReportDate,
} from '@/lib/reporting'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function buildPdfFilename(date: string) {
  return `water-quality-report-${date}.pdf`
}

function getSmtpConfig() {
  const user = process.env.SMTP_USER?.trim() ?? ''
  const pass = process.env.SMTP_PASS?.trim() ?? ''
  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT ?? '465')
  const secure = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() !== 'false'
  const from = process.env.MAIL_FROM?.trim() || user

  if (!user || !pass || !from || !Number.isFinite(port)) {
    return null
  }

  return { host, port, secure, user, pass, from }
}

async function sendWithNodemailer(email: string, date: string, pdfBuffer: Buffer) {
  const smtp = getSmtpConfig()

  if (!smtp) {
    return { emailed: false, emailConfigured: false }
  }

  const records = getTelemetryRecordsForDate(date)
  const html = createDailyReportEmailHtml(date, records)
  const { attachments: chartAttachments } = createInlineEmailCharts(date, records)

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  })

  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject: `Water dashboard sensor graphs - ${date}`,
    text: [
      `Water dashboard report for ${date}.`,
      `Records included: ${records.length}.`,
      'The HTML version of this email contains inline graphs for pH, temperature, turbidity, flow, tank level, battery voltage, lux, RGB color channels, and sensor diagnostic voltages.',
      'A PDF summary is attached as well.',
    ].join('\n'),
    html,
    attachments: [
      ...chartAttachments,
      {
        filename: buildPdfFilename(date),
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  })

  return { emailed: true, emailConfigured: true }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = String(searchParams.get('date') ?? '').trim()

  if (!isValidReportDate(date)) {
    return NextResponse.json({ ok: false, message: 'A valid report date is required.' }, { status: 400 })
  }

  const records = getTelemetryRecordsForDate(date)
  const pdfBuffer = createDailyReportPdf(date, records)

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${buildPdfFilename(date)}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { date?: string; email?: string }
    const date = String(body.date ?? '').trim()
    const email = String(body.email ?? '').trim()

    if (!isValidReportDate(date)) {
      return NextResponse.json({ ok: false, message: 'A valid report date is required.' }, { status: 400 })
    }

    if (!isValidEmailAddress(email)) {
      return NextResponse.json({ ok: false, message: 'Enter a valid email address.' }, { status: 400 })
    }

    const records = getTelemetryRecordsForDate(date)
    const pdfBuffer = createDailyReportPdf(date, records)
    const emailResult = await sendWithNodemailer(email, date, pdfBuffer)

    if (emailResult.emailed) {
      return NextResponse.json({
        ok: true,
        emailed: true,
        emailConfigured: true,
        message: `Graph report sent to ${email}.`,
        downloadUrl: `/api/system-alerts/report?date=${encodeURIComponent(date)}`,
      })
    }

    return NextResponse.json({
      ok: true,
      emailed: false,
      emailConfigured: false,
      message: 'The PDF report is ready. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, and MAIL_FROM on the dashboard server to email the inline sensor graphs with Nodemailer.',
      downloadUrl: `/api/system-alerts/report?date=${encodeURIComponent(date)}`,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Unable to prepare the report email.',
      },
      { status: 500 },
    )
  }
}
