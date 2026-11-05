import { filter as arrayFilter } from 'lodash'
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ClonedProject,
  GetProjectsResponseBody,
  Project,
  Sort,
} from '../../../../../types/project/dashboard/api'
import getMeta from '../../../utils/meta'
import useAsync from '../../../shared/hooks/use-async'
import { getProjects } from '../util/api'
import sortProjects from '../util/sort-projects'
import { debugConsole } from '@/utils/debugging'

const MAX_PROJECT_PER_PAGE = 20

// Documentation Studio REA: one user, no sharing, no tags/archive/trash.
export type Filter = 'all'
const filters: Record<Filter, Partial<Project>> = {
  all: {},
}

export type ProjectListContextValue = {
  addClonedProjectToViewData: (project: ClonedProject) => void
  selectOrUnselectAllProjects: React.Dispatch<React.SetStateAction<boolean>>
  visibleProjects: Project[]
  totalProjectsCount: number
  error: Error | null
  isLoading: ReturnType<typeof useAsync>['isLoading']
  loadProgress: number
  sort: Sort
  setSort: React.Dispatch<React.SetStateAction<Sort>>
  currentFilterProjectsCount: number
  filter: Filter
  selectFilter: (filter: Filter) => void
  updateProjectViewData: (newProjectData: Project) => void
  removeProjectFromView: (project: Project) => void
  searchText: string
  setSearchText: React.Dispatch<React.SetStateAction<string>>
  selectedProjects: Project[]
  selectedProjectIds: Set<string>
  setSelectedProjectIds: React.Dispatch<React.SetStateAction<Set<string>>>
  toggleSelectedProject: (projectId: string, selected?: boolean) => void
  hiddenProjectsCount: number
  loadMoreCount: number
  showAllProjects: () => void
  loadMoreProjects: () => void
}

export const ProjectListContext = createContext<
  ProjectListContextValue | undefined
>(undefined)

type ProjectListProviderProps = {
  children: ReactNode
}

export function ProjectListProvider({
  children,
}: ProjectListProviderProps) {
  const prefetchedProjectsBlob = getMeta('ol-prefetchedProjectsBlob')
  const [loadedProjects, setLoadedProjects] = useState<Project[]>(
    prefetchedProjectsBlob?.projects ?? []
  )
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([])
  const [maxVisibleProjects, setMaxVisibleProjects] =
    useState(MAX_PROJECT_PER_PAGE)
  const [hiddenProjectsCount, setHiddenProjectsCount] = useState(0)
  const [loadMoreCount, setLoadMoreCount] = useState(0)
  const [loadProgress, setLoadProgress] = useState(
    prefetchedProjectsBlob ? 100 : 20
  )
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(
    prefetchedProjectsBlob?.totalSize ?? 0
  )
  const [sort, setSort] = useState<Sort>({
    by: 'lastUpdated',
    order: 'desc',
  })
  const prevSortRef = useRef<Sort>(sort)
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const [searchText, setSearchText] = useState('')

  const {
    isLoading: loading,
    isIdle,
    error,
    runAsync,
  } = useAsync<GetProjectsResponseBody>({
    status: prefetchedProjectsBlob ? 'resolved' : 'pending',
    data: prefetchedProjectsBlob,
  })
  const isLoading = isIdle ? true : loading

  useEffect(() => {
    if (prefetchedProjectsBlob) return
    setLoadProgress(40)
    runAsync(getProjects({ by: 'lastUpdated', order: 'desc' }))
      .then(data => {
        setLoadedProjects(data.projects)
        setTotalProjectsCount(data.totalSize)
      })
      .catch(debugConsole.error)
      .finally(() => {
        setLoadProgress(100)
      })
  }, [prefetchedProjectsBlob, runAsync])

  useEffect(() => {
    let filteredProjects = [...loadedProjects]

    if (searchText.length) {
      filteredProjects = filteredProjects.filter(project =>
        project.name.toLowerCase().includes(searchText.toLowerCase())
      )
    }

    filteredProjects = arrayFilter(filteredProjects, filters.all)

    if (prevSortRef.current !== sort) {
      filteredProjects = sortProjects(filteredProjects, sort)
      const loadedProjectsSorted = sortProjects(loadedProjects, sort)
      setLoadedProjects(loadedProjectsSorted)
    }

    if (filteredProjects.length > maxVisibleProjects) {
      const visibleFilteredProjects = filteredProjects.slice(
        0,
        maxVisibleProjects
      )

      const hiddenFilteredProjectsCount =
        filteredProjects.slice(maxVisibleProjects).length

      setVisibleProjects(visibleFilteredProjects)
      setHiddenProjectsCount(hiddenFilteredProjectsCount)

      if (hiddenFilteredProjectsCount > MAX_PROJECT_PER_PAGE) {
        setLoadMoreCount(MAX_PROJECT_PER_PAGE)
      } else {
        setLoadMoreCount(hiddenFilteredProjectsCount)
      }
    } else {
      setVisibleProjects(filteredProjects)
      setLoadMoreCount(0)
      setHiddenProjectsCount(0)
    }
  }, [
    loadedProjects,
    maxVisibleProjects,
    searchText,
    sort,
  ])

  useEffect(() => {
    prevSortRef.current = sort
  }, [sort])

  const showAllProjects = useCallback(() => {
    setLoadMoreCount(0)
    setHiddenProjectsCount(0)
    setMaxVisibleProjects(maxVisibleProjects + hiddenProjectsCount)
  }, [hiddenProjectsCount, maxVisibleProjects])

  const loadMoreProjects = useCallback(() => {
    setMaxVisibleProjects(maxVisibleProjects + loadMoreCount)
  }, [maxVisibleProjects, loadMoreCount])

  const [selectedProjectIds, setSelectedProjectIds] = useState(
    () => new Set<string>()
  )

  const toggleSelectedProject = useCallback(
    (projectId: string, selected?: boolean) => {
      setSelectedProjectIds(prevSelectedProjectIds => {
        const selectedProjectIds = new Set(prevSelectedProjectIds)
        if (selected === true) {
          selectedProjectIds.add(projectId)
        } else if (selected === false) {
          selectedProjectIds.delete(projectId)
        } else if (selectedProjectIds.has(projectId)) {
          selectedProjectIds.delete(projectId)
        } else {
          selectedProjectIds.add(projectId)
        }
        return selectedProjectIds
      })
    },
    []
  )

  const selectedProjects = useMemo(() => {
    return visibleProjects.filter(project => selectedProjectIds.has(project.id))
  }, [selectedProjectIds, visibleProjects])

  const selectOrUnselectAllProjects = useCallback(
    (checked: any) => {
      setSelectedProjectIds(prevSelectedProjectIds => {
        const selectedProjectIds = new Set(prevSelectedProjectIds)
        for (const project of visibleProjects) {
          if (checked) {
            selectedProjectIds.add(project.id)
          } else {
            selectedProjectIds.delete(project.id)
          }
        }
        return selectedProjectIds
      })
    },
    [visibleProjects]
  )

  // How many projects the current filter matches, ignoring the search text.
  // `visibleProjects` can't answer "is this view empty?" on its own, because it
  // is also narrowed by the search text (which persists across filter changes)
  // and by pagination. Callers need the distinction to tell an empty view apart
  // from a search that matched nothing.
  const currentFilterProjectsCount = useMemo(
    () => arrayFilter(loadedProjects, filters.all).length,
    [loadedProjects]
  )

  const filter: Filter = 'all'
  const selectFilter = useCallback(() => {}, [])

  const addClonedProjectToViewData = useCallback(
    (project: ClonedProject) => {
      // clone API not using camelCase and does not return all data

      const owner = {
        id: project.owner?._id,
        email: project.owner?.email,
        firstName: project.owner?.first_name,
        lastName: project.owner?.last_name,
      }

      const clonedProject: Project = {
        ...project,
        id: project.project_id,
        owner,
        lastUpdatedBy: owner,
        source: 'owner',
        trashed: false,
        archived: false,
        accessLevel: 'owner',
      }

      setLoadedProjects(loadedProjects => {
        return sortProjects([...loadedProjects, clonedProject], sort)
      })
    },
    [sort]
  )

  const updateProjectViewData = useCallback((newProjectData: Project) => {
    setLoadedProjects(loadedProjects => {
      return loadedProjects.map(p =>
        p.id === newProjectData.id ? { ...newProjectData } : p
      )
    })
  }, [])

  const removeProjectFromView = useCallback((project: Project) => {
    setLoadedProjects(loadedProjects => {
      return loadedProjects.filter(p => p.id !== project.id)
    })
  }, [])

  const value = useMemo<ProjectListContextValue>(
    () => ({
      addClonedProjectToViewData,
      error,
      filter,
      hiddenProjectsCount,
      isLoading,
      loadMoreCount,
      loadMoreProjects,
      loadProgress,
      removeProjectFromView,
      selectFilter,
      selectedProjects,
      selectedProjectIds,
      selectOrUnselectAllProjects,
      searchText,
      setSearchText,
      setSelectedProjectIds,
      setShowCustomPicker,
      setSort,
      showAllProjects,
      showCustomPicker,
      sort,
      toggleSelectedProject,
      totalProjectsCount,
      updateProjectViewData,
      currentFilterProjectsCount,
      visibleProjects,
    }),
    [
      addClonedProjectToViewData,
      error,
      filter,
      hiddenProjectsCount,
      isLoading,
      loadMoreCount,
      loadMoreProjects,
      loadProgress,
      removeProjectFromView,
      selectFilter,
      selectedProjectIds,
      selectedProjects,
      selectOrUnselectAllProjects,
      searchText,
      setSearchText,
      setSelectedProjectIds,
      setShowCustomPicker,
      setSort,
      showAllProjects,
      showCustomPicker,
      sort,
      toggleSelectedProject,
      totalProjectsCount,
      updateProjectViewData,
      currentFilterProjectsCount,
      visibleProjects,
    ]
  )

  return (
    <ProjectListContext.Provider value={value}>
      {children}
    </ProjectListContext.Provider>
  )
}

export function useProjectListContext() {
  const context = useContext(ProjectListContext)
  if (!context) {
    throw new Error(
      'ProjectListContext is only available inside ProjectListProvider'
    )
  }
  return context
}
