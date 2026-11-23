import OutlineList from './outline-list'
import { OutlineItemData } from '@/features/ide-react/types/outline'

function OutlineRoot({
  outline,
  jumpToLine,
  highlightedLine,
}: {
  outline: OutlineItemData[]
  jumpToLine: (line: number, syncToPdf: boolean) => void
  highlightedLine?: number
}) {
  return (
    <div>
      {outline.length ? (
        <OutlineList
          outline={outline}
          jumpToLine={jumpToLine}
          isRoot
          highlightedLine={highlightedLine}
          containsHighlightedLine
        />
      ) : null}
    </div>
  )
}

export default OutlineRoot
