import { useState } from 'react';
import { useHotels, useCreateHotel, useDeleteHotel, type Hotel } from '../hooks/useApi';

export function HotelsPage() {
  const { data: hotels, isLoading } = useHotels();
  const createHotel = useCreateHotel();
  const deleteHotel = useDeleteHotel();
  const [showForm, setShowForm] = useState(false);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createHotel.mutate({
      name: fd.get('name') as string,
      phoneNumber: fd.get('phoneNumber') as string,
      timezone: (fd.get('timezone') as string) || 'America/New_York',
      handoffPhone: (fd.get('handoffPhone') as string) || undefined,
      greeting: (fd.get('greeting') as string) || undefined,
    } as Partial<Hotel>, {
      onSuccess: () => setShowForm(false),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hotels</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700">
          {showForm ? 'Cancel' : '+ Add Hotel'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Name *</label>
            <input name="name" required className="w-full border rounded px-3 py-2 text-sm" placeholder="Grand Plaza Hotel" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number * (Twilio)</label>
            <input name="phoneNumber" required className="w-full border rounded px-3 py-2 text-sm" placeholder="+15075411684" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <input name="timezone" className="w-full border rounded px-3 py-2 text-sm" placeholder="America/New_York" defaultValue="America/New_York" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Handoff Phone</label>
            <input name="handoffPhone" className="w-full border rounded px-3 py-2 text-sm" placeholder="+15551234567" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Greeting</label>
            <textarea name="greeting" rows={2} className="w-full border rounded px-3 py-2 text-sm" placeholder="Welcome to Grand Plaza Hotel! For English stay on the line..." />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded">Cancel</button>
            <button type="submit" disabled={createHotel.isPending} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
              {createHotel.isPending ? 'Creating...' : 'Create Hotel'}
            </button>
          </div>
          {createHotel.isError && <p className="col-span-2 text-sm text-red-500">{createHotel.error.message}</p>}
        </form>
      )}

      {isLoading ? (
        <p className="text-gray-400">Loading...</p>
      ) : !hotels?.length ? (
        <p className="text-gray-400">No hotels configured yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hotels.map((hotel) => (
            <div key={hotel.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-gray-900">{hotel.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{hotel.phoneNumber}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${hotel.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {hotel.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                <p>Timezone: {hotel.timezone}</p>
                <p>Check-in: {hotel.checkInTime} / Check-out: {hotel.checkOutTime}</p>
                <p>PMS: {hotel.pmsProvider}</p>
                {hotel.handoffPhone && <p>Handoff: {hotel.handoffPhone}</p>}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => { if (confirm(`Deactivate ${hotel.name}?`)) deleteHotel.mutate(hotel.id); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Deactivate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
