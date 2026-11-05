// Documentation Studio REA: single-user mode.
//
// Enabled by setting OVERLEAF_SINGLE_USER_EMAIL to the email of an existing
// user (create it once with the `create-user` script). Then:
//   - any browser without a login session is logged in as that user
//     automatically (GET requests only, so POSTs never race a new session)
//   - routes for sharing, invitations, token access and email/password
//     recovery answer 404
//
// Only use this on a machine where everyone who can reach the port is
// trusted (the compose file binds to 127.0.0.1).

import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import UserGetter from '../Features/User/UserGetter.mjs'
import SessionManager from '../Features/Authentication/SessionManager.mjs'
import AuthenticationController from '../Features/Authentication/AuthenticationController.mjs'

// [method pattern, path pattern]; method `*` means all methods.
const BLOCKED_ROUTES = [
  ['*', /^\/project\/[^/]+\/invites?(\/|$)/],
  ['*', /^\/project\/[^/]+\/transfer-ownership$/],
  ['*', /^\/project\/[^/]+\/leave$/],
  ['*', /^\/project\/[^/]+\/tokens(\/|$)/],
  ['write', /^\/project\/[^/]+\/members(\/|$)/],
  ['*', /^\/(read\/)?[A-Za-z0-9]+\/grant$/],
  ['*', /^\/user\/emails(\/|$)/],
  ['*', /^\/user\/password\/(reset|set)$/],
  ['*', /^\/user\/reconfirm$/],
  ['*', /^\/register$/],
]

function isBlocked(req) {
  const isWrite = req.method !== 'GET' && req.method !== 'HEAD'
  return BLOCKED_ROUTES.some(([method, pattern]) => {
    if (method === 'write' && !isWrite) return false
    return pattern.test(req.path)
  })
}

export function singleUserBlockMiddleware(req, res, next) {
  if (!Settings.singleUserEmail || !isBlocked(req)) {
    return next()
  }
  res.sendStatus(404)
}

export async function singleUserAutoLoginMiddleware(req, res, next) {
  const email = Settings.singleUserEmail
  if (
    !email ||
    req.method !== 'GET' ||
    !req.session ||
    req.session.noSessionCallback ||
    SessionManager.isUserLoggedIn(req.session)
  ) {
    return next()
  }

  try {
    const user = await UserGetter.promises.getUserByMainEmail(email)
    if (!user) {
      // The user has not been created yet: fall back to the normal login /
      // launchpad pages so the first admin can be created.
      return next()
    }
    await AuthenticationController.promises.establishSession(user, req)
    logger.debug({ userId: user._id }, 'single-user auto login')
    next()
  } catch (err) {
    next(err)
  }
}
