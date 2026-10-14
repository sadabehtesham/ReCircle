import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function useUnread() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const id = user?._id;

  const refresh = useCallback(() => {
    if (!id) return;
    api
      .get('/notifications/unread-count')
      .then((response) => {
        setCount(response.data.data.count);
        setError('');
      })
      .catch((requestError) => setError(errMsg(requestError)));
  }, [id]);

  useEffect(() => {
    if (!id) {
      setCount(0);
      setError('');
      return undefined;
    }

    refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 60000);
    window.addEventListener('notifications-changed', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('notifications-changed', refresh);
    };
  }, [id, refresh]);

  return { count, error };
}
