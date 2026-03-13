/**
 * rehype plugin to unwrap <figure> from <p>.
 * Prevents invalid HTML: <p><figure>...</figure></p>
 */

import type { Root } from 'hast'
import { SKIP, visit } from 'unist-util-visit'

function applicable(node: { type: string; tagName?: string; children?: unknown[] }): boolean {
  if (node.type !== 'element' || !node.children) return false
  let hasFigure = false
  for (const child of node.children as Array<{ type: string; tagName?: string }>) {
    if (child.type === 'text' && /^\s*$/.test((child as { value?: string }).value || '')) {
      continue
    }
    if (child.type === 'element' && child.tagName === 'figure') {
      hasFigure = true
      continue
    }
    return false
  }
  return hasFigure
}

export default function rehypeUnwrapFigures() {
  return function (tree: Root) {
    visit(tree, 'element', function (node, index, parent) {
      if (
        node.tagName === 'p' &&
        parent &&
        typeof index === 'number' &&
        applicable(node)
      ) {
        parent.children.splice(index, 1, ...(node.children || []))
        return SKIP
      }
    })
  }
}
