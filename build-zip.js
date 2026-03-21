import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files and folders to exclude
const excludePatterns = [
	'node_modules',
	'dist',
	'.git',
	'.gitignore',
	'.env',
	'.env.local',
	'.env.*.local',
	'.DS_Store',
	'Thumbs.db',
	'*.log',
	'.cache',
	'.vscode',
	'.idea',
	'coverage',
	'build-zip.js',
	'*.swp',
	'*.swo',
	'*~',
];

// Files and folders to include
const includePatterns = [
	'src',
	'public',
	'docs',
	'fintracker',
	'package.json',
	'package-lock.json',
	'tsconfig.json',
	'tsconfig.node.json',
	'vite.config.ts',
	'tailwind.config.js',
	'postcss.config.js',
	'index.html',
	'README.md',
	'.gitignore',
	'memories',
];

// Build exclude pattern for zip command
const excludeFlags = excludePatterns.map((pattern) => `-x "${pattern}" "${pattern}/*"`).join(' ');

// Build include pattern for zip command
const includeFiles = includePatterns.map((pattern) => `"${pattern}"`).join(' ');

const timestamp = new Date().toISOString().slice(0, 10);
const zipFileName = `finTracker-backup-${timestamp}.zip`;
const zipFilePath = path.join(__dirname, zipFileName);

try {
	console.log(`\n📦 Creating zip file: ${zipFileName}\n`);

	// Build zip command
	const cmd = `cd "${__dirname}" && zip -r "${zipFileName}" ${includeFiles} ${excludeFlags} -q`;

	// Execute zip command
	execSync(cmd, { stdio: 'inherit' });

	// Get file size
	const stats = fs.statSync(zipFilePath);
	const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

	console.log(`\n✅ Successfully created: ${zipFileName}`);
	console.log(`📊 File size: ${sizeInMB} MB`);
	console.log(`📍 Location: ${zipFilePath}\n`);
} catch (error) {
	console.error(`\n❌ Error creating zip file:`);
	console.error(error.message);
	process.exit(1);
}
