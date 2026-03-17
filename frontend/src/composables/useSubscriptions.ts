/**
 * Composable useSubscriptions
 */

import { ref } from 'vue'
import { createDAVClient } from 'tsdav'
import { useCalendarStore } from '@/stores/calendar'
import type { CalendarSubscription, CalendarEvent, EventSource } from '@/stores/calendar'
import { SOURCE_COLORS } from '@/stores/calendar'

// ── Proxy ICS ─────────────────────────────────

const ICS_PROXY_BASE = `http://82.67.177.75:9090/ics-proxy`

const ICS_DOMAIN_MAP: Record<string, string> = {
  'ical.aimaira.com':      'aimaira',
  'calendar.google.com':   'google',
  'outlook.live.com':      'outlook',
  'outlook.office365.com': 'office365',
}

function buildProxyUrl(icsUrl: string): string {
  try {
    const url = new URL(icsUrl)
    const proxyName = ICS_DOMAIN_MAP[url.hostname]
    if (!proxyName) return icsUrl
    return `${ICS_PROXY_BASE}/${proxyName}${url.pathname}${url.search}`
  } catch {
    return icsUrl
  }
}

// ── Parsing ICS ───────────────────────────────

function parseICSDate(value: string): { date: string; allDay: boolean } {
  const isAllDay = !value.includes('T')
  if (isAllDay) {
    const y = value.substring(0, 4)
    const m = value.substring(4, 6)
    const d = value.substring(6, 8)
    return { date: `${y}-${m}-${d}T00:00:00`, allDay: true }
  }
  const y = value.substring(0, 4)
  const mo = value.substring(4, 6)
  const d = value.substring(6, 8)
  const h = value.substring(9, 11)
  const mi = value.substring(11, 13)
  const s = value.substring(13, 15)
  const utc = value.endsWith('Z') ? 'Z' : ''
  return { date: `${y}-${mo}-${d}T${h}:${mi}:${s}${utc}`, allDay: false }
}

function parseICSString(icsText: string, source: EventSource, color: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const lines = icsText.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r\n|\n/)
  let inEvent = false
  let props: Record<string, string> = {}

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; props = {}; continue }
    if (line === 'END:VEVENT') {
      inEvent = false
      if (props['UID'] && props['SUMMARY'] && props['DTSTART']) {
        const start = parseICSDate(props['DTSTART'])
        const end = props['DTEND'] ? parseICSDate(props['DTEND']) : { date: start.date, allDay: start.allDay }
        events.push({
          id: `${source}-${props['UID']}`,
          title: props['SUMMARY'],
          start: start.date,
          end: end.date,
          allDay: start.allDay,
          source, color,
          description: props['DESCRIPTION'],
          recurrence: 'none',
        })
      }
      continue
    }
    if (!inEvent) continue
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const propFull = line.substring(0, colonIdx)
    const value = line.substring(colonIdx + 1)
    const semicolonIdx = propFull.indexOf(';')
    const propName = semicolonIdx !== -1 ? propFull.substring(0, semicolonIdx) : propFull
    props[propName] = value
  }
  return events
}

// ── Le composable ─────────────────────────────

export function useSubscriptions() {
  const store = useCalendarStore()
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function testSubscription(sub: Partial<CalendarSubscription>): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      if (sub.type === 'ics') {
        if (!sub.icsUrl) throw new Error('URL ICS manquante')
        const proxyUrl = buildProxyUrl(sub.icsUrl)
        const response = await fetch(proxyUrl)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Pas un fichier ICS valide')
        return true
      }
      if (sub.type === 'caldav' || sub.type === 'apple') {
        const url = sub.type === 'apple' ? 'https://caldav.icloud.com/' : sub.url!
        const username = sub.type === 'apple' ? sub.appleUsername! : sub.username!
        const password = sub.type === 'apple' ? sub.applePassword! : sub.password!
        if (!url || !username || !password) throw new Error('Credentials manquants')
        const client = await createDAVClient({
          serverUrl: url,
          credentials: { username, password },
          authMethod: 'Basic',
          defaultAccountType: 'caldav',
        })
        const calendars = await client.fetchCalendars()
        return calendars.length >= 0
      }
      if (sub.type === 'google') return true
      return false
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de connexion'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function fetchSubscriptionEvents(sub: CalendarSubscription): Promise<CalendarEvent[]> {
    if (!sub.enabled) return []
    const color = sub.color ?? SOURCE_COLORS.google
    const source = `sub_${sub.id}` as EventSource
    try {
      if (sub.type === 'ics' && sub.icsUrl) {
        const proxyUrl = buildProxyUrl(sub.icsUrl)
        const response = await fetch(proxyUrl)
        if (!response.ok) { store.updateSubscriptionStatus(sub.id, { error: `HTTP ${response.status}` }); return [] }
        const text = await response.text()
        const events = parseICSString(text, source, color)
        store.updateSubscriptionStatus(sub.id, { lastSync: new Date().toISOString(), error: undefined })
        return events
      }
      if (sub.type === 'caldav' || sub.type === 'apple') {
        const url = sub.type === 'apple' ? 'https://caldav.icloud.com/' : sub.url!
        const username = sub.type === 'apple' ? sub.appleUsername! : sub.username!
        const password = sub.type === 'apple' ? sub.applePassword! : sub.password!
        const client = await createDAVClient({
          serverUrl: url,
          credentials: { username, password },
          authMethod: 'Basic',
          defaultAccountType: 'caldav',
        })
        const calendars = await client.fetchCalendars()
        const allEvents: CalendarEvent[] = []
        for (const calendar of calendars) {
          const objects = await client.fetchCalendarObjects({ calendar })
          for (const obj of objects) {
            if (!obj.data) continue
            allEvents.push(...parseICSString(obj.data, source, color))
          }
        }
        store.updateSubscriptionStatus(sub.id, { lastSync: new Date().toISOString(), error: undefined })
        return allEvents
      }
      return []
    } catch (e) {
      store.updateSubscriptionStatus(sub.id, { error: e instanceof Error ? e.message : 'Erreur inconnue' })
      return []
    }
  }

  async function fetchAllSubscriptions(): Promise<CalendarEvent[]> {
    const allEvents: CalendarEvent[] = []
    for (const sub of store.subscriptions) {
      if (!sub.enabled) continue
      allEvents.push(...await fetchSubscriptionEvents(sub))
    }
    return allEvents
  }

  function generateVdirsyncerConfig(sub: CalendarSubscription): string {
    if (sub.type !== 'google') return ''
    const safeName = sub.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
    return `[pair ${safeName}]
a = "${safeName}_local"
b = "${safeName}_remote"
collections = ["from b"]
conflict_resolution = "b wins"

[storage ${safeName}_local]
type = "caldav"
url = "http://127.0.0.1:5232/pauline/"
username = "pauline"
password = "RADICALE_PASSWORD"

[storage ${safeName}_remote]
type = "google_calendar"
client_id = "${sub.googleClientId}"
client_secret = "${sub.googleClientSecret}"
token_file = "/var/lib/vdirsyncer/${safeName}_token.json"
redirect_uri = "urn:ietf:wg:oauth:2.0:oob"
`
  }

  return {
    isLoading, error,
    testSubscription, fetchSubscriptionEvents, fetchAllSubscriptions,
    generateVdirsyncerConfig, buildProxyUrl,
  }
}