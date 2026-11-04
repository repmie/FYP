import { useQuery } from '@tanstack/react-query';
import { Shell, PageHeader } from '@/components/Shell';
import { Card, Loading, ErrorState } from '@/components/common';
import { getStations, getFiles } from '@/lib/api';
import { fmtKLDateTime } from '@/lib/time';
import { Download } from 'lucide-react';

function sizeText(kb) { return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`; }

export default function DataFiles() {
  const stationsQ = useQuery({ queryKey: ['stations'], queryFn: getStations });
  const filesQ = useQuery({ queryKey: ['files'], queryFn: getFiles });

  return (
    <Shell>
      <PageHeader title="Data & files" purpose="Live hourly readings are matched to the nearest OpenAQ station with all model inputs. Forecasts are only shown when 24 consecutive complete hours are available." testid="data-header" />

      <div className="space-y-6">
        <Card className="p-6 overflow-x-auto">
          <h2 className="text-[20px] font-semibold mb-4">Stations</h2>
          {stationsQ.isLoading ? <Loading /> : stationsQ.isError ? <ErrorState onRetry={stationsQ.refetch} /> : (
            <table className="w-full text-sm" data-testid="stations-table">
              <thead><tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 font-medium">Station</th><th className="py-2 font-medium">Coordinates</th>
                <th className="py-2 font-medium">OpenAQ location</th><th className="py-2 font-medium">Complete hours (last 72h)</th><th className="py-2 font-medium">Latest reading</th><th className="py-2 font-medium">Forecast</th>
              </tr></thead>
              <tbody className="tnum">
                {stationsQ.data.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0" data-testid={`station-row-${s.id}`}>
                    <td className="py-2.5 font-medium">{s.name}</td>
                    <td>{s.lat.toFixed(4)}, {s.lon.toFixed(4)}</td>
                    <td>{s.openAqLocation || (s.sourceStatus === 'error' ? 'OpenAQ unavailable' : 'No matching station with all inputs')}</td>
                    <td>{s.hoursOfData.toLocaleString()}</td>
                    <td>{fmtKLDateTime(new Date(s.lastReadingAt))}</td>
                    <td><span className={`px-2 py-0.5 rounded-full text-xs ${s.forecastMethod === 'model' ? 'bg-green-50 text-green-700' : 'bg-secondary text-muted-foreground'}`}>{s.forecastMethod === 'model' ? 'model' : s.forecastMethod === 'persistence' ? 'fallback' : 'unavailable'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <p className="text-xs text-muted-foreground">
          Air-quality measurements are provided by OpenAQ. Station matches are selected by distance and available parameters; source location and measurement time are shown above.
        </p>

        <Card className="p-6 overflow-x-auto">
          <h2 className="text-[20px] font-semibold mb-4">Downloadable files</h2>
          {filesQ.isLoading ? <Loading /> : filesQ.isError ? <ErrorState onRetry={filesQ.refetch} /> : (
            <table className="w-full text-sm" data-testid="files-table">
              <thead><tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 font-medium">File</th><th className="py-2 font-medium">Size</th><th className="py-2 font-medium text-right">Download</th>
              </tr></thead>
              <tbody className="tnum">
                {filesQ.data.map((f) => (
                  <tr key={f.name} className="border-b border-border last:border-0">
                    <td className="py-2.5"><span className="font-medium font-mono text-[13px]">{f.name}</span><span className="block text-xs text-muted-foreground">{f.description}</span></td>
                    <td>{sizeText(f.sizeKb)}</td>
                    <td className="text-right">
                      <a href={f.url} className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline" data-testid={`download-${f.name}`}>
                        <Download size={16} strokeWidth={1.5} /> Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Shell>
  );
}