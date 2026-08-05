import { metrics } from '@opentelemetry/api'

import metadata from '../package.json' with { type: 'json' }

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || metadata.name
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || metadata.version

const CACHE_COUNT = 'cache.count'
const HTTP_REQUEST_IN_FLIGHT = 'http.request.in.flight'
const REST_API_DURATION = 'rest.api.duration'
const CACHE_HIT_RATIO = 'cache.hit.ratio'

// get provider to create metric
const meter = metrics.getMeter(SERVICE_NAME, SERVICE_VERSION)

// counter
export const cacheCountCounter = meter.createCounter(
   CACHE_COUNT, {
      description: 'URL short code cache lookup result count',
      unit: 'int'
})
// updown counter
export const httpRequestInFlightUpdownCounter = meter.createUpDownCounter(
   HTTP_REQUEST_IN_FLIGHT, {
      description: 'Total number of request being served',
      unit: 'int'
   }
)
// histogram
export const restApiDurationHistogram = meter.createHistogram(
   REST_API_DURATION, {
      description: 'Duration of the recordVisit operation include geolocation and database operations',
      unit: 'ms'
   }
)
// gauge
export const cacheRatioGauge = meter.createObservableGauge(
   CACHE_HIT_RATIO, {
      description: 'Rolling ratio of URL short code lookups hits',
      unit: '1'
   }
)
