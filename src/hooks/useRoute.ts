import { useCallback, useEffect, useState } from 'react';

function read(): string {
  const h = window.location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h : '/' + h;
}

export function useRoute() {
  const [path, setPath] = useState(read);
  useEffect(() => {
    const fn = () => setPath(read());
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  const navigate = useCallback((to: string, replace = false) => {
    const target = '#' + (to.startsWith('/') ? to : '/' + to);
    if (replace) window.location.replace(target);
    else window.location.hash = target;
  }, []);
  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else navigate('/');
  }, [navigate]);
  const parts = path.split('?')[0].split('/').filter(Boolean);
  return { path, parts, navigate, back };
}

export function navigate(to: string) {
  window.location.hash = '#' + (to.startsWith('/') ? to : '/' + to);
}
