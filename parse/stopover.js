const parseStopover = (ctx, st, date) => { // st = raw stopover
	const {profile, opt} = ctx;

	const cancelled = profile.parseCancelled(st);
	const arr = profile.parseWhen(ctx, date, st.ankunftsZeitpunkt || st.ankunftsDatum || st.ankunft?.sollzeit || st.arrivalTime?.target, st.ezAnkunftsZeitpunkt || st.ezAnkunftsDatum || st.ankunft?.echtzeit || st.arrivalTime?.timeType != 'SCHEDULE' && st.arrivalTime?.predicted, cancelled,
	);
	const arrPl = profile.parsePlatform(ctx, st.gleis || st.track?.target, st.ezGleis || st.track?.prediction);
	const dep = profile.parseWhen(ctx, date, st.abfahrtsZeitpunkt || st.abgangsDatum || st.abfahrt?.sollzeit || st.departureTime?.target, st.ezAbfahrtsZeitpunkt || st.ezAbgangsDatum || st.abfahrt?.echtzeit || st.departureTime?.timeType != 'SCHEDULE' && st.departureTime?.predicted, cancelled,
	);
	const depPl = arrPl;

	const res = {
		stop: profile.parseLocation(ctx, st.ort || st.station || st) || null,
		arrival: arr.when,
		plannedArrival: arr.plannedWhen,
		arrivalDelay: arr.delay,
		arrivalPlatform: arrPl.platform,
		arrivalPrognosisType: null, // TODO
		plannedArrivalPlatform: arrPl.plannedPlatform,
		departure: dep.when,
		plannedDeparture: dep.plannedWhen,
		departureDelay: dep.delay,
		departurePlatform: depPl.platform,
		departurePrognosisType: null, // TODO
		plannedDeparturePlatform: depPl.plannedPlatform,
	};

	if (arr.prognosedWhen) {
		res.prognosedArrival = arr.prognosedWhen;
	}
	if (arrPl.prognosedPlatform) {
		res.prognosedArrivalPlatform = arrPl.prognosedPlatform;
	}
	if (dep.prognosedWhen) {
		res.prognosedDeparture = dep.prognosedWhen;
	}
	if (depPl.prognosedPlatform) {
		res.prognosedDeparturePlatform = depPl.prognosedPlatform;
	}

	const load = profile.parseLoadFactor(opt, st.auslastungsmeldungen || st.auslastungsInfos);
	if (load) {
		res.loadFactor = load;
	}
	// mark stations the train passes without stopping
	// TODO risNotizen key text.realtime.stop.exit.disabled?

	if (cancelled) {
		res.cancelled = true;
		Object.defineProperty(res, 'canceled', {value: true});
	}

	// TODO res.additional = true;

	if (opt.remarks) {
		res.remarks = profile.parseRemarks(ctx, st);
	}

	return res;
};

export {
	parseStopover,
};
