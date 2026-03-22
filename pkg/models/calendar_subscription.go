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

package models

import (
	"time"

	"code.vikunja.io/api/pkg/config"
	"code.vikunja.io/api/pkg/utils"
	"code.vikunja.io/api/pkg/web"

	"xorm.io/xorm"
)

// CalendarSubscriptionType represents the type of an external calendar subscription.
type CalendarSubscriptionType string

const (
	CalendarSubscriptionTypeICS    CalendarSubscriptionType = "ics"
	CalendarSubscriptionTypeCalDAV CalendarSubscriptionType = "caldav"
	CalendarSubscriptionTypeApple  CalendarSubscriptionType = "apple"
)

// CalendarSubscription represents a shared external calendar subscription.
// Credentials are stored encrypted using AES-256-GCM.
// @Summary Shared external calendar subscription
type CalendarSubscription struct {
	// The unique, numeric id of this subscription.
	ID int64 `xorm:"bigint autoincr not null unique pk" json:"id" param:"id"`

	// A human-readable name for this subscription.
	Name string `xorm:"varchar(250) not null" json:"name" valid:"required"`

	// The type of calendar: ics, caldav or apple.
	Type CalendarSubscriptionType `xorm:"varchar(50) not null" json:"type" valid:"required"`

	// A hex color code for display in the calendar.
	Color string `xorm:"varchar(7)" json:"color"`

	// The URL of the calendar (ICS URL for ics type, CalDAV URL for caldav/apple types).
	URL string `xorm:"text" json:"url,omitempty"`

	// Username for CalDAV/Apple authentication (write-only, never returned in GET responses).
	Username string `xorm:"-" json:"username,omitempty"`

	// Password for CalDAV/Apple authentication (write-only, never returned in GET responses).
	Password string `xorm:"-" json:"password,omitempty"`

	// Encrypted username stored in database.
	UsernameEnc []byte `xorm:"blob" json:"-"`

	// Encrypted password stored in database.
	PasswordEnc []byte `xorm:"blob" json:"-"`

	// A timestamp when this subscription was created.
	Created time.Time `xorm:"created not null" json:"created"`

	// A timestamp when this subscription was last updated.
	Updated time.Time `xorm:"updated not null" json:"updated"`

	// The ID of the user who created this subscription.
	CreatedByID int64 `xorm:"bigint not null" json:"created_by_id"`

	web.CRUDable `xorm:"-" json:"-"`
	web.Permissions `xorm:"-" json:"-"`
}

func (*CalendarSubscription) TableName() string {
	return "calendar_subscriptions"
}

func calendarEncryptionKey() ([]byte, error) {
	secret := config.ServiceJWTSecret.GetString()
	return utils.DeriveEncryptionKey(secret, "calendar_subscription_credentials")
}

func (cs *CalendarSubscription) encryptCredentials() error {
	key, err := calendarEncryptionKey()
	if err != nil {
		return err
	}

	if cs.Username != "" {
		cs.UsernameEnc, err = utils.EncryptAES256GCM(key, cs.Username)
		if err != nil {
			return err
		}
	}

	if cs.Password != "" {
		cs.PasswordEnc, err = utils.EncryptAES256GCM(key, cs.Password)
		if err != nil {
			return err
		}
	}

	return nil
}

// DecryptCredentials decrypts the stored credentials into Username and Password fields.
// This should only be called server-side when fetching calendar events.
func (cs *CalendarSubscription) DecryptCredentials() error {
	if len(cs.UsernameEnc) == 0 && len(cs.PasswordEnc) == 0 {
		return nil
	}

	key, err := calendarEncryptionKey()
	if err != nil {
		return err
	}

	if len(cs.UsernameEnc) > 0 {
		cs.Username, err = utils.DecryptAES256GCM(key, cs.UsernameEnc)
		if err != nil {
			return err
		}
	}

	if len(cs.PasswordEnc) > 0 {
		cs.Password, err = utils.DecryptAES256GCM(key, cs.PasswordEnc)
		if err != nil {
			return err
		}
	}

	return nil
}

// ReadAll returns all calendar subscriptions.
// @Summary Get all shared calendar subscriptions
// @Description Returns all shared calendar subscriptions. Credentials are never included in the response.
// @tags calendar
// @Accept json
// @Produce json
// @Security JWTKeyAuth
// @Success 200 {array} models.CalendarSubscription "The list of all subscriptions"
// @Failure 500 {object} models.Message "Internal server error"
// @Router /calendar-subscriptions [get]
func (cs *CalendarSubscription) ReadAll(s *xorm.Session, a web.Auth, search string, page int, perPage int) (result interface{}, resultCount int, numberOfTotalItems int64, err error) {
	subs := []*CalendarSubscription{}
	err = s.Find(&subs)
	if err != nil {
		return nil, 0, 0, err
	}

	// Never return credentials
	for _, sub := range subs {
		sub.Username = ""
		sub.Password = ""
		sub.UsernameEnc = nil
		sub.PasswordEnc = nil
	}

	total, err := s.Count(&CalendarSubscription{})
	return subs, len(subs), total, err
}

// Create creates a new calendar subscription.
// @Summary Create a new shared calendar subscription
// @tags calendar
// @Accept json
// @Produce json
// @Security JWTKeyAuth
// @Success 201 {object} models.CalendarSubscription "The created subscription"
// @Failure 400 {object} web.HTTPError "Invalid data"
// @Failure 500 {object} models.Message "Internal server error"
// @Router /calendar-subscriptions [put]
func (cs *CalendarSubscription) Create(s *xorm.Session, a web.Auth) error {
	cs.ID = 0
	cs.CreatedByID = a.GetID()

	if err := cs.encryptCredentials(); err != nil {
		return err
	}

	_, err := s.Insert(cs)
	if err != nil {
		return err
	}

	// Don't return credentials
	cs.Username = ""
	cs.Password = ""
	cs.UsernameEnc = nil
	cs.PasswordEnc = nil

	return nil
}

// Update updates an existing calendar subscription.
// @Summary Update a shared calendar subscription
// @tags calendar
// @Accept json
// @Produce json
// @Security JWTKeyAuth
// @Param id path int true "Subscription ID"
// @Success 200 {object} models.CalendarSubscription "The updated subscription"
// @Failure 400 {object} web.HTTPError "Invalid data"
// @Failure 404 {object} web.HTTPError "Subscription not found"
// @Failure 500 {object} models.Message "Internal server error"
// @Router /calendar-subscriptions/{id} [post]
func (cs *CalendarSubscription) Update(s *xorm.Session, a web.Auth) error {
	existing := &CalendarSubscription{}
	exists, err := s.Where("id = ?", cs.ID).Get(existing)
	if err != nil {
		return err
	}
	if !exists {
		return ErrCalendarSubscriptionNotFound{ID: cs.ID}
	}

	existing.Name = cs.Name
	existing.Type = cs.Type
	existing.Color = cs.Color
	existing.URL = cs.URL

	// Only update credentials if new values were provided
	if cs.Username != "" {
		existing.Username = cs.Username
		existing.Password = cs.Password
		if err := existing.encryptCredentials(); err != nil {
			return err
		}
	}

	_, err = s.Where("id = ?", cs.ID).
		Cols("name", "type", "color", "url", "username_enc", "password_enc", "updated").
		Update(existing)
	if err != nil {
		return err
	}

	cs.UsernameEnc = nil
	cs.PasswordEnc = nil
	cs.Username = ""
	cs.Password = ""

	return nil
}

// Delete deletes a calendar subscription.
// @Summary Delete a shared calendar subscription
// @tags calendar
// @Accept json
// @Produce json
// @Security JWTKeyAuth
// @Param id path int true "Subscription ID"
// @Success 200 {object} models.Message "Successfully deleted"
// @Failure 404 {object} web.HTTPError "Subscription not found"
// @Failure 500 {object} models.Message "Internal server error"
// @Router /calendar-subscriptions/{id} [delete]
func (cs *CalendarSubscription) Delete(s *xorm.Session, a web.Auth) error {
	_, err := s.Where("id = ?", cs.ID).Delete(&CalendarSubscription{})
	return err
}

// GetCalendarSubscriptionByID returns a subscription by its ID with decrypted credentials.
// This is for internal server use only when fetching calendar events.
func GetCalendarSubscriptionByID(s *xorm.Session, id int64) (*CalendarSubscription, error) {
	cs := &CalendarSubscription{}
	exists, err := s.Where("id = ?", id).Get(cs)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrCalendarSubscriptionNotFound{ID: id}
	}
	return cs, nil
}
