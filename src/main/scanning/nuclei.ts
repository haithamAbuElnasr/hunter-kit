import path from 'path';
import fs from 'fs';
import util from 'util';
import { execFile } from 'child_process';
import { toolPath } from '../util';
import { PROJECT_DIR } from '../api/project';
import { connectJson } from '../db/connect';
import { countLines } from '../results/countResults';

const execFileAsync = util.promisify(execFile);

/**
 * Ensure an output directory exists and return its resolved path
 */
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
  scanType: string, // e.g. "-t http/"
  outputFileName: string,
  dbKey: string,
  outputDir: string,
  inputFile = 'httpx_live_domains.txt',
): Promise<{ message: string; success: boolean; error: any }> {
  try {
    const nucleiPath = toolPath('nuclei');
    ensureDir(outputDir);

    const inputPath = path.join(outputDir, inputFile);
    const outputFileNameJson = outputFileName.replace('.txt', '.json');
    const outputPathTxt = path.join(outputDir, outputFileName);
    const outputPathJson = path.join(outputDir, outputFileNameJson);

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Parse nuclei flags correctly into array form to avoid shell interpretation issues
    // Example: "-t http/" -> ["-t", "http/"]
    const scanArgs = scanType.trim().split(/\s+/);
    const args = [
      '-l',
      inputPath,
      ...scanArgs,
      '-o',
      outputPathTxt,
      '-je',
      outputPathJson,
    ];

    console.log('Running nuclei:', nucleiPath, args.join(' '));

    // Execute nuclei safely without invoking any shell
    await execFileAsync(nucleiPath, args, {
      windowsHide: true,
      stdio: 'inherit',
    });

    const numberOfUrls = await countLines(outputPathTxt);

    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      [dbKey]: {
        result: numberOfUrls,
        run: true,
        filePath: outputPathTxt,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error(`Error occurred in ${dbKey} scan:`, error);
    return { message: 'Error', success: false, error };
  }
}

/**
 * Individual exported scan functions
 */

export async function generalScanning(outputDir: string = PROJECT_DIR) {
  return runScan(
    '-t http/',
    'general_scanning.txt',
    'generalScanning',
    outputDir,
  );
}

export async function exposedPanels(outputDir: string = PROJECT_DIR) {
  return runScan(
    '-t http/exposed-panels',
    'exposed_panels.txt',
    'exposedPanels',
    outputDir,
  );
}

export async function defaultCredentials(outputDir: string = PROJECT_DIR) {
  return runScan(
    '-t http/default-logins',
    'default_credentials.txt',
    'defaultCredentials',
    outputDir,
  );
}

export async function subdomainTakeovers(outputDir: string = PROJECT_DIR) {
  return runScan(
    '-t http/takeovers',
    'subdomain_takeovers.txt',
    'subdomainTakeovers',
    outputDir,
  );
}

export async function scanningForExposures(outputDir: string = PROJECT_DIR) {
  return runScan('-t exposures/', 'exposures.txt', 'exposures', outputDir);
}

export async function scanningCVEs(outputDir: string = PROJECT_DIR) {
  return runScan(
    '-t http/vulnerabilities',
    'CVEs.txt',
    'scanningCVEs',
    outputDir,
    'waybackurls_archive.txt',
  );
}

export async function scanningForLFI(outputDir: string = PROJECT_DIR) {
  return runScan(
    '-tags lfi',
    'LFI.txt',
    'scanningForLFI',
    outputDir,
    'waybackurls_archive.txt',
  );
}
