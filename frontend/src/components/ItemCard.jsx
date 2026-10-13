import { Link } from 'react-router-dom';
import Badge from './Badge';
import { CONDITIONS, LENDING } from '../utils/constants';

export default function ItemCard({ item }) {
  return (
    <Link
      to={`/items/${item._id}`}
      className="block overflow-hidden rounded-lg border bg-white hover:shadow focus:outline-none focus:ring-2 focus:ring-green-600"
    >
      <img src={item.images[0].url} alt={item.title} loading="lazy" className="h-40 w-full object-cover" />
      <div className="space-y-2 p-3">
        <h3 className="truncate font-medium">{item.title}</h3>
        <div className="flex flex-wrap gap-1">
          <Badge tone={item.lendingType}>
            {LENDING[item.lendingType]}{item.lendingType === 'sell' && ` · ₹${item.price}`}
          </Badge>
          <Badge>{CONDITIONS[item.condition]}</Badge>
        </div>
        <p className="truncate text-xs text-gray-500">{item.ownerId.name} · {item.pickupLocation}</p>
      </div>
    </Link>
  );
}
