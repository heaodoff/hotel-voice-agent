import { useReservations } from '../hooks/useApi';
import { StatusBadge } from '../components/StatusBadge';

export function ReservationsPage() {
  const { data, isLoading } = useReservations();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reservations</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-out</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : !data?.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No reservations</td></tr>
            ) : data.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono">{r.confirmationCode ?? '-'}</td>
                <td className="px-4 py-3 text-sm">{r.guest.firstName ? `${r.guest.firstName} ${r.guest.lastName ?? ''}`.trim() : r.guest.phoneNumber}</td>
                <td className="px-4 py-3 text-sm">{r.checkInDate.split('T')[0]}</td>
                <td className="px-4 py-3 text-sm">{r.checkOutDate.split('T')[0]}</td>
                <td className="px-4 py-3 text-sm capitalize">{r.roomType} x{r.roomCount}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-sm">{r.totalPrice ? `$${Number(r.totalPrice).toFixed(0)}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
