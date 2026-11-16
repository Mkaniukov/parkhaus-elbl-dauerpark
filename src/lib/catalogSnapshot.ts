import { fallbackCatalog, toPublicCatalog, type PublicCatalog } from './catalogModel'

let current: PublicCatalog = toPublicCatalog(fallbackCatalog())

export function getCatalog(): PublicCatalog {
  return current
}

export function setCatalog(next: PublicCatalog): void {
  current = next
}
