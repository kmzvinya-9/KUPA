import type { TelemetryRecord } from '@/lib/telemetry-store'
import { getTelemetryHistory } from '@/lib/telemetry-store'

export type DailyReportStats = {
  count: number
  minPh: number
  maxPh: number
  avgPh: number
  minTemperatureC: number
  maxTemperatureC: number
  avgTemperatureC: number
  minTurbidityPercent: number
  maxTurbidityPercent: number
  avgTurbidityPercent: number
  minFlowRateLMin: number
  maxFlowRateLMin: number
  avgFlowRateLMin: number
  avgBatteryVoltage: number
  minBatteryVoltage: number
  maxBatteryVoltage: number
  forcedShutdownCount: number
  noWaterCount: number
}

export type InlineEmailAttachment = {
  filename: string
  cid: string
  content: Buffer
  contentType: string
  contentDisposition: 'inline'
}

type SingleMetricChartConfig = {
  cid: string
  filename: string
  title: string
  unit: string
  color: string
  values: number[]
  labels: string[]
  normalRange?: { low: number; high: number }
}

type MultiMetricChartConfig = {
  cid: string
  filename: string
  title: string
  unit: string
  labels: string[]
  series: Array<{
    name: string
    color: string
    values: number[]
  }>
}

type EmailChartMeta = {
  cid: string
  filename: string
  title: string
  summary: string
}

export function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isValidReportDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function getTelemetryRecordsForDate(date: string) {
  return getTelemetryHistory().filter((record) => record.timestamp.slice(0, 10) === date)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function minValue(values: number[]) {
  if (values.length === 0) return 0
  return Math.min(...values)
}

function maxValue(values: number[]) {
  if (values.length === 0) return 0
  return Math.max(...values)
}

export function buildDailyReportStats(records: TelemetryRecord[]): DailyReportStats {
  const phValues = records.map((record) => record.ph)
  const temperatureValues = records.map((record) => record.temperatureC)
  const turbidityValues = records.map((record) => record.turbidityPercent)
  const flowValues = records.map((record) => record.flowRateLMin)
  const batteryValues = records.map((record) => record.batteryVoltage)

  return {
    count: records.length,
    minPh: minValue(phValues),
    maxPh: maxValue(phValues),
    avgPh: average(phValues),
    minTemperatureC: minValue(temperatureValues),
    maxTemperatureC: maxValue(temperatureValues),
    avgTemperatureC: average(temperatureValues),
    minTurbidityPercent: minValue(turbidityValues),
    maxTurbidityPercent: maxValue(turbidityValues),
    avgTurbidityPercent: average(turbidityValues),
    minFlowRateLMin: minValue(flowValues),
    maxFlowRateLMin: maxValue(flowValues),
    avgFlowRateLMin: average(flowValues),
    avgBatteryVoltage: average(batteryValues),
    minBatteryVoltage: minValue(batteryValues),
    maxBatteryVoltage: maxValue(batteryValues),
    forcedShutdownCount: 0, // Battery-forced shutdowns removed - sensors always run
    noWaterCount: records.filter((record) => !record.hasWater).length,
  }
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapText(text: string, maxChars = 88) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function createPdfFromPages(pages: string[][]) {
  const objects: string[] = []

  const addObject = (body: string) => {
    objects.push(body)
    return objects.length
  }

  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pageIds: number[] = []
  const contentIds: number[] = []

  for (const pageLines of pages) {
    const content = pageLines.join('\n')
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`)
    contentIds.push(contentId)
    pageIds.push(0)
  }

  const pagesId = addObject('')

  for (let index = 0; index < contentIds.length; index += 1) {
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Contents ${contentIds[index]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`)
    pageIds[index] = pageId
  }

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'utf8')
}

export function createDailyReportPdf(date: string, records: TelemetryRecord[]) {
  const stats = buildDailyReportStats(records)
  const reportLines: string[] = []

  const pushWrapped = (text: string) => {
    reportLines.push(...wrapText(text))
  }

  reportLines.push('WATER QUALITY DAILY REPORT')
  reportLines.push(`Selected Date: ${date}`)
  reportLines.push(`Device: ${records[0]?.deviceId ?? 'ESP32-WATER-01'}`)
  reportLines.push(`Records captured: ${stats.count}`)
  reportLines.push('')

  if (records.length === 0) {
    pushWrapped('No telemetry was stored for the selected date. The PDF was still generated so the date can be shared in System Alerts.')
  } else {
    reportLines.push('Daily summary')
    reportLines.push(`pH avg ${stats.avgPh.toFixed(2)} | min ${stats.minPh.toFixed(2)} | max ${stats.maxPh.toFixed(2)}`)
    reportLines.push(`Temperature avg ${stats.avgTemperatureC.toFixed(2)} C | min ${stats.minTemperatureC.toFixed(2)} | max ${stats.maxTemperatureC.toFixed(2)}`)
    reportLines.push(`Turbidity avg ${stats.avgTurbidityPercent.toFixed(2)} % | min ${stats.minTurbidityPercent.toFixed(2)} | max ${stats.maxTurbidityPercent.toFixed(2)}`)
    reportLines.push(`Flow avg ${stats.avgFlowRateLMin.toFixed(2)} L/min | min ${stats.minFlowRateLMin.toFixed(2)} | max ${stats.maxFlowRateLMin.toFixed(2)}`)
    reportLines.push(`Battery avg ${stats.avgBatteryVoltage.toFixed(2)} V | min ${stats.minBatteryVoltage.toFixed(2)} | max ${stats.maxBatteryVoltage.toFixed(2)}`)
    reportLines.push(`Forced sensor shutdown events: ${stats.forcedShutdownCount}`)
    reportLines.push(`No-water readings held at zero: ${stats.noWaterCount}`)
    reportLines.push('')
    reportLines.push('Record details')

    for (const record of records.slice(0, 120)) {
      const line = [
        record.timestamp.replace('T', ' ').replace('.000Z', ' UTC'),
        `pH ${record.ph.toFixed(2)}`,
        `Temp ${record.temperatureC.toFixed(2)}C`,
        `Turbidity ${record.turbidityPercent.toFixed(2)}%`,
        `Flow ${record.flowRateLMin.toFixed(2)}L/min`,
        `Battery ${record.batteryVoltage.toFixed(2)}V`,
        `Water ${record.hasWater ? 'yes' : 'no'}`,
        `Sensors off ${record.sensorsForcedOff ? 'yes' : 'no'}`,
      ].join(' | ')
      pushWrapped(line)
    }

    if (records.length > 120) {
      reportLines.push('')
      pushWrapped(`Only the first 120 records are listed in this PDF to keep the report readable. Total records stored for the selected date: ${records.length}.`)
    }
  }

  const pages: string[][] = []
  const linesPerPage = 42

  for (let start = 0; start < reportLines.length; start += linesPerPage) {
    const chunk = reportLines.slice(start, start + linesPerPage)
    const content: string[] = ['BT', '/F1 18 Tf', '40 800 Td']
    let firstLine = true

    for (const line of chunk) {
      const fontSize = firstLine ? 18 : line === 'Daily summary' || line === 'Record details' ? 13 : 10
      if (!firstLine) {
        content.push(`0 -${line === '' ? 10 : 16} Td`)
      }
      content.push(`/F1 ${fontSize} Tf`)
      content.push(`(${escapePdfText(line || ' ')}) Tj`)
      firstLine = false
    }

    content.push('ET')
    pages.push(content)
  }

  if (pages.length === 0) {
    pages.push(['BT', '/F1 18 Tf', '40 800 Td', '(WATER QUALITY DAILY REPORT) Tj', '0 -20 Td', '/F1 10 Tf', '(No report data available.) Tj', 'ET'])
  }

  return createPdfFromPages(pages)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeSvg(value: string) {
  return escapeHtml(value)
}

function formatReportDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatMetricNumber(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00'
}

function formatTimeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
}

function createPlaceholderChart(title: string, subtitle: string) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="320" viewBox="0 0 960 320" role="img" aria-label="${escapeSvg(title)} chart unavailable">
    <rect width="960" height="320" fill="#0f172a" rx="20" ry="20" />
    <text x="40" y="56" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">${escapeSvg(title)}</text>
    <text x="40" y="90" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="14">${escapeSvg(subtitle)}</text>
    <text x="480" y="180" text-anchor="middle" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="20">No telemetry available for this date</text>
  </svg>`
}

function createSingleMetricChartSvg(config: SingleMetricChartConfig) {
  const { title, unit, color, values, labels, normalRange } = config

  if (values.length === 0) {
    return createPlaceholderChart(title, 'No points were stored for the selected date.')
  }

  const width = 960
  const height = 320
  const left = 76
  const right = 28
  const top = 68
  const bottom = 52
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom
  const minRaw = Math.min(...values, ...(normalRange ? [normalRange.low] : []))
  const maxRaw = Math.max(...values, ...(normalRange ? [normalRange.high] : []))
  const spread = maxRaw - minRaw
  const padding = spread === 0 ? Math.max(1, Math.abs(maxRaw) * 0.12 || 1) : spread * 0.14
  const chartMin = minRaw - padding
  const chartMax = maxRaw + padding
  const range = chartMax - chartMin || 1
  const xAt = (index: number) => left + (values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth)
  const yAt = (value: number) => top + ((chartMax - value) / range) * chartHeight
  const points = values.map((value, index) => `${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`).join(' ')

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
    const y = top + ratio * chartHeight
    const value = chartMax - ratio * range
    return {
      y,
      value,
    }
  })

  const xLabels = [
    { label: labels[0] ?? 'Start', x: left, anchor: 'start' },
    { label: labels[Math.floor((labels.length - 1) / 2)] ?? 'Mid', x: left + chartWidth / 2, anchor: 'middle' },
    { label: labels[labels.length - 1] ?? 'End', x: left + chartWidth, anchor: 'end' },
  ]

  const avg = average(values)
  const min = minValue(values)
  const max = maxValue(values)

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvg(title)} graph">
    <rect width="${width}" height="${height}" fill="#0f172a" rx="20" ry="20" />
    <text x="40" y="48" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">${escapeSvg(title)}</text>
    <text x="40" y="72" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="13">Min ${escapeSvg(formatMetricNumber(min))}${escapeSvg(unit)} · Avg ${escapeSvg(formatMetricNumber(avg))}${escapeSvg(unit)} · Max ${escapeSvg(formatMetricNumber(max))}${escapeSvg(unit)}</text>
    ${gridLines.map((line) => `
      <line x1="${left}" y1="${line.y.toFixed(2)}" x2="${width - right}" y2="${line.y.toFixed(2)}" stroke="#1e293b" stroke-width="1" />
      <text x="${left - 12}" y="${(line.y + 4).toFixed(2)}" text-anchor="end" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="11">${escapeSvg(formatMetricNumber(line.value))}</text>
    `).join('')}
    ${normalRange ? `
      <rect x="${left}" y="${yAt(normalRange.high).toFixed(2)}" width="${chartWidth}" height="${Math.max(1, yAt(normalRange.low) - yAt(normalRange.high)).toFixed(2)}" fill="#1d4ed8" opacity="0.12" />
      <text x="${width - right}" y="${(yAt(normalRange.high) - 8).toFixed(2)}" text-anchor="end" fill="#93c5fd" font-family="Arial, Helvetica, sans-serif" font-size="11">Normal band ${escapeSvg(formatMetricNumber(normalRange.low))}-${escapeSvg(formatMetricNumber(normalRange.high))}${escapeSvg(unit)}</text>
    ` : ''}
    <polyline fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" points="${points}" />
    ${values.map((value, index) => `
      <circle cx="${xAt(index).toFixed(2)}" cy="${yAt(value).toFixed(2)}" r="3.5" fill="${color}" />
    `).join('')}
    ${xLabels.map((item) => `
      <text x="${item.x.toFixed(2)}" y="${height - 18}" text-anchor="${item.anchor}" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="11">${escapeSvg(item.label)}</text>
    `).join('')}
  </svg>`
}

function createMultiMetricChartSvg(config: MultiMetricChartConfig) {
  const { title, unit, labels, series } = config
  const activeSeries = series.filter((entry) => entry.values.length > 0)
  if (activeSeries.length === 0) {
    return createPlaceholderChart(title, 'No points were stored for the selected date.')
  }

  const width = 960
  const height = 320
  const left = 76
  const right = 28
  const top = 72
  const bottom = 52
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom
  const allValues = activeSeries.flatMap((entry) => entry.values)
  const minRaw = Math.min(...allValues)
  const maxRaw = Math.max(...allValues)
  const spread = maxRaw - minRaw
  const padding = spread === 0 ? Math.max(5, Math.abs(maxRaw) * 0.12 || 5) : spread * 0.14
  const minimum = Math.max(0, minRaw - padding)
  const maximum = maxRaw + padding
  const range = maximum - minimum || 1
  const longestSeriesLength = Math.max(...activeSeries.map((entry) => entry.values.length))
  const xAt = (index: number) => left + (longestSeriesLength <= 1 ? chartWidth / 2 : (index / (longestSeriesLength - 1)) * chartWidth)
  const yAt = (value: number) => top + ((maximum - value) / range) * chartHeight

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
    const y = top + ratio * chartHeight
    const value = maximum - ratio * range
    return { y, value }
  })

  const xLabels = [
    { label: labels[0] ?? 'Start', x: left, anchor: 'start' },
    { label: labels[Math.floor((labels.length - 1) / 2)] ?? 'Mid', x: left + chartWidth / 2, anchor: 'middle' },
    { label: labels[labels.length - 1] ?? 'End', x: left + chartWidth, anchor: 'end' },
  ]

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeSvg(title)} graph">
    <rect width="${width}" height="${height}" fill="#0f172a" rx="20" ry="20" />
    <text x="40" y="48" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">${escapeSvg(title)}</text>
    <text x="40" y="72" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="13">Combined channels with shared ${escapeSvg(unit)} scale</text>
    ${gridLines.map((line) => `
      <line x1="${left}" y1="${line.y.toFixed(2)}" x2="${width - right}" y2="${line.y.toFixed(2)}" stroke="#1e293b" stroke-width="1" />
      <text x="${left - 12}" y="${(line.y + 4).toFixed(2)}" text-anchor="end" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="11">${escapeSvg(formatMetricNumber(line.value))}</text>
    `).join('')}
    ${activeSeries.map((entry, entryIndex) => {
      const points = entry.values.map((value, index) => `${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`).join(' ')
      return `
        <polyline fill="none" stroke="${entry.color}" stroke-width="${entryIndex === 0 ? 3.5 : 3}" stroke-linejoin="round" stroke-linecap="round" points="${points}" />
        ${entry.values.map((value, index) => `
          <circle cx="${xAt(index).toFixed(2)}" cy="${yAt(value).toFixed(2)}" r="3" fill="${entry.color}" />
        `).join('')}
      `
    }).join('')}
    ${activeSeries.map((entry, index) => `
      <rect x="${40 + (index * 210)}" y="${height - 38}" width="16" height="4" fill="${entry.color}" rx="2" />
      <text x="${64 + (index * 210)}" y="${height - 30}" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="12">${escapeSvg(entry.name)}</text>
    `).join('')}
    ${xLabels.map((item) => `
      <text x="${item.x.toFixed(2)}" y="${height - 12}" text-anchor="${item.anchor}" fill="#94a3b8" font-family="Arial, Helvetica, sans-serif" font-size="11">${escapeSvg(item.label)}</text>
    `).join('')}
  </svg>`
}

function buildChartSummary(title: string, values: number[], unit: string) {
  if (values.length === 0) return `${title}: no telemetry was stored for the selected date.`
  return `${title}: min ${formatMetricNumber(minValue(values))}${unit}, avg ${formatMetricNumber(average(values))}${unit}, max ${formatMetricNumber(maxValue(values))}${unit}.`
}

export function createInlineEmailCharts(date: string, records: TelemetryRecord[]) {
  const labels = records.map((record) => formatTimeLabel(record.timestamp))
  const chartDefinitions: Array<SingleMetricChartConfig | MultiMetricChartConfig> = [
    {
      cid: `chart-ph-${date}@water-dashboard`,
      filename: `ph-${date}.svg`,
      title: 'pH Trend',
      unit: ' pH',
      color: '#22d3ee',
      values: records.map((record) => record.ph),
      labels,
      normalRange: { low: 6.5, high: 8.5 },
    },
    {
      cid: `chart-temperature-${date}@water-dashboard`,
      filename: `temperature-${date}.svg`,
      title: 'Temperature Trend',
      unit: ' °C',
      color: '#fb923c',
      values: records.map((record) => record.temperatureC),
      labels,
    },
    {
      cid: `chart-turbidity-${date}@water-dashboard`,
      filename: `turbidity-${date}.svg`,
      title: 'Turbidity Trend',
      unit: ' %',
      color: '#a78bfa',
      values: records.map((record) => record.turbidityPercent),
      labels,
    },
    {
      cid: `chart-flow-${date}@water-dashboard`,
      filename: `flow-${date}.svg`,
      title: 'Flow Rate Trend',
      unit: ' L/min',
      color: '#34d399',
      values: records.map((record) => record.flowRateLMin),
      labels,
    },
    {
      cid: `chart-tank-${date}@water-dashboard`,
      filename: `tank-${date}.svg`,
      title: 'Tank Level Trend',
      unit: ' %',
      color: '#38bdf8',
      values: records.map((record) => record.tankLevelPercent),
      labels,
    },
    {
      cid: `chart-battery-${date}@water-dashboard`,
      filename: `battery-${date}.svg`,
      title: 'Battery Voltage Trend',
      unit: ' V',
      color: '#facc15',
      values: records.map((record) => record.batteryVoltage),
      labels,
      normalRange: { low: 5.5, high: 8.4 },
    },
    {
      cid: `chart-lux-${date}@water-dashboard`,
      filename: `lux-${date}.svg`,
      title: 'Light / Lux Trend',
      unit: ' lx',
      color: '#f472b6',
      values: records.map((record) => record.lux),
      labels,
    },
    {
      cid: `chart-color-${date}@water-dashboard`,
      filename: `color-${date}.svg`,
      title: 'Color Sensor Channels',
      unit: ' RGB',
      labels,
      series: [
        { name: 'Red channel', color: '#ef4444', values: records.map((record) => record.colorR) },
        { name: 'Green channel', color: '#22c55e', values: records.map((record) => record.colorG) },
        { name: 'Blue channel', color: '#3b82f6', values: records.map((record) => record.colorB) },
      ],
    },
    {
      cid: `chart-sensor-voltage-${date}@water-dashboard`,
      filename: `sensor-voltages-${date}.svg`,
      title: 'Sensor Diagnostic Voltages',
      unit: ' V',
      labels,
      series: [
        { name: 'pH probe voltage', color: '#06b6d4', values: records.map((record) => record.phVoltage) },
        { name: 'Turbidity sensor voltage', color: '#e879f9', values: records.map((record) => record.turbidityVoltage) },
      ],
    },
  ]

  const attachments: InlineEmailAttachment[] = []
  const charts: EmailChartMeta[] = []

  for (const chart of chartDefinitions) {
    const svg = 'series' in chart
      ? createMultiMetricChartSvg(chart)
      : createSingleMetricChartSvg(chart)

    attachments.push({
      filename: chart.filename,
      cid: chart.cid,
      content: Buffer.from(svg, 'utf8'),
      contentType: 'image/svg+xml',
      contentDisposition: 'inline',
    })

    const summary = 'series' in chart
      ? `${chart.title}: ${chart.series.map((entry) => buildChartSummary(entry.name, entry.values, chart.unit === ' RGB' ? '' : chart.unit)).join(' ')}`
      : buildChartSummary(chart.title, chart.values, chart.unit)

    charts.push({
      cid: chart.cid,
      filename: chart.filename,
      title: chart.title,
      summary,
    })
  }

  return { attachments, charts }
}

export function createDailyReportEmailHtml(date: string, records: TelemetryRecord[]) {
  const stats = buildDailyReportStats(records)
  const lastRecord = records[records.length - 1] ?? null
  const { charts } = createInlineEmailCharts(date, records)
  const statusPills = [
    `Records: ${stats.count}`,
    `No-water points: ${stats.noWaterCount}`,
    `Forced shutdowns: ${stats.forcedShutdownCount}`,
    `Latest battery: ${formatMetricNumber(lastRecord?.batteryVoltage ?? 0)}V`,
  ]

  return `
  <div style="margin:0;padding:24px;background:#020617;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;">
    <div style="max-width:1080px;margin:0 auto;">
      <div style="background:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:24px 28px;box-shadow:0 10px 30px rgba(15,23,42,.35);">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#38bdf8;">Water dashboard automatic report</p>
        <h1 style="margin:0 0 10px;font-size:28px;line-height:1.2;color:#f8fafc;">Daily sensor graphs for ${escapeHtml(formatReportDate(date))}</h1>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#cbd5e1;">This email includes inline graphs for the stored telemetry on the selected day. The PDF summary is also attached for download and sharing.</p>
        <div style="margin:0 0 20px;">
          ${statusPills.map((item) => `<span style="display:inline-block;margin:0 8px 8px 0;padding:8px 12px;border-radius:999px;background:#111827;border:1px solid #334155;font-size:12px;color:#e2e8f0;">${escapeHtml(item)}</span>`).join('')}
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:14px;border:1px solid #1e293b;border-radius:14px;background:#020617;">
              <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Average pH</div>
              <div style="font-size:22px;color:#f8fafc;font-weight:700;">${escapeHtml(formatMetricNumber(stats.avgPh))}</div>
            </td>
            <td style="width:12px"></td>
            <td style="padding:14px;border:1px solid #1e293b;border-radius:14px;background:#020617;">
              <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Average temperature</div>
              <div style="font-size:22px;color:#f8fafc;font-weight:700;">${escapeHtml(formatMetricNumber(stats.avgTemperatureC))} °C</div>
            </td>
            <td style="width:12px"></td>
            <td style="padding:14px;border:1px solid #1e293b;border-radius:14px;background:#020617;">
              <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Average turbidity</div>
              <div style="font-size:22px;color:#f8fafc;font-weight:700;">${escapeHtml(formatMetricNumber(stats.avgTurbidityPercent))} %</div>
            </td>
          </tr>
        </table>
        ${charts.map((chart) => `
          <div style="margin:0 0 22px;padding:18px;border:1px solid #1e293b;border-radius:18px;background:#020617;">
            <div style="margin:0 0 10px;font-size:18px;font-weight:700;color:#f8fafc;">${escapeHtml(chart.title)}</div>
            <div style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#94a3b8;">${escapeHtml(chart.summary)}</div>
            <img src="cid:${chart.cid}" alt="${escapeHtml(chart.title)}" style="display:block;width:100%;max-width:960px;border:0;border-radius:14px;" />
          </div>
        `).join('')}
        <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Generated by the dashboard server from telemetry already stored in your local history. When the ESP32 is offline, your existing logic still keeps live dashboard values at zero and history continues to reflect whatever readings were saved before the link dropped.</p>
      </div>
    </div>
  </div>`
}
