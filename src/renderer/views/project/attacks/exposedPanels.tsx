import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { ProjectDetails } from '../../../types';
import { Button } from '../../../components/ui/button';
import { toast } from '../../../components/ui/use-toast';

export default function ExposedPanels(details: ProjectDetails) {
  const [loading, setLoading] = useState(false);

  const runExposedPanels = async () => {
    if (!details.name) return;

    setLoading(true); // turn spinner on immediately
    try {
      const res = await window.electron.ipcRenderer.invoke('exposed-panels', {
        projectName: details.name,
      });

      if (res) {
        toast({ title: 'Exposed Panels job completed' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Exposed Panels job failed', variant: 'destructive' });
    } finally {
      setLoading(false); // always turn spinner off
    }
  };

  return (
    <>
      {!loading ? (
        <Button onClick={runExposedPanels}>Process</Button>
      ) : (
        <Button disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Please wait
        </Button>
      )}
    </>
  );
}
