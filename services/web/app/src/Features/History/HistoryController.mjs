// @ts-check

// Documentation Studio REA: the version-history features (diffs, labels,
// restore, revert, version zip downloads) have been removed. What is left is
// what the editor and compile path need: blobs, the history flush proxy and
// the project history resync.

import { pipeline } from 'node:stream/promises'
import { expressify } from '@overleaf/promise-utils'

import { fetchStreamWithResponse } from '@overleaf/fetch-utils'

import settings from '@overleaf/settings'
/** @type {any} */
import SessionManager from '../Authentication/SessionManager.mjs'
import Errors from '../Errors/Errors.js'
/** @type {any} */
import HistoryManager from './HistoryManager.mjs'
/** @type {any} */
import ProjectEntityUpdateHandler from '../Project/ProjectEntityUpdateHandler.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('express').NextFunction} NextFunction
 */

// Number of seconds after which the browser should send a request to revalidate
// blobs
const REVALIDATE_BLOB_AFTER_SECONDS = 86400 // 1 day

// Number of seconds during which the browser can serve a stale response while
// revalidating
const STALE_WHILE_REVALIDATE_SECONDS = 365 * 86400 // 1 year
/**
 * @param {Request} req
 * @param {Response} res
 */
async function getBlob(req, res) {
  await requestBlob('GET', req, res)
}

/**
 * @param {Request} req
 * @param {Response} res
 */
async function headBlob(req, res) {
  await requestBlob('HEAD', req, res)
}

const requestBlobSchema = z.object({
  params: z.strictObject({
    project_id: zz.coercedObjectId(),
    hash: zz.hex().length(40),
  }),
  query: z.object({
    fallback: zz.coercedObjectId().optional(),
  }),
})

/**
 * @param {any} method
 * @param {Request} req
 * @param {Response} res
 */
async function requestBlob(method, req, res) {
  const { params } = parseReq(req, requestBlobSchema)
  const { project_id: projectId, hash } = params

  // Handle conditional GET request
  if (req.get('If-None-Match') === hash) {
    setBlobCacheHeaders(res, hash)
    return res.status(304).end()
  }

  const range = req.get('Range')
  let stream, contentLength, contentRange
  try {
    ;({ stream, contentLength, contentRange } =
      await HistoryManager.promises.requestBlobWithProjectId(
        projectId,
        hash,
        method,
        range
      ))
  } catch (/** @type {any} */ err) {
    if (err instanceof Errors.NotFoundError) return res.status(404).end()
    throw err
  }

  if (contentLength) res.setHeader('Content-Length', contentLength)
  if (contentRange) {
    res.setHeader('Content-Range', contentRange)
    res.status(206) // Partial Content
  }
  res.setHeader('Content-Type', 'application/octet-stream')
  setBlobCacheHeaders(res, hash)

  // Disable buffering in nginx
  res.setHeader('X-Accel-Buffering', 'no')

  try {
    await pipeline(stream, res)
  } catch (/** @type {any} */ err) {
    // If the downstream request is cancelled, we get an
    // ERR_STREAM_PREMATURE_CLOSE, ignore these "errors".
    if (!isPrematureClose(err)) {
      throw err
    }
  }
}

/**
 * @param {Response} res
 * @param {any} etag
 */
function setBlobCacheHeaders(res, etag) {
  // Blobs are immutable, so they can in principle be cached indefinitely. Here,
  // we ask the browser to cache them for some time, but then check back
  // regularly in case they changed (even though they shouldn't). This is a
  // precaution in case a bug makes us send bad data through that endpoint.
  res.set(
    'Cache-Control',
    `private, max-age=${REVALIDATE_BLOB_AFTER_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`
  )
  res.set('ETag', etag)
}

const proxyToHistoryApiSchema = z.object({
  // both project_id and Project_id are accepted for backwards compatibility
  params: z.strictObject({
    Project_id: zz.objectId().optional(),
    project_id: zz.objectId().optional(),
    doc_id: zz.objectId().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const proxyToHistoryApiFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId().optional(),
    project_id: zz.objectId().optional(),
    doc_id: zz.objectId().optional(),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function proxyToHistoryApi(req, res, next) {
  parseReq(req, proxyToHistoryApiSchema, {
    fallbackSchema: proxyToHistoryApiFallbackSchema,
  })
  const userId = SessionManager.getLoggedInUserId(req.session)
  const url = settings.apis.project_history.url + req.url

  const { stream, response } = await fetchStreamWithResponse(url, {
    method: req.method,
    headers: { 'X-User-Id': userId },
  })

  const contentType = response.headers.get('Content-Type')
  const contentLength = response.headers.get('Content-Length')
  if (contentType != null) {
    res.set('Content-Type', contentType)
  }
  if (contentLength != null) {
    res.set('Content-Length', contentLength)
  }

  try {
    await pipeline(stream, res)
  } catch (/** @type {any} */ err) {
    // If the downstream request is cancelled, we get an
    // ERR_STREAM_PREMATURE_CLOSE.
    if (!isPrematureClose(err)) {
      throw err
    }
  }
}


const resyncProjectHistorySchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  body: z.strictObject({
    historyRangesMigration: z.enum(['forwards', 'backwards']).optional(),
    resyncProjectStructureOnly: z.boolean().default(false),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const resyncProjectHistoryFallbackSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    historyRangesMigration: z.enum(['forwards', 'backwards']).optional(),
    resyncProjectStructureOnly: z.boolean().default(false),
  }),
})

/**
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 */
async function resyncProjectHistory(req, res, next) {
  // increase timeout to 6 minutes
  res.setTimeout(6 * 60 * 1000)
  const { params, body } = parseReq(req, resyncProjectHistorySchema, {
    fallbackSchema: resyncProjectHistoryFallbackSchema,
  })
  const projectId = params.Project_id
  const opts = {
    historyRangesMigration: body.historyRangesMigration,
    resyncProjectStructureOnly: body.resyncProjectStructureOnly,
  }

  try {
    await ProjectEntityUpdateHandler.promises.resyncProjectHistory(
      projectId,
      opts
    )
  } catch (/** @type {any} */ err) {
    if (err instanceof Errors.ProjectHistoryDisabledError) {
      return res.sendStatus(404)
    } else {
      throw err
    }
  }

  res.sendStatus(204)
}

/**
 * @param {any} err
 */
function isPrematureClose(err) {
  return (
    err instanceof Error &&
    'code' in err &&
    (err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
      err.code === 'ERR_STREAM_UNABLE_TO_PIPE')
  )
}

export default {
  getBlob: expressify(getBlob),
  headBlob: expressify(headBlob),
  proxyToHistoryApi: expressify(proxyToHistoryApi),
  resyncProjectHistory: expressify(resyncProjectHistory),
}