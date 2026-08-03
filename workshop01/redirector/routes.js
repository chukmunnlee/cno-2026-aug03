import { Router } from "express";
import db from "../lib/db.js";
import { logger } from "../lib/logger.js";
import redis from "../lib/redis.js";
import { geolocate } from "./geo.js";

import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api'
import { ATTR_DB_COLLECTION_NAME, ATTR_DB_QUERY_TEXT, ATTR_URL_PATH } from "@opentelemetry/semantic-conventions";

import metadata from '../package.json' with { type: 'json' }

function injectError(errorProb = 0.3) {
  if (Math.random() <= errorProb)
    throw new Error('This is an injected error')
}

const router = Router();
//const tracer = trace.getTracer(metadata.name, metadata.version)
const tracer = trace.getTracer('shortener', 'workshop01')

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.get("/resolve/:code", async (req, res) => {
	const { code } = req.params;

  tracer.startActiveSpan('Resolve shortner code', { kind: SpanKind.SERVER }, 
      async (span) => {
        // start of work
        try {
          const cached = await redis.get(`urls:${code}`);

          // Add attributes
          span.setAttributes({
            [ ATTR_URL_PATH ]: '/resolve/:code',
            'cache.hit': !!cached
          })

          let originalUrl;

          if (cached) {
            originalUrl = cached;
          } else {

            const result = await db.query(
              "SELECT original_url FROM urls WHERE short_code = $1",
              [code],
            );
            injectError()
            if (result.rows.length === 0) {
              return res.status(404).json({ error: "Short URL not found" });
            }
            originalUrl = result.rows[0].original_url;
            // add more attributes
            span.setAttributes({
              [ ATTR_DB_COLLECTION_NAME ]: 'urls',
              [ ATTR_DB_QUERY_TEXT ]: "SELECT original_url FROM urls WHERE short_code = $1"
            })
            await redis.set(`urls:${code}`, originalUrl, { EX: 86400 });
            // record an event
            span.addEvent('Cache updated', { code: code })
          }

          await recordVisit(req, code);
          res.json({ original_url: originalUrl });
          // mark span as successful
          span.setStatus(SpanStatusCode.OK)

        } catch (err) {
          // Record the exception event
          span.recordException(err)
          // mark the span as error because of the exception
          span.setStatus(SpanStatusCode.ERROR)
          logger.error({ err }, "Resolve failed");
          res.status(500).json({ error: "Internal server error" });

        } finally {  
          // end the span
          span.end() 
        }
      } // close the span function
  ) // close the startActiveSpan
});

async function recordVisit(req, shortCode) {
	const ip = req.get("x-forwarded-for") || req.ip || req.socket.remoteAddress;
	const userAgent = req.get("user-agent") || "unknown";

	try {
		const geo = await geolocate(ip);

		await db.query(
			`INSERT INTO visits (short_code, ip_address, country, city, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
			[shortCode, ip, geo.country, geo.city, userAgent],
		);
	} catch (err) {
		logger.error({ err }, "Failed to record visit");
	}
}

export default router;
