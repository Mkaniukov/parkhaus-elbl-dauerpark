/** Function-URL. `VITE_SUBMIT_URL` darf auf `/submit` zeigen — der letzte Pfadteil wird ersetzt. */
export function apiUrl(name: 'catalog' | 'admin' | 'submit'): string {
  const submit = import.meta.env.VITE_SUBMIT_URL
  if (submit) return submit.replace(/\/[^/]*$/, `/${name}`)
  return `/.netlify/functions/${name}`
}
