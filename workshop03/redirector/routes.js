import { Router } from "express";
import db from "../lib/db.js";
import { logger } from "../lib/logger.js";
import redis from "../lib/redis.js";
import { geolocate } from "./geo.js";
import { cacheRatioGauge, cacheCountCounter, restApiDurationHistogram, httpRequestInFlightUpdownCounter } from './metrics.js'

import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { ATTR_DB_COLLECTION_NAME, ATTR_DB_QUERY_TEXT, ATTR_HTTP_RESPONSE_STATUS_CODE, ATTR_URL_PATH } from "@opentelemetry/semantic-conventions";

import metadata from '../package.json' with { type: 'json' }

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || metadata.name
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION || metadata.version

function injectError(errorProb = 0.3) {
  if (Math.random() <= errorProb)
    throw new Error('This is an injected error')
}

const router = Router();
const tracer = trace.getTracer(SERVICE_NAME, SERVICE_VERSION)

// Cache statistics
let hit = 0
let totalLookup = 0

// Metric: Hit ratio

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.get("/resolve/:code", async (req, res) => {
	const { code } = req.params;

  // Metric: Inflight request

  tracer.startActiveSpan('Resolve shortener code', { kind: SpanKind.SERVER },
    async (span0) => {

      try {
        totalLookup++
        const cached = await redis.get(`url:${code}`);

        span0.setAttributes({
          [ ATTR_URL_PATH ]: "/resolve/:code",
          'cache.hit': !!cached
        })
        logger.debug({ 'cache.hit': !!cached, code }, `Lookup ${code}`)

        let originalUrl;
        
        // Metric: Hit counter

        if (cached) {
          hit++
          originalUrl = cached;
        } else {
          const result = await db.query(
            "SELECT original_url FROM urls WHERE short_code = $1",
            [code],
          );

          injectError()

          span0.setAttributes({
            [ ATTR_DB_COLLECTION_NAME ]: 'urls',
            [ ATTR_DB_QUERY_TEXT ]: "SELECT original_url FROM urls WHERE short_code = $1",
            'code.exists': result.rows.length > 0
          })

          if (result.rows.length === 0) {
            
            logger.error({ [ ATTR_HTTP_RESPONSE_STATUS_CODE ]: 404 }, 'Short URL not found')
            return res.status(404).json({ error: "Short URL not found" });
          }

          originalUrl = result.rows[0].original_url;

          await redis.set(`url:${code}`, originalUrl, { EX: 86400 });

          span0.addEvent('Update cache', {  
            'code': code
          })

          logger.info({ code }, `Update cache ${code}`)
        }

        await recordVisit(req, code);

        res.json({ original_url: originalUrl });

        span0.setStatus({ code: SpanStatusCode.OK })

      } catch (err) {
        span0.setStatus({ code: SpanStatusCode.ERROR, message: JSON.stringify(err) })
        span0.recordException(err)

        logger.error({ err }, "Resolve failed");
        res.status(500).json({ error: "Internal server error" });
      } 
      finally {
        span0.end()
      }

    }
  )
});

async function recordVisit(req, shortCode) {
	const ip = req.get("x-forwarded-for") || req.ip || req.socket.remoteAddress;
	const userAgent = req.get("user-agent") || "unknown";

  const startTime = Date.now()
  let resolved = true

	try {
		const geo = await geolocate(ip);

		await db.query(
			`INSERT INTO visits (short_code, ip_address, country, city, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
			[shortCode, ip, geo.country, geo.city, userAgent],
		);
	} catch (err) {
		logger.error({ err }, "Failed to record visit");
    resolved = false
	} finally {
    // Metric: REST endpoint duration
    
  }
}

export default router;
