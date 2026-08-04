import pino from "pino";
import { dirname, basename } from 'node:path'

const serviceName = process.env.OTEL_SERVICE_NAME || basename(dirname(process.argv[1]))
const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0-dev'
const cloudRegion = process.env.CLOUD_REGION || 'none'

export const logFile = pino.destination({
  dest: `./logs/${serviceName}.log`,
  mkdir: true,
  append: false,
  sync: false
})

export const config = {
  level: process.env.LOG_LEVEL || 'debug',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    'service.name': serviceName,
    'service.version': serviceVersion,
    'cloud_region': cloudRegion
  }
}

export const logger = pino(config, logFile)

