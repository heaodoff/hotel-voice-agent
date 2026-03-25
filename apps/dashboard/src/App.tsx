import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { CallsPage } from './pages/Calls';
import { CallDetailPage } from './pages/CallDetail';
import { ReservationsPage } from './pages/Reservations';
import { HotelsPage } from './pages/Hotels';
import { BillingPage } from './pages/Billing';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10000, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/calls/:callSid" element={<CallDetailPage />} />
            <Route path="/reservations" element={<ReservationsPage />} />
            <Route path="/hotels" element={<HotelsPage />} />
            <Route path="/billing" element={<BillingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
