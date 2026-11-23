import { useEffect, useState } from 'react';

/** Tiny hash router: '#/patients/12' -> ['patients', '12']. Refresh-safe and linkable. */
const parse = () => (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('/').filter(Boolean);

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const navigate = (path) => {
  const next = `#/${path.replace(/^\/+/, '')}`;
  if (window.location.hash !== next) window.location.hash = next;
};
