const express = require('express');
const db = require('../db');
const { TABLES, EXPORT_VERSION, buildExportPayload, getBackupFiles } = require('../backup');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

const getTableColumns = (tableName) =>
  db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);

const buildInsertStatement = (tableName, columns) => {
  const placeholders = columns.map(() => '?').join(', ');
  return db.prepare(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`);
};

router.get('/summary', (req, res) => {
  const counts = Object.fromEntries(
    TABLES.map((table) => [
      table.name,
      db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count
    ])
  );

  res.json({
    exported_tables: TABLES.map((table) => table.name),
    counts,
    backups: {
      latest: getBackupFiles()[0] || null,
      total_files: getBackupFiles().length,
      auto_backup_enabled: String(process.env.AUTO_BACKUP_ENABLED || 'true').toLowerCase() !== 'false',
      auto_backup_time: process.env.AUTO_BACKUP_TIME || '20:00',
      keep_latest: Number(process.env.AUTO_BACKUP_KEEP_LATEST || 14)
    }
  });
});

router.get('/export', (req, res) => {
  res.json(buildExportPayload());
});

router.post('/import', (req, res) => {
  const payload = req.body;

  if (!payload || payload.app !== 'PharmaDesk' || !payload.tables || typeof payload.tables !== 'object') {
    return res.status(400).json({ error: 'Invalid backup file.' });
  }
  if (payload.confirm_restore !== 'RESTORE') {
    return res.status(400).json({ error: 'Restore confirmation is required.' });
  }
  if (payload.export_version && Number(payload.export_version) > EXPORT_VERSION) {
    return res.status(400).json({ error: 'Backup file was created by a newer app version.' });
  }

  try {
    db.transaction(() => {
      db.exec('PRAGMA foreign_keys = OFF');

      const deleteOrder = [...TABLES].reverse();
      for (const table of deleteOrder) {
        db.prepare(`DELETE FROM ${table.name}`).run();
      }
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN (" + TABLES.map(() => '?').join(', ') + ")")
        .run(...TABLES.map((table) => table.name));

      for (const table of TABLES) {
        const rows = payload.tables[table.name];
        if (!Array.isArray(rows)) continue;

        const columns = getTableColumns(table.name);
        const insert = buildInsertStatement(table.name, columns);

        for (const row of rows) {
          insert.run(...columns.map((column) => (row[column] ?? null)));
        }
      }

      db.exec('PRAGMA foreign_keys = ON');
    })();

    res.json({ message: 'Backup imported successfully.' });
  } catch (error) {
    try {
      db.exec('PRAGMA foreign_keys = ON');
    } catch {}
    res.status(500).json({ error: 'Failed to import backup.' });
  }
});

module.exports = router;
