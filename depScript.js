// Requires Node.js 18+ (for fetch built-in)
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream";
import { promisify } from "util";
import tar from "tar";
import AdmZip from "adm-zip";

const streamPipeline = promisify(pipeline);

// Determine script folder path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Helper: Get OS type ----
function getOsType() {
  const platform = os.platform();

  if (platform.startsWith("win")) return "windows";
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "linux";

  console.error(`Unsupported operating system: ${platform}`);
  process.exit(1);
}

// ---- Helper: Download and Extract ----
async function downloadAndExtract(toolInfo) {
  const { name: toolName, repo_owner, repo_name } = toolInfo;
  const apiUrl = `https://api.github.com/repos/${repo_owner}/${repo_name}/releases/latest`;
  const osType = getOsType();

  console.log(`\nFetching release info for ${toolName}...`);
  const resp = await fetch(apiUrl, {
    headers: { "User-Agent": "NodeJS-script" },
  });

  if (resp.status === 200) {
    const releaseInfo = await resp.json();
    let assetUrl = null;

    for (const asset of releaseInfo.assets) {
      const assetNameLower = asset.name.toLowerCase();
      if (assetNameLower.includes(osType) && !assetNameLower.includes("checksum")) {
        assetUrl = asset.browser_download_url;
        break;
      }
    }

    if (!assetUrl) {
      console.warn(`No matching release asset found for ${osType} (excluding checksum).`);
      return;
    }

    const archiveFileName = path.basename(assetUrl);
    console.log(`Downloading ${toolName}: ${archiveFileName}`);

    const binFolder = path.join(__dirname, "bin");
    if (!fs.existsSync(binFolder)) fs.mkdirSync(binFolder, { recursive: true });

    const filePath = path.join(binFolder, archiveFileName);

    // ---- Download file ----
    const downloadResp = await fetch(assetUrl);
    if (!downloadResp.ok) throw new Error(`Download failed: ${downloadResp.statusText}`);
    await streamPipeline(downloadResp.body, fs.createWriteStream(filePath));

    // ---- Extract file ----
    if (archiveFileName.endsWith(".zip")) {
      extractZipArchive(filePath, binFolder);
    } else if (archiveFileName.endsWith(".tar.gz") || archiveFileName.endsWith(".tgz")) {
      await extractTarArchive(filePath, binFolder);
    } else {
      console.error(`Unsupported archive format: ${archiveFileName}`);
      process.exit(1);
    }

    fs.unlinkSync(filePath); // delete archive after extraction
    console.log(`${toolName} downloaded and extracted: ${archiveFileName}`);
  } else if (resp.status === 404) {
    console.error(`Release information not found for ${toolName}. Check repository or release.`);
  } else {
    console.error(`Failed to retrieve release information. Status code: ${resp.status}`);
  }
}

// ---- Extractors ----
function extractZipArchive(zipFile, destPath) {
  const zip = new AdmZip(zipFile);
  zip.extractAllTo(destPath, true);
}

async function extractTarArchive(tarFile, destPath) {
  await tar.x({
    file: tarFile,
    cwd: destPath,
  });
}

// ---- Main ----
const tools = [
  { name: "subfinder", repo_owner: "projectdiscovery", repo_name: "subfinder" },
  { name: "httpx", repo_owner: "projectdiscovery", repo_name: "httpx" },
  { name: "waybackurls", repo_owner: "tomnomnom", repo_name: "waybackurls" },
  { name: "jsleak", repo_owner: "0xHunterr", repo_name: "jsleak" },
  { name: "dalfox", repo_owner: "hahwul", repo_name: "dalfox" },
  { name: "nuclei", repo_owner: "projectdiscovery", repo_name: "nuclei" },
  // Add more tools as needed
];

// Sequentially download and extract
for (const tool of tools) {
  await downloadAndExtract(tool);
}
