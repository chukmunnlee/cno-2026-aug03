import { metrics } from '@opentelemetry/api'

import metadata from '../package.json' with { type: 'json' }

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || metadata.name
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || metadata.version

const CACHE_COUNT = 'cache.count'
const HTTP_REQUEST_IN_FLIGHT = 'http.request.in.flight'
const REST_API_DURATION = 'rest.api.duration'
const CACHE_HIT_RATIO = 'cache.hit.ratio'

export const cacheCountCounter = null

export const httpRequestInFlightUpdownCounter = null

export const restApiDurationHistogram = null

export const cacheRatioGauge = null
