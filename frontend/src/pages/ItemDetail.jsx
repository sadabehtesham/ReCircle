import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Badge from '../components/Badge';
import ConfirmDialog from '../components/ConfirmDialog';
import RequestPanel from '../components/RequestPanel';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, CONDITIONS, LENDING } from '../utils/constants';

const STATUS = {
  reserved: 'Reserved',
  closed: 'No longer available',
  unavailable: 'Not available right now',
};

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [photo, setPhoto] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let live = true;
    setItem(null);
    setError('');
    api
      .get(`/items/${id}`)
      .then((response) => {
        if (live) setItem(response.data.data.item);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      });
    return () => {
      live = false;
    };
  }, [id]);

  const remove = async () => {
    try {
      await api.delete(`/items/${id}`);
      navigate('/items');
    } catch (requestError) {
      setConfirming(false);
      setActionError(errMsg(requestError));
    }
  };

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!item) return <p className="text-gray-500">Loading…</p>;

  const isOwner = user?._id === item.ownerId._id;
  const rows = [
    ['Category', CATEGORIES[item.category]],
    ['Pickup location', item.pickupLocation],
    ['Owner', <Link key="owner" to={`/users/${item.ownerId._id}`} className="text-green-700 underline">{item.ownerId.name}, {item.ownerId.college}</Link>],
    ['Listed', new Date(item.createdAt).toLocaleDateString()],
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <img
          src={item.images[photo].url}
          alt={item.title}
          className="aspect-square w-full rounded-lg border bg-white object-contain"
        />
        {item.images.length > 1 && (
          <div className="mt-2 flex gap-2">
            {item.images.map((image, index) => (
              <button
                key={image.publicId}
                type="button"
                onClick={() => setPhoto(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === photo}
                className={`rounded border-2 focus:outline-none focus:ring-2 focus:ring-green-600 ${index === photo ? 'border-green-600' : 'border-transparent'}`}
              >
                <img src={image.url} alt="" className="h-16 w-16 rounded object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{item.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge tone={item.lendingType}>{LENDING[item.lendingType]}</Badge>
          <Badge>{CONDITIONS[item.condition]}</Badge>
          {STATUS[item.listingStatus] && <Badge tone="sell">{STATUS[item.listingStatus]}</Badge>}
        </div>
        {item.lendingType === 'sell' && <p className="text-xl font-semibold">₹{item.price}</p>}
        <p className="whitespace-pre-line text-gray-700">{item.description}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-gray-500">{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>

        {actionError && <p role="alert" className="text-sm text-red-600">{actionError}</p>}
        <RequestPanel item={item} />
        {isOwner && (
          <div className="flex gap-2 pt-2">
            <Link to={`/items/${id}/edit`} className="rounded-md border bg-white px-3 py-1.5 text-sm">Edit</Link>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete this listing?"
        confirmLabel="Delete"
        message="It will be removed from the marketplace. This can't be undone."
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
