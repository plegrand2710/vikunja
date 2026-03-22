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

package migration

import (
	"src.techknowlogick.com/xormigrate"
	"xorm.io/xorm"
)

type calendarSubscription20260322 struct {
	ID            int64  `xorm:"bigint autoincr not null unique pk"`
	Name          string `xorm:"varchar(250) not null"`
	Type          string `xorm:"varchar(50) not null"`
	Color         string `xorm:"varchar(7)"`
	URL           string `xorm:"text"`
	UsernameEnc   []byte `xorm:"blob"`
	PasswordEnc   []byte `xorm:"blob"`
	Created       int64  `xorm:"created not null"`
	Updated       int64  `xorm:"updated not null"`
	CreatedByID   int64  `xorm:"bigint not null"`
}

func (calendarSubscription20260322) TableName() string {
	return "calendar_subscriptions"
}

func init() {
	migrations = append(migrations, &xormigrate.Migration{
		ID:          "20260322000001",
		Description: "Add calendar_subscriptions table for shared external calendar subscriptions",
		Migrate: func(tx *xorm.Engine) error {
			return tx.Sync2(calendarSubscription20260322{})
		},
		Rollback: func(tx *xorm.Engine) error {
			return tx.DropTables(calendarSubscription20260322{})
		},
	})
}
