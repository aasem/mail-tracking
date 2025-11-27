import Database from "better-sqlite3"
import path from "path"

export const DEFAULT_STATUS_COLOR = "#2563eb"

const dbPath = path.join(process.cwd(), "mail_tracking.db")

// Helper function to calculate pending days
function calculatePendingDays(receivedDate: string, despatchDate: string | null): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // If despatch date is set, pending days is 0
  if (despatchDate) {
    return 0
  }
  
  // Calculate days between today and received date
  const received = new Date(receivedDate)
  received.setHours(0, 0, 0, 0)
  
  const diffTime = today.getTime() - received.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays) // Ensure non-negative
}

export function getDb() {
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS directorates (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS status_entries (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '${DEFAULT_STATUS_COLOR}'
    );

    CREATE TABLE IF NOT EXISTS mail_records (
      id INTEGER PRIMARY KEY,
      document_title TEXT NOT NULL,
      originator_id INTEGER NOT NULL,
      received_date DATE NOT NULL,
      status TEXT NOT NULL,
      comments TEXT,
      despatch_date DATE,
      recipient_id INTEGER,
      pending_days INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(originator_id) REFERENCES directorates(id),
      FOREIGN KEY(recipient_id) REFERENCES directorates(id)
    );
  `)

  // Migrate existing schema: allow NULL recipient_id if it's currently NOT NULL
  const tableInfo = db.prepare("PRAGMA table_info(mail_records)").all() as Array<{ name: string; notnull: number; type: string }>
  const recipientIdColumn = tableInfo.find((col) => col.name === "recipient_id")
  if (recipientIdColumn && recipientIdColumn.notnull === 1) {
    // Create a new table with nullable recipient_id
    db.exec(`
      CREATE TABLE IF NOT EXISTS mail_records_new (
        id INTEGER PRIMARY KEY,
        document_title TEXT NOT NULL,
        originator_id INTEGER NOT NULL,
        received_date DATE NOT NULL,
        status TEXT NOT NULL,
        comments TEXT,
        despatch_date DATE,
        recipient_id INTEGER,
        pending_days INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(originator_id) REFERENCES directorates(id),
        FOREIGN KEY(recipient_id) REFERENCES directorates(id)
      );
      
      INSERT INTO mail_records_new SELECT * FROM mail_records;
      DROP TABLE mail_records;
      ALTER TABLE mail_records_new RENAME TO mail_records;
    `)
  }

  // Backfill color column for existing databases where it may be missing
  const statusColumns = db.prepare("PRAGMA table_info(status_entries)").all() as Array<{ name: string }>
  const hasColorColumn = statusColumns.some((column) => column.name === "color")
  if (!hasColorColumn) {
    db.exec(`ALTER TABLE status_entries ADD COLUMN color TEXT NOT NULL DEFAULT '${DEFAULT_STATUS_COLOR}'`)
  }

  return db
}

export function getAllDirectorates() {
  const db = getDb()
  return db.prepare("SELECT * FROM directorates ORDER BY name").all() as Array<{ id: number; name: string }>
}

export function addDirectorate(name: string) {
  const db = getDb()
  try {
    const insert = db.prepare("INSERT INTO directorates (name) VALUES (?)")
    const result = insert.run(name)
    return { id: Number(result.lastInsertRowid), name }
  } catch (error: any) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error(`Addressee "${name}" already exists in the master list`)
    }
    throw error
  }
}

export function getDirectorateByName(name: string) {
  const db = getDb()
  return db.prepare("SELECT * FROM directorates WHERE name = ?").get(name) as { id: number; name: string } | undefined
}

export function updateDirectorate(id: number, name: string) {
  const db = getDb()
  try {
    const update = db.prepare("UPDATE directorates SET name = ? WHERE id = ?")
    const result = update.run(name, id)
    if (result.changes === 0) {
      throw new Error(`Addressee with id ${id} not found`)
    }
    return { id, name }
  } catch (error: any) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error(`Addressee "${name}" already exists in the master list. Please choose a different name.`)
    }
    throw error
  }
}

export function deleteDirectorate(id: number) {
  const db = getDb()
  
  // Get the directorate name for better error messages
  const directorate = db.prepare("SELECT name FROM directorates WHERE id = ?").get(id) as { name: string } | undefined
  if (!directorate) {
    throw new Error(`Addressee with id ${id} not found`)
  }
  
  // Check if directorate is used in any mail records
  const checkUsage = db.prepare(`
    SELECT COUNT(*) as count 
    FROM mail_records 
    WHERE originator_id = ? OR recipient_id = ?
  `).get(id, id) as { count: number }
  
  if (checkUsage.count > 0) {
    throw new Error(`Cannot delete addressee "${directorate.name}": It is currently being used in ${checkUsage.count} mail record(s). Please delete or update those records first before removing this addressee.`)
  }
  
  const deleteStmt = db.prepare("DELETE FROM directorates WHERE id = ?")
  const result = deleteStmt.run(id)
  
  if (result.changes === 0) {
    throw new Error(`Addressee "${directorate.name}" could not be deleted`)
  }
  
  return true
}

export function searchMailRecords(
  searchTerm = "",
  originator = "",
  recipient = "",
  status = "",
  receivedFrom = "",
  receivedTo = "",
  despatchFrom = "",
  despatchTo = ""
) {
  const db = getDb()
  let query = `
    SELECT 
      mr.id, mr.document_title, d1.name as originator, 
      mr.received_date, mr.status, mr.comments, 
      mr.despatch_date, d2.name as recipient_name
    FROM mail_records mr
    JOIN directorates d1 ON mr.originator_id = d1.id
    LEFT JOIN directorates d2 ON mr.recipient_id = d2.id
    WHERE 1=1
  `

  const params: (string | number)[] = []

  if (searchTerm) {
    query += " AND (mr.document_title LIKE ? OR d1.name LIKE ? OR mr.comments LIKE ?)"
    const term = `%${searchTerm}%`
    params.push(term, term, term)
  }

  if (originator) {
    query += " AND d1.name = ?"
    params.push(originator)
  }

  if (recipient) {
    query += " AND d2.name = ?"
    params.push(recipient)
  }

  if (status) {
    query += " AND mr.status = ?"
    params.push(status)
  }

  if (receivedFrom) {
    query += " AND mr.received_date >= ?"
    params.push(receivedFrom)
  }

  if (receivedTo) {
    query += " AND mr.received_date <= ?"
    params.push(receivedTo)
  }

  if (despatchFrom) {
    query += " AND mr.despatch_date IS NOT NULL AND mr.despatch_date >= ?"
    params.push(despatchFrom)
  }

  if (despatchTo) {
    query += " AND mr.despatch_date IS NOT NULL AND mr.despatch_date <= ?"
    params.push(despatchTo)
  }

  query += " ORDER BY mr.received_date DESC"

  const records = db.prepare(query).all(...params) as Array<any>
  
  // Calculate pending days for each record
  return records.map((record) => ({
    ...record,
    pending_days: calculatePendingDays(record.received_date, record.despatch_date)
  }))
}

export function addMailRecords(
  records: Array<{
    document_title: string
    originator?: string
    originator_id?: number
    received_date: string
    status: string
    comments: string
    despatch_date: string | null
    recipient_name?: string
    recipient_id?: number
  }>,
) {
  const db = getDb()
  
  // Helper to get directorate by name (must exist - no auto-creation)
  const getDirectorateId = (name: string): number => {
    const existing = getDirectorateByName(name)
    if (!existing) {
      throw new Error(`Addressee "${name}" does not exist in the master list. Please add it first.`)
    }
    return existing.id
  }

  const insertWithIds = db.prepare(`
    INSERT INTO mail_records 
    (document_title, originator_id, received_date, status, comments, despatch_date, recipient_id, pending_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction((recs: typeof records) => {
    return recs.map((rec) => {
      let originatorId: number
      let recipientId: number | null = null

      // Handle originator (required)
      if (rec.originator) {
        originatorId = getDirectorateId(rec.originator)
      } else if (rec.originator_id) {
        originatorId = rec.originator_id
      } else {
        throw new Error("Records must have either originator or originator_id")
      }

      // Handle recipient (optional)
      if (rec.recipient_name) {
        recipientId = getDirectorateId(rec.recipient_name)
      } else if (rec.recipient_id !== undefined) {
        recipientId = rec.recipient_id || null
      }

      // Calculate pending days automatically
      const pendingDays = calculatePendingDays(rec.received_date, rec.despatch_date)

      return insertWithIds.run(
        rec.document_title,
        originatorId,
        rec.received_date,
        rec.status,
        rec.comments,
        rec.despatch_date || null,
        recipientId,
        pendingDays,
      )
    })
  })

  return transaction(records)
}

export function deleteMailRecords(ids: number[]) {
  const db = getDb()
  const deleteStmt = db.prepare("DELETE FROM mail_records WHERE id = ?")
  
  const transaction = db.transaction((recordIds: number[]) => {
    return recordIds.map((id: number) => deleteStmt.run(id))
  })
  
  return transaction(ids)
}

export function deleteAllMailRecords() {
  const db = getDb()
  return db.prepare("DELETE FROM mail_records").run()
}

type StatusEntryRecord = { id: number; name: string; color: string }

// Status entries functions
export function getAllStatusEntries() {
  const db = getDb()
  return db.prepare("SELECT id, name, color FROM status_entries ORDER BY name").all() as StatusEntryRecord[]
}

export function addStatusEntry(name: string, color: string) {
  const db = getDb()
  const finalColor = color || DEFAULT_STATUS_COLOR
  try {
    const insert = db.prepare("INSERT INTO status_entries (name, color) VALUES (?, ?)")
    const result = insert.run(name, finalColor)
    return { id: Number(result.lastInsertRowid), name, color: finalColor }
  } catch (error: any) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error(`Status "${name}" already exists`)
    }
    throw error
  }
}

export function updateStatusEntry(id: number, name: string, color: string) {
  const db = getDb()
  const finalColor = color || DEFAULT_STATUS_COLOR
  try {
    const update = db.prepare("UPDATE status_entries SET name = ?, color = ? WHERE id = ?")
    const result = update.run(name, finalColor, id)
    if (result.changes === 0) {
      throw new Error(`Status with id ${id} not found`)
    }
    return { id, name, color: finalColor }
  } catch (error: any) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new Error(`Status "${name}" already exists. Please choose a different name.`)
    }
    throw error
  }
}

export function deleteStatusEntry(id: number) {
  const db = getDb()
  
  const status = db.prepare("SELECT name FROM status_entries WHERE id = ?").get(id) as { name: string } | undefined
  if (!status) {
    throw new Error(`Status with id ${id} not found`)
  }
  
  // Check if status is used in any mail records
  const checkUsage = db.prepare(`
    SELECT COUNT(*) as count 
    FROM mail_records 
    WHERE status = ?
  `).get(status.name) as { count: number }
  
  if (checkUsage.count > 0) {
    throw new Error(`Cannot delete status "${status.name}": It is currently being used in ${checkUsage.count} mail record(s). Please update those records first.`)
  }
  
  const deleteStmt = db.prepare("DELETE FROM status_entries WHERE id = ?")
  const result = deleteStmt.run(id)
  
  if (result.changes === 0) {
    throw new Error(`Status "${status.name}" could not be deleted`)
  }
  
  return true
}

// Mail record update function
export function updateMailRecord(
  id: number,
  updates: {
    document_title?: string
    originator_id?: number
    received_date?: string
    status?: string
    comments?: string
    despatch_date?: string | null
    recipient_id?: number | null
  }
) {
  const db = getDb()
  
  // Get current record to calculate pending days
  const currentRecord = getMailRecordById(id)
  if (!currentRecord) {
    throw new Error(`Mail record with id ${id} not found`)
  }
  
  // Use updated values or current values for calculation
  const receivedDate = updates.received_date ?? currentRecord.received_date
  const despatchDate = updates.despatch_date !== undefined ? updates.despatch_date : currentRecord.despatch_date
  
  // Calculate pending days automatically
  const pendingDays = calculatePendingDays(receivedDate, despatchDate)
  
  const fields: string[] = []
  const values: any[] = []
  
  if (updates.document_title !== undefined) {
    fields.push("document_title = ?")
    values.push(updates.document_title)
  }
  if (updates.originator_id !== undefined) {
    fields.push("originator_id = ?")
    values.push(updates.originator_id)
  }
  if (updates.received_date !== undefined) {
    fields.push("received_date = ?")
    values.push(updates.received_date)
  }
  if (updates.status !== undefined) {
    fields.push("status = ?")
    values.push(updates.status)
  }
  if (updates.comments !== undefined) {
    fields.push("comments = ?")
    values.push(updates.comments)
  }
  if (updates.despatch_date !== undefined) {
    fields.push("despatch_date = ?")
    values.push(updates.despatch_date)
  }
  if (updates.recipient_id !== undefined) {
    fields.push("recipient_id = ?")
    values.push(updates.recipient_id)
  }
  
  // Always update pending_days
  fields.push("pending_days = ?")
  values.push(pendingDays)
  
  if (fields.length === 0) {
    throw new Error("No fields to update")
  }
  
  values.push(id)
  const query = `UPDATE mail_records SET ${fields.join(", ")} WHERE id = ?`
  const result = db.prepare(query).run(...values)
  
  if (result.changes === 0) {
    throw new Error(`Mail record with id ${id} not found`)
  }
  
  return true
}

export function getMailRecordById(id: number) {
  const db = getDb()
  const record = db.prepare(`
    SELECT 
      mr.id, mr.document_title, d1.name as originator, d1.id as originator_id,
      mr.received_date, mr.status, mr.comments, 
      mr.despatch_date, d2.name as recipient_name, d2.id as recipient_id
    FROM mail_records mr
    JOIN directorates d1 ON mr.originator_id = d1.id
    LEFT JOIN directorates d2 ON mr.recipient_id = d2.id
    WHERE mr.id = ?
  `).get(id) as any
  
  if (!record) {
    return null
  }
  
  // Calculate pending days
  return {
    ...record,
    pending_days: calculatePendingDays(record.received_date, record.despatch_date)
  }
}
