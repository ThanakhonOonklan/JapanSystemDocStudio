// @ts-check

// Documentation Studio REA: the standalone `chat` service has been removed.
//
// This module keeps the same interface as the original HTTP client so that
// the rest of `web` (project deletion/duplication, document loading, history
// restore, authorization) keeps working, but every call is now answered
// locally with an empty result. Chat messages and comment threads are not
// stored anywhere.

import { callbackify } from 'node:util'

const CHAT_REMOVED = 'chat service has been removed'

/**
 * Used by AuthorizationManager to check thread ownership for reviewers.
 * There are no threads, so we always reject (access is denied).
 *
 * @param {any} _projectId
 * @param {any} _threadId
 */
async function getThread(_projectId, _threadId) {
  throw new Error(CHAT_REMOVED)
}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 * @param {any} _messageId
 */
async function getThreadMessage(_projectId, _threadId, _messageId) {
  throw new Error(CHAT_REMOVED)
}

/**
 * @param {any} _projectId
 */
async function getThreads(_projectId) {
  return {}
}

/**
 * @param {any} _projectId
 */
async function destroyProject(_projectId) {}

/**
 * @param {any} _projectId
 * @param {any} _userId
 * @param {any} _content
 */
async function sendGlobalMessage(_projectId, _userId, _content) {
  throw new Error(CHAT_REMOVED)
}

/**
 * @param {any} _projectId
 * @param {any} _limit
 * @param {any} _before
 */
async function getGlobalMessages(_projectId, _limit, _before) {
  return []
}

/**
 * @param {any} _projectId
 * @param {any} _messageId
 */
async function getGlobalMessage(_projectId, _messageId) {
  throw new Error(CHAT_REMOVED)
}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 * @param {any} _userId
 * @param {any} _content
 */
async function sendComment(_projectId, _threadId, _userId, _content) {
  throw new Error(CHAT_REMOVED)
}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 * @param {any} _userId
 */
async function resolveThread(_projectId, _threadId, _userId) {}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 */
async function reopenThread(_projectId, _threadId) {}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 */
async function deleteThread(_projectId, _threadId) {}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 * @param {any} _messageId
 * @param {any} _userId
 * @param {any} _content
 */
async function editMessage(
  _projectId,
  _threadId,
  _messageId,
  _userId,
  _content
) {}

/**
 * @param {any} _projectId
 * @param {any} _messageId
 * @param {any} _userId
 * @param {any} _content
 */
async function editGlobalMessage(_projectId, _messageId, _userId, _content) {}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 * @param {any} _messageId
 */
async function deleteMessage(_projectId, _threadId, _messageId) {}

/**
 * @param {any} _projectId
 * @param {any} _threadId
 * @param {any} _userId
 * @param {any} _messageId
 */
async function deleteUserMessage(_projectId, _threadId, _userId, _messageId) {}

/**
 * @param {any} _projectId
 * @param {any} _messageId
 */
async function deleteGlobalMessage(_projectId, _messageId) {}

/**
 * Called on every document load.
 *
 * @param {any} _projectId
 * @return {Promise<string[]>}
 */
async function getResolvedThreadIds(_projectId) {
  return []
}

/**
 * Called when restoring a document from history that contains comments.
 * Returns no duplicated threads, so comments are simply dropped.
 *
 * @param {any} _projectId
 * @param {any} _threads
 * @return {Promise<{ newThreads: Record<string, any> }>}
 */
async function duplicateCommentThreads(_projectId, _threads) {
  return { newThreads: {} }
}

/**
 * @param {any} _projectId
 * @param {any} _threads
 * @return {Promise<Record<string, any>>}
 */
async function generateThreadData(_projectId, _threads) {
  return {}
}

/**
 * @param {string} _sourceProjectId
 * @param {string} _targetProjectId
 * @return {Promise<void>}
 */
async function cloneCommentThreads(_sourceProjectId, _targetProjectId) {}

export default {
  getThread: callbackify(getThread),
  getThreadMessage: callbackify(getThreadMessage),
  getThreads: callbackify(getThreads),
  destroyProject: callbackify(destroyProject),
  sendGlobalMessage: callbackify(sendGlobalMessage),
  getGlobalMessages: callbackify(getGlobalMessages),
  getGlobalMessage: callbackify(getGlobalMessage),
  sendComment: callbackify(sendComment),
  resolveThread: callbackify(resolveThread),
  reopenThread: callbackify(reopenThread),
  deleteThread: callbackify(deleteThread),
  editMessage: callbackify(editMessage),
  editGlobalMessage: callbackify(editGlobalMessage),
  deleteMessage: callbackify(deleteMessage),
  deleteUserMessage: callbackify(deleteUserMessage),
  deleteGlobalMessage: callbackify(deleteGlobalMessage),
  getResolvedThreadIds: callbackify(getResolvedThreadIds),
  duplicateCommentThreads: callbackify(duplicateCommentThreads),
  generateThreadData: callbackify(generateThreadData),
  promises: {
    getThread,
    getThreadMessage,
    getThreads,
    destroyProject,
    sendGlobalMessage,
    getGlobalMessages,
    getGlobalMessage,
    sendComment,
    resolveThread,
    reopenThread,
    deleteThread,
    editMessage,
    editGlobalMessage,
    deleteMessage,
    deleteUserMessage,
    deleteGlobalMessage,
    getResolvedThreadIds,
    duplicateCommentThreads,
    generateThreadData,
    cloneCommentThreads,
  },
}
