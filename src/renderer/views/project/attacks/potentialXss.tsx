/* eslint-disable react/destructuring-assignment */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/jsx-no-useless-fragment */
/* eslint-disable react-hooks/rules-of-hooks */
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { ProjectDetails } from '../../../types';
import { toast } from '../../../components/ui/use-toast';
export default function PotentialXss(details: ProjectDetails) {
  const [loading, setLoading] = useState(false);

  const runPotentialXss = async () => {
    if (!details.name) return;

    setLoading(true); // <-- turn spinner on immediately
    try {
      const res = await window.electron.ipcRenderer.invoke('potential-xss', {
        projectName: details.name,
      });

      if (res) {
        toast({ title: 'Potential XSS job completed' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Potential XSS failed', variant: 'destructive' });
    } finally {
      setLoading(false); // <-- stop spinner whether it succeeds or fails
    }
  };

  return (
    <>
      {!loading ? (
        <Button onClick={runPotentialXss}>Process</Button>
      ) : (
        <Button disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Please wait
        </Button>
      )}
    </>
  );
}
