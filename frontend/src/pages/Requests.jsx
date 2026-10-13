import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import StatusBadge from '../components/StatusBadge';
import { fmtDay } from '../utils/dates';

const KIND = { borrow: 'Borrow', sell: 'Purchase', giveaway: 'Give away' };
const DIALOG = {
  cancel: { title: 'Cancel this request?', label: 'Cancel request', text: 'reserved items become available again.' },
  reject: { title: 'Reject this request?', label: 'Reject', text: 'the borrower will see it as rejected.' },
};
const tab = ({ isActive }) => `rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-green-700 text-white' : 'border bg-white'}`;
const danger = 'rounded-md border border-red-300 px-3 py-1 text-sm text-red-700';

export default function Requests({ role }) {
  const asOwner = role === 'owner';
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null); // { r, verb }

  useEffect(() => {
    let live = true;
    api
      .get('/requests', { params: { role, page, limit: 10 } })
      .then((r) => live && setData(r.data.data))
      .catch((e) => live && setError(errMsg(e)));
    return () => { live = false; };
  }, [role, page, version]);

  const canCancel = (r) => (asOwner ? r.status === 'approved' : ['pending', 'approved'].includes(r.status));

  const run = async (verb, r) => {
    try {
      await api.patch(`/requests/${r._id}/${verb}`);
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
    setVersion((n) => n + 1); // reload either way: a conflict means the data changed
    setTarget(null);
  };

  const d = target && DIALOG[target.verb];

  return (
    <div>
      <h1 className="text-2xl font-semibold">Requests</h1>
      <div className="mt-3 flex gap-2">
        <NavLink end to="/requests" className={tab}>My requests</NavLink>
        <NavLink to="/requests/incoming" className={tab}>Incoming</NavLink>
      </div>

      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
      {!data && !error && <p className="mt-4 text-gray-500">Loading…</p>}

      {data && !data.requests.length && (
        <div className="mt-4 rounded-lg border bg-white p-8 text-center">
          <p>{asOwner ? 'No one has requested your items yet.' : "You haven't requested anything yet."}</p>
          {!asOwner && <Link to="/items" className="text-green-700 underline">Browse items</Link>}
        </div>
      )}

      {data && data.requests.length > 0 && (
        <>
          <ul className="mt-4 space-y-3">
            {data.requests.map((r) => {
              const other = asOwner ? r.borrowerId : r.ownerId;
              return (
                <li key={r._id} className="flex gap-3 rounded-lg border bg-white p-3">
                  <img src={r.itemId.images[0].url} alt="" className="h-16 w-16 rounded object-cover" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/items/${r.itemId._id}`} className="font-medium hover:underline">{r.itemId.title}</Link>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-sm text-gray-600">
                      {KIND[r.type]}{r.type === 'borrow' && `: ${fmtDay(r.startDate)} to ${fmtDay(r.endDate)}`}
                      {' · '}{asOwner ? 'from' : 'owner'}{' '}
                      <Link to={`/users/${other._id}`} className="underline">{other.name}</Link>
                    </p>
                    {r.message && <p className="text-sm text-gray-700">“{r.message}”</p>}
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    {asOwner && r.status === 'pending' && (
                      <>
                        <button onClick={() => run('approve', r)} className="rounded-md bg-green-700 px-3 py-1 text-sm text-white hover:bg-green-800">
                          Approve
                        </button>
                        <button onClick={() => setTarget({ r, verb: 'reject' })} className={danger}>Reject</button>
                      </>
                    )}
                    {canCancel(r) && <button onClick={() => setTarget({ r, verb: 'cancel' })} className={danger}>Cancel</button>}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(target)} title={d?.title} confirmLabel={d?.label}
        message={target && `“${target.r.itemId.title}”: ${d.text}`}
        onConfirm={() => run(target.verb, target.r)} onCancel={() => setTarget(null)}
      />
    </div>
  );
}
