import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { LENDING } from '../utils/constants';
import { fmtDay, lastDay } from '../utils/dates';

const photo = (item) => item.images[0].url;
const span = (request) => (
  request.type === 'borrow' ? ` · ${fmtDay(request.startDate)} to ${fmtDay(request.endDate)}` : ''
);

function Card({ label, value, sub }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function Section({ title, data, to, empty, row, urgent }) {
  return (
    <section className={`rounded-lg border bg-white p-4 ${urgent ? 'border-red-300' : ''}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">
          {title} <span className="text-sm font-normal text-gray-500">({data.count})</span>
        </h2>
        {data.count > 0 && <Link to={to} className="text-sm text-green-700 underline">View all</Link>}
      </div>
      {data.items.length ? (
        <ul className="mt-3 space-y-2">
          {data.items.map((item) => {
            const details = row(item);
            return (
              <li key={item._id}>
                <Link
                  to={details.to}
                  className="flex items-center gap-3 rounded-md p-1 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <img src={details.img} alt="" className="h-12 w-12 rounded object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{details.title}</span>
                    <span className="block truncate text-xs text-gray-600">{details.sub}</span>
                  </span>
                  <StatusBadge status={details.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-600">{empty}</p>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api
      .get('/dashboard')
      .then((response) => {
        if (live) setData(response.data.data);
      })
      .catch((requestError) => {
        if (live) setError(errMsg(requestError));
      });
    return () => {
      live = false;
    };
  }, []);

  if (error) return <p role="alert" className="text-red-600">{error}</p>;
  if (!data) return <p aria-busy="true" className="text-gray-500">Loading…</p>;

  const loan = (other, verb) => (transaction) => ({
    to: '/loans',
    img: photo(transaction.itemId),
    title: transaction.itemId.title,
    sub: `${verb} ${transaction[other].name} · return by ${lastDay(transaction.dueAt)}`,
    status: transaction.overdue ? 'overdue' : transaction.currentStatus,
  });
  const request = (to, who, name) => (entry) => ({
    to,
    img: photo(entry.itemId),
    title: entry.itemId.title,
    sub: `${who} ${entry[name].name}${span(entry)}`,
    status: entry.status,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <Link to="/items/new" className="rounded-md bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800">
          List an item
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Total listings" value={data.listings.count} />
        <Card label="Pending requests" value={data.incoming.count} sub="waiting for your decision" />
        <Card
          label="Active loans"
          value={data.borrowed.count + data.lent.count}
          sub={`${data.borrowed.count} borrowed · ${data.lent.count} lent`}
        />
        <Card label="Completed" value={data.completed.count} sub="transactions" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.overdue.count > 0 && (
          <div className="lg:col-span-2">
            <Section
              urgent
              title="Overdue items"
              data={data.overdue}
              to="/loans"
              empty=""
              row={(transaction) => ({
                to: '/loans',
                img: photo(transaction.itemId),
                title: transaction.itemId.title,
                status: 'overdue',
                sub: transaction.ownerId._id === user._id
                  ? `${transaction.borrowerId.name} should have returned it by ${lastDay(transaction.dueAt)}`
                  : `You should have returned it by ${lastDay(transaction.dueAt)}`,
              })}
            />
          </div>
        )}
        <Section
          title="Incoming requests"
          data={data.incoming}
          to="/requests/incoming"
          empty="No requests waiting for you."
          row={request('/requests/incoming', 'from', 'borrowerId')}
        />
        <Section
          title="My borrow requests"
          data={data.requests}
          to="/requests"
          empty="You have no open requests."
          row={request('/requests', 'owner', 'ownerId')}
        />
        <Section
          title="Currently borrowed"
          data={data.borrowed}
          to="/loans"
          empty="Nothing borrowed right now."
          row={loan('ownerId', 'from')}
        />
        <Section
          title="Items I have lent"
          data={data.lent}
          to="/loans"
          empty="Nothing lent out right now."
          row={loan('borrowerId', 'with')}
        />
        <Section
          title="My listings"
          data={data.listings}
          to="/my-listings"
          empty="You haven't listed anything yet."
          row={(item) => ({
            to: `/items/${item._id}`,
            img: photo(item),
            title: item.title,
            status: item.listingStatus,
            sub: LENDING[item.lendingType] + (item.lendingType === 'sell' ? ` · ₹${item.price}` : ''),
          })}
        />
        <Section
          title="Completed transactions"
          data={data.completed}
          to="/loans/history"
          empty="No completed transactions yet."
          row={(transaction) => ({
            to: '/loans/history',
            img: photo(transaction.itemId),
            title: transaction.itemId.title,
            status: 'completed',
            sub: `${LENDING[transaction.type]} · ${new Date(transaction.completedAt).toLocaleDateString()}`,
          })}
        />
      </div>
    </div>
  );
}
