import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useDashboard, useHotels } from '../hooks/useApi';
import { KpiCard } from '../components/KpiCard';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function DashboardPage() {
  const [period, setPeriod] = useState<string>('week');
  const [hotelId, setHotelId] = useState<string>('');
  const { data, isLoading } = useDashboard(period, hotelId || undefined);
  const { data: hotels } = useHotels();

  if (isLoading || !data) {
    return <div className="text-gray-500">Loading dashboard...</div>;
  }

  const completionRate = data.totalCalls > 0
    ? `${Math.round((data.completedCalls / data.totalCalls) * 100)}%`
    : '0%';

  const avgDurationMin = data.averageDuration > 0
    ? `${Math.floor(data.averageDuration / 60)}:${String(data.averageDuration % 60).padStart(2, '0')}`
    : '0:00';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex gap-2">
          <select
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
            className="text-sm border rounded px-3 py-1.5"
          >
            <option value="">All Hotels</option>
            {hotels?.map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
          {(['day', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded ${period === p ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border hover:bg-gray-100'}`}
            >
              {p === 'day' ? '24h' : p === 'week' ? '7d' : '30d'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard title="Total Calls" value={data.totalCalls} />
        <KpiCard title="Completion" value={completionRate} subtitle={`${data.completedCalls} completed`} />
        <KpiCard title="Avg Duration" value={avgDurationMin} />
        <KpiCard title="Reservations" value={data.totalReservations} />
        <KpiCard title="Revenue" value={`$${data.revenue.toLocaleString()}`} />
        <KpiCard title="Handoff Rate" value={`${Math.round(data.handoffRate * 100)}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Calls by Day</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.callsByDay}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Languages</h2>
          {data.topLanguages.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.topLanguages} dataKey="count" nameKey="lang" cx="50%" cy="50%" outerRadius={90} label={({ lang, count }: { lang: string; count: number }) => `${lang} (${count})`}>
                  {data.topLanguages.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-center py-16">No language data yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Handoff Reasons</h2>
          {data.handoffReasons.length > 0 ? (
            <div className="space-y-2">
              {data.handoffReasons.map((r) => (
                <div key={r.reason} className="flex justify-between text-sm">
                  <span className="text-gray-700">{r.reason.replace(/_/g, ' ')}</span>
                  <span className="font-medium">{r.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No handoffs yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">Tool Performance</h2>
          {data.toolPerformance.length > 0 ? (
            <div className="space-y-2">
              {data.toolPerformance.map((t) => (
                <div key={t.tool} className="flex justify-between text-sm">
                  <span className="text-gray-700 font-mono text-xs">{t.tool}</span>
                  <span className="text-gray-500">
                    {t.avgMs}ms avg | {Math.round(t.errorRate * 100)}% err | {t.count} calls
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No tool data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
