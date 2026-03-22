// Vikunja is a to-do list application to facilitate your life.
// Copyright 2018-present Vikunja and contributors. All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package v1

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"code.vikunja.io/api/pkg/db"
	"code.vikunja.io/api/pkg/models"
	ics "github.com/arran4/golang-ical"
	"github.com/labstack/echo/v5"
)

// CalendarEvent represents a calendar event returned to the frontend.
type CalendarEvent struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Start       string `json:"start"`
	End         string `json:"end"`
	AllDay      bool   `json:"allDay"`
	Description string `json:"description,omitempty"`
	SourceID    int64  `json:"sourceId"`
}

// GetCalendarSubscriptionEvents fetches events from an external calendar subscription server-side.
// @Summary Get events from a shared calendar subscription
// @Description Fetches calendar events from an external ICS or CalDAV source server-side. Credentials are never exposed to the client.
// @tags calendar
// @Accept json
// @Produce json
// @Security JWTKeyAuth
// @Param id path int true "Subscription ID"
// @Success 200 {array} v1.CalendarEvent "List of calendar events"
// @Failure 400 {object} web.HTTPError "Invalid subscription ID"
// @Failure 404 {object} web.HTTPError "Subscription not found"
// @Failure 500 {object} models.Message "Internal server error"
// @Router /calendar-subscriptions/{id}/events [get]
func GetCalendarSubscriptionEvents(c *echo.Context) error {
	idParam := c.Param("id")
	id, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		return echo.ErrBadRequest
	}

	s := db.NewSession()
	defer s.Close()

	sub, err := models.GetCalendarSubscriptionByID(s, id)
	if err != nil {
		return err
	}

	if err := sub.DecryptCredentials(); err != nil {
		return fmt.Errorf("failed to decrypt credentials: %w", err)
	}

	var events []CalendarEvent

	switch sub.Type {
	case models.CalendarSubscriptionTypeICS:
		events, err = fetchICSEvents(sub)
	case models.CalendarSubscriptionTypeCalDAV, models.CalendarSubscriptionTypeApple:
		events, err = fetchCalDAVEvents(sub)
	default:
		return fmt.Errorf("unsupported subscription type: %s", sub.Type)
	}

	if err != nil {
		return fmt.Errorf("failed to fetch events: %w", err)
	}

	return c.JSON(http.StatusOK, events)
}

func fetchICSEvents(sub *models.CalendarSubscription) ([]CalendarEvent, error) {
	client := &http.Client{Timeout: 30 * time.Second}

	req, err := http.NewRequest(http.MethodGet, sub.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	if sub.Username != "" && sub.Password != "" {
		req.SetBasicAuth(sub.Username, sub.Password)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024)) // 10 MB limit
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	return parseICSData(string(body), sub.ID)
}

func fetchCalDAVEvents(sub *models.CalendarSubscription) ([]CalendarEvent, error) {
	calURL := sub.URL
	if sub.Type == models.CalendarSubscriptionTypeApple {
		calURL = "https://caldav.icloud.com/"
	}

	// CalDAV REPORT request to fetch all calendar objects
	reportBody := `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-data/>
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT"/>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`

	client := &http.Client{Timeout: 60 * time.Second}

	req, err := http.NewRequest("REPORT", calURL, strings.NewReader(reportBody))
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	req.Header.Set("Content-Type", "application/xml; charset=utf-8")
	req.Header.Set("Depth", "1")

	if sub.Username != "" {
		credentials := base64.StdEncoding.EncodeToString([]byte(sub.Username + ":" + sub.Password))
		req.Header.Set("Authorization", "Basic "+credentials)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CalDAV request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusMultiStatus && resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("CalDAV server returned HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed to read CalDAV response: %w", err)
	}

	// Extract calendar-data elements from the XML response
	return extractEventsFromDAVResponse(string(body), sub.ID)
}

func extractEventsFromDAVResponse(xmlBody string, sourceID int64) ([]CalendarEvent, error) {
	var allEvents []CalendarEvent

	// Extract all <cal:calendar-data> or <C:calendar-data> blocks
	lower := strings.ToLower(xmlBody)
	searchTag := "calendar-data>"
	pos := 0
	for {
		start := strings.Index(lower[pos:], searchTag)
		if start == -1 {
			break
		}
		start += pos + len(searchTag)

		// Find the end tag
		end := strings.Index(lower[start:], "</")
		if end == -1 {
			break
		}
		end += start

		icsData := xmlBody[start:end]
		icsData = strings.TrimSpace(icsData)

		if strings.Contains(strings.ToUpper(icsData), "BEGIN:VCALENDAR") {
			events, err := parseICSData(icsData, sourceID)
			if err == nil {
				allEvents = append(allEvents, events...)
			}
		}

		pos = end
	}

	return allEvents, nil
}

func parseICSData(icsData string, sourceID int64) ([]CalendarEvent, error) {
	cal, err := ics.ParseCalendar(strings.NewReader(icsData))
	if err != nil {
		return nil, err
	}

	var events []CalendarEvent
	for _, component := range cal.Components {
		event, ok := component.(*ics.VEvent)
		if !ok {
			continue
		}

		uid := event.GetProperty(ics.ComponentPropertyUniqueId)
		summary := event.GetProperty(ics.ComponentPropertySummary)
		dtStart := event.GetProperty(ics.ComponentPropertyDtStart)
		dtEnd := event.GetProperty(ics.ComponentPropertyDtEnd)
		description := event.GetProperty(ics.ComponentPropertyDescription)

		if uid == nil || summary == nil || dtStart == nil {
			continue
		}

		startStr, allDay := formatICSDate(dtStart.Value)
		endStr := startStr
		if dtEnd != nil {
			endStr, _ = formatICSDate(dtEnd.Value)
		}

		descStr := ""
		if description != nil {
			descStr = description.Value
		}

		events = append(events, CalendarEvent{
			ID:          fmt.Sprintf("sub_%d_%s", sourceID, uid.Value),
			Title:       summary.Value,
			Start:       startStr,
			End:         endStr,
			AllDay:      allDay,
			Description: descStr,
			SourceID:    sourceID,
		})
	}

	return events, nil
}

// formatICSDate converts an ICS date string to ISO 8601 format.
// Returns (isoDatetime, isAllDay).
func formatICSDate(value string) (string, bool) {
	// Remove TZID parameter if present (e.g., "TZID=Europe/Paris:20260315T100000")
	if idx := strings.LastIndex(value, ":"); idx != -1 {
		value = value[idx+1:]
	}

	value = strings.TrimSuffix(value, "Z")

	if len(value) == 8 {
		// All-day: YYYYMMDD
		return fmt.Sprintf("%s-%s-%s", value[0:4], value[4:6], value[6:8]), true
	}

	if len(value) >= 15 {
		// Datetime: YYYYMMDDTHHMMSS
		return fmt.Sprintf("%s-%s-%sT%s:%s:%s",
			value[0:4], value[4:6], value[6:8],
			value[9:11], value[11:13], value[13:15],
		), false
	}

	return value, false
}
