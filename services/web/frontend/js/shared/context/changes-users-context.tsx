import { createContext, FC, useContext, useMemo } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import { UserId } from '@ol-types/user'

export type ChangesUser = {
  id: UserId
  email: string
  first_name?: string
  last_name?: string
}

export type ChangesUsers = Map<UserId, ChangesUser>

export const ChangesUsersContext = createContext<ChangesUsers | undefined>(
  undefined
)

export const ChangesUsersProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { project } = useProjectContext()
  const { members, owner } = project || {}

  // The changes/users API (project history) is not part of this build, so
  // only the owner and members are known.
  const changesUsers: ChangesUsers | undefined = undefined

  // add the project owner and members to the changes users data
  const value = useMemo(() => {
    if (!owner || !members) {
      return
    }
    const value: ChangesUsers = new Map(changesUsers)
    value.set(owner._id, { ...owner, id: owner._id })
    for (const member of members) {
      value.set(member._id, { ...member, id: member._id })
    }
    return value
  }, [members, owner])

  return (
    <ChangesUsersContext.Provider value={value}>
      {children}
    </ChangesUsersContext.Provider>
  )
}

export const useChangesUsersContext = () => {
  return useContext(ChangesUsersContext)
}
