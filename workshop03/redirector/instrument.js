// Instrumentation
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register('@opentelemetry/instrumentation/hook.mjs', pathToFileURL('./'))

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

// TODO: Configure Instrumentation for Node
const sdk = new NodeSDK({
  instrumentations: getNodeAutoInstrumentations()
})

sdk.start()

// IMPORTANT! Only import logger after NodeSDK is started
// Must use await. If use static import, then will be hosited
// logger will be loaded before NodeSDK starts
const { logFile, logger } = await import('../lib/logger.js');

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(async () => {
      logFile.flushSync();
      logger.info('Instrumentation terminated');
    })
    .finally(() => process.exit(0))
})

logger.info('Instrumentation started')
