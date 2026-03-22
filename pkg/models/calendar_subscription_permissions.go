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
	"code.vikunja.io/api/pkg/web"
	"xorm.io/xorm"
)

// CanCreate checks if a user can create a calendar subscription.
// Any authenticated user can create shared subscriptions.
func (cs *CalendarSubscription) CanCreate(s *xorm.Session, a web.Auth) (bool, error) {
	if _, is := a.(*LinkSharing); is {
		return false, ErrGenericForbidden{}
	}
	return true, nil
}

// CanRead checks if a user can read a calendar subscription.
// Any authenticated user can read shared subscriptions.
func (cs *CalendarSubscription) CanRead(s *xorm.Session, a web.Auth) (bool, int, error) {
	if _, is := a.(*LinkSharing); is {
		return false, 0, ErrGenericForbidden{}
	}
	return true, 0, nil
}

// CanUpdate checks if a user can update a calendar subscription.
// Any authenticated user can update shared subscriptions.
func (cs *CalendarSubscription) CanUpdate(s *xorm.Session, a web.Auth) (bool, error) {
	if _, is := a.(*LinkSharing); is {
		return false, ErrGenericForbidden{}
	}
	return true, nil
}

// CanDelete checks if a user can delete a calendar subscription.
// Any authenticated user can delete shared subscriptions.
func (cs *CalendarSubscription) CanDelete(s *xorm.Session, a web.Auth) (bool, error) {
	if _, is := a.(*LinkSharing); is {
		return false, ErrGenericForbidden{}
	}
	return true, nil
}

// ErrCalendarSubscriptionNotFound is returned when a calendar subscription is not found.
type ErrCalendarSubscriptionNotFound struct {
	ID int64
}

func (e ErrCalendarSubscriptionNotFound) Error() string {
	return "calendar subscription not found"
}

// ErrCodeCalendarSubscriptionNotFound is the error code for ErrCalendarSubscriptionNotFound.
const ErrCodeCalendarSubscriptionNotFound = 15001

func (e ErrCalendarSubscriptionNotFound) HTTPError() web.HTTPError {
	return web.HTTPError{
		HTTPCode: 404,
		Code:     ErrCodeCalendarSubscriptionNotFound,
		Message:  "This calendar subscription does not exist.",
	}
}
