// Japan Documentation Studio: administrator commands.
//
// There is no admin page in the web app. The administrator runs these on the
// server (from the folder that holds docker-compose.local.yml):
//
//   docker exec docstudio-app sh -c "cd /overleaf/services/web && \
//     node modules/server-ce-scripts/scripts/docstudio-admin.mjs <command> [options]"
//
// Commands
//   users                                   everybody who has signed in, with
//                                           the number of projects each owns
//   projects [--user EMAIL]                 projects (all, or one user's)
//   set-admin --email EMAIL [--revoke]      make somebody an administrator
//   move-project --project ID_OR_NAME --to EMAIL [--from EMAIL] [--dry-run]
//   move-project --all-from EMAIL --to EMAIL [--dry-run]
//                                           give projects to another user
//   deleted [--user EMAIL]                  deleted projects that can still be
//                                           restored (about 90 days)
//   restore-project --project-id ID --user EMAIL
//                                           bring a deleted project back
//
// Emails are the ones the login proxy sends (the organisation account).

import minimist from 'minimist'
import { db, ObjectId } from '../../../app/src/infrastructure/mongodb.mjs'
import ProjectDeleter from '../../../app/src/Features/Project/ProjectDeleter.mjs'
import { scriptRunner } from '../../../scripts/lib/ScriptRunner.mjs'

const USAGE = `Usage: docstudio-admin.mjs <command> [options]

  users
  projects [--user EMAIL]
  set-admin --email EMAIL [--revoke]
  move-project --project ID_OR_NAME --to EMAIL [--from EMAIL] [--dry-run]
  move-project --all-from EMAIL --to EMAIL [--dry-run]
  deleted [--user EMAIL]
  restore-project --project-id ID --user EMAIL
`

const lower = value => String(value).trim().toLowerCase()

function table(rows, columns) {
  const widths = columns.map(c =>
    Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length))
  )
  const line = values =>
    values.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  ')
  console.log(line(columns))
  console.log(widths.map(w => '-'.repeat(w)).join('  '))
  for (const row of rows) console.log(line(columns.map(c => row[c])))
  console.log(`\n${rows.length} row(s)`)
}

const date = value => (value ? new Date(value).toISOString().slice(0, 10) : '')

async function userByEmail(email) {
  const user = await db.users.findOne({ email: lower(email) })
  if (!user) {
    throw new Error(
      `no user with the email ${email} (a user is created the first time they sign in)`
    )
  }
  return user
}

async function users() {
  const owned = new Map()
  const counts = await db.projects
    .aggregate([{ $group: { _id: '$owner_ref', n: { $sum: 1 } } }])
    .toArray()
  for (const { _id, n } of counts) owned.set(String(_id), n)

  const all = await db.users
    .find({}, { projection: { email: 1, isAdmin: 1, signUpDate: 1, lastLoggedIn: 1 } })
    .sort({ email: 1 })
    .toArray()
  table(
    all.map(u => ({
      email: u.email,
      admin: u.isAdmin ? 'yes' : '',
      projects: owned.get(String(u._id)) ?? 0,
      'first seen': date(u.signUpDate),
      'last login': date(u.lastLoggedIn),
      id: String(u._id),
    })),
    ['email', 'admin', 'projects', 'first seen', 'last login', 'id']
  )
}

async function projects(argv) {
  const query = {}
  if (argv.user) query.owner_ref = (await userByEmail(argv.user))._id
  const list = await db.projects
    .find(query, { projection: { name: 1, owner_ref: 1, lastUpdated: 1, archived: 1 } })
    .sort({ lastUpdated: -1 })
    .toArray()
  const ids = [...new Set(list.map(p => String(p.owner_ref)))].map(
    id => new ObjectId(id)
  )
  const owners = new Map(
    (
      await db.users
        .find({ _id: { $in: ids } }, { projection: { email: 1 } })
        .toArray()
    ).map(u => [String(u._id), u.email])
  )
  table(
    list.map(p => ({
      name: p.name,
      owner: owners.get(String(p.owner_ref)) ?? String(p.owner_ref),
      updated: date(p.lastUpdated),
      id: String(p._id),
    })),
    ['name', 'owner', 'updated', 'id']
  )
}

async function setAdmin(argv) {
  if (!argv.email) throw new Error('set --email')
  const user = await userByEmail(argv.email)
  const isAdmin = !argv.revoke
  await db.users.updateOne({ _id: user._id }, { $set: { isAdmin } })
  console.log(`${user.email} is ${isAdmin ? 'now' : 'no longer'} an administrator`)
}

async function findProjectsToMove(argv) {
  if (argv['all-from']) {
    const from = await userByEmail(argv['all-from'])
    return db.projects.find({ owner_ref: from._id }).toArray()
  }
  if (!argv.project) throw new Error('set --project (an id or an exact name) or --all-from')
  const query = ObjectId.isValid(argv.project) && String(argv.project).length === 24
    ? { _id: new ObjectId(argv.project) }
    : { name: String(argv.project) }
  if (argv.from) query.owner_ref = (await userByEmail(argv.from))._id
  const found = await db.projects.find(query).toArray()
  if (found.length > 1) {
    throw new Error(
      `${found.length} projects are named "${argv.project}"; add --from EMAIL or use the project id (see the "projects" command)`
    )
  }
  if (found.length === 0) throw new Error(`no project matches "${argv.project}"`)
  return found
}

async function uniqueName(ownerId, name) {
  const taken = new Set(
    (
      await db.projects
        .find({ owner_ref: ownerId }, { projection: { name: 1 } })
        .toArray()
    ).map(p => p.name)
  )
  if (!taken.has(name)) return name
  let candidate = `${name} (moved)`
  for (let n = 2; taken.has(candidate); n++) candidate = `${name} (moved ${n})`
  return candidate
}

async function moveProject(argv) {
  if (!argv.to) throw new Error('set --to EMAIL')
  const target = await userByEmail(argv.to)
  const found = await findProjectsToMove(argv)
  const dryRun = Boolean(argv['dry-run'])

  for (const project of found) {
    if (String(project.owner_ref) === String(target._id)) {
      console.log(`skip     ${project.name} (already owned by ${target.email})`)
      continue
    }
    const name = await uniqueName(target._id, project.name)
    console.log(
      `${dryRun ? 'would move' : 'moving    '} ${project.name}` +
        `${name !== project.name ? ` as "${name}"` : ''} -> ${target.email}`
    )
    if (dryRun) continue
    await db.projects.updateOne(
      { _id: project._id },
      {
        $set: { owner_ref: target._id, name },
        // the new owner must not stay on the project as a collaborator too
        $pull: {
          collaberator_refs: target._id,
          readOnly_refs: target._id,
          reviewer_refs: target._id,
          tokenAccessReadAndWrite_refs: target._id,
          tokenAccessReadOnly_refs: target._id,
        },
      }
    )
  }
  if (!dryRun) {
    console.log(
      '\nThe new owner sees the project the next time the project list loads.\n' +
        'Ask people to close the project in their browser first if it was open.'
    )
  }
}

async function deleted(argv) {
  const query = {}
  if (argv.user) {
    query['deleterData.deletedProjectOwnerId'] = (await userByEmail(argv.user))._id
  }
  const list = await db.deletedProjects
    .find(query)
    .sort({ 'deleterData.deletedAt': -1 })
    .toArray()
  const ids = [
    ...new Set(
      list.map(p => String(p.deleterData?.deletedProjectOwnerId)).filter(Boolean)
    ),
  ]
    .filter(id => ObjectId.isValid(id))
    .map(id => new ObjectId(id))
  const owners = new Map(
    (
      await db.users
        .find({ _id: { $in: ids } }, { projection: { email: 1 } })
        .toArray()
    ).map(u => [String(u._id), u.email])
  )
  table(
    list.map(p => ({
      name: p.project?.name ?? '(contents already removed)',
      owner:
        owners.get(String(p.deleterData?.deletedProjectOwnerId)) ??
        String(p.deleterData?.deletedProjectOwnerId ?? ''),
      deleted: date(p.deleterData?.deletedAt),
      'project id': String(p.deleterData?.deletedProjectId ?? ''),
    })),
    ['name', 'owner', 'deleted', 'project id']
  )
}

async function restoreProject(argv) {
  const projectId = argv['project-id']
  if (!projectId || !argv.user) throw new Error('set --project-id and --user EMAIL')
  const user = await userByEmail(argv.user)
  console.log(`Restoring project ${projectId} to ${user.email}`)
  await ProjectDeleter.promises.undeleteProject(projectId, { userId: user._id })
}

const COMMANDS = {
  users,
  projects,
  'set-admin': setAdmin,
  'move-project': moveProject,
  deleted,
  'restore-project': restoreProject,
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['revoke', 'dry-run'],
    string: ['email', 'user', 'to', 'from', 'all-from', 'project', 'project-id'],
  })
  const command = COMMANDS[argv._[0]]
  if (!command) {
    console.log(USAGE)
    throw new Error(argv._[0] ? `unknown command "${argv._[0]}"` : 'no command given')
  }
  await command(argv)
}

try {
  await scriptRunner(main)
  process.exit(0)
} catch (error) {
  console.error(`\n${error.message}`)
  process.exit(1)
}
