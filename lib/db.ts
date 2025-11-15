import Database from "better-sqlite3"
import path from "path"

const dbPath = path.join(process.cwd(), "mail_tracking.db")

export function getDb() {
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")

  // Initialize schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS directorates (
      id INTEGER PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mail_records (
      id INTEGER PRIMARY KEY,
      document_title TEXT NOT NULL,
      originator_id INTEGER NOT NULL,
      received_date DATE NOT NULL,
      status TEXT NOT NULL,
      comments TEXT,
      despatch_date DATE,
      recipient_id INTEGER NOT NULL,
      pending_days INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(originator_id) REFERENCES directorates(id),
      FOREIGN KEY(recipient_id) REFERENCES directorates(id)
    );
  `)


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

export function searchMailRecords(searchTerm = "", originator = "", recipient = "") {
  const db = getDb()
  let query = `
    SELECT 
      mr.id, mr.document_title, d1.name as originator, 
      mr.received_date, mr.status, mr.comments, 
      mr.despatch_date, d2.name as recipient_name, mr.pending_days
    FROM mail_records mr
    JOIN directorates d1 ON mr.originator_id = d1.id
    JOIN directorates d2 ON mr.recipient_id = d2.id
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

  query += " ORDER BY mr.received_date DESC"

  return db.prepare(query).all(...params) as Array<any>
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
    pending_days: number
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
      let recipientId: number

      if (rec.originator && rec.recipient_name) {
        // Use names - must exist in master list
        originatorId = getDirectorateId(rec.originator)
        recipientId = getDirectorateId(rec.recipient_name)
      } else if (rec.originator_id && rec.recipient_id) {
        // Use provided IDs
        originatorId = rec.originator_id
        recipientId = rec.recipient_id
      } else {
        throw new Error("Records must have either (originator, recipient_name) or (originator_id, recipient_id)")
      }

      return insertWithIds.run(
        rec.document_title,
        originatorId,
        rec.received_date,
        rec.status,
        rec.comments,
        rec.despatch_date || null,
        recipientId,
        rec.pending_days,
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
