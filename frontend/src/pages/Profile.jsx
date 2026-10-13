import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Avatar from '../components/Avatar';
import ItemCard from '../components/ItemCard';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api
      .get(`/users/${id}`)
      .then((response) => {
        if (live) setData(response.data.data);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!data) return <p className="text-gray-500">Loading…</p>;
  const { user, items } = data;

  return (
    <div>
      <div className="flex items-center gap-4 rounded-lg border bg-white p-4">
        <Avatar user={user} size="h-20 w-20" />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-gray-600">
            {user.college} · Member since {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
        {me?._id === user._id && (
          <Link to="/profile/edit" className="rounded-md border px-3 py-1.5 text-sm">Edit profile</Link>
        )}
      </div>

      <h2 className="mt-6 text-lg font-semibold">Available items</h2>
      {items.length ? (
        <div className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => <ItemCard key={item._id} item={item} />)}
        </div>
      ) : (
        <p className="mt-2 text-gray-600">No items listed right now.</p>
      )}
    </div>
  );
}
