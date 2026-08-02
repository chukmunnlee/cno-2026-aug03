// Ported from https://github.com/GoogleCloudPlatform/microservices-demo/tree/main/src/loadgenerator

import http from 'k6/http';
import { sleep, check } from 'k6';

const GATEWAY_IP = __ENV.GATEWAY_IP || "192.168.39.200"
const BOUTIQUE_URL = __ENV.BOUTIQUE_URL || `http://boutique.${GATEWAY_IP}.nip.io/`;

const LOAD_DURATION = __ENV.LOAD_DURATION || '2m'
const VUS_COUNT = parseInt(__ENV.VUS_COUNT) || 1

const products = [
  '0PUK6V6EV0',
  '1YMWWN1N4O',
  '2ZYFJ3GM2N',
  '66VCHSJNUP',
  '6E92ZMYYFZ',
  '9SIQT8TOJO',
  'L9ECAV7KIM',
  'LS4PSXUNUM',
  'OLJCESPC7Z',
];

const currencies = ['EUR', 'USD', 'JPY', 'CAD', 'GBP', 'TRY'];

const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const countries = ['United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 'France', 'Japan', 'Brazil'];
const streetNames = ['Main St', 'Oak Ave', 'Maple Dr', 'Park Blvd', 'Cedar Ln', 'Elm St', 'Washington Ave', 'Lake Dr'];
const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'example.com'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randString(len) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function fakeEmail() {
  return `${randString(8)}.${randString(4)}@${randChoice(emailDomains)}`;
}

function fakeStreetAddress() {
  return `${randInt(1, 9999)} ${randChoice(streetNames)}`;
}

function fakeZipCode() {
  return String(randInt(10000, 99999));
}

function fakeVisaNumber() {
  // Visa: starts with 4, 16 digits total
  let n = '4';
  for (let i = 0; i < 15; i++) n += randInt(0, 9);
  return n;
}

// --- Task functions ---

function taskIndex() {
  const res = http.get(`${BOUTIQUE_URL}/`);
  check(res, { 'index 200': r => r.status === 200 });
}

function taskSetCurrency() {
  const res = http.post(`${BOUTIQUE_URL}/setCurrency`, {
    currency_code: randChoice(currencies),
  });
  check(res, { 'setCurrency 200': r => r.status === 200 });
}

function taskBrowseProduct() {
  const res = http.get(`${BOUTIQUE_URL}/product/${randChoice(products)}`);
  check(res, { 'browseProduct 200': r => r.status === 200 });
}

function taskViewCart() {
  const res = http.get(`${BOUTIQUE_URL}/cart`);
  check(res, { 'viewCart 200': r => r.status === 200 });
}

function taskAddToCart() {
  const product = randChoice(products);
  http.get(`${BOUTIQUE_URL}/product/${product}`);
  const res = http.post(`${BOUTIQUE_URL}/cart`, {
    product_id: product,
    quantity: String(randInt(1, 10)),
  });
  check(res, { 'addToCart 200': r => r.status === 200 });
}

function taskCheckout() {
  taskAddToCart();
  const currentYear = new Date().getFullYear() + 1;
  const res = http.post(`${BOUTIQUE_URL}/cart/checkout`, {
    email: fakeEmail(),
    street_address: fakeStreetAddress(),
    zip_code: fakeZipCode(),
    city: randChoice(cities),
    state: randChoice(states),
    country: randChoice(countries),
    credit_card_number: fakeVisaNumber(),
    credit_card_expiration_month: String(randInt(1, 12)),
    credit_card_expiration_year: String(randInt(currentYear, currentYear + 70)),
    credit_card_cvv: String(randInt(100, 999)),
  });
  check(res, { 'checkout 200': r => r.status === 200 });
}

function taskLogout() {
  const res = http.get(`${BOUTIQUE_URL}/logout`);
  check(res, { 'logout 200': r => r.status === 200 });
}

function taskEmptyCart() {
  const res = http.post(`${BOUTIQUE_URL}/cart/empty`);
  check(res, { 'emptyCart 200': r => r.status === 200 });
}

// Weighted task table — mirrors Locust TaskSet weights
// index:1, setCurrency:2, browseProduct:10, addToCart:2, viewCart:3, checkout:1
const weightedTasks = [
  { weight: 1,  fn: taskIndex },
  { weight: 2,  fn: taskSetCurrency },
  { weight: 10, fn: taskBrowseProduct },
  { weight: 2,  fn: taskAddToCart },
  { weight: 3,  fn: taskViewCart },
  { weight: 1,  fn: taskCheckout },
];

const totalWeight = weightedTasks.reduce((sum, t) => sum + t.weight, 0);

function pickTask() {
  let r = Math.random() * totalWeight;
  for (const t of weightedTasks) {
    r -= t.weight;
    if (r <= 0) return t.fn;
  }
  return weightedTasks[weightedTasks.length - 1].fn;
}

export let options = {
  vus: VUS_COUNT,
  duration: LOAD_DURATION
}

// Per-VU state: simulate Locust's on_start (runs once per virtual user)
let started = false;

export default function () {
  if (!started) {
    taskIndex();  // on_start equivalent
    started = true;
  }

  pickTask()();

  // wait_time = between(1, 10) seconds
  sleep(randInt(1, 10));
}
