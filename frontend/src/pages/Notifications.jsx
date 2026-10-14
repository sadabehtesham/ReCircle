import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Pagination from '../components/Pagination';

export default function Notifications() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api
      .get('/notifications', {
        params: { page, limit: 15, ...(unreadOnly && { unread: 'true' }) },
      })
      .then((response) => {
        if (live) setData(response.data.data);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      });
    return () => {
      live = false;
    };
  }, [page, unreadOnly, version]);

  const act = async (call) => {
    try {
      await call();
      setError('');
      setVersion((current) => current + 1);
      window.dispatchEvent(new Event('notifications-changed'));
    } catch (requestError) {
      setError(errMsg(requestError));
    }
  };

  const markRead = (notification) => {
    if (!notification.readAt) {
      act(() => api.patch(`/notifications/${notification._id}/read`));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => {
                setUnreadOnly(event.target.checked);
                setPage(1);
                setData(null);
              }}
            />
            Unread only
          </label>
          <button
            type="button"
            disabled={!data?.unreadCount}
            onClick={() => act(() => api.patch('/notifications/read-all'))}
            className="rounded-md border bg-white px-3 py-1.5 disabled:opacity-50"
          >
            Mark all as read
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
      {!data && !error && <p aria-busy="true" className="mt-4 text-gray-500">Loading notifications…</p>}
      {data && !data.notifications.length && (
        <p className="mt-4 rounded-lg border bg-white p-8 text-center text-gray-600">
          {unreadOnly ? "You're all caught up." : 'No notifications yet.'}
        </p>
      )}
      {data && data.notifications.length > 0 && (
        <>
          <ul className="mt-4 divide-y rounded-lg border bg-white">
            {data.notifications.map((notification) => (
              <li key={notification._id}>
                <Link
                  to={notification.link || '/'}
                  onClick={() => markRead(notification)}
                  className={`block rounded-lg p-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600 ${notification.readAt ? '' : 'bg-green-50'}`}
                >
                  <span className="font-medium">
                    {!notification.readAt && <span className="sr-only">Unread: </span>}
                    {notification.title}
                  </span>
                  <span className="mt-1 block text-sm text-gray-700">{notification.message}</span>
                  <span className="mt-2 block text-xs text-gray-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
