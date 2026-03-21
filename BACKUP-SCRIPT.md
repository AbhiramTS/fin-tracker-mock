# finTracker Backup Script

This guide explains how to use the backup scripts to create a zip file of your finTracker project, excluding unnecessary folders like `node_modules` and `dist`.

## Usage

### Option 1: Using npm (Recommended for Node.js projects)

```bash
npm run zip
```

### Option 2: Using Node.js directly

```bash
node build-zip.js
```

### Option 3: Using Bash script

```bash
bash build-zip.sh
```

Or make it executable first:

```bash
chmod +x build-zip.sh
./build-zip.sh
```

## What gets included

✅ **Included:**

- `src/` - Source code
- `public/` - Public assets
- `docs/` - Documentation
- `fintracker/` - Additional project files
- `memories/` - Saved memories
- All configuration files (package.json, tsconfig.json, vite.config.ts, etc.)
- README.md and other documentation

## What gets excluded

❌ **Excluded:**

- `node_modules/` - Dependencies (can be reinstalled with `npm install`)
- `dist/` - Build output (can be regenerated with `npm run build`)
- `.git/` - Git history
- `.env` files - Environment variables
- `.DS_Store`, `Thumbs.db` - System files
- `.cache/`, `.vscode/`, `.idea/` - Cache and IDE files
- Log files and temporary files

## Output

The script creates a timestamped zip file:

```
finTracker-backup-YYYY-MM-DD.zip
```

The file size and location will be displayed when the script completes.

## Notes

- The scripts require the `zip` command to be available on your system
- On Windows, you may need to install a zip utility like [7-Zip](https://www.7-zip.org/) or use WSL
- Each time you run the script, it creates a new file with today's date
- Previous backups are never overwritten
