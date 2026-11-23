import { describe, it, expect } from 'vitest'
import {
  decideAuth,
  ipInList,
  isAllowedDomain,
  parseAuthEmail,
  parseList,
} from '../../../../app/src/infrastructure/HeaderAuth.mjs'

const config = { proxyIps: ['10.0.0.5', '172.18.0.0/16'], allowedDomains: [] }
const base = {
  method: 'GET',
  path: '/project',
  headerValue: 'Somchai@Example.com',
  ip: '10.0.0.5',
  sessionEmail: null,
  config,
}

describe('HeaderAuth', function () {
  describe('parseAuthEmail', function () {
    it('lower-cases and trims a valid email', function () {
      expect(parseAuthEmail('  Somchai@Example.com ')).toBe('somchai@example.com')
    })

    it('refuses anything that is not exactly one email', function () {
      for (const value of [
        undefined,
        '',
        'no-at-sign',
        'a@b',
        'a@b.com, c@d.com',
        'a@b.com;c@d.com',
        'a b@c.com',
        '<a@b.com>',
        ['a@b.com'].concat(['x']).length === 2 ? 123 : null,
      ]) {
        expect(parseAuthEmail(value)).toBe(null)
      }
    })

    it('takes the first value of a repeated header', function () {
      expect(parseAuthEmail(['a@b.com', 'c@d.com'])).toBe('a@b.com')
    })
  })

  describe('ipInList', function () {
    it('matches exact addresses, IPv4-mapped IPv6 and CIDR ranges', function () {
      expect(ipInList('10.0.0.5', ['10.0.0.5'])).toBe(true)
      expect(ipInList('::ffff:10.0.0.5', ['10.0.0.5'])).toBe(true)
      expect(ipInList('172.18.3.4', ['172.18.0.0/16'])).toBe(true)
      expect(ipInList('172.19.0.1', ['172.18.0.0/16'])).toBe(false)
      expect(ipInList('1.2.3.4', ['0.0.0.0/0'])).toBe(true)
    })

    it('matches nothing for an empty list or a bad entry', function () {
      expect(ipInList('10.0.0.5', [])).toBe(false)
      expect(ipInList('10.0.0.5', ['10.0.0.0/99', 'nonsense'])).toBe(false)
      expect(ipInList('', ['10.0.0.5'])).toBe(false)
    })
  })

  describe('isAllowedDomain', function () {
    it('allows everything without a list, otherwise only the listed domains', function () {
      expect(isAllowedDomain('a@x.com', [])).toBe(true)
      expect(isAllowedDomain('a@x.com', ['x.com'])).toBe(true)
      expect(isAllowedDomain('a@X.com', ['@x.com'])).toBe(true)
      expect(isAllowedDomain('a@evil-x.com', ['x.com'])).toBe(false)
      expect(isAllowedDomain('a@sub.x.com', ['x.com'])).toBe(false)
    })
  })

  describe('decideAuth', function () {
    it('logs in a new session as the email in the header', function () {
      expect(decideAuth(base)).toEqual({
        action: 'login',
        email: 'somchai@example.com',
        switching: false,
      })
    })

    it('does nothing when the session already is that user', function () {
      expect(decideAuth({ ...base, sessionEmail: 'Somchai@example.com' })).toEqual({
        action: 'next',
      })
    })

    it('switches the session when the header names somebody else', function () {
      expect(decideAuth({ ...base, sessionEmail: 'other@example.com' })).toEqual({
        action: 'login',
        email: 'somchai@example.com',
        switching: true,
      })
    })

    it('refuses a write that arrives with another user\'s session', function () {
      const result = decideAuth({
        ...base,
        method: 'POST',
        sessionEmail: 'other@example.com',
      })
      expect(result.action).toBe('deny')
      expect(result.status).toBe(401)
    })

    it('never trusts the header from an address that is not the proxy', function () {
      const result = decideAuth({ ...base, ip: '203.0.113.9' })
      expect(result.action).toBe('deny')
      expect(result.status).toBe(403)
      // even with a session that matches: forged headers cannot be told apart
      expect(
        decideAuth({ ...base, ip: '203.0.113.9', sessionEmail: 'somchai@example.com' })
          .status
      ).toBe(403)
    })

    it('refuses a request without a usable header', function () {
      expect(decideAuth({ ...base, headerValue: undefined }).status).toBe(401)
      expect(decideAuth({ ...base, headerValue: 'a@b.com, c@d.com' }).status).toBe(401)
    })

    it('refuses an email outside the allowed domains', function () {
      const result = decideAuth({
        ...base,
        config: { ...config, allowedDomains: ['company.co.th'] },
      })
      expect(result.status).toBe(403)
    })

    it('answers health checks without a user', function () {
      expect(decideAuth({ ...base, path: '/status', headerValue: undefined, ip: '9.9.9.9' }))
        .toEqual({ action: 'next' })
    })

    it('refuses everything when no proxy address is configured', function () {
      expect(decideAuth({ ...base, config: { proxyIps: [], allowedDomains: [] } }).status).toBe(403)
    })
  })

  describe('parseList', function () {
    it('splits on commas and spaces', function () {
      expect(parseList('a.com, b.com  c.com')).toEqual(['a.com', 'b.com', 'c.com'])
      expect(parseList(undefined)).toEqual([])
    })
  })
})
