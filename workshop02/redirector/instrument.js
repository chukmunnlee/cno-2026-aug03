// Instrumentation
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('@opentelemetry/instrumentation/hook.mjs', pathToFileURL('./'))

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

// Traces
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'

const OTEL_EXPORTER_OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

// Trace
const otlpTraceExporter = new OTLPTraceExporter({
  url: OTEL_EXPORTER_OTLP_ENDPOINT,
})
const batchSpanProcessor = new BatchSpanProcessor(otlpTraceExporter)

const sdk = new NodeSDK({
  spanProcessors: [ batchSpanProcessor ],
  instrumentations: getNodeAutoInstrumentations()
})

sdk.start()

// incorrect - hoisting
//import { logger, logFile } from '../lib/logger.js'
const { logger, logFile } = await import('../lib/logger.js')

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(async () => {
      logFile.flushSync();
      logger.info('Instrumentation terminated');
    })
    .finally(() => process.exit(0))
})

logger.info('Instrumentation started')
