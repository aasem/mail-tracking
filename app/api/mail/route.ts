import { type NextRequest, NextResponse } from "next/server"
import { searchMailRecords, getAllDirectorates, addMailRecords, deleteMailRecords, deleteAllMailRecords, addDirectorate, getDirectorateByName, updateDirectorate, deleteDirectorate } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const originator = searchParams.get("originator") || ""
    const recipient = searchParams.get("recipient") || ""

    const records = searchMailRecords(search, originator, recipient)
    const allAddressees = getAllDirectorates()

    return NextResponse.json({
      records,
      allAddressees, // Master list of all addressees
    })
  } catch (error) {
    console.error("Error fetching mail records:", error)
    return NextResponse.json({ error: "Failed to fetch mail records" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
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

    return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
  } catch (error) {
    console.error("Error updating directorate:", error)
    return NextResponse.json({ error: "Failed to update directorate" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const directorateId = searchParams.get("directorateId")
    
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
