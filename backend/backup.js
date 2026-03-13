const fs = require('fs');
const path = require('path');
const db = require('./db');

const TABLES = [
  { name: 'users', order: 'id' },
  { name: 'categories', order: 'id' },
  { name: 'suppliers', order: 'id' },
  { name: 'products', order: 'id' },
  { name: 'product_batches', order: 'id' },
  { name: 'sales', order: 'id' },
  { name: 'sale_items', order: 'id' },
  { name: 'returns', order: 'id' },
  { name: 'return_items', order: 'id' },
  { name: 'purchase_receipts', order: 'id' },
  { name: 'purchase_receipt_items', order: 'id' },
  { name: 'stock_movements', order: 'id' }
];

const EXPORT_VERSION = 1;
const backupsDir = path.join(__dirname, 'backups');

const ensureBackupsDir = () => {
  fs.mkdirSync(backupsDir, { recursive: true });
};

const buildExportPayload = () => {
  const tables = {};
  const counts = {};

  for (const table of TABLES) {
    const rows = db.prepare(`SELECT * FROM ${table.name} ORDER BY ${table.order}`).all();
    tables[table.name] = rows;
    counts[table.name] = rows.length;
  }

  return {
    app: 'PharmaDesk',
    export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    counts,
    tables
  };
};

const sanitizeTimestamp = (value) => value.replace(/[:.]/g, '-');

const createBackupFile = () => {
  ensureBackupsDir();
  const payload = buildExportPayload();
  const fileName = `pharmadesk-backup-${sanitizeTimestamp(payload.exported_at)}.json`;
  const filePath = path.join(backupsDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return { fileName, filePath, payload };
};

const getBackupFiles = () => {
  ensureBackupsDir();
  return fs.readdirSync(backupsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const fullPath = path.join(backupsDir, name);
      const stats = fs.statSync(fullPath);
      return {
        fileName: name,
        filePath: fullPath,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString()
      };
    })
    .sort((left, right) => new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime());
};

const pruneBackups = (keepLatest) => {
  if (!Number.isInteger(keepLatest) || keepLatest <= 0) return;

  const files = getBackupFiles();
  for (const file of files.slice(keepLatest)) {
    try {
      fs.unlinkSync(file.filePath);
    } catch (error) {
      console.error(`Failed to remove old backup ${file.fileName}`, error);
    }
  }
};

const parseScheduledTime = (value) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value || '');
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return { hours, minutes };
};

const millisecondsUntilNextRun = ({ hours, minutes }) => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - now.getTime();
};

const startAutoBackupScheduler = () => {
  const enabled = String(process.env.AUTO_BACKUP_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    return { enabled: false, schedule: null };
  }

  const parsedTime = parseScheduledTime(process.env.AUTO_BACKUP_TIME || '20:00');
  if (!parsedTime) {
    console.error('Invalid AUTO_BACKUP_TIME. Expected HH:MM, for example 20:00.');
    return { enabled: false, schedule: null };
  }

  const keepLatest = Number(process.env.AUTO_BACKUP_KEEP_LATEST || 14);

  const runBackup = () => {
    try {
      const result = createBackupFile();
      pruneBackups(keepLatest);
      console.log(`Auto backup created: ${result.fileName}`);
    } catch (error) {
      console.error('Automatic backup failed', error);
    }
  };

  const scheduleNext = () => {
    const delay = millisecondsUntilNextRun(parsedTime);
    setTimeout(() => {
      runBackup();
      scheduleNext();
    }, delay);
  };

  ensureBackupsDir();
  scheduleNext();

  return {
    enabled: true,
    schedule: `${String(parsedTime.hours).padStart(2, '0')}:${String(parsedTime.minutes).padStart(2, '0')}`,
    keepLatest
  };
};

module.exports = {
  TABLES,
  EXPORT_VERSION,
  backupsDir,
  buildExportPayload,
  createBackupFile,
  getBackupFiles,
  startAutoBackupScheduler
};
