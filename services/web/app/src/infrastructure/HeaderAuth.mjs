// Japan Documentation Studio: login at the web layer.
//
// A reverse proxy in front of the app (oauth2-proxy, Caddy, nginx ...) signs
// people in with the organisation's accounts and passes the signed-in email in
// a request header. This module decides, for every request, what to do with
// that header. It has no database or session code, so it can be tested alone;
// HeaderAuthMiddleware.mjs wires it to the real users and sessions.
//
// Settings (see config/settings.defaults.js):
//   authHeader          name of the header that carries the email, e.g.
//                       "x-forwarded-email". Not set = this mode is off.
//   authProxyIps        addresses of the proxy (exact or CIDR). The header is
//                       trusted only on requests that come from one of them.
//   authAllowedDomains  optional second check: only these email domains.
//   authLogoutUrl       where "Log out" goes (the proxy's sign-out page).

/** Paths that must answer without a signed-in user (health checks). */
const OPEN_PATHS = new Set(['/status', '/health_check', '/favicon.ico'])

export function isOpenPath(path) {
  return OPEN_PATHS.has(path)
}

/**
 * The email in a header value, lower case, or null when it is not an email.
 * @param {string | string[] | undefined} value
 */
export function parseAuthEmail(value) {
  const first = Array.isArray(value) ? value[0] : value
  if (typeof first !== 'string') return null
  const email = first.trim().toLowerCase()
  if (email.length === 0 || email.length > 254) return null
  // one @, something on both sides, no spaces or commas (a comma would mean
  // several values joined by a proxy: refuse rather than guess)
  if (!/^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/.test(email)) return null
  return email
}

/** @param {string} email @param {string[]} domains */
export function isAllowedDomain(email, domains) {
  if (!domains || domains.length === 0) return true
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
  return domains.some(d => d.toLowerCase().replace(/^@/, '') === domain)
}

function ipv4ToInt(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const v = Number(part)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n
}

function normaliseIp(ip) {
  if (typeof ip !== 'string') return ''
  // "::ffff:10.0.0.5" is the IPv4 address 10.0.0.5
  return ip.trim().toLowerCase().replace(/^::ffff:/, '')
}

/**
 * Whether `ip` is one of `entries`: exact addresses or IPv4 CIDR ranges
 * ("10.0.0.0/8"). An empty list matches nothing.
 * @param {string} ip
 * @param {string[]} entries
 */
export function ipInList(ip, entries) {
  const address = normaliseIp(ip)
  if (!address || !entries) return false
  for (const raw of entries) {
    const entry = normaliseIp(raw)
    if (!entry) continue
    const slash = entry.indexOf('/')
    if (slash === -1) {
      if (entry === address) return true
      continue
    }
    const base = ipv4ToInt(entry.slice(0, slash))
    const bits = Number(entry.slice(slash + 1))
    const target = ipv4ToInt(address)
    if (base === null || target === null) continue
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) continue
    if (bits === 0) return true
    const size = 2 ** (32 - bits)
    if (Math.floor(base / size) === Math.floor(target / size)) return true
  }
  return false
}

/**
 * What to do with one request.
 *
 * @param {object} input
 * @param {string} input.method
 * @param {string} input.path
 * @param {string | string[] | undefined} input.headerValue the auth header
 * @param {string} input.ip address the request came from (the proxy)
 * @param {string | null} input.sessionEmail email of the signed-in session user
 * @param {{ proxyIps: string[], allowedDomains: string[] }} input.config
 * @returns {{ action: 'next' } |
 *           { action: 'deny', status: 401 | 403, reason: string } |
 *           { action: 'login', email: string, switching: boolean }}
 *   next   nothing to do (open path, or the session already is this user)
 *   deny   refuse the request
 *   login  put this email's user into the session; `switching` is true when
 *          the session belonged to somebody else
 */
export function decideAuth({ method, path, headerValue, ip, sessionEmail, config }) {
  if (isOpenPath(path)) return { action: 'next' }

  if (!ipInList(ip, config.proxyIps)) {
    // Somebody reached the app without going through the proxy. The header
    // can be forged on such a request, so it is never trusted.
    return { action: 'deny', status: 403, reason: 'not from the login proxy' }
  }

  const email = parseAuthEmail(headerValue)
  if (!email) {
    return { action: 'deny', status: 401, reason: 'no signed-in user' }
  }
  if (!isAllowedDomain(email, config.allowedDomains)) {
    return { action: 'deny', status: 403, reason: 'email domain is not allowed' }
  }

  if (sessionEmail && sessionEmail.toLowerCase() === email) {
    return { action: 'next' }
  }

  // a different person, or no session yet. Only a read (GET/HEAD) may start a
  // session; a POST/PUT/DELETE with a stale session is refused so that a
  // change meant for the previous user is never applied to the new one.
  if (method !== 'GET' && method !== 'HEAD') {
    return {
      action: 'deny',
      status: 401,
      reason: 'session belongs to another user, reload the page',
    }
  }
  return { action: 'login', email, switching: Boolean(sessionEmail) }
}

/** "a@x.com, b@y.com" -> ['a@x.com', 'b@y.com'] */
export function parseList(value) {
  if (!value) return []
  return String(value)
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
}
