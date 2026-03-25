import { useParams, Link } from 'react-router-dom';
import { useCallTimeline } from '../hooks/useApi';
import { StatusBadge } from '../components/StatusBadge';

export function CallDetailPage() {
  const { callSid } = useParams<{ callSid: string }>();
  const { data, isLoading } = useCallTimeline(callSid ?? '');

  if (isLoading) return <div className="text-gray-500">Loading...</div>;
  if (!data) return <div className="text-red-500">Call not found</div>;

  const { call, timeline } = data;
  const guestName = call.guest?.firstName ? `${call.guest.firstName} ${call.guest.lastName ?? ''}`.trim() : call.guest?.phoneNumber ?? 'Unknown';

  return (
    <div>
      <Link to="/calls" className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Calls</Link>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{guestName}</h1>
            <p className="text-sm text-gray-500 mt-1">{call.hotelName} &middot; {call.callSid}</p>
          </div>
          <StatusBadge status={call.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
          <div><span className="text-gray-500">Started:</span> <span className="ml-1">{new Date(call.startedAt).toLocaleString()}</span></div>
          <div><span className="text-gray-500">Duration:</span> <span className="ml-1">{call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : '-'}</span></div>
          <div><span className="text-gray-500">Language:</span> <span className="ml-1">{call.language ?? 'Unknown'}</span></div>
          {call.recordingUrl && <div><a href={call.recordingUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Recording</a></div>}
        </div>
      </div>

      {call.transcriptSummary && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Transcript</h2>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{call.transcriptSummary}</pre>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-sm font-medium text-gray-500 mb-4">Timeline ({timeline.length} events)</h2>
        <div className="space-y-3">
          {timeline.map((entry, i) => (
            <div key={i} className="flex gap-3 text-sm">
              <span className="text-gray-400 w-20 shrink-0 text-xs mt-0.5">{new Date(entry.time).toLocaleTimeString()}</span>
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${entry.type === 'tool' ? 'bg-blue-500' : entry.type === 'handoff' ? 'bg-red-500' : 'bg-gray-400'}`} />
              <div>
                {entry.type === 'event' && (
                  <span className="text-gray-700">{(entry.data as { event?: string }).event}</span>
                )}
                {entry.type === 'tool' && (
                  <span>
                    <span className="font-mono text-blue-700">{(entry.data as { toolName?: string }).toolName}</span>
                    <span className="text-gray-500 ml-2">{(entry.data as { durationMs?: number }).durationMs}ms</span>
                    {(entry.data as { error?: string }).error && <span className="text-red-500 ml-2">{(entry.data as { error?: string }).error}</span>}
                  </span>
                )}
                {entry.type === 'handoff' && (
                  <span className="text-red-700">Handoff: {(entry.data as { reason?: string }).reason} &rarr; {(entry.data as { transferTo?: string }).transferTo}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
