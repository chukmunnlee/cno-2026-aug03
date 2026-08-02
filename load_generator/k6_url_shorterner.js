import http from 'k6/http'
import { sleep, check } from 'k6'
import { SharedArray } from 'k6/data'
import faker from 'k6/x/faker'
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

const API_SHORTEN = 'api/shorten'
const SHORTERNER_URL = __ENV.SHORTERNER_URL || 'http://localhost:5000'
const LOAD_DURATION = __ENV.LOAD_DURATION || '1m'
const MAX_SLEEP = parseInt(__ENV.MAX_SLEEP) || 5
const VUS_COUNT = parseInt(__ENV.VUS_COUNT) || 1
const ERROR_RATE = parseFloat(__ENV.ERROR_RATE) || 0.3

const REAL_URLS = new SharedArray('real_urls', function() {
  return JSON.parse(open('./real_urls.json'))
})

function generateRandomCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomIndex);
  }
  return result;
}

function randomUrl() {
  if (Math.random() <= .2)
    return faker.internet.url()
  return REAL_URLS[randomIntBetween(0, REAL_URLS.length)]
}

function randomCode(codes) {
  if (Math.random() <= .3)
    return generateRandomCode()
  const idx = randomIntBetween(0, codes.length)
  return codes[idx]
}


function shortenURL(url) {
  const params = { 
    headers: { 
      'Content-Type': 'application/json',
      'X-Forwarded-For': faker.internet.ipv4Address(),
      'User-Agent': faker.internet.userAgent()
    } 
  }
  return http.post(`${SHORTERNER_URL}/${API_SHORTEN}`, JSON.stringify({ url }), params)
}

function redirect(code) {
  const params = { 
    headers: { 
      'X-Forwarded-For': faker.internet.ipv4Address(),
      'User-Agent': faker.internet.userAgent()
    } 
  }
  return http.get(`${SHORTERNER_URL}/${code}`, params)
}

// k6 starts

export let options = {
  vus: VUS_COUNT,
  duration: LOAD_DURATION
}

export function setup() {
  const shortCode = []
  const maxUrl = randomIntBetween(5, 10)
  for (let i = 0; i < maxUrl; i++) {
    const resp = { status: 500 }
    try { shortenURL(randomUrl()) } catch (err) { }
    if (resp?.status < 400)
      shortCode.push(JSON.parse(resp.body).short_code)
  }
  return shortCode
}

export default function(shortCodes) {
  const _shortCodes = [ ...shortCodes ]
  let resp = { status: 0 };

  // 30% of the time, add a new URL
  if (Math.random() <= ERROR_RATE) {
    try { 
      resp = shortenURL(randomUrl()) 
      if (resp.status < 400)
        _shortCodes.push(JSON.parse(resp.body).short_code)
    } catch (e) { }

  } else {
    const code = randomCode(_shortCodes)
    try { resp = redirect(code) } catch (e) { }
  }

  check(resp, {
    'OK': r => (r.status >= 200) && (r.status <= 399),
    'Client error': r => (r.status >= 400) && (r.status <= 499),
    'Server error': r => (r.status >= 500),
    'K6 exception': r => (r == undefined) || (r == null) || (r?.status == 0)
  })

  sleep(randomIntBetween(1, MAX_SLEEP))
}
