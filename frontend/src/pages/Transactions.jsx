import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import Select from '../components/Select';
import StatusBadge from '../components/StatusBadge';
import { CONDITIONS } from '../utils/constants';
import { lastDay } from '../utils/dates';

const KIND = { borrow: 'Borrow', sell: 'Purchase', giveaway: 'Give away' };
const tab = (on) => `rounded-md px-3 py-1.5 text-sm ${on ? 'bg-green-700 text-white' : 'border bg-white'}`;

export default function Transactions({ status }) {
  const [role, setRole] = useState('borrower');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [condition, setCondition] = useState('');
  const asOwner = role === 'owner';

  useEffect(() => {
    let live = true;
    api
      .get('/transactions', { params: { role, status, page, limit: 10 } })
      .then((r) => live && setData(r.data.data))
      .catch((e) => live && setError(errMsg(e)));
    return () => { live = false; };
  }, [role, status, page, version]);

  const pick = (nextRole) => {
    setRole(nextRole);
    setPage(1);
    setData(null);
  };

  const confirmReturn = async () => {
    try {
      await api.post(`/requests/${target.requestId}/return`, condition ? { condition } : {});
      setError('');
    } catch (e) {
      setError(errMsg(e));
    }
    setVersion((n) => n + 1);
    setTarget(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold">Loans</h1>
      <div className="mt-3 flex gap-2">
        <NavLink end to="/loans" className={({ isActive }) => tab(isActive)}>Active</NavLink>
        <NavLink to="/loans/history" className={({ isActive }) => tab(isActive)}>History</NavLink>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" aria-pressed={!asOwner} onClick={() => pick('borrower')} className={tab(!asOwner)}>
          As borrower or buyer
        </button>
        <button type="button" aria-pressed={asOwner} onClick={() => pick('owner')} className={tab(asOwner)}>
          As owner
        </button>
      </div>

      {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
      {!data && !error && <p className="mt-4 text-gray-500">Loading…</p>}
      {data && !data.transactions.length && (
        <p className="mt-4 rounded-lg border bg-white p-8 text-center text-gray-600">
          {status === 'active' ? 'No active loans.' : 'No completed transactions yet.'}
        </p>
      )}

      {data && data.transactions.length > 0 && (
        <>
          <ul className="mt-4 space-y-3">
            {data.transactions.map((transaction) => {
              const other = asOwner ? transaction.borrowerId : transaction.ownerId;
              return (
                <li key={transaction._id} className="flex gap-3 rounded-lg border bg-white p-3">
                  <img src={transaction.itemId.images[0].url} alt="" className="h-16 w-16 rounded object-cover" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/items/${transaction.itemId._id}`} className="font-medium hover:underline">
                        {transaction.itemId.title}
                      </Link>
                      <StatusBadge status={transaction.overdue ? 'overdue' : transaction.currentStatus} />
                    </div>
                    <p className="text-sm text-gray-600">
                      {KIND[transaction.type]}{transaction.type === 'sell' && ` · ₹${transaction.price}`}
                      {' · '}{asOwner ? 'with' : 'owner'}{' '}
                      <Link to={`/users/${other._id}`} className="underline">{other.name}</Link>
                    </p>
                    <p className="text-sm text-gray-600">
                      {transaction.currentStatus === 'active'
                        ? `Return by ${lastDay(transaction.dueAt)}`
                        : `Completed ${new Date(transaction.completedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {asOwner && transaction.currentStatus === 'active' && (
                    <button
                      type="button"
                      onClick={() => { setCondition(''); setTarget(transaction); }}
                      className="self-start rounded-md bg-green-700 px-3 py-1 text-sm text-white hover:bg-green-800"
                    >
                      Confirm return
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        tone="green"
        title="Confirm return"
        confirmLabel="Confirm return"
        message={target && `Confirm that you got “${target.itemId.title}” back from ${target.borrowerId.name}.`}
        onConfirm={confirmReturn}
        onCancel={() => setTarget(null)}
      >
        <div className="mt-3">
          <Select
            id="return-condition"
            label="Condition on return (optional)"
            placeholder="Not recorded"
            options={CONDITIONS}
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
