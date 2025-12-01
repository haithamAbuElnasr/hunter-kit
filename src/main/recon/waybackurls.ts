import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import readline from 'readline';
import { toolPath } from '../util';
import { PROJECT_DIR } from '../api/project';
import { connectJson } from '../db/connect';
import { countLines } from '../results/countResults';

const execFileAsync = util.promisify(execFile);

/**
 * Helper: filter lines from a file by substring or regex and save them.
 */
async function filterFileLines(
  inputFile: string,
  outputFile: string,
  filter: (line: string) => boolean,
): Promise<number> {
  const input = fs.createReadStream(inputFile);
  const output = fs.createWriteStream(outputFile);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let count = 0;
  for await (const line of rl) {
    if (filter(line)) {
      output.write(line + '\n');
      count++;
    }
  }
  output.end();
  return count;
}

export async function wwayback(
  outputDir: string = PROJECT_DIR,
): Promise<{ message: string; success: boolean; error: any }> {
  try {
    const waybackPath = toolPath('waybackurls');
    const inputFile = path.join(outputDir, 'httpx_live_domains.txt');
    const outputFile = path.join(outputDir, 'waybackurls_archive.txt');

    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    const inputDomains = fs
      .readFileSync(inputFile, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean);

    const outStream = fs.createWriteStream(outputFile);

    // Process each domain with waybackurls safely
    for (const domain of inputDomains) {
      const { stdout } = await execFileAsync(waybackPath, [domain], {
        maxBuffer: 1024 * 1024 * 100, // 100 MB buffer
      });
      if (stdout) outStream.write(stdout);
    }
    outStream.end();

    const numberOfUrls = await countLines(outputFile);

    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      archive: {
        result: numberOfUrls,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('Error in wwayback:', error);
    console.log('Error in wwayback:', error);
    return { message: "There's no data to get", success: false, error };
  }
}

export async function fetchJs(
  outputDir: string = PROJECT_DIR,
): Promise<{ message: string; success: boolean; error: any }> {
  try {
    const inputFile = path.join(outputDir, 'waybackurls_archive.txt');
    const outputFile = path.join(outputDir, 'waybackurls_js.txt');

    const numberOfJsFiles = await filterFileLines(inputFile, outputFile, (line) =>
      line.includes('.js'),
    );

    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      js: {
        result: numberOfJsFiles,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('Error in fetchJs:', error);
    return { message: "There's no data to get", success: false, error };
  }
}

export async function parameter(
  outputDir: string = PROJECT_DIR,
): Promise<{ message: string; success: boolean; error: any }> {
  try {
    const inputFile = path.join(outputDir, 'waybackurls_archive.txt');
    const outputFile = path.join(outputDir, 'waybackurls_parameter.txt');

    const numberOfParams = await filterFileLines(inputFile, outputFile, (line) =>
      line.includes('='),
    );

    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      params: {
        result: numberOfParams,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('Error in parameter:', error);
    return { message: "There's no data to get", success: false, error };
  }
}
