import { type NextRequest, NextResponse } from "next/server"
import { searchMailRecords, getAllDirectorates, addMailRecords, deleteMailRecords, deleteAllMailRecords, addDirectorate, getDirectorateByName, updateDirectorate, deleteDirectorate, getAllStatusEntries, addStatusEntry, updateStatusEntry, deleteStatusEntry, updateMailRecord, getMailRecordById, getEarliestMailRecordDate, getMailSummary, DEFAULT_STATUS_COLOR } from "@/lib/db"

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/

function resolveStatusColor(color: unknown) {
  if (typeof color !== "string" || color.trim() === "") {
    return DEFAULT_STATUS_COLOR
  }
  const trimmed = color.trim()
  if (!HEX_COLOR_REGEX.test(trimmed)) {
    return null
  }
  return trimmed.toLowerCase()
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const originator = searchParams.get("originator") || ""
    const recipient = searchParams.get("recipient") || ""
    const status = searchParams.get("status") || ""
    const receivedFrom = searchParams.get("receivedFrom") || ""
    const receivedTo = searchParams.get("receivedTo") || ""
    const despatchFrom = searchParams.get("despatchFrom") || ""
    const despatchTo = searchParams.get("despatchTo") || ""
    const recordId = searchParams.get("recordId")
    const statusEntries = searchParams.get("statusEntries") === "true"
    const summary = searchParams.get("summary") === "true"
    const fromDate = searchParams.get("fromDate")
    const earliestDate = searchParams.get("earliestDate") === "true"

    // Return earliest mail record date if requested
    if (earliestDate) {
      const earliest = getEarliestMailRecordDate()
      return NextResponse.json({ earliestDate: earliest })
    }

    // Return mail summary if requested
    if (summary) {
      if (!fromDate) {
        return NextResponse.json({ error: "fromDate parameter is required for summary" }, { status: 400 })
      }
      const summaryData = getMailSummary(fromDate)
      return NextResponse.json({ summary: summaryData })
    }

    // Return status entries if requested
    if (statusEntries) {
      const entries = getAllStatusEntries()
      return NextResponse.json({ statusEntries: entries })
    }

    // Return single record if recordId is provided
    if (recordId) {
      const id = Number.parseInt(recordId)
      if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid record ID" }, { status: 400 })
      }
      const record = getMailRecordById(id)
      if (!record) {
        return NextResponse.json({ error: "Record not found" }, { status: 404 })
      }
      return NextResponse.json({ record })
    }

    const records = searchMailRecords(
      search,
      originator,
      recipient,
      status,
      receivedFrom,
      receivedTo,
      despatchFrom,
      despatchTo
    )
    const allAddressees = getAllDirectorates()
    const allStatusEntries = getAllStatusEntries()

    return NextResponse.json({
      records,
      allAddressees, // Master list of all addressees
      statusEntries: allStatusEntries, // Status entries
    })
  } catch (error) {
    console.error("Error fetching mail records:", error)
    return NextResponse.json({ error: "Failed to fetch mail records" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is a request to create a status entry
    if (body.statusEntry) {
      const { name, color } = body.statusEntry
      if (!name || typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "Status name is required" }, { status: 400 })
      }

      const resolvedColor = resolveStatusColor(color)
      if (!resolvedColor) {
        return NextResponse.json({ error: "Status color must be a valid hex value (e.g. #2563eb)" }, { status: 400 })
      }

      try {
        const statusEntry = addStatusEntry(name.trim(), resolvedColor)
        return NextResponse.json({
          success: true,
          statusEntry,
          message: `Status "${name}" created successfully`,
        })
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          return NextResponse.json({ error: error.message }, { status: 409 })
        }
        throw error
      }
    }

    // Check if this is a request to create a directorate
    if (body.directorate) {
      const { name } = body.directorate
      if (!name || typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "Addressee name is required" }, { status: 400 })
      }

      try {
        const directorate = addDirectorate(name.trim())
        return NextResponse.json({
          success: true,
          directorate,
          message: `Directorate "${name}" created successfully`,
        })
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          return NextResponse.json({ error: error.message }, { status: 409 })
        }
        throw error
      }
    }

    // Otherwise, handle mail records
    const { records } = body
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Invalid records format" }, { status: 400 })
    }

    try {
      addMailRecords(records)
      return NextResponse.json({
        success: true,
        message: `${records.length} record(s) added successfully`,
      })
    } catch (error: any) {
      // Return specific error messages for better user feedback
      if (error.message.includes("does not exist in the master list")) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    }
  } catch (error: any) {
    console.error("Error adding mail records:", error)
    const errorMessage = error.message || "Failed to add mail records"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Check if this is a request to update a status entry
    if (body.statusEntry) {
      const { id, name, color } = body.statusEntry
      if (!id || typeof id !== "number") {
        return NextResponse.json({ error: "Status ID is required" }, { status: 400 })
      }
      if (!name || typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "Status name is required" }, { status: 400 })
      }

      const resolvedColor = resolveStatusColor(color)
      if (!resolvedColor) {
        return NextResponse.json({ error: "Status color must be a valid hex value (e.g. #2563eb)" }, { status: 400 })
      }

      try {
        const statusEntry = updateStatusEntry(id, name.trim(), resolvedColor)
        return NextResponse.json({
          success: true,
          statusEntry,
          message: `Status updated successfully`,
        })
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error.message.includes("not found")) {
          return NextResponse.json({ error: error.message }, { status: 404 })
        }
        throw error
      }
    }

    // Check if this is a request to update a directorate
    if (body.directorate) {
      const { id, name } = body.directorate
      if (!id || typeof id !== "number") {
        return NextResponse.json({ error: "Addressee ID is required" }, { status: 400 })
      }
      if (!name || typeof name !== "string" || name.trim() === "") {
        return NextResponse.json({ error: "Addressee name is required" }, { status: 400 })
      }

      try {
        const directorate = updateDirectorate(id, name.trim())
        return NextResponse.json({
          success: true,
          directorate,
          message: `Directorate updated successfully`,
        })
      } catch (error: any) {
        if (error.message.includes("already exists")) {
          return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error.message.includes("not found")) {
          return NextResponse.json({ error: error.message }, { status: 404 })
        }
        throw error
      }
    }

    // Check if this is a request to update a mail record
    if (body.mailRecord) {
      const { id, ...updates } = body.mailRecord
      if (!id || typeof id !== "number") {
        return NextResponse.json({ error: "Mail record ID is required" }, { status: 400 })
      }

      // Convert names to IDs if provided
      const finalUpdates: any = { ...updates }
      if (updates.originator) {
        const directorate = getDirectorateByName(updates.originator)
        if (!directorate) {
          return NextResponse.json({ error: `Addressee "${updates.originator}" not found` }, { status: 404 })
        }
        finalUpdates.originator_id = directorate.id
        delete finalUpdates.originator
      }
      // Check if recipient_name is explicitly provided (including undefined/null to clear)
      if ('recipient_name' in updates) {
        if (updates.recipient_name) {
          const directorate = getDirectorateByName(updates.recipient_name)
          if (!directorate) {
            return NextResponse.json({ error: `Addressee "${updates.recipient_name}" not found` }, { status: 404 })
          }
          finalUpdates.recipient_id = directorate.id
        } else {
          // recipient_name is undefined/null/empty - clear it
          finalUpdates.recipient_id = null
        }
        delete finalUpdates.recipient_name
      }

      try {
        updateMailRecord(id, finalUpdates)
        const updatedRecord = getMailRecordById(id)
        return NextResponse.json({
          success: true,
          record: updatedRecord,
          message: `Mail record updated successfully`,
        })
      } catch (error: any) {
        if (error.message.includes("not found")) {
          return NextResponse.json({ error: error.message }, { status: 404 })
        }
        throw error
      }
    }

    return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
  } catch (error: any) {
    console.error("Error updating:", error)
    return NextResponse.json({ error: error.message || "Failed to update" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const directorateId = searchParams.get("directorateId")
    const statusId = searchParams.get("statusId")
    
    // Check if this is a request to delete a status entry
    if (statusId) {
      const id = Number.parseInt(statusId)
      if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid status ID" }, { status: 400 })
      }

      try {
        deleteStatusEntry(id)
        return NextResponse.json({
          success: true,
          message: "Status deleted successfully",
        })
      } catch (error: any) {
        if (error.message.includes("Cannot delete")) {
          return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error.message.includes("not found")) {
          return NextResponse.json({ error: error.message }, { status: 404 })
        }
        throw error
      }
    }
    
    // Check if this is a request to delete a directorate
    if (directorateId) {
      const id = Number.parseInt(directorateId)
      if (isNaN(id)) {
        return NextResponse.json({ error: "Invalid addressee ID" }, { status: 400 })
      }

      try {
        deleteDirectorate(id)
        return NextResponse.json({
          success: true,
          message: "Addressee deleted successfully",
        })
      } catch (error: any) {
        if (error.message.includes("Cannot delete")) {
          return NextResponse.json({ error: error.message }, { status: 409 })
        }
        if (error.message.includes("not found")) {
          return NextResponse.json({ error: error.message }, { status: 404 })
        }
        throw error
      }
    }

    // Otherwise, handle mail records deletion
    const ids = searchParams.get("ids")
    const deleteAll = searchParams.get("deleteAll") === "true"

    if (deleteAll) {
      deleteAllMailRecords()
      return NextResponse.json({
        success: true,
        message: "All records deleted successfully",
      })
    }

    if (!ids) {
      return NextResponse.json({ error: "IDs parameter is required" }, { status: 400 })
    }

    const idArray = ids.split(",").map((id) => Number.parseInt(id.trim()))
    
    if (idArray.some((id) => isNaN(id))) {
      return NextResponse.json({ error: "Invalid IDs format" }, { status: 400 })
    }

    deleteMailRecords(idArray)

    return NextResponse.json({
      success: true,
      message: `${idArray.length} record(s) deleted successfully`,
    })
  } catch (error) {
    console.error("Error deleting:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
