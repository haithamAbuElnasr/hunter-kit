/* eslint-disable no-console */
/* eslint-disable import/prefer-default-export */

import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';
import { resultFromStd, toolPath } from '../util';
import { PROJECT_DIR } from '../api/project';
import { connectJson } from '../db/connect';

const execFileAsync = util.promisify(execFile);

export async function subFinder(
  domains: string | string[],
  outputDir: string = PROJECT_DIR,
): Promise<{ message: string; success: boolean; error: any }> {
  try {
    const subfinderPath = toolPath('subfinder');
    const outputFile = path.join(outputDir, 'recon_subdomins.txt');

    // Normalize domains into an array
    const domainList = Array.isArray(domains) ? domains : [domains];
    const allResults: string[] = [];

    // Run subfinder separately for each domain (cross‑platform safe way)
    for (const domain of domainList) {
      const { stdout, stderr } = await execFileAsync(subfinderPath, ['-d', domain]);

      // Combine stdout and stderr in case results appear in both
      if (stdout) allResults.push(stdout.trim());
      const found = resultFromStd(stderr, /\bFound\s+(\d+)\s+subdomains?/);
      if (found) console.log(`Found ${found} subdomains for ${domain}`);
    }

    // Append results to output file
    fs.appendFileSync(outputFile, allResults.join('\n') + '\n', 'utf8');

    // Count total found domains
    const domainsFound = allResults.reduce(
      (acc, val) => acc + (val ? val.split('\n').length : 0),
      0,
    );

    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      subfinder: {
        result: domainsFound,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('Error running subFinder:', error);
    return { message: 'Error', success: false, error };
  }
}
