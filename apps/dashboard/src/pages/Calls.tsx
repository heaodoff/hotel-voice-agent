import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCalls, useHotels } from '../hooks/useApi';
import { StatusBadge } from '../components/StatusBadge';

export function CallsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [hotelId, setHotelId] = useState('');
  const { data, isLoading } = useCalls({ page, limit: 20, status: status || undefined, hotelId: hotelId || undefined });
  const { data: hotels } = useHotels();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Calls</h1>

      <div className="flex gap-3 mb-4">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="text-sm border rounded px-3 py-1.5">
          <option value="">All Statuses</option>
          {['COMPLETED', 'IN_PROGRESS', 'FAILED', 'TRANSFERRED', 'NO_ANSWER'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setPage(1); }} className="text-sm border rounded px-3 py-1.5">
          <option value="">All Hotels</option>
          {hotels?.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        {data && <span className="text-sm text-gray-500 self-center">{data.total} calls</span>}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hotel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lang</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tools</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : !data?.calls.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No calls found</td></tr>
            ) : data.calls.map((call) => (
              <tr key={call.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">
                  <Link to={`/calls/${call.twilioCallSid}`} className="text-blue-600 hover:underline">
                    {new Date(call.startedAt).toLocaleString()}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">
                  {call.guest?.firstName ? `${call.guest.firstName} ${call.guest.lastName ?? ''}`.trim() : call.callerNumber}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{call.hotel?.name ?? '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={call.status} /></td>
                <td className="px-4 py-3 text-sm text-gray-600">{call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{call.language ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{call._count.toolLogs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex gap-2 mt-4 justify-center">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Prev</button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {data.totalPages}</span>
          <button onClick={() => setPage(Math.min(data.totalPages, page + 1))} disabled={page === data.totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
