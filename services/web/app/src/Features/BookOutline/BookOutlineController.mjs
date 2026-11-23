import { expressify } from '@overleaf/promise-utils'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import { buildBookOutline } from './BookOutline.mjs'

const getBookOutlineSchema = z.object({
  params: z.strictObject({ project_id: zz.objectId() }),
  query: z.object({ language: z.string().regex(/^[A-Za-z-]{1,12}$/).optional() }),
})

async function getBookOutline(req, res) {
  const { params, query } = parseReq(req, getBookOutlineSchema, {
    logOnly: true,
  })
  const projectId = params.project_id
  // the editor writes through document-updater; read what is current
  await DocumentUpdaterHandler.promises.flushProjectToMongo(projectId)
  const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
  const lines = {}
  for (const [path, doc] of Object.entries(docs)) {
    if (/\.(md|markdown|ya?ml)$/i.test(path)) lines[path] = doc.lines
  }
  res.json(buildBookOutline(lines, { language: query.language }))
}

export default { getBookOutline: expressify(getBookOutline) }
