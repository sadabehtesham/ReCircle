import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import Field from './Field';
import StatusBadge from './StatusBadge';
import { useAuth } from '../context/AuthContext';

const OPEN_STATUSES = ['pending', 'approved', 'active', 'overdue'];

export default function RequestPanel({ item }) {
  const { user, loading: authLoading } = useAuth();
  const [mine, setMine] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isOwner = user?._id === item.ownerId._id;

  useEffect(() => {
    if (!user || isOwner) return undefined;
    let live = true;
    setLoading(true);
    api
      .get('/requests', { params: { itemId: item._id, page: 1, limit: 50 } })
      .then((response) => {
        if (!live) return;
        const current = response.data.data.requests.find((r) => OPEN_STATUSES.includes(r.status));
        setMine(current || null);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [item._id, isOwner, user]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body = {
        itemId: item._id,
        ...(item.lendingType === 'borrow' && { startDate, endDate }),
        ...(message.trim() && { message: message.trim() }),
      };
      const response = await api.post('/requests', body);
      setMine(response.data.data.request);
    } catch (requestError) {
      setError(errMsg(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || isOwner) return null;
  if (!user) {
    return (
      <div className="rounded-lg border bg-white p-4">
        <Link to="/login" className="text-green-700 underline">Log in</Link>
        {' '}to request this item.
      </div>
    );
  }

  const hints = {
    pending: "Waiting for the owner's decision.",
    approved: item.lendingType === 'borrow'
      ? 'Approved. Arrange pickup with the owner.'
      : "It's yours. Arrange pickup with the owner.",
    active: 'You have this item. Return it to the owner by the end date.',
  };

  if (loading) return <p className="text-sm text-gray-500">Loading your request…</p>;

  if (mine) {
    return (
      <div className="space-y-2 rounded-lg border bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">Your request</span>
          <StatusBadge status={mine.overdue ? 'overdue' : mine.status} />
        </div>
        {hints[mine.status] && <p className="text-sm text-gray-600">{hints[mine.status]}</p>}
        {mine.status === 'rejected' && <p className="text-sm text-gray-600">The owner rejected this request.</p>}
        {mine.status === 'cancelled' && <p className="text-sm text-gray-600">This request was cancelled.</p>}
        <Link to="/requests" className="text-sm text-green-700 underline">View my requests</Link>
      </div>
    );
  }

  if (item.listingStatus !== 'available') {
    return <p className="rounded-lg border bg-white p-4 text-sm text-gray-600">This item is not available for requests right now.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">
        {item.lendingType === 'borrow' ? 'Request to borrow' : item.lendingType === 'sell' ? 'Request to purchase' : 'Request this item'}
      </h2>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {item.lendingType === 'borrow' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="request-start-date" label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Field id="request-end-date" label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      )}
      <div>
        <label htmlFor="request-message" className="block text-sm font-medium text-gray-700">Message (optional)</label>
        <textarea
          id="request-message"
          name="message"
          rows={3}
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800 disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}
