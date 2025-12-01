/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
/* eslint-disable react/function-component-definition */
/* eslint-disable react/jsx-props-no-spreading */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AskAi } from '../../components/ai/aiChat';

/* -----------------------------------------------------------------
   🧩 MOCK DATA (Fallback if Electron IPC is not available)
------------------------------------------------------------------- */
const records = [
  {
    'template-id': 'xss-deprecated-header',
    info: {
      name: 'XSS-Protection Header - Cross-Site Scripting',
      description:
        'Setting the XSS-Protection header is deprecated. Setting the header to anything other than `0` can actually introduce an XSS vulnerability.',
      severity: 'info',
    },
    url: 'https://hi.new',
  },
  {
    'template-id': 'tech-detect',
    info: {
      name: 'Wappalyzer Technology Detection',
      description: 'Detects technologies via HTTP headers and responses.',
      severity: 'info',
    },
    url: 'https://api.hi.new',
  },
];

/* -----------------------------------------------------------------
   🧱 TYPES
------------------------------------------------------------------- */
interface RecordInfo {
  name: string;
  description: string;
  severity: string;
}

interface Record {
  'template-id': string;
  info: RecordInfo;
  url: string;
}

interface RecordData {
  templateId: string;
  name: string;
  description: string;
  severity: string;
}

type RecordGroupedByURL = { [url: string]: RecordData[] };

/* -----------------------------------------------------------------
   🎨 SEVERITY COLORS
------------------------------------------------------------------- */
const severityColors: Record<string, string> = {
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800',
  critical: 'bg-purple-100 text-purple-800',
};

/* -----------------------------------------------------------------
   📦 GROUPING FUNCTION
------------------------------------------------------------------- */
const groupByUrl = (records: Record[]): RecordGroupedByURL => {
  return records.reduce((acc, record) => {
    const { url } = record;
    if (!acc[url]) acc[url] = [];
    acc[url].push({
      templateId: record['template-id'],
      name: record.info.name,
      description: record.info.description,
      severity: record.info.severity,
    });
    return acc;
  }, {} as RecordGroupedByURL);
};

/* -----------------------------------------------------------------
   📊 TABLE COMPONENT
------------------------------------------------------------------- */
interface RecordTableProps {
  data: RecordGroupedByURL;
}

const RecordTable: React.FC<RecordTableProps> = ({ data }) => {
  return (
    <div className="p-4">
      {Object.keys(data).map((url) => (
        <div key={url} className="mb-8">
          <h2 className="text-xl font-bold mb-4">{url}</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white/20 shadow-md rounded-lg overflow-hidden">
              <thead className="bg-gray-100/40">
                <tr>
                  <th className="py-2 px-4 border-b">Template ID</th>
                  <th className="py-2 px-4 border-b">Name</th>
                  <th className="py-2 px-4 border-b">Description</th>
                  <th className="py-2 px-4 border-b">Ask AI</th>
                  <th className="py-2 px-4 border-b">Severity</th>
                </tr>
              </thead>
              <tbody>
                {data[url].map((record, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2 px-4">{record.templateId}</td>
                    <td className="py-2 px-4">{record.name}</td>
                    <td className="py-2 px-4">{record.description}</td>
                    <td className="py-2 px-4">
                      {record.description && (
                        <AskAi
                          severity={record.severity}
                          input={`${record.description}`}
                        />
                      )}
                    </td>
                    <td
                      className={`py-2 px-4 ${
                        severityColors[record.severity] || ''
                      } rounded-lg text-center`}
                    >
                      {record.severity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

/* -----------------------------------------------------------------
   🚀 MAIN COMPONENT
------------------------------------------------------------------- */
const AttacksResults: React.FC = () => {
  const [details, setDetails] = useState<RecordGroupedByURL | undefined>();
  const { projectSlug } = useParams<{ projectSlug: string }>();

  useEffect(() => {
    const getDetails = async () => {
      try {
        console.log('AttacksResults mounted');
        console.log('projectSlug:', projectSlug);
        console.log('window.electron:', (window as any).electron);

        // ✅ If not in Electron, use mock data
        if (!(window as any).electron) {
          console.warn('Electron not detected — using local mock data.');
          const groupedData = groupByUrl(records);
          setDetails(groupedData);
          return;
        }

        // ✅ Fetch via Electron IPC
        const res = await (window as any).electron.ipcRenderer.invoke(
          'get-attack-result',
          projectSlug,
        );

        if (!res?.results) {
          console.warn('No results from Electron IPC — using mock data.');
          setDetails(groupByUrl(records));
          return;
        }

        console.log(`Fetched ${res.results} results from IPC`);
        const groupedData = groupByUrl(res.results);
        setDetails(groupedData);
      } catch (error) {
        console.error('Error fetching attack results:', error);
        setDetails(groupByUrl(records)); // fallback
      }
    };

    getDetails();
  }, [projectSlug]);

  // --- Render Loading State ---
  if (!details) {
    console.log('Rendering loading state...');
    return <div className="p-4 text-gray-500">Loading...</div>;
  }

  // --- Render Final View ---
  const isMock = !(window as any).electron;
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-6">Attack Results</h1>

      {isMock && (
        <div className="p-2 mb-4 bg-yellow-100 text-yellow-700 rounded">
          ⚠️ Running in browser mode — showing mock data.
        </div>
      )}

      <RecordTable data={details} />
    </div>
  );
};

export default AttacksResults;
