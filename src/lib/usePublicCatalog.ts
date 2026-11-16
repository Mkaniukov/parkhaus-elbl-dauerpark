import { useEffect, useState } from 'react'
import { apiUrl } from './apiUrl'
import {
  isPublicSettings,
  type CatalogGarage,
  type PublicCatalog,
} from './catalogModel'
import { getCatalog, setCatalog } from './catalogSnapshot'

export function usePublicCatalog(): PublicCatalog {
  const [catalog, setCat] = useState<PublicCatalog>(() => getCatalog())

  useEffect(() => {
    let cancel = false
    fetch(apiUrl('catalog'), { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as { garagen?: unknown; settings?: unknown }
      })
      .then((data) => {
        if (cancel || !data || !Array.isArray(data.garagen) || !isPublicSettings(data.settings)) {
          return
        }
        const next: PublicCatalog = {
          garagen: data.garagen as CatalogGarage[],
          settings: data.settings,
        }
        setCatalog(next)
        setCat(next)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  return catalog
}
