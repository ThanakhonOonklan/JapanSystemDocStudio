// @ts-check

// Documentation Studio REA: only the routes the editor and compile path need
// are kept (blobs, history flush, project history resync). Version history
// itself (updates, diffs, labels, restore/revert, version downloads) is gone.

import Settings from '@overleaf/settings'
import { RateLimiter } from '../../infrastructure/RateLimiter.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import AuthorizationMiddleware from '../Authorization/AuthorizationMiddleware.mjs'
import RateLimiterMiddleware from '../Security/RateLimiterMiddleware.mjs'
import HistoryController from './HistoryController.mjs'
import AsyncLocalStorage from '../../infrastructure/AsyncLocalStorage.mjs'

const rateLimiters = {
  getProjectBlob: new RateLimiter('get-project-blob', {
    // Download project in full once per hour
    points: Settings.maxEntitiesPerProject,
    duration: 60 * 60,
  }),
  flushHistory: new RateLimiter('flush-project-history', {
    points: 30,
    duration: 60,
  }),
}

/**
 * @param {any} webRouter
 * @param {any} privateApiRouter
 */
function apply(webRouter, privateApiRouter) {
  // Blobs (images and other project files)

  webRouter.head(
    '/project/:project_id/blob/:hash',
    RateLimiterMiddleware.rateLimit(rateLimiters.getProjectBlob),
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.headBlob
  )
  webRouter.get(
    '/project/:project_id/blob/:hash',
    RateLimiterMiddleware.rateLimit(rateLimiters.getProjectBlob),
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.getBlob
  )

  // History flush and resync

  webRouter.post(
    '/project/:Project_id/flush',
    RateLimiterMiddleware.rateLimit(rateLimiters.flushHistory),
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.blockRestrictedUserFromProject,
    AuthorizationMiddleware.ensureUserCanReadProject,
    HistoryController.proxyToHistoryApi
  )
  privateApiRouter.post(
    '/project/:Project_id/history/resync',
    AuthenticationController.requirePrivateApiAuth(),
    HistoryController.resyncProjectHistory
  )
}

export default { apply }
