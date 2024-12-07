import {DateTime, IANAZone} from 'luxon';
import {luxonIANAZonesByProfile as timezones} from '../lib/luxon-timezones.js';

// todo: change to `(profile) => (when) => {}`
const formatTime = (profile, when, includeOffset = false) => {
	let timezone;
	if (timezones.has(profile)) {
		timezone = timezones.get(profile);
	} else {
		timezone = new IANAZone(profile.timezone);
		timezones.set(profile, timezone);
	}

	return DateTime
		.fromMillis(Number(when), {
			locale: profile.locale,
			zone: timezone,
		})
		.startOf('second')
		.toISO({ includeOffset: includeOffset, suppressMilliseconds: true })
};

export {
	formatTime,
};
