// Real-time answers that run in the browser with no paid API keys:
//   • current time (local or any major city)
//   • today's date, day of week, date math, countdowns to common holidays
//   • math expressions (safe evaluator, no eval)
//   • weather via Open-Meteo (free, no key)
//
// tryAnswerRealtime() returns a ready-to-speak answer when the user's question
// is one of the above, and null otherwise so the AI model can handle it.

const WMO_WEATHER: Record<number, string> = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'foggy',
  48: 'frosty',
  51: 'lightly drizzling',
  53: 'drizzling',
  55: 'heavily drizzling',
  61: 'lightly raining',
  63: 'raining',
  65: 'heavily raining',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'lightly snowing',
  73: 'snowing',
  75: 'heavily snowing',
  77: 'snowing',
  80: 'showers',
  81: 'rain showers',
  82: 'violent showers',
  85: 'snow showers',
  86: 'heavy snow showers',
  95: 'thunderstorms',
  96: 'thunderstorms with hail',
  99: 'severe thunderstorms',
};

const CITY_TIMEZONES: Record<string, string> = {
  'new york': 'America/New_York',
  'nyc': 'America/New_York',
  'los angeles': 'America/Los_Angeles',
  'la': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'houston': 'America/Chicago',
  'dallas': 'America/Chicago',
  'denver': 'America/Denver',
  'phoenix': 'America/Phoenix',
  'seattle': 'America/Los_Angeles',
  'miami': 'America/New_York',
  'toronto': 'America/Toronto',
  'vancouver': 'America/Vancouver',
  'mexico city': 'America/Mexico_City',
  'london': 'Europe/London',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'madrid': 'Europe/Madrid',
  'rome': 'Europe/Rome',
  'amsterdam': 'Europe/Amsterdam',
  'dublin': 'Europe/Dublin',
  'lisbon': 'Europe/Lisbon',
  'moscow': 'Europe/Moscow',
  'zurich': 'Europe/Zurich',
  'brussels': 'Europe/Brussels',
  'stockholm': 'Europe/Stockholm',
  'oslo': 'Europe/Oslo',
  'copenhagen': 'Europe/Copenhagen',
  'athens': 'Europe/Athens',
  'istanbul': 'Europe/Istanbul',
  'dubai': 'Asia/Dubai',
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'new delhi': 'Asia/Kolkata',
  'bengaluru': 'Asia/Kolkata',
  'bangalore': 'Asia/Kolkata',
  'chennai': 'Asia/Kolkata',
  'tokyo': 'Asia/Tokyo',
  'osaka': 'Asia/Tokyo',
  'seoul': 'Asia/Seoul',
  'beijing': 'Asia/Shanghai',
  'shanghai': 'Asia/Shanghai',
  'hong kong': 'Asia/Hong_Kong',
  'singapore': 'Asia/Singapore',
  'bangkok': 'Asia/Bangkok',
  'jakarta': 'Asia/Jakarta',
  'kuala lumpur': 'Asia/Kuala_Lumpur',
  'manila': 'Asia/Manila',
  'sydney': 'Australia/Sydney',
  'melbourne': 'Australia/Melbourne',
  'brisbane': 'Australia/Brisbane',
  'perth': 'Australia/Perth',
  'auckland': 'Pacific/Auckland',
  'wellington': 'Pacific/Auckland',
  'hongkong': 'Asia/Hong_Kong',
  'saopaulo': 'America/Sao_Paulo',
  'rio de janeiro': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'cairo': 'Africa/Cairo',
  'lagos': 'Africa/Lagos',
  'nairobi': 'Africa/Nairobi',
  'cape town': 'Africa/Johannesburg',
};

// Simple holiday calendar (month/day). Thanksgiving, Easter, Mother's Day and
// Father's Day are computed from their date rules.
const FIXED_HOLIDAYS: Record<string, { month: number; day: number }> = {
  'new year': { month: 1, day: 1 },
  "new year's": { month: 1, day: 1 },
  'new years': { month: 1, day: 1 },
  'new years day': { month: 1, day: 1 },
  'valentine': { month: 2, day: 14 },
  "valentine's day": { month: 2, day: 14 },
  'valentines day': { month: 2, day: 14 },
  'independence day': { month: 7, day: 4 },
  'fourth of july': { month: 7, day: 4 },
  'halloween': { month: 10, day: 31 },
  'christmas': { month: 12, day: 25 },
  'christmas day': { month: 12, day: 25 },
  'new years eve': { month: 12, day: 31 },
  "new year's eve": { month: 12, day: 31 },
};

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

// Context string injected into the AI system prompt so the model knows the
// real current date and time instead of guessing from stale training data.
export function getRealtimeContext(): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `Today's date is ${date}. The current local time is ${time}.`;
}

// Main entry: answer time / date / math / weather questions locally.
export async function tryAnswerRealtime(raw: string): Promise<string | null> {
  const q = (raw ?? '').trim();
  if (!q) return null;

  const news = await answerNews(q);
  if (news) return news;

  const webSearch = await answerWebSearch(q);
  if (webSearch) return webSearch;

  const time = answerTime(q);
  if (time) return time;

  const date = answerDate(q);
  if (date) return date;

  const math = answerMath(q);
  if (math) return math;

  return await answerWeather(q);
}

// ---------------------------------------------------------------------------
// Current time
// ---------------------------------------------------------------------------

function isTimeQuestion(q: string): boolean {
  return /(\bwhat.*\btime\b|\bcurrent\s*time\b|\btime\s*(is\s*it|now|right\s*now)\b|\btell\s*me\s*(the\s*)?time\b)/i.test(q);
}

function answerTime(q: string): string | null {
  if (!isTimeQuestion(q)) return null;

  const city = extractCity(q);
  const tz = city ? CITY_TIMEZONES[city.toLowerCase()] : undefined;
  const now = new Date();

  let time: string;
  try {
    time = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(tz ? { timeZone: tz } : {}),
    });
  } catch {
    time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  if (city && tz) return `It's ${time} in ${titleCase(city)} right now.`;
  return `It's ${time} right now.`;
}

// ---------------------------------------------------------------------------
// Date / calendar
// ---------------------------------------------------------------------------

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatShortDate(d: Date): string {
  return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86400000);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function nextHolidayDate(name: string, from: Date): { month: number; day: number; year: number } | null {
  const lower = name.toLowerCase();
  if (FIXED_HOLIDAYS[lower]) {
    const { month, day } = FIXED_HOLIDAYS[lower];
    let year = from.getFullYear();
    if (new Date(year, month - 1, day) < new Date(from.getFullYear(), from.getMonth(), from.getDate())) year += 1;
    return { month, day, year };
  }
  // Thanksgiving — 4th Thursday of November
  if (lower === 'thanksgiving' || lower === 'thanksgiving day') {
    const year = from.getMonth() === 10 && from.getDate() > 21 ? from.getFullYear() + 1 : from.getFullYear();
    const first = new Date(year, 10, 1);
    const offset = (11 - first.getDay()) % 7; // Thursday of the first week
    return { month: 11, day: 1 + offset + 21, year };
  }
  // Mother's Day — 2nd Sunday of May
  if (lower === 'mothers day' || lower === "mother's day") {
    const year = from.getMonth() >= 4 ? from.getFullYear() + 1 : from.getFullYear();
    const first = new Date(year, 4, 1);
    const offset = (7 - first.getDay()) % 7; // Sunday of the first week
    return { month: 5, day: 1 + offset + 7, year };
  }
  // Father's Day — 3rd Sunday of June
  if (lower === 'fathers day' || lower === "father's day") {
    const year = from.getMonth() >= 5 ? from.getFullYear() + 1 : from.getFullYear();
    const first = new Date(year, 5, 1);
    const offset = (7 - first.getDay()) % 7;
    return { month: 6, day: 1 + offset + 14, year };
  }
  return null;
}

// Parse strings like "December 25", "dec 25", "12/25", "25 December".
function parseMonthDay(text: string): { month: number; day: number } | null {
  let m = text.match(/([a-z]+)\s+(\d{1,2})\b/i);
  if (m && MONTH_NAMES[m[1].toLowerCase()]) {
    const day = parseInt(m[2], 10);
    if (day >= 1 && day <= 31) return { month: MONTH_NAMES[m[1].toLowerCase()], day };
  }
  m = text.match(/(\d{1,2})\s+([a-z]+)\b/i);
  if (m && MONTH_NAMES[m[2].toLowerCase()]) {
    const day = parseInt(m[1], 10);
    if (day >= 1 && day <= 31) return { month: MONTH_NAMES[m[2].toLowerCase()], day };
  }
  m = text.match(/(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    const month = parseInt(m[1], 10);
    const day = parseInt(m[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }
  return null;
}

function answerDate(q: string): string | null {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // "what's the date", "what day is it", "what is today", "tell me the date"
  if (/what('?s)?\s*(the\s*)?date\b|today's\s*date|todays\s*date|current\s*date|tell\s*me\s*(the\s*)?(today's\s*)?date\b|what\s*day\s*(is\s*it)?(\s*today)?\b|what\s+is\s+today\b/i.test(q)) {
    if (/\bday\s+is\s+it\b/i.test(q) && !/\bdate\b/i.test(q)) {
      return `Today is ${DAYS[today.getDay()]}.`;
    }
    return `Today is ${formatLongDate(today)}.`;
  }

  // "in X days", "what will the date be in X days"
  const inDays = q.match(/\bin\s+(\d+)\s*days?\b/i);
  if (inDays) {
    const n = parseInt(inDays[1], 10);
    if (n > 0 && n < 5000) {
      const target = addDays(today, n);
      return `In ${n} ${n === 1 ? 'day' : 'days'} it will be ${formatShortDate(target)}.`;
    }
  }

  // "how many days until Christmas / December 25"
  const untilMatch = q.match(/\b(?:how\s+many\s+days|days)\s*(?:until|till|til|before|left\s*(?:until|before))?\s+([\w'’\s\-.,]+)/i);
  if (untilMatch) {
    const target = cleanTarget(untilMatch[1]);
    const holiday = nextHolidayDate(target, today);
    const parsed = parseMonthDay(target);
    let date: Date | null = null;
    if (holiday) {
      date = new Date(holiday.year, holiday.month - 1, holiday.day);
    } else if (parsed) {
      let year = today.getFullYear();
      if (new Date(year, parsed.month - 1, parsed.day) < today) year += 1;
      date = new Date(year, parsed.month - 1, parsed.day);
    }
    if (date) {
      const diff = daysBetween(today, date);
      if (diff === 0) return `${titleCase(target)} is today!`;
      return diff === 1
        ? `${titleCase(target)} is tomorrow.`
        : `It's ${diff} days until ${titleCase(target)}.`;
    }
  }

  // "when is Christmas" / "when is December 25"
  const whenMatch = q.match(/\bwhen\s+is\s+([\w'’\s\-.,]+)\??$/i);
  if (whenMatch) {
    const target = cleanTarget(whenMatch[1]);
    const holiday = nextHolidayDate(target, today);
    const parsed = parseMonthDay(target);
    let date: Date | null = null;
    if (holiday) date = new Date(holiday.year, holiday.month - 1, holiday.day);
    else if (parsed) {
      let year = today.getFullYear();
      if (new Date(year, parsed.month - 1, parsed.day) < today) year += 1;
      date = new Date(year, parsed.month - 1, parsed.day);
    }
    if (date) {
      const diff = daysBetween(today, date);
      const base = `${titleCase(target)} is on ${formatLongDate(date)}.`;
      const extra = diff === 0 ? ' That is today.' : diff === 1 ? ' That is tomorrow.' : ` That is ${diff} days from now.`;
      return base + extra;
    }
  }

  // "what day of the week is <date>"
  const dowMatch = q.match(/\bday\s+of\s+the\s+week\s+is\s+([\w'’\s\-.,]+?)\??$/i);
  if (dowMatch) {
    const parsed = parseMonthDay(cleanTarget(dowMatch[1]));
    if (parsed) {
      let year = today.getFullYear();
      if (new Date(year, parsed.month - 1, parsed.day) < today) year += 1;
      const d = new Date(year, parsed.month - 1, parsed.day);
      return `${formatShortDate(d)} falls on a ${DAYS[d.getDay()]}.`;
    }
  }

  return null;
}

function cleanTarget(s: string): string {
  return s
    .replace(/\b(please|right\s*now|today|tonight|now)\b/gi, '')
    .replace(/[.,!?]+$/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

function answerMath(q: string): string | null {
  if (!/\d/.test(q)) return null;

  const hasWord = /(plus|minus|times|multiplied\s*by|divided\s*by|percent|percentage\s*of|square\s*root|sqrt\b|squared|cubed|to\s*the\s*power|modulo|\bmod\b)/i.test(q);
  const hasSymbol = /\d\s*[-+*/^%()]\s*\d/.test(q);
  const hasPercent = /\d\s*%/.test(q);
  if (!hasWord && !hasSymbol && !hasPercent) return null;

  let expr = q
    .replace(/^what('?s)?\s*(the\s*)?(answer\s*to\s*)?(is|are)\s*/i, '')
    .replace(/\b(calculate|compute|solve|evaluate|work\s*out|figure\s*out|tell\s*me|can\s*you|please|equals|equal\s*to)\b/gi, '')
    .replace(/\?/g, '')
    .trim();

  expr = expr
    .replace(/\bplus\b/gi, '+')
    .replace(/\bminus\b/gi, '-')
    .replace(/\b(times|multiplied\s*by|multiply\s*by)\b/gi, '*')
    .replace(/\b(divided\s*by|divide\s*by)\b/gi, '/')
    .replace(/\b(to\s*the\s*power\s*of)\b/gi, '^')
    .replace(/\bsquared\b/gi, '^2')
    .replace(/\bcubed\b/gi, '^3')
    .replace(/\bmod(ulo)?\b/gi, '%')
    .replace(/\bpercent(age)?\b/gi, '%')
    .replace(/\b(square\s*root\s*of|sqrt\s*of|the\s*square\s*root\s*of)\b/gi, 'sqrt(');

  // 25% of 200 → (25/100*200)
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s+(\d+(?:\.\d+)?)/gi, '($1/100*$2)');

  // close an unclosed sqrt
  const open = (expr.match(/sqrt\(/g) || []).length;
  const close = (expr.match(/\)/g) || []).length;
  if (open > close) expr += ')'.repeat(open - close);

  const result = evaluateMathExpr(expr);
  if (result === null) return null;
  return `The answer is ${formatNumber(result)}.`;
}

function tokenizeMath(expr: string): string[] {
  const tokens: string[] = [];
  const re = /(\d+(?:\.\d+)?|[+\-*/%^()]|[a-z]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expr))) {
    if (m[0].trim()) tokens.push(m[0].toLowerCase());
  }
  return tokens;
}

function evaluateMathExpr(expr: string): number | null {
  if (!expr || expr.length > 200) return null;
  const parser = new MathParser(tokenizeMath(expr));
  return parser.parse();
}

class MathParser {
  private pos = 0;
  constructor(private tokens: string[]) {}

  parse(): number | null {
    try {
      const v = this.expression();
      if (this.pos !== this.tokens.length) return null;
      return Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  private peek(): string { return this.tokens[this.pos]; }

  private next(): string { return this.tokens[this.pos++]; }

  private match(op: string): boolean {
    if (this.peek() === op) { this.pos += 1; return true; }
    return false;
  }

  private expression(): number {
    let v = this.factor();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.next();
      const rhs = this.factor();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  private factor(): number {
    let v = this.unary();
    while (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') {
      const op = this.next();
      const rhs = this.unary();
      if (op === '*') v = v * rhs;
      else if (op === '/') v = v / rhs;
      else v = v % rhs;
    }
    return v;
  }

  private unary(): number {
    if (this.match('-')) return -this.unary();
    if (this.match('+')) return this.unary();
    return this.power();
  }

  private power(): number {
    const base = this.primary();
    if (this.match('^')) return Math.pow(base, this.unary());
    return base;
  }

  private primary(): number {
    const t = this.peek();
    if (t === '(') {
      this.next();
      const v = this.expression();
      this.match(')');
      return v;
    }
    if (t && /^[a-z]+$/.test(t)) {
      this.next();
      this.match('(');
      const arg = this.expression();
      this.match(')');
      switch (t) {
        case 'sqrt': return Math.sqrt(arg);
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'abs': return Math.abs(arg);
        case 'round': return Math.round(arg);
        case 'floor': return Math.floor(arg);
        case 'ceil': return Math.ceil(arg);
        case 'ln': return Math.log(arg);
        case 'log': return Math.log10(arg);
        default: throw new Error('unknown function');
      }
    }
    if (t && /^\d+(\.\d+)?$/.test(t)) {
      this.next();
      return parseFloat(t);
    }
    throw new Error('unexpected token');
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  if (Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-9)) return n.toString();
  const rounded = Math.round(n * 1e6) / 1e6;
  return String(rounded);
}

// ---------------------------------------------------------------------------
// Weather (Open-Meteo — free, no API key)
// ---------------------------------------------------------------------------

function isWeatherQuestion(q: string): boolean {
  const questionLike = /^(what|how|is\s+it|will\s+it|weather|how's|hows|tell\s+me|can\s+you)/i.test(q.trim())
    || /weather\s+in|temperature\s+in|forecast\s+(for|in)|is\s+it\s+(raining|rainy|sunny|cloudy|snowing|hot|cold|foggy)/i.test(q);
  const hasWeatherWord = /(weather|temperature|forecast|raining|rainy|sunny|cloudy|snowing|foggy|windy|humidity|how\s+hot|how\s+cold)/i.test(q);
  return questionLike && hasWeatherWord;
}

function extractCity(q: string): string | null {
  const m = q.match(/\b(?:in|at)\s+([A-Za-z][A-Za-z .'\u2019-]{1,40}?)\s*(?:right\s*now|now|today|tomorrow|tonight|this\s+\w+|\?\s*|please|$)/i);
  if (!m) return null;
  let city = m[1].trim().replace(/[.,]+$/g, '').trim();
  if (!city) return null;
  const filler = /^(right\s*now|now|today|tomorrow|tonight|the|a|an|my|your|it|this|that|week|weekend|morning|afternoon|evening)$/i;
  city = city.replace(/\s+(right\s*now|now|today|tomorrow|tonight|the|this|that|week|weekend|morning|afternoon|evening|please)$/i, '').trim();
  if (filler.test(city) || city.length > 40) return null;
  return city || null;
}

async function answerWeather(q: string): Promise<string | null> {
  if (!isWeatherQuestion(q)) return null;

  let coords: { lat: number; lng: number } | null = null;
  let city: string | null = null;

  const cityMatch = extractCity(q);
  if (cityMatch) {
    city = cityMatch;
    const geo = await geocodeCity(city);
    if (geo) coords = geo;
    else return null;
  } else {
    coords = await getBrowserCoords();
    city = null;
  }

  if (!coords) return null;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const temp = Math.round(data.current?.temperature_2m);
    const code = data.current?.weather_code;
    const desc = WMO_WEATHER[code] ?? 'fair';
    const high = Math.round(data.daily?.temperature_2m_max?.[0]);
    const low = Math.round(data.daily?.temperature_2m_min?.[0]);

    if (typeof temp !== 'number' || Number.isNaN(temp)) return null;

    const place = city ? ` in ${titleCase(city)}` : '';
    const highLow = Number.isFinite(high) && Number.isFinite(low)
      ? `, with a high of ${high} and a low of ${low}`
      : '';
    return `It's ${temp} degrees and ${desc}${place} right now${highLow}.`;
  } catch {
    return null;
  }
}

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lng: r.longitude };
  } catch {
    return null;
  }
}

function getBrowserCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { clearTimeout(timer); resolve(null); },
      { timeout: 5000, maximumAge: 600000 }
    );
  });
}

// ---------------------------------------------------------------------------
// News (via server proxy → Google News RSS / Hacker News)
// ---------------------------------------------------------------------------

function isNewsQuestion(q: string): boolean {
  return /\b(news|headlines?|what'?s\s+happening|current\s+events?|top\s+stories|breaking|in\s+the\s+news)\b/i.test(q);
}

function extractNewsQuery(q: string): string | null {
  const m = q.match(/\b(?:news|headlines?|stories)\s+(?:about|on|for|regarding|concerning)\s+(.+?)(?:\?|$)/i);
  if (m) return m[1].replace(/[.,!?]+$/g, '').trim();
  const m2 = q.match(/\b(?:what'?s\s+happening|current\s+events?)\s+(?:about|on|in|with)\s+(.+?)(?:\?|$)/i);
  if (m2) return m2[1].replace(/[.,!?]+$/g, '').trim();
  return null;
}

interface NewsItem {
  title: string;
  pubDate?: string;
  source?: string;
  url?: string;
}

async function answerNews(q: string): Promise<string | null> {
  if (!isNewsQuestion(q)) return null;

  const query = extractNewsQuery(q);
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  params.set('count', '8');

  try {
    const res = await fetch(`/api/news?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    const items: NewsItem[] = data.items || [];
    if (items.length === 0) return null;

    const sourceLabel = data.source === 'hacker-news' ? 'Hacker News' : 'Google News';
    const header = query
      ? `Here are the latest headlines about ${query}, from ${sourceLabel}:`
      : `Here are today's top headlines from ${sourceLabel}:`;

    const bullets = items.slice(0, 6).map((item, i) => {
      const parts: string[] = [];
      parts.push(item.title);
      if (item.source) parts.push(`— ${item.source}`);
      return `${i + 1}. ${parts.join(' ')}`;
    });

    return `${header}\n\n${bullets.join('\n')}`;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Web search (via server proxy → DuckDuckGo)
// ---------------------------------------------------------------------------

function isWebSearchQuestion(q: string): boolean {
  return /\b(search\s+for|look\s+up|google|what('?s|\s+is)\s+the\s+latest|what\s+happened|who\s+(won|is|invented|discovered|created)|where\s+(is|was|are)|latest\s+(news|info|update)|tell\s+me\s+about)\b/i.test(q);
}

function extractSearchQuery(q: string): string | null {
  let m = q.match(/\b(?:search\s+for|look\s+up|google|tell\s+me\s+about)\s+(.+?)(?:\?|$)/i);
  if (m) return m[1].replace(/[.,!?]+$/g, '').trim();
  m = q.match(/\b(?:what('?s|\s+is)\s+the\s+latest\s+(?:on|about|with|regarding))\s+(.+?)(?:\?|$)/i);
  if (m) return m[1].replace(/[.,!?]+$/g, '').trim();
  m = q.match(/\b(?:what\s+happened|who\s+(?:won|is|invented|discovered|created)|where\s+(?:is|was|are))\s+(.+?)(?:\?|$)/i);
  if (m) return m[1].replace(/[.,!?]+$/g, '').trim();
  m = q.match(/\b(?:latest\s+(?:news|info|update)\s+(?:on|about|with))\s+(.+?)(?:\?|$)/i);
  if (m) return m[1].replace(/[.,!?]+$/g, '').trim();
  return null;
}

interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
}

async function answerWebSearch(q: string): Promise<string | null> {
  if (!isWebSearchQuestion(q)) return null;

  const query = extractSearchQuery(q);
  if (!query) return null;

  try {
    const res = await fetch(`/api/web-search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results: SearchResult[] = data.results || [];
    if (results.length === 0 && !data.abstract) return null;

    let answer = '';
    if (data.abstract) {
      answer = data.abstract;
    } else {
      answer = results.slice(0, 3).map((r, i) => `${i + 1}. ${r.title}. ${r.snippet}`).join('\n');
    }
    return answer || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
