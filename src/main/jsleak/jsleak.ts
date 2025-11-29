import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { toolPath } from '../util';
import { PROJECT_DIR } from '../api/project';
import { connectJson } from '../db/connect';
import { countLines } from '../results/countResults';

/**
 * Ensure directory for a file exists.
 */
function ensureDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Run jsleak on each line from inputFile; write combined output to outputFile.
 * Each URL is fed via stdin (not as CLI args) to avoid parsing errors.
 */
async function runJsleakPerLine(
  binaryPath: string,
  args: string[],
  inputFile: string,
  outputFile: string,
  filterFn?: (line: string) => boolean
): Promise<void> {
  ensureDir(outputFile);

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Input file not found: ${inputFile}`);
  }

  const lines = fs.readFileSync(inputFile, 'utf8').split(/\r?\n/).filter(Boolean);
  console.log(`[jsleak] Processing ${lines.length} lines with args: ${args.join(' ')}`);

  const outputStream = fs.createWriteStream(outputFile);

  for (const [index, rawLine] of lines.entries()) {
    const cleanUrl = rawLine.trim();
    try {
      const out = execFileSync(binaryPath, args, {
        input: cleanUrl + '\n',
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      if (out) {
        const filtered = filterFn
          ? out
              .split(/\r?\n/)
              .filter((l) => l && filterFn(l))
              .join('\n')
          : out;

        if (filtered?.trim()) {
          outputStream.write(filtered + '\n');
          console.log(`[${index + 1}/${lines.length}] ✔ Processed: ${cleanUrl}`);
        } else {
          console.log(`[${index + 1}/${lines.length}] (no matching output): ${cleanUrl}`);
        }
      } else {
        console.log(`[${index + 1}/${lines.length}] (no output): ${cleanUrl}`);
      }
    } catch (err) {
      console.warn(`[${index + 1}/${lines.length}] ⚠ Failed: ${cleanUrl} ->`, (err as Error).message);
    }
  }

  outputStream.end();
  await new Promise<void>((resolve) => outputStream.on('finish', resolve));
  console.log(`[jsleak] Finished; results written to ${outputFile}`);
}

/**
 * Find secrets using jsleak -s
 */
export async function findSecret(
  outputDir: string = PROJECT_DIR
): Promise<{ message: string; success: boolean; error: any }> {
  try {
    console.log('\n[findSecret] Starting...');
    const jsleakPath = toolPath('jsleak');
    const inputFile = path.join(outputDir, 'httpx_live_domains.txt');
    const outputFile = path.join(outputDir, 'secrets.txt');

    await runJsleakPerLine(jsleakPath, ['-s'], inputFile, outputFile);

    if (!fs.existsSync(outputFile)) {
      return { message: 'No secrets found', success: true, error: null };
    }

    const numberOfUrls = await countLines(outputFile);
    const db = connectJson(path.join(outputDir, 'details.json'));

    await db.update({
      findSecrets: {
        result: numberOfUrls,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    console.log(`[findSecret] Completed. Found ${numberOfUrls} results.`);
    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('[findSecret] Error:', error);
    return { message: 'Error', success: false, error };
  }
}

/**
 * Extract JS file links using jsleak -l
 */
export async function extraLinks(
  outputDir: string = PROJECT_DIR
): Promise<{ message: string; success: boolean; error: any }> {
  try {
    console.log('\n[extraLinks] Starting...');
    const jsleakPath = toolPath('jsleak');
    const inputFile = path.join(outputDir, 'httpx_live_domains.txt');
    const outputFile = path.join(outputDir, 'extra_links.txt');

    await runJsleakPerLine(
      jsleakPath,
      ['-l'],
      inputFile,
      outputFile,
      (line) => line.includes('.js'),
    );

    if (!fs.existsSync(outputFile)) {
      return { message: 'No extra links found', success: true, error: null };
    }

    const numberOfUrls = await countLines(outputFile);
    const db = connectJson(path.join(outputDir, 'details.json'));

    await db.update({
      extraLinks: {
        result: numberOfUrls,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    console.log(`[extraLinks] Completed. Found ${numberOfUrls} results.`);
    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('[extraLinks] Error:', error);
    return { message: 'Error', success: false, error };
  }
}
