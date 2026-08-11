import {stringify} from 'qs';
import {parse as parseContentType} from 'content-type';
import {HafasError} from './errors.js';

const proxyAddress = typeof process !== 'undefined' && (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) || null;
const isBrowserLikeRuntime = () => typeof window !== 'undefined' && typeof document !== 'undefined';

let nodeFetchPromise;
const getNodeFetch = async () => {
	if (!nodeFetchPromise) {
		nodeFetchPromise = import('wreq-js')
			.then(({fetch}) => fetch)
			.catch((error) => {
				throw new Error('Failed to load wreq-js. Use Node.js 20+ or a browser-like runtime.', {cause: error});
			});
	}
	return await nodeFetchPromise;
};

const getNodeTransportOptions = (endpoint) => {
	const host = new URL(endpoint).host;
	const transportOptions = {
		browser: 'chrome',
		os: 'windows',
		disableDefaultHeaders: true,
	};
	if (proxyAddress) {
		transportOptions.proxy = proxyAddress;
	}
	return transportOptions;
};

const randomBytesHexString = length => [...Array(length)].map(() => Math.floor(Math.random() * 16)
	.toString(16))
	.join('');

const id = randomBytesHexString(6)
	.toString('hex');
const randomizeUserAgent = (userAgent) => {
	let ua = userAgent;
	for (
		let i = Math.round(5 + Math.random() * 5);
		i < ua.length;
		i += Math.round(5 + Math.random() * 5)
	) {
		ua = ua.slice(0, i) + id + ua.slice(i);
		i += id.length;
	}
	return ua;
};

const checkIfResponseIsOk = (_) => {
	const {
		body,
		errProps: baseErrProps,
	} = _;

	const errProps = {
		...baseErrProps,
	};
	if (body.id) {
		errProps.hafasResponseId = body.id;
	}

	// Because we want more accurate stack traces, we don't construct the error here,
	// but only return the constructor & error message.
	const getError = (_) => {
		// mutating here is ugly but pragmatic
		if (_.fehlerNachricht.ueberschrift) {
			errProps.hafasMessage = _.fehlerNachricht.ueberschrift;
		}
		if (_.fehlerNachricht.text) {
			errProps.hafasDescription = _.fehlerNachricht.text;
		}
		return {
			Error: HafasError,
			message: errProps.hafasMessage || 'unknown error',
			props: {code: _.fehlerNachricht.code},
		};
	};

	if (body.fehlerNachricht || body.errors) { // TODO better handling
		const {Error: HafasError, message, props} = getError(body);
		throw new HafasError(message, body.err || body.errors, {...errProps, ...props});
	}
};

const request = async (ctx, userAgent, reqData) => {
	const {profile, opt} = ctx;

	const endpoint = reqData.endpoint;
	delete reqData.endpoint;
	const rawReqBody = profile.transformReqBody(ctx, reqData.body);

	const reqOptions = profile.transformReq(ctx, {
		keepalive: true,
		method: reqData.method,
		// todo: CORS? referrer policy?
		body: JSON.stringify(rawReqBody),
		headers: {
			'Content-Type': 'application/json',
			// 'Accept-Encoding': 'gzip, deflate, br, zstd',
			'Accept': 'application/json',
			'Accept-Language': opt.language || profile.defaultLanguage || 'en',
			'user-agent': profile.randomizeUserAgent
				? randomizeUserAgent(userAgent)
				: userAgent,
			...reqData.headers,
		},
		redirect: 'follow',
		query: reqData.query,
	});

	let url = endpoint + (reqData.path || '');
	if (reqOptions.query) {
		url += '?' + stringify(reqOptions.query, {arrayFormat: 'brackets', encodeValuesOnly: true});
	}
	delete reqOptions.query;

	const fetchReq = new Request(url, reqOptions);
	if (!isBrowserLikeRuntime()) {
		Object.assign(reqOptions, getNodeTransportOptions(endpoint));
	}

	const reqId = randomBytesHexString(6);
	profile.logRequest(ctx, fetchReq, reqId);

	const fetch = isBrowserLikeRuntime() ? globalThis.fetch : await getNodeFetch();
	const res = await fetch(url, reqOptions);

	const errProps = {
		// todo [breaking]: assign as non-enumerable property
		request: fetchReq,
		// todo [breaking]: assign as non-enumerable property
		response: res,
		url,
	};

	if (!res.ok) {
		// todo [breaking]: make this a FetchError or a HafasClientError?
		console.log(JSON.stringify(res), await res.text());
		const err = new Error(res.statusText);
		Object.assign(err, errProps);
		throw err;
	}

	let cType = res.headers.get('content-type');
	if (cType) {
		const {type} = parseContentType(cType);
		// For some reason, the reqOptions.headers object is sometimes a plain object
		// and sometimes a Headers object (In browser env). For the latter, .get() must
		// be used.
		if (type !== reqOptions.headers['Accept'] && type !== reqOptions.headers.get('Accept')) {
			throw new HafasError('invalid/unsupported response content-type: ' + cType, null, errProps);
		}
	}

	const body = await res.text();
	profile.logResponse(ctx, res, body, reqId);

	const b = JSON.parse(body);
	checkIfResponseIsOk({
		body: b,
		errProps,
	});
	return {
		res: b,
		common: {},
	};
};

export {
	checkIfResponseIsOk,
	request,
};
