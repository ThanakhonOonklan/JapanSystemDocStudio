// Japan Documentation Studio: login at the web layer (see HeaderAuth.mjs for
// the rules). This file connects the rules to the real users and sessions.
//
// Turned on by OVERLEAF_AUTH_HEADER. Needs OVERLEAF_AUTH_PROXY_IPS: without
// it every request is refused, because the header could be forged.

import mongodb from 'mongodb-legacy'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import UserGetter from '../Features/User/UserGetter.mjs'
import UserCreator from '../Features/User/UserCreator.mjs'
import SessionManager from '../Features/Authentication/SessionManager.mjs'
import AuthenticationController from '../Features/Authentication/AuthenticationController.mjs'
import { decideAuth, parseAuthEmail } from './HeaderAuth.mjs'

const { ObjectId } = mongodb

export const headerAuthEnabled = () => Boolean(Settings.authHeader)

function sessionEmail(req) {
  const user = req.session && SessionManager.getSessionUser(req.session)
  return user?.email || null
}

async function findOrCreateUser(email) {
  const existing = await UserGetter.promises.getUserByMainEmail(email)
  if (existing) return { user: existing, created: false }
  const user = await UserCreator.promises.createNewUser(
    {
      email,
      holdingAccount: false,
      analyticsId: new ObjectId().toString(),
    },
    { confirmedAt: new Date() }
  )
  // an account made here is an ordinary one: the administrator is named with
  // the set-admin script, never by the proxy
  logger.info({ userId: user._id }, 'created a user from the login header')
  return { user, created: true }
}

function logoutUrl() {
  return Settings.authLogoutUrl || '/oauth2/sign_out'
}

/**
 * "Log out" ends the session here and goes to the proxy's sign-out page,
 * which ends the organisation sign-in as well. Without that the proxy would
 * sign the same person straight back in.
 */
function handleLogout(req, res, next) {
  // a link on another site must not be able to sign somebody out
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return res.status(403).type('text/plain').send('Access is not allowed.')
  }
  const finish = () => res.redirect(303, logoutUrl())
  if (!req.session) return finish()
  req.session.destroy(err => {
    if (err) return next(err)
    res.clearCookie(Settings.cookieName)
    finish()
  })
}

export async function headerAuthMiddleware(req, res, next) {
  if (!headerAuthEnabled()) return next()

  try {
    if (req.path === '/logout' && req.method === 'POST') {
      return handleLogout(req, res, next)
    }

    const decision = decideAuth({
      method: req.method,
      path: req.path,
      headerValue: req.headers[Settings.authHeader.toLowerCase()],
      ip: req.ip,
      sessionEmail: sessionEmail(req),
      config: {
        proxyIps: Settings.authProxyIps || [],
        allowedDomains: Settings.authAllowedDomains || [],
      },
    })

    if (decision.action === 'next') return next()

    if (decision.action === 'deny') {
      logger.warn(
        { ip: req.ip, path: req.path, reason: decision.reason },
        'login header: request refused'
      )
      return res.status(decision.status).type('text/plain').send(
        decision.status === 401
          ? 'Not signed in. Reload the page.'
          : 'Access is not allowed.'
      )
    }

    // action: login
    if (!req.session || req.session.noSessionCallback) return next()
    if (decision.switching) {
      // the browser was used by somebody else: drop what that session knew
      delete req.session.passport
      delete req.session.user
    }
    const { user } = await findOrCreateUser(decision.email)
    await AuthenticationController.promises.establishSession(user, req)
    logger.debug({ userId: user._id }, 'login header: session established')
    return next()
  } catch (err) {
    return next(err)
  }
}

export { parseAuthEmail }
