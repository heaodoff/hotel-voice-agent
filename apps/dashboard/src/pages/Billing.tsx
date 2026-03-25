import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { KpiCard } from '../components/KpiCard';

interface UsageData {
  totalCalls: number;
  completedCalls: number;
  totalMinutes: number;
  totalReservations: number;
  revenue: number;
  overageMinutes: number;
  overageCost: number;
  totalCost: number;
  status: string;
}

interface HotelBilling {
  hotelId: string;
  hotelName: string;
  plan: string;
  monthlyPrice: number;
  includedMinutes: number;
  pricePerMinute: number;
  currentUsage: UsageData | null;
}

interface BillingPlan {
  name: string;
  monthlyPrice: number;
  includedMinutes: number;
  pricePerMinute: number;
}

function useBillingOverview() {
  return useQuery({
    queryKey: ['billing-overview'],
    queryFn: () => api.get<HotelBilling[]>('/billing/overview'),
  });
}

function useBillingPlans() {
  return useQuery({
    queryKey: ['billing-plans'],
    queryFn: () => api.get<Record<string, BillingPlan>>('/billing/plans'),
  });
}

function useRecalculate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hotelId: string) => api.post(`/billing/hotels/${hotelId}/recalculate`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-overview'] }),
  });
}

function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, plan }: { hotelId: string; plan: string }) =>
      api.put(`/billing/hotels/${hotelId}/plan`, { plan }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-overview'] }),
  });
}

export function BillingPage() {
  const { data: hotels, isLoading } = useBillingOverview();
  const { data: plans } = useBillingPlans();
  const recalculate = useRecalculate();
  const updatePlan = useUpdatePlan();

  if (isLoading) return <div className="text-gray-500">Loading billing...</div>;

  // Totals
  const totalRevenue = hotels?.reduce((s, h) => s + (h.currentUsage?.revenue ?? 0), 0) ?? 0;
  const totalMinutes = hotels?.reduce((s, h) => s + (h.currentUsage?.totalMinutes ?? 0), 0) ?? 0;
  const totalMRR = hotels?.reduce((s, h) => s + h.monthlyPrice, 0) ?? 0;
  const totalOverage = hotels?.reduce((s, h) => s + (h.currentUsage?.overageCost ?? 0), 0) ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Billing & Usage</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard title="MRR" value={`$${totalMRR.toLocaleString()}`} subtitle="Monthly recurring" />
        <KpiCard title="Total Minutes" value={totalMinutes.toLocaleString()} subtitle="This month" />
        <KpiCard title="Booking Revenue" value={`$${totalRevenue.toLocaleString()}`} subtitle="Hotels earned" />
        <KpiCard title="Overage Revenue" value={`$${totalOverage.toFixed(2)}`} subtitle="Usage overage" />
      </div>

      {/* Plans reference */}
      {plans && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Available Plans</h2>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(plans).map(([key, plan]) => (
              <div key={key} className="border rounded-lg p-4 text-center">
                <p className="font-semibold text-gray-900">{plan.name}</p>
                <p className="text-2xl font-bold mt-1">${plan.monthlyPrice}<span className="text-sm font-normal text-gray-500">/mo</span></p>
                <p className="text-sm text-gray-500 mt-1">{plan.includedMinutes} min included</p>
                <p className="text-xs text-gray-400">${plan.pricePerMinute}/min overage</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-hotel billing */}
      <div className="space-y-4">
        {hotels?.map((hotel) => {
          const usage = hotel.currentUsage;
          const minutesUsedPct = usage ? Math.min(100, Math.round((usage.totalMinutes / hotel.includedMinutes) * 100)) : 0;

          return (
            <div key={hotel.hotelId} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{hotel.hotelName}</h3>
                  <p className="text-sm text-gray-500 capitalize">{hotel.plan} — ${hotel.monthlyPrice}/mo</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={hotel.plan}
                    onChange={(e) => updatePlan.mutate({ hotelId: hotel.hotelId, plan: e.target.value })}
                    className="text-sm border rounded px-2 py-1"
                  >
                    {plans && Object.entries(plans).map(([key, plan]) => (
                      <option key={key} value={key}>{plan.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => recalculate.mutate(hotel.hotelId)}
                    disabled={recalculate.isPending}
                    className="text-xs px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Recalculate
                  </button>
                </div>
              </div>

              {usage ? (
                <div>
                  {/* Minutes progress bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{usage.totalMinutes} / {hotel.includedMinutes} minutes</span>
                      <span>{minutesUsedPct}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${minutesUsedPct >= 90 ? 'bg-red-500' : minutesUsedPct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                        style={{ width: `${minutesUsedPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Calls</p>
                      <p className="font-medium">{usage.totalCalls} ({usage.completedCalls} completed)</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Reservations</p>
                      <p className="font-medium">{usage.totalReservations}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Booking Revenue</p>
                      <p className="font-medium">${usage.revenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Overage</p>
                      <p className="font-medium">{usage.overageMinutes} min (${usage.overageCost.toFixed(2)})</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Bill</p>
                      <p className="font-semibold text-gray-900">${usage.totalCost.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No usage data yet. Click "Recalculate" to sync.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
