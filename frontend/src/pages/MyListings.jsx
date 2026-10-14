import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Badge from '../components/Badge';
import ItemCard from '../components/ItemCard';
import Pagination from '../components/Pagination';

const STATUS = {
  available: 'Available',
  unavailable: 'Unavailable',
  reserved: 'Reserved',
  closed: 'Closed',
};

export default function MyListings() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setData(null);
    setError('');
    api
      .get('/items/mine', { params: { page, limit: 12 } })
      .then((response) => {
        if (live) setData(response.data.data);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      });
    return () => {
      live = false;
    };
  }, [page]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My listings</h1>
        <Link to="/items/new" className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800">
          List an item
        </Link>
      </div>
      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
      {!data && !error && <p className="mt-4 text-gray-500">Loading…</p>}
      {data && !data.items.length && (
        <p className="mt-4 rounded-lg border bg-white p-8 text-center text-gray-600">
          You haven't listed anything yet.
        </p>
      )}
      {data && data.items.length > 0 && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.items.map((item) => (
              <div key={item._id}>
                <ItemCard item={item} />
                <div className="mt-1 flex items-center justify-between px-1">
                  <Badge tone={item.listingStatus === 'available' ? 'green' : 'gray'}>
                    {STATUS[item.listingStatus] || item.listingStatus}
                  </Badge>
                  {['available', 'unavailable'].includes(item.listingStatus) && (
                    <Link to={`/items/${item._id}/edit`} className="text-sm text-green-700 underline">Edit</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
