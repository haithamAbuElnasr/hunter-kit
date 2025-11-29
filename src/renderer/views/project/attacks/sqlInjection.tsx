/* eslint-disable react/destructuring-assignment */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/jsx-no-useless-fragment */
/* eslint-disable react-hooks/rules-of-hooks */
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { ProjectDetails } from '../../../types';
import { toast } from '../../../components/ui/use-toast';

export default function SqlInjection(details: ProjectDetails) {
  const [loading, setLoading] = useState(false);

  const runSqlInjection = async () => {
    if (!details.name) return;

    setLoading(true); // turn spinner on immediately
    try {
      const res = await window.electron.ipcRenderer.invoke('multi-scans', {
        projectName: details.name,
      });

      if (res) {
        toast({ title: 'Multi‑scan job completed' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Multi‑scan job failed', variant: 'destructive' });
    } finally {
      setLoading(false); // ensure we always turn the spinner off
    }
  };

  return (
    <>
      {!loading ? (
        <Button onClick={runSqlInjection}>Process</Button>
      ) : (
        <Button disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Please wait
        </Button>
      )}
    </>
  );
}
