import path from 'path';
import fs from 'fs';
import util from 'util';
import { execFile } from 'child_process';
import { toolPath } from '../util';
import { PROJECT_DIR } from '../api/project';
import { connectJson } from '../db/connect';
import { countLines } from '../results/countResults';

const execFileAsync = util.promisify(execFile);

/** Return the default Nuclei templates base path */
function nucleiTemplatesPath(): string {
  // On Windows, usually in C:\Users\<user>\nuclei-templates
  const home = process.env.USERPROFILE || process.env.HOMEPATH || 'C:\\Users\\Public';
  return path.join(home, 'nuclei-templates');
}

/** Ensure a directory exists */
function ensureDir(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return path.resolve(dirPath);
}

/**
 * Generic nuclei scan runner (cross‑platform safe)
 */
async function runScan(
  scanType: string, // e.g. "http/"
  outputFileName: string,
  dbKey: string,
  outputDir: string,
  inputFile = 'httpx_live_domains.txt',
): Promise<{ message: string; success: boolean; error: any }> {
  const nucleiPath = toolPath('nuclei');
  ensureDir(outputDir);

  const inputPath = path.join(outputDir, inputFile);
  const outputFileNameJson = outputFileName.replace('.txt', '.json');
  const outputPathTxt = path.join(outputDir, outputFileName);
  const outputPathJson = path.join(outputDir, outputFileNameJson);

  let success = true;
  let error: any = null;
  let numberOfUrls = 0;

  try {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Resolve template directory
    const templatesDir = nucleiTemplatesPath();
    const scanTemplatePath = path.join(templatesDir, scanType);

    // If user passed something like '-t http/vulnerabilities', we already
    // add the full path automatically.
    const args = [
      '-l',
      inputPath,
      '-t',
      scanTemplatePath,
      '-o',
      outputPathTxt,
      '-je',
      outputPathJson,
    ];

    console.log('Running nuclei:', nucleiPath, args.join(' '));

    await execFileAsync(nucleiPath, args, {
      windowsHide: true,
      stdio: 'inherit',
    });

    numberOfUrls = await countLines(outputPathTxt);
  } catch (err) {
    success = false;
    error = err;
    console.error(`Error occurred in ${dbKey} scan:`, err);
  }

  // Always write update to details.json
  try {
    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      [dbKey]: {
        result: numberOfUrls,
        run: true,
        filePath: outputPathTxt,
        date: new Date().toUTCString(),
      },
    });
  } catch (err) {
    console.error(`Couldn't update details.json for ${dbKey}:`, err);
  }

  return { message: success ? 'Done' : 'Error', success, error };
}

/** Individual scan functions */

export async function generalScanning(outputDir: string = PROJECT_DIR) {
  return runScan('http', 'general_scanning.txt', 'generalScanning', outputDir);
}

export async function exposedPanels(outputDir: string = PROJECT_DIR) {
  return runScan('http/exposed-panels', 'exposed_panels.txt', 'exposedPanels', outputDir);
}

export async function defaultCredentials(outputDir: string = PROJECT_DIR) {
  return runScan('http/default-logins', 'default_credentials.txt', 'defaultCredentials', outputDir);
}

export async function subdomainTakeovers(outputDir: string = PROJECT_DIR) {
  return runScan('http/takeovers', 'subdomain_takeovers.txt', 'subdomainTakeovers', outputDir);
}

export async function scanningForExposures(outputDir: string = PROJECT_DIR) {
  // Path: nuclei-templates/http/exposures
  return runScan('http/exposures', 'exposures.txt', 'exposures', outputDir);
}

export async function scanningCVEs(outputDir: string = PROJECT_DIR) {
  // Path: nuclei-templates/http/vulnerabilities
  return runScan('http/vulnerabilities', 'CVEs.txt', 'scanningCVEs', outputDir, 'waybackurls_archive.txt');
}

export async function scanningForLFI(outputDir: string = PROJECT_DIR) {
  // Path: nuclei-templates/file/lfi or filter by tag
  return runScan('file/lfi', 'LFI.txt', 'scanningForLFI', outputDir, 'waybackurls_archive.txt');
}
