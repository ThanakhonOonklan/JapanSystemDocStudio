// Documentation Studio REA: there is exactly one user. It is created
// automatically the first time the web process starts, so nothing has to be
// set up by hand and there are no registration or password pages.
//
// The user is identified by the OVERLEAF_SINGLE_USER_EMAIL setting. Every
// visitor is logged in as that user (see SingleUserMiddleware).

import mongodb from 'mongodb-legacy'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import UserGetter from '../Features/User/UserGetter.mjs'
import UserCreator from '../Features/User/UserCreator.mjs'
import { db } from './mongodb.mjs'

const { ObjectId } = mongodb

export async function ensureSingleUser() {
  const email = Settings.singleUserEmail
  if (!email) return null

  const existing = await UserGetter.promises.getUserByMainEmail(email)
  if (existing) return existing

  const user = await UserCreator.promises.createNewUser(
    {
      email,
      holdingAccount: false,
      analyticsId: new ObjectId().toString(),
    },
    { confirmedAt: new Date() }
  )
  // the one user may use every feature of the system
  await db.users.updateOne({ _id: user._id }, { $set: { isAdmin: true } })
  logger.info({ userId: user._id }, 'created the single user')
  return user
}
