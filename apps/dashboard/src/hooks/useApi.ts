import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

// Types matching backend responses
export interface DashboardMetrics {
  totalCalls: number;
  completedCalls: number;
  averageDuration: number;
  totalReservations: number;
  revenue: number;
  handoffRate: number;
  topLanguages: { lang: string; count: number }[];
  callsByDay: { date: string; count: number }[];
  handoffReasons: { reason: string; count: number }[];
  toolPerformance: { tool: string; avgMs: number; errorRate: number; count: number }[];
}

export interface Call {
  id: string;
  twilioCallSid: string;
  status: string;
  callerNumber: string;
  language: string | null;
  duration: number | null;
  transcriptSummary: string | null;
  recordingUrl: string | null;
  startedAt: string;
  endedAt: string | null;
  guest: { firstName: string | null; lastName: string | null; phoneNumber: string } | null;
  hotel: { name: string } | null;
  _count: { toolLogs: number; handoffs: number };
}

export interface CallsResponse {
  calls: Call[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Hotel {
  id: string;
  name: string;
  phoneNumber: string;
  timezone: string;
  handoffPhone: string | null;
  greeting: string | null;
  checkInTime: string;
  checkOutTime: string;
  policies: Record<string, unknown> | null;
  pmsProvider: string;
  active: boolean;
  createdAt: string;
}

export interface Reservation {
  id: string;
  confirmationCode: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
  roomCount: number;
  guestCount: number;
  totalPrice: string | null;
  currency: string;
  createdAt: string;
  guest: { firstName: string | null; lastName: string | null; phoneNumber: string };
}

export interface TimelineEntry {
  time: string;
  type: 'event' | 'tool' | 'handoff';
  data: Record<string, unknown>;
}

export interface CallTimeline {
  call: {
    id: string;
    callSid: string;
    status: string;
    duration: number | null;
    language: string | null;
    startedAt: string;
    endedAt: string | null;
    transcriptSummary: string | null;
    recordingUrl: string | null;
    hotelName: string;
    guest: { firstName: string | null; lastName: string | null; phoneNumber: string } | null;
  };
  timeline: TimelineEntry[];
}

// Hooks
export function useDashboard(period: string, hotelId?: string) {
  const params = new URLSearchParams({ period });
  if (hotelId) params.set('hotelId', hotelId);
  return useQuery({
    queryKey: ['dashboard', period, hotelId],
    queryFn: () => api.get<DashboardMetrics>(`/analytics/dashboard?${params}`),
    refetchInterval: 30000,
  });
}

export function useCalls(filters: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v != null) params.set(k, String(v));
  }
  return useQuery({
    queryKey: ['calls', filters],
    queryFn: () => api.get<CallsResponse>(`/analytics/calls?${params}`),
  });
}

export function useCallTimeline(callSid: string) {
  return useQuery({
    queryKey: ['call-timeline', callSid],
    queryFn: () => api.get<CallTimeline>(`/calls/${callSid}/timeline`),
    enabled: !!callSid,
  });
}

export function useHotels() {
  return useQuery({
    queryKey: ['hotels'],
    queryFn: () => api.get<Hotel[]>('/hotels'),
  });
}

export function useReservations() {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: () => api.get<Reservation[]>('/reservations'),
  });
}

export function useCreateHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Hotel>) => api.post<Hotel>('/hotels', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotels'] }),
  });
}

export function useUpdateHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Hotel> & { id: string }) => api.put<Hotel>(`/hotels/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotels'] }),
  });
}

export function useDeleteHotel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/hotels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hotels'] }),
  });
}
