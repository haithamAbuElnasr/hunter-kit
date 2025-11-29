import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { toolPath } from '../util';
import { PROJECT_DIR } from '../api/project';
import { connectJson } from '../db/connect';
import { countLines } from '../results/countResults';

export async function liveSubDomains(
  outputDir: string = PROJECT_DIR
): Promise<{
  message: string;
  success: boolean;
  error: any;
}> {
  try {
    const httprobePath = toolPath('httpx');
    const inputFile = path.join(outputDir, 'recon_subdomins.txt');
    const outputFile = path.join(outputDir, 'httpx_live_domains.txt');

    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    // Run command safely across systems
    execFileSync(httprobePath, ['-l', inputFile, '-o', outputFile], {
      stdio: 'inherit',
    });

    const numberOfUrls = await countLines(outputFile);

    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      liveDomains: {
        result: numberOfUrls,
        run: true,
        filePath: outputFile,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('Error in liveSubDomains:', error);
    return { message: 'Error', success: false, error };
  }
}

export async function screenwin(
  outputDir: string = PROJECT_DIR
): Promise<{
  message: string;
  success: boolean;
  error: any;
}> {
  try {
    const httpxPath = toolPath('httpx');
    const liveFile = path.join(outputDir, 'httpx_live_domains.txt');
    const screenshotDir = path.join(outputDir, 'httpx_screen');

    if (!fs.existsSync(liveFile)) {
      throw new Error(`Input file not found: ${liveFile}`);
    }

    // Ensure the screenshot directory exists
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Run screenshot command
    execFileSync(httpxPath, ['-ss', '-l', liveFile, '-srd', screenshotDir], {
      stdio: 'inherit',
    });

    const screenshotIndex = path.join(
      screenshotDir,
      'screenshot/index_screenshot.txt'
    );

    const numberOfScreenShots = fs.existsSync(screenshotIndex)
      ? await countLines(screenshotIndex)
      : 0;

    const db = connectJson(path.join(outputDir, 'details.json'));
    await db.update({
      screens: {
        result: numberOfScreenShots,
        run: true,
        filePath: screenshotDir,
        date: new Date().toUTCString(),
      },
    });

    return { message: 'Done', success: true, error: null };
  } catch (error) {
    console.error('Error in screenwin:', error);
    return { message: 'Error', success: false, error };
  }
}
