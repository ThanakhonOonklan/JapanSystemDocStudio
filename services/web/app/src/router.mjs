import ErrorController from './Features/Errors/ErrorController.mjs'
import Features from './infrastructure/Features.mjs'
import ProjectController from './Features/Project/ProjectController.mjs'
import ProjectApiController from './Features/Project/ProjectApiController.mjs'
import ProjectListController from './Features/Project/ProjectListController.mjs'
import SpellingController from './Features/Spelling/SpellingController.mjs'
import EditorRouter from './Features/Editor/EditorRouter.mjs'
import Settings from '@overleaf/settings'
import TpdsController from './Features/ThirdPartyDataStore/TpdsController.mjs'
import UploadsRouter from './Features/Uploads/UploadsRouter.mjs'
import metrics from '@overleaf/metrics'
import AuthenticationController from './Features/Authentication/AuthenticationController.mjs'
import PermissionsController from './Features/Authorization/PermissionsController.mjs'
import CollaboratorsRouter from './Features/Collaborators/CollaboratorsRouter.mjs'
import UserInfoController from './Features/User/UserInfoController.mjs'
import UserController from './Features/User/UserController.mjs'
import TutorialController from './Features/Tutorial/TutorialController.mjs'
import DocumentController from './Features/Documents/DocumentController.mjs'
import CompileManager from './Features/Compile/CompileManager.mjs'
import CompileController from './Features/Compile/CompileController.mjs'
import HealthCheckController from './Features/HealthCheck/HealthCheckController.mjs'
import ProjectDownloadsController from './Features/Downloads/ProjectDownloadsController.mjs'
import FileStoreController from './Features/FileStore/FileStoreController.mjs'
import DocumentUpdaterController from './Features/DocumentUpdater/DocumentUpdaterController.mjs'
import HistoryRouter from './Features/History/HistoryRouter.mjs'
import ExportsController from './Features/Exports/ExportsController.mjs'
import ChatController from './Features/Chat/ChatController.mjs'
import Modules from './infrastructure/Modules.mjs'
import {
  RateLimiter,
  openProjectRateLimiter,
  overleafLoginRateLimiter,
} from './infrastructure/RateLimiter.mjs'
import RateLimiterMiddleware from './Features/Security/RateLimiterMiddleware.mjs'
import InactiveProjectController from './Features/InactiveData/InactiveProjectController.mjs'
import ReferencesController from './Features/References/ReferencesController.mjs'
import AuthorizationMiddleware from './Features/Authorization/AuthorizationMiddleware.mjs'
import MetaController from './Features/Metadata/MetaController.mjs'
import LinkedFilesRouter from './Features/LinkedFiles/LinkedFilesRouter.mjs'
import SystemMessageController from './Features/SystemMessages/SystemMessageController.mjs'
import AnalyticsRegistrationSourceMiddleware from './Features/Analytics/AnalyticsRegistrationSourceMiddleware.mjs'
import AnalyticsUTMTrackingMiddleware from './Features/Analytics/AnalyticsUTMTrackingMiddleware.mjs'
import UnsupportedBrowserMiddleware from './infrastructure/UnsupportedBrowserMiddleware.mjs'
import logger from '@overleaf/logger'
import _ from 'lodash'
import { plainTextResponse } from './infrastructure/Response.mjs'
import SocketDiagnostics from './Features/SocketDiagnostics/SocketDiagnostics.mjs'
import ClsiCacheController from './Features/Compile/ClsiCacheController.mjs'
import AsyncLocalStorage from './infrastructure/AsyncLocalStorage.mjs'
import {
  getRawReqInput,
  parseReq,
  z,
  zz,
} from './infrastructure/Validation.mjs'

const { renderUnsupportedBrowserPage, unsupportedBrowserMiddleware } =
  UnsupportedBrowserMiddleware

const rateLimiters = {
  addEmail: new RateLimiter('add-email', {
    points: 10,
    duration: 60,
  }),
  addProjectToTag: new RateLimiter('add-project-to-tag', {
    points: 30,
    duration: 60,
  }),
  addProjectsToTag: new RateLimiter('add-projects-to-tag', {
    points: 30,
    duration: 60,
  }),
  canSkipCaptcha: new RateLimiter('can-skip-captcha', {
    points: 20,
    duration: 60,
  }),
  changePassword: new RateLimiter('change-password', {
    points: 10,
    duration: 60,
  }),
  compileProjectHttp: new RateLimiter('compile-project-http', {
    points: 200,
    duration: 10 * 60,
  }),
  confirmEmail: new RateLimiter('confirm-email', {
    points: 10,
    duration: 60,
  }),
  createProject: new RateLimiter('create-project', {
    points: 20,
    duration: 60,
  }),
  createTag: new RateLimiter('create-tag', {
    points: 30,
    duration: 60,
  }),
  deleteEmail: new RateLimiter('delete-email', {
    points: 10,
    duration: 60,
  }),
  deleteTag: new RateLimiter('delete-tag', {
    points: 30,
    duration: 60,
  }),
  deleteUser: new RateLimiter('delete-user', {
    points: 10,
    duration: 60,
  }),
  endorseEmail: new RateLimiter('endorse-email', {
    points: 30,
    duration: 60,
  }),
  getProjects: new RateLimiter('get-projects', {
    points: 30,
    duration: 60,
  }),
  grantTokenAccessReadOnly: new RateLimiter('grant-token-access-read-only', {
    points: 10,
    duration: 60,
  }),
  grantTokenAccessReadWrite: new RateLimiter('grant-token-access-read-write', {
    points: 10,
    duration: 60,
  }),
  indexAllProjectReferences: new RateLimiter('index-all-project-references', {
    points: 30,
    duration: 60,
  }),
  miscOutputDownload: new RateLimiter('misc-output-download', {
    points: 1000,
    duration: 60 * 60,
  }),
  multipleProjectsZipDownload: new RateLimiter(
    'multiple-projects-zip-download',
    {
      points: 10,
      duration: 60,
    }
  ),
  openDashboard: new RateLimiter('open-dashboard', {
    points: 30,
    duration: 60,
  }),
  readAndWriteToken: new RateLimiter('read-and-write-token', {
    points: 15,
    duration: 60,
  }),
  readOnlyToken: new RateLimiter('read-only-token', {
    points: 15,
    duration: 60,
  }),
  removeProjectFromTag: new RateLimiter('remove-project-from-tag', {
    points: 30,
    duration: 60,
  }),
  removeProjectsFromTag: new RateLimiter('remove-projects-from-tag', {
    points: 30,
    duration: 60,
  }),
  renameTag: new RateLimiter('rename-tag', {
    points: 30,
    duration: 60,
  }),
  resendConfirmation: new RateLimiter('resend-confirmation', {
    points: 1,
    duration: 60,
  }),
  sendConfirmation: new RateLimiter('send-confirmation', {
    points: 2,
    duration: 60,
  }),
  sendChatMessage: new RateLimiter('send-chat-message', {
    points: 100,
    duration: 60,
  }),
  statusCompiler: new RateLimiter('status-compiler', {
    points: 10,
    duration: 60,
  }),
  zipDownload: new RateLimiter('zip-download', {
    points: 10,
    duration: 60,
  }),
  documentExport: new RateLimiter('document-export', {
    points: 5,
    duration: 60,
  }),
  documentExportDownload: new RateLimiter('document-export-download', {
    points: 30,
    duration: 60,
  }),
}

const statusCompilerSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
})

async function initialize(webRouter, privateApiRouter, publicApiRouter) {
  webRouter.use(unsupportedBrowserMiddleware)

  if (!Settings.allowPublicAccess) {
    webRouter.all('*', AuthenticationController.requireGlobalLogin)
  }

  webRouter.get('*', AnalyticsRegistrationSourceMiddleware.setInbound())
  webRouter.get('*', AnalyticsUTMTrackingMiddleware.recordUTMTags())

  if (process.env.NODE_ENV === 'development' && global.__coverage__) {
    // Expose code coverage via an endpoint when running with code coverage enabled
    webRouter.get('/coverage', (req, res) => {
      const coverage = {}
      for (const [key, value] of Object.entries(global.__coverage__)) {
        coverage[key] = {
          ...value,
          // Transform for Jenkins sourcemap
          path: value.path.replace('/overleaf/', '/workspace/'),
        }
      }
      res.json({ coverage })
    })
  }

  // Documentation Studio REA: there is one user who is logged in
  // automatically, so there are no login, register, password, account,
  // subscription, admin or sharing pages.
  webRouter.get('/', (req, res) => res.redirect('/project'))

  webRouter.get(
    '/socket-diagnostics',
    AuthenticationController.requireLogin(),
    SocketDiagnostics.index
  )

  EditorRouter.apply(webRouter, privateApiRouter)
  CollaboratorsRouter.apply(webRouter, privateApiRouter)
  UploadsRouter.apply(webRouter, privateApiRouter)
  LinkedFilesRouter.apply(webRouter, privateApiRouter, publicApiRouter)
  HistoryRouter.apply(webRouter, privateApiRouter)

  await Modules.applyRouter(webRouter, privateApiRouter, publicApiRouter)

  // .getMessages will generate an empty response for anonymous users.
  webRouter.get('/system/messages', SystemMessageController.getMessages)

  webRouter.get(
    '/user/features',
    AuthenticationController.requireLogin(),
    UserInfoController.getUserFeatures
  )

  webRouter.post(
    '/tutorial/:tutorialKey/complete',
    AuthenticationController.requireLogin(),
    TutorialController.completeTutorial
  )

  webRouter.post(
    '/tutorial/:tutorialKey/postpone',
    AuthenticationController.requireLogin(),
    TutorialController.postponeTutorial
  )

  webRouter.get(
    '/user/projects',
    AuthenticationController.requireLogin(),
    ProjectController.userProjectsJson
  )
  webRouter.get(
    '/project/:Project_id/entities',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.projectEntitiesJson
  )

  // All project dashboard navigation states render the same page. The active
  // navigation item is derived from the URL on the frontend.
  const domainCaptureTestSessionMiddleware = await Modules.middleware(
    'domainCaptureTestSession'
  )
  for (const projectDashboardRoute of ['/project', '/project/owned']) {
    webRouter.get(
      projectDashboardRoute,
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(rateLimiters.openDashboard),
      AsyncLocalStorage.middleware,
      domainCaptureTestSessionMiddleware,
      PermissionsController.useCapabilities(),
      ProjectListController.projectListPage
    )
  }
  webRouter.post(
    '/project/new',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.createProject),
    ProjectController.newProject
  )
  webRouter.post(
    '/api/project',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.getProjects),
    ProjectListController.getProjectsJson
  )

  for (const route of [
    // Keep the old route for continuous metrics
    '/Project/:Project_id',
    // New route for pdf-detach
    '/Project/:Project_id/:detachRole(detacher|detached)',
  ]) {
    webRouter.get(
      route,
      RateLimiterMiddleware.rateLimit(openProjectRateLimiter, {
        params: ['Project_id'],
      }),
      AsyncLocalStorage.middleware,
      PermissionsController.useCapabilities(),
      AuthorizationMiddleware.ensureUserCanReadProject,
      ProjectController.loadEditor
    )
  }
  webRouter.head(
    '/Project/:Project_id/file/:File_id',
    AuthorizationMiddleware.ensureUserCanReadProject,
    FileStoreController.getFileHead
  )
  webRouter.get(
    '/Project/:Project_id/file/:File_id',
    AuthorizationMiddleware.ensureUserCanReadProject,
    FileStoreController.getFile
  )

  webRouter.get(
    '/Project/:Project_id/doc/:Doc_id/download', // "download" suffix to avoid conflict with private API route at doc/:doc_id
    AuthorizationMiddleware.ensureUserCanReadProject,
    DocumentUpdaterController.getDoc
  )
  webRouter.post(
    '/project/:Project_id/settings',
    AuthorizationMiddleware.ensureUserCanWriteProjectSettings,
    ProjectController.updateProjectSettings
  )
  webRouter.post(
    '/project/:Project_id/settings/admin',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.updateProjectAdminSettings
  )

  webRouter.post(
    '/project/:Project_id/compile',
    RateLimiterMiddleware.rateLimit(rateLimiters.compileProjectHttp, {
      params: ['Project_id'],
    }),
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.compile
  )

  webRouter.post(
    '/project/:Project_id/compile/stop',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.stopCompile
  )

  webRouter.get(
    '/project/:Project_id/output/cached/output.overleaf.json',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    ClsiCacheController.getLatestBuildFromCache
  )

  webRouter.get(
    '/download/project/:Project_id/build/:editorBuildId/output/cached/:filename',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ClsiCacheController.downloadFromCache
  )

  // PDF Download button for specific build
  webRouter.get(
    '/download/project/:Project_id/build/:build_id/output/output.pdf',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.downloadPdf
  )

  // Align with limits defined in CompileController.downloadPdf
  const rateLimiterMiddlewareOutputFiles = RateLimiterMiddleware.rateLimit(
    rateLimiters.miscOutputDownload,
    { params: ['Project_id'] }
  )

  // Download all the output files of a specific build
  webRouter.get(
    '/project/:Project_id/build/:build_id/output/output.zip',
    rateLimiterMiddlewareOutputFiles,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getOutputZipFromClsi
  )
  webRouter.get(
    '/project/:Project_id/user/:user_id/build/:build_id/output/output.zip',
    rateLimiterMiddlewareOutputFiles,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getOutputZipFromClsi
  )

  // direct url access to output files for a specific build
  webRouter.get(
    '/project/:Project_id/build/:build_id/output/:file(.+)',
    rateLimiterMiddlewareOutputFiles,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  // direct url access to output files for a specific user and build
  webRouter.get(
    '/project/:Project_id/user/:user_id/build/:build_id/output/:file(.+)',
    rateLimiterMiddlewareOutputFiles,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.getFileFromClsi
  )

  webRouter.delete(
    '/project/:Project_id/output',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.deleteAuxFiles
  )
  webRouter.get(
    '/project/:Project_id/sync/code',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.proxySyncCode
  )
  webRouter.get(
    '/project/:Project_id/sync/pdf',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.proxySyncPdf
  )
  webRouter.get(
    '/project/:Project_id/wordcount',
    AuthorizationMiddleware.ensureUserCanReadProject,
    CompileController.wordCount
  )

  webRouter.delete(
    '/Project/:Project_id',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.deleteProject
  )

  webRouter.post(
    '/Project/:Project_id/clone',
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectController.cloneProject
  )

  webRouter.post(
    '/project/:Project_id/rename',
    AuthenticationController.requireLogin(),
    AuthorizationMiddleware.ensureUserCanAdminProject,
    ProjectController.renameProject
  )
  webRouter.post(
    '/project/:project_id/export/:brand_variation_id',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportProject
  )
  webRouter.get(
    '/project/:project_id/export/:export_id',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportStatus
  )
  webRouter.get(
    '/project/:project_id/export/:export_id/:type',
    AuthorizationMiddleware.ensureUserCanWriteProjectContent,
    ExportsController.exportDownload
  )

  if (Settings.enablePandocConversions) {
    webRouter.get(
      '/project/:Project_id/download/conversion/:type',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(rateLimiters.documentExport, {
        params: ['Project_id'],
      }),
      AuthorizationMiddleware.ensureUserCanReadProject,
      ProjectDownloadsController.exportProjectConversion
    )
    webRouter.get(
      '/project/:Project_id/download/conversion/:conversionId/:type/build/:buildId/output/:file(.+)',
      AuthenticationController.requireLogin(),
      RateLimiterMiddleware.rateLimit(rateLimiters.documentExportDownload, {
        params: ['Project_id'],
      }),
      AuthorizationMiddleware.ensureUserCanReadProject,
      ProjectDownloadsController.downloadPreparedProjectExport
    )
  }

  webRouter.get(
    '/Project/:Project_id/download/zip',
    RateLimiterMiddleware.rateLimit(rateLimiters.zipDownload, {
      params: ['Project_id'],
    }),
    AuthorizationMiddleware.ensureUserCanReadProject,
    ProjectDownloadsController.downloadProject
  )
  webRouter.get(
    '/project/download/zip',
    AuthenticationController.requireLogin(),
    RateLimiterMiddleware.rateLimit(rateLimiters.multipleProjectsZipDownload),
    AuthorizationMiddleware.ensureUserCanReadMultipleProjects,
    ProjectDownloadsController.downloadMultipleProjects
  )

  webRouter.get(
    '/project/:project_id/metadata',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    Settings.allowAnonymousReadAndWriteSharing
      ? (req, res, next) => {
          next()
        }
      : AuthenticationController.requireLogin(),
    MetaController.getMetadata
  )
  webRouter.post(
    '/project/:project_id/doc/:doc_id/metadata',
    AsyncLocalStorage.middleware,
    AuthorizationMiddleware.ensureUserCanReadProject,
    Settings.allowAnonymousReadAndWriteSharing
      ? (req, res, next) => {
          next()
        }
      : AuthenticationController.requireLogin(),
    MetaController.broadcastMetadataForDoc
  )
  privateApiRouter.post(
    '/internal/expire-deleted-projects-after-duration',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectController.expireDeletedProjectsAfterDuration
  )
  privateApiRouter.post(
    '/internal/expire-deleted-users-after-duration',
    AuthenticationController.requirePrivateApiAuth(),
    UserController.expireDeletedUsersAfterDuration
  )
  privateApiRouter.post(
    '/internal/project/:projectId/expire-deleted-project',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectController.expireDeletedProject
  )
  privateApiRouter.post(
    '/internal/users/:userId/expire',
    AuthenticationController.requirePrivateApiAuth(),
    UserController.expireDeletedUser
  )

  // Deprecated in favour of /internal/project/:project_id but still used by versioning
  privateApiRouter.get(
    '/project/:project_id/details',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectApiController.getProjectDetails
  )

  // New 'stable' /internal API end points
  privateApiRouter.get(
    '/internal/project/:project_id',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectApiController.getProjectDetails
  )
  privateApiRouter.get(
    '/internal/project/:Project_id/zip',
    AuthenticationController.requirePrivateApiAuth(),
    ProjectDownloadsController.downloadProject
  )
  privateApiRouter.get(
    '/internal/project/:project_id/compile/pdf',
    AuthenticationController.requirePrivateApiAuth(),
    CompileController.compileAndDownloadPdf
  )

  privateApiRouter.post(
    '/internal/deactivateOldProjects',
    AuthenticationController.requirePrivateApiAuth(),
    InactiveProjectController.deactivateOldProjects
  )
  privateApiRouter.post(
    '/internal/project/:project_id/deactivate',
    AuthenticationController.requirePrivateApiAuth(),
    InactiveProjectController.deactivateProject
  )

  privateApiRouter.get(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.requirePrivateApiAuth(),
    DocumentController.getDocument
  )
  privateApiRouter.post(
    '/project/:Project_id/doc/:doc_id',
    AuthenticationController.requirePrivateApiAuth(),
    DocumentController.setDocument
  )
  privateApiRouter.post(
    '/project/:Project_id/doc/:doc_id/changes/reject',
    AuthenticationController.requirePrivateApiAuth(),
    DocumentController.trackChangesRejected
  )

  privateApiRouter.post(
    '/user/:user_id/project/new',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.createProject
  )
  privateApiRouter.post(
    '/user/:user_id/project/resolve',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.resolveProject
  )
  privateApiRouter.post(
    '/tpds/folder-update',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.updateFolder
  )
  privateApiRouter.post(
    '/user/:user_id/update/:path(.+)',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.mergeUpdate
  )
  privateApiRouter.delete(
    '/user/:user_id/update/:path(.+)',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteUpdate
  )
  privateApiRouter.post(
    '/project/:project_id/user/:user_id/update/:path(.+)',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.mergeUpdate
  )
  privateApiRouter.delete(
    '/project/:project_id/user/:user_id/update/:path(.+)',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteUpdate
  )

  privateApiRouter.post(
    '/project/:project_id/contents/:path(.+)',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.updateProjectContents
  )
  privateApiRouter.delete(
    '/project/:project_id/contents/:path(.+)',
    AuthenticationController.requirePrivateApiAuth(),
    TpdsController.deleteProjectContents
  )

  webRouter.post(
    '/spelling/learn',
    AuthenticationController.requireLogin(),
    SpellingController.learn
  )

  webRouter.post(
    '/spelling/unlearn',
    AuthenticationController.requireLogin(),
    SpellingController.unlearn
  )

  if (Features.hasFeature('chat')) {
    webRouter.get(
      '/project/:project_id/messages',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      ChatController.getMessages
    )
    webRouter.post(
      '/project/:project_id/messages',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      PermissionsController.requirePermission('chat'),
      RateLimiterMiddleware.rateLimit(rateLimiters.sendChatMessage),
      ChatController.sendMessage
    )
    webRouter.delete(
      '/project/:project_id/messages/:message_id',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      AuthorizationMiddleware.ensureUserIsMessageAuthor,
      PermissionsController.requirePermission('chat'),
      ChatController.deleteMessage
    )
    webRouter.post(
      '/project/:project_id/messages/:message_id/edit',
      AuthorizationMiddleware.blockRestrictedUserFromProject,
      AuthorizationMiddleware.ensureUserCanReadProject,
      AuthorizationMiddleware.ensureUserIsMessageAuthor,
      PermissionsController.requirePermission('chat'),
      ChatController.editMessage
    )
  }

  webRouter.post(
    '/project/:Project_id/references/indexAll',
    AuthorizationMiddleware.ensureUserCanReadProject,
    RateLimiterMiddleware.rateLimit(rateLimiters.indexAllProjectReferences),
    ReferencesController.indexAll
  )

  privateApiRouter.get('/perfTest', (req, res) => {
    plainTextResponse(res, 'hello')
  })

  publicApiRouter.get('/status', (req, res) => {
    if (Settings.shuttingDown) {
      res.sendStatus(503) // Service unavailable
    } else if (!Settings.siteIsOpen) {
      plainTextResponse(res, 'web site is closed (web)')
    } else if (!Settings.editorIsOpen) {
      plainTextResponse(res, 'web editor is closed (web)')
    } else {
      plainTextResponse(res, 'web is alive (web)')
    }
  })
  privateApiRouter.get('/status', (req, res) => {
    plainTextResponse(res, 'web is alive (api)')
  })

  // used by kubernetes health-check and acceptance tests
  webRouter.get('/dev/csrf', (req, res) => {
    plainTextResponse(res, res.locals.csrfToken)
  })

  privateApiRouter.get(
    '/health_check',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  publicApiRouter.get(
    '/health_check/api',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )
  privateApiRouter.get(
    '/health_check/api',
    HealthCheckController.checkActiveHandles,
    HealthCheckController.checkApi
  )

  publicApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)
  privateApiRouter.get('/health_check/redis', HealthCheckController.checkRedis)

  publicApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)
  privateApiRouter.get('/health_check/mongo', HealthCheckController.checkMongo)

  webRouter.get(
    '/status/compiler/:Project_id',
    RateLimiterMiddleware.rateLimit(rateLimiters.statusCompiler),
    AuthorizationMiddleware.ensureUserCanReadProject,
    function (req, res) {
      const {
        params: { Project_id: projectId },
      } = parseReq(req, statusCompilerSchema, { logOnly: true })
      // use a valid user id for testing
      const testUserId = '123456789012345678901234'
      const sendRes = _.once(function (statusCode, message, clsiServerId) {
        res.status(statusCode)
        plainTextResponse(res, message)
        // Force every compile to a new server and do not leave cruft behind.
        CompileManager.promises
          .deleteAuxFiles(projectId, testUserId, clsiServerId)
          .catch(() => {})
      })
      let handler = setTimeout(function () {
        CompileManager.promises
          .stopCompile(projectId, testUserId)
          .catch(() => {})
        sendRes(500, 'Compiler timed out')
        handler = null
      }, 10000)
      CompileManager.compile(
        projectId,
        testUserId,
        {
          metricsPath: 'health-check',
          compileFromHistory: true,
          rootResourcePath: 'main.tex',
        },
        function (error, status, _outputFiles, clsiServerId) {
          if (handler) {
            clearTimeout(handler)
          }
          if (error) {
            sendRes(
              500,
              `Compiler returned error ${error.message}`,
              clsiServerId
            )
          } else if (status === 'success') {
            sendRes(
              200,
              'Compiler returned in less than 10 seconds',
              clsiServerId
            )
          } else {
            sendRes(500, `Compiler returned failure ${status}`, clsiServerId)
          }
        }
      )
    }
  )

  webRouter.post('/error/client', function (req, res, next) {
    // This route only logs whatever diagnostic payload the client reports
    // (arbitrary properties copied off a JS Error, plus free-form metadata --
    // see ide-react-context.tsx's reportError) and always 204s; it never
    // branches on the content, so there is nothing to validate it against.
    // (case 2: final error-handler logging)
    const { error, meta } = getRawReqInput(req).body
    logger.warn({ err: error, meta }, 'client side error')
    metrics.inc('client-side-error')
    res.sendStatus(204)
  })

  webRouter.get('/unsupported-browser', renderUnsupportedBrowserPage)

  webRouter.get('*', ErrorController.notFound)
}

export default { initialize, rateLimiters }
