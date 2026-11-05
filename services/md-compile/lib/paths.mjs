import path from 'node:path'

/**
 * True if `target` is `root` or lives inside it.
 */
export function isInside(root, target) {
  const rel = path.relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * Resolve `relative` against `base` and make sure the result stays inside
 * `root` (the compile directory). Throws otherwise.
 */
export function resolveInside(root, base, relative) {
  const resolved = path.resolve(base, relative)
  if (!isInside(root, resolved)) {
    throw new Error(`path escapes the project: ${relative}`)
  }
  return resolved
}
