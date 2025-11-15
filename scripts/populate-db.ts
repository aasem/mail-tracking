import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

const dbPath = path.join(process.cwd(), "mail_tracking.db")
const jsonPath = path.join(process.cwd(), "scripts", "populate-data.json")

interface MailRecord {
  id: number
  document_title: string
  originator: string
  received_date: string
  status: string
  comments: string
  despatch_date: string | null
  recipient_name: string
  pending_days: number
}

function populateDatabase() {
  console.log("Starting database population...")

  // Check if JSON file exists
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON file not found at ${jsonPath}`)
    process.exit(1)
  }

  // Read JSON file
  const jsonData = fs.readFileSync(jsonPath, "utf-8")
  const records: MailRecord[] = JSON.parse(jsonData)

  console.log(`Found ${records.length} records to import`)

  // Connect to database
  const db = new Database(dbPath)
  db.pragma("journal_mode = WAL")

  try {
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

    // Ensure directorates exist
    const checkDirectorate = db.prepare("SELECT * FROM directorates WHERE name = ?")
    const insertDirectorate = db.prepare("INSERT INTO directorates (name) VALUES (?)")
    const directorates = ["D1", "D2", "D3"]
    
    directorates.forEach((name) => {
      if (!checkDirectorate.get(name)) {
        insertDirectorate.run(name)
        console.log(`Created directorate: ${name}`)
      }
    })

    // Clear existing records (optional - comment out if you want to keep existing data)
    const existingCount = db.prepare("SELECT COUNT(*) as count FROM mail_records").get() as { count: number }
    if (existingCount.count > 0) {
      console.log(`Found ${existingCount.count} existing records. Clearing them...`)
      db.prepare("DELETE FROM mail_records").run()
    }

    // Prepare insert statement
    const insert = db.prepare(`
      INSERT INTO mail_records 
      (document_title, originator_id, received_date, status, comments, despatch_date, recipient_id, pending_days)
      SELECT ?, d1.id, ?, ?, ?, ?, d2.id, ?
      FROM directorates d1, directorates d2
      WHERE d1.name = ? AND d2.name = ?
    `)

    // Insert records
    const transaction = db.transaction((recs: MailRecord[]) => {
      let inserted = 0
      recs.forEach((record) => {
        try {
          insert.run(
            record.document_title,
            record.received_date,
            record.status,
            record.comments || "",
            record.despatch_date || null,
            record.pending_days,
            record.originator,
            record.recipient_name,
          )
          inserted++
          console.log(`✓ Inserted: ${record.document_title} (${record.originator} → ${record.recipient_name})`)
        } catch (error) {
          console.error(`✗ Failed to insert: ${record.document_title}`, error)
        }
      })
      return inserted
    })

    const insertedCount = transaction(records)

    console.log(`\n✅ Successfully populated database!`)
    console.log(`   Inserted ${insertedCount} out of ${records.length} records`)

    // Verify insertion
    const finalCount = db.prepare("SELECT COUNT(*) as count FROM mail_records").get() as { count: number }
    console.log(`   Total records in database: ${finalCount.count}`)
  } catch (error) {
    console.error("Error populating database:", error)
    process.exit(1)
  } finally {
    db.close()
  }
}

// Run the script
populateDatabase()

