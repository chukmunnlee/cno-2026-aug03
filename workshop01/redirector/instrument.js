import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

// register the hook
register('@opentelemetry/instrumentation/hook.mjs', pathToFileURL('./'))

import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { resourceFromAttributes } from '@opentelemetry/resources'

// Traces
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'

import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { logger } from '../lib/logger.js'
import metadata from '../package.json' with { type: 'json' }

const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

// Create the NodeSDK and enable library instrumentation
const sdk = new NodeSDK({
   instrumentations: getNodeAutoInstrumentations()
})

// Stop the SDK
process.on('SIGTERM', () => {
   sdk.shutdown()
   logger.info("Instrumentation stopped")
})

// Start the SDK
logger.info("Instrumentation started")
sdk.start()