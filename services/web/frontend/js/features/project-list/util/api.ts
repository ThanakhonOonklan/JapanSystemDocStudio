import {
  GetProjectsResponseBody,
  Sort,
} from '../../../../../types/project/dashboard/api'
import { deleteJSON, postJSON } from '../../../infrastructure/fetch-json'

export function getProjects(sortBy: Sort): Promise<GetProjectsResponseBody> {
  return postJSON('/api/project', { body: { sort: sortBy } })
}

// Deleting a project removes it for good (no trash, no archive).
export function deleteProject(projectId: string) {
  return deleteJSON(`/project/${projectId}`)
}

export function renameProject(projectId: string, newName: string) {
  return postJSON(`/project/${projectId}/rename`, {
    body: {
      newProjectName: newName,
    },
  })
}
