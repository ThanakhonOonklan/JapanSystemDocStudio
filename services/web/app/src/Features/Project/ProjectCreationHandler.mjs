import OError from '@overleaf/o-error'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import mongodb from 'mongodb-legacy'
import { Project } from '../../models/Project.mjs'
import { Folder } from '../../models/Folder.mjs'
import ProjectEntityUpdateHandler from './ProjectEntityUpdateHandler.mjs'
import ProjectDetailsHandler from './ProjectDetailsHandler.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import { User } from '../../models/User.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { callbackify } from 'node:util'
import _ from 'lodash'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import TpdsUpdateSender from '../ThirdPartyDataStore/TpdsUpdateSender.mjs'
import SplitTestHandler from '../SplitTests/SplitTestHandler.mjs'
import SplitTestUserGetter from '../SplitTests/SplitTestUserGetter.mjs'

const { ObjectId } = mongodb

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

async function createBlankProject(
  ownerId,
  projectName,
  attributes = {},
  options
) {
  const isImport = attributes && attributes.overleaf
  const project = await _createBlankProject(
    ownerId,
    projectName,
    attributes,
    options
  )
  const segmentation = _.pick(attributes, [
    'fromV1TemplateId',
    'fromV1TemplateVersionId',
  ])
  Object.assign(segmentation, attributes.segmentation)
  segmentation.projectId = project._id
  if (isImport) {
    AnalyticsManager.recordEventForUserInBackground(
      ownerId,
      'project-imported',
      segmentation
    )
  } else {
    AnalyticsManager.recordEventForUserInBackground(
      ownerId,
      'project-created',
      segmentation
    )
  }
  return project
}

async function createProjectFromSnippet(ownerId, projectName, docLines) {
  const project = await _createBlankProject(ownerId, projectName)
  AnalyticsManager.recordEventForUserInBackground(ownerId, 'project-created', {
    projectId: project._id,
  })
  await _createRootDoc(project, ownerId, docLines)
  return project
}

// Documentation Studio REA: new projects are Markdown books (book.yaml with
// th/ and en/ chapters). The files come from templates/project_files/<dir>/.
const MARKDOWN_TEMPLATES = {
  blank: {
    dir: 'md-blank',
    docs: ['book.yaml', 'th/01-intro.md', 'en/01-intro.md'],
    files: [],
  },
  example: {
    dir: 'md-example',
    docs: [
      'book.yaml',
      'th/01-intro.md',
      'th/02-writing.md',
      'en/01-intro.md',
      'en/02-writing.md',
    ],
    files: ['assets/diagram.svg'],
  },
}

async function _addMarkdownProjectFiles(project, ownerId, projectName, kind) {
  const spec = MARKDOWN_TEMPLATES[kind]
  for (const relativePath of spec.docs) {
    const docLines = await _buildTemplate(
      `${spec.dir}/${relativePath}`,
      ownerId,
      projectName
    )
    const { doc } =
      await ProjectEntityUpdateHandler.promises.upsertDocWithPath(
        project._id,
        `/${relativePath}`,
        docLines,
        null,
        ownerId
      )
    if (relativePath === 'book.yaml') {
      await ProjectEntityUpdateHandler.promises.setRootDoc(project._id, doc._id)
      // update the rootDoc id on the project in memory
      project.rootDoc_id = doc._id
    }
  }
  for (const relativePath of spec.files) {
    await ProjectEntityUpdateHandler.promises.upsertFileWithPath(
      project._id,
      `/${relativePath}`,
      path.join(
        import.meta.dirname,
        `/../../../templates/project_files/${spec.dir}/${relativePath}`
      ),
      null,
      ownerId,
      null
    )
  }
}

async function _createMarkdownProject(ownerId, projectName, kind, attributes) {
  const project = await _createBlankProject(ownerId, projectName, attributes)
  try {
    await _addMarkdownProjectFiles(project, ownerId, projectName, kind)
  } catch (error) {
    throw OError.tag(error, 'error adding files when creating Markdown project')
  }
  AnalyticsManager.recordEventForUserInBackground(ownerId, 'project-created', {
    projectId: project._id,
  })
  return project
}

async function createBasicProject(ownerId, projectName) {
  return await _createMarkdownProject(ownerId, projectName, 'blank')
}

async function createExampleProject(ownerId, projectName, attributes = {}) {
  return await _createMarkdownProject(
    ownerId,
    projectName,
    'example',
    attributes
  )
}

async function _createBlankProject(
  ownerId,
  projectName,
  attributes = {},
  { skipCreatingInTPDS = false } = {}
) {
  metrics.inc('project-creation')
  const timer = new metrics.Timer('project-creation')
  await ProjectDetailsHandler.promises.validateProjectName(projectName)

  const rootFolder = new Folder({ name: 'rootFolder' })

  attributes.lastUpdatedBy = attributes.owner_ref = new ObjectId(ownerId)
  attributes.name = projectName
  const project = new Project(attributes)

  // Initialise the history unless the caller has overridden it in the attributes
  // (to allow scripted creation of projects without full project history)
  if (project.overleaf.history.id == null && !attributes.overleaf) {
    const historyId = await HistoryManager.promises.initializeProject(
      project._id
    )
    if (historyId != null) {
      project.overleaf.history.id = historyId
    }
  }

  // All the projects are initialised with Full Project History. This property
  // is still set for backwards compatibility: Server Pro requires all projects
  // have it set to `true` since SP 4.0
  project.overleaf.history.display = true

  if (Settings.currentImageName) {
    // avoid clobbering any imageName already set in attributes (e.g. importedImageName)
    if (!project.imageName) {
      project.imageName = Settings.currentImageName
    }
  }
  project.rootFolder[0] = rootFolder
  const user = await User.findById(ownerId, {
    'ace.spellCheckLanguage': 1,
    _id: 1,
    ...SplitTestUserGetter.getProjection('history-ranges-support'),
  })
  project.spellCheckLanguage = user.ace.spellCheckLanguage
  const historyRangesSupportAssignment =
    await SplitTestHandler.promises.getAssignmentForMongoUser(
      user,
      'history-ranges-support'
    )
  if (historyRangesSupportAssignment.variant === 'enabled') {
    project.overleaf.history.rangesSupportEnabled = true
  }

  if (attributes.isDebugCopyOf) {
    project.overleaf.isDebugCopyOf = new ObjectId(attributes.isDebugCopyOf)
  }

  await project.save()
  if (!skipCreatingInTPDS) {
    await TpdsUpdateSender.promises.createProject({
      projectId: project._id,
      projectName,
      ownerId,
      userId: ownerId,
    })
  }
  timer.done()
  return project
}

async function _createRootDoc(project, ownerId, docLines) {
  try {
    const { doc } = await ProjectEntityUpdateHandler.promises.addDoc(
      project._id,
      project.rootFolder[0]._id,
      'main.tex',
      docLines,
      ownerId,
      null
    )
    await ProjectEntityUpdateHandler.promises.setRootDoc(project._id, doc._id)
    // update the rootDoc id on the project in memory
    // used to identify the rootResourcePath when doing an initial compile from history
    project.rootDoc_id = doc._id
    return doc
  } catch (error) {
    throw OError.tag(error, 'error adding root doc when creating project')
  }
}

async function _buildTemplate(templateName, userId, projectName) {
  const user = await User.findById(userId, 'first_name last_name')

  const templatePath = path.join(
    import.meta.dirname,
    `/../../../templates/project_files/${templateName}`
  )
  const template = fs.readFileSync(templatePath)
  const now = new Date()
  const data = {
    project_name: projectName,
    user,
    author: [user?.first_name, user?.last_name].filter(Boolean).join(' '),
    year: now.getUTCFullYear(),
    month: MONTH_NAMES[now.getUTCMonth()],
    // e.g. "พฤศจิกายน 2569" (Buddhist era)
    thai_date: `${THAI_MONTH_NAMES[now.getUTCMonth()]} ${now.getUTCFullYear() + 543}`,
  }
  const output = _.template(template.toString())(data)
  return output.split('\n')
}

export default {
  createBlankProject: callbackify(createBlankProject),
  createProjectFromSnippet: callbackify(createProjectFromSnippet),
  createBasicProject: callbackify(createBasicProject),
  createExampleProject: callbackify(createExampleProject),
  promises: {
    createBlankProject,
    createProjectFromSnippet,
    createBasicProject,
    createExampleProject,
  },
}
