import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { toolPath } from '../util';
import { PROJECT_DIR } from '../api/project';
import { connectJson } from '../db/connect';
import { countLines } from '../results/countResults';

const execFileAsync = promisify(execFile);

/** Ensure directory for a file exists */
function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Core Dalfox runner */
async function runDalfox(
  args: string[],
  outputFile: string,
  dbKey: string,
  outputDir: string,
) {
  ensureDir(outputFile);

  const dalfoxPath = toolPath('dalfox'); // let helper add .exe or variant
  const errorLog = path.join(outputDir, `${dbKey}_error.log`);
  const output = fs.createWriteStream(outputFile);
  const errOutput = fs.createWriteStream(errorLog);

  try {
    // Execute without using a shell
    const proc = execFile(dalfoxPath, args, { windowsHide: true });

    proc.stdout?.pipe(output);
    proc.stderr?.pipe(errOutput);

    const exitCode: number = await new Promise((resolve) => {
      proc.on('error', () => resolve(999)); // custom code if spawn fails
      proc.on('exit', (code) => resolve(code ?? 999));
    });

    output.end();
    errOutput.end();

    if (exitCode !== 0) {
      console.warn(`Dalfox exited with code ${exitCode} (see ${errorLog})`);
    }

    if (!fs.existsSync(outputFile)) {
      console.warn(`No output produced for ${dbKey}`);
      return { message: 'No results', success: true, error: null };
    }

    const numberOfUrls = await countLines(outputFile);
    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      [dbKey]: {
        result: numberOfUrls,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error(`Error occurred in ${dbKey}:`, error);
    return { message: 'Error', success: false, error };
  }
}

/** Runs Dalfox to find XSS */
export async function scanningForXSS(
  outputDir: string = PROJECT_DIR,
) {
  const inputFile = path.join(outputDir, 'httpx_live_domains.txt');
  if (!fs.existsSync(inputFile) || !fs.readFileSync(inputFile, 'utf8').trim()) {
    return { message: 'Input file empty or missing', success: false, error: null };
  }

  const outputFile = path.join(outputDir, 'XSS.txt');
  const args = ['file', inputFile, '--skip-bav'];
  return runDalfox(args, outputFile, 'XSS', outputDir);
}

/** Runs Dalfox multi‑scan */
export async function multiScans(
  outputDir: string = PROJECT_DIR,
) {
  const inputFile = path.join(outputDir, 'httpx_live_domains.txt');
  if (!fs.existsSync(inputFile) || !fs.readFileSync(inputFile, 'utf8').trim()) {
    return { message: 'Input file empty or missing', success: false, error: null };
  }

  const outputFile = path.join(outputDir, 'multi_scans.txt');
  const args = ['file', inputFile];
  return runDalfox(args, outputFile, 'multiScans', outputDir);
}
