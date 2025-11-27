"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { AddDocumentModal, MailRecordInput } from "./add-document-modal"
import { EditDocumentModal } from "./edit-document-modal"
import { ManageAddresseesModal } from "./manage-addressees-modal"
import { ManageStatusModal } from "./manage-status-modal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

interface MailRecord {
  id: number
  document_title: string
  originator: string
  received_date: string
  status: string
  comments: string
  despatch_date: string | null
  recipient_name: string | null
  pending_days: number
}

type StatusEntry = {
  id: number
  name: string
  color: string
}

const DEFAULT_STATUS_COLOR = "#2563eb"
const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{6})$/

const hexToRgba = (hex: string, alpha = 0.15) => {
  if (!HEX_COLOR_REGEX.test(hex)) {
    return `rgba(37, 99, 235, ${alpha})`
  }
  const normalized = hex.replace("#", "")
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const escapeHtml = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return ""
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
export function MailTracker() {
  const [records, setRecords] = useState<MailRecord[]>([])
  const [allAddressees, setAllAddressees] = useState<Array<{ id: number; name: string }>>([]) // Master list
  const [filterAddressees, setFilterAddressees] = useState<Array<{ id: number; name: string }>>([]) // Only those with mail
  const [statusEntries, setStatusEntries] = useState<StatusEntry[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [originatorFilter, setOriginatorFilter] = useState("All")
  const [recipientFilter, setRecipientFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")
  const [receivedDateFrom, setReceivedDateFrom] = useState<Date | null>(null)
  const [receivedDateTo, setReceivedDateTo] = useState<Date | null>(null)
  const [despatchDateFrom, setDespatchDateFrom] = useState<Date | null>(null)
  const [despatchDateTo, setDespatchDateTo] = useState<Date | null>(null)
  const [openDateFilter, setOpenDateFilter] = useState<string | null>(null)
  const [openModal, setOpenModal] = useState(false)
  const [openDirectorateModal, setOpenDirectorateModal] = useState(false)
  const [openStatusModal, setOpenStatusModal] = useState(false)
  const [openEditModal, setOpenEditModal] = useState(false)
  const [editingDirectorate, setEditingDirectorate] = useState<{ id: number; name: string } | null>(null)
  const [editingStatus, setEditingStatus] = useState<StatusEntry | null>(null)
  const [editingRecord, setEditingRecord] = useState<MailRecord | null>(null)
  const [newDirectorateName, setNewDirectorateName] = useState("")
  const [newStatusName, setNewStatusName] = useState("")
  const [newStatusColor, setNewStatusColor] = useState(DEFAULT_STATUS_COLOR)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [openSummaryModal, setOpenSummaryModal] = useState(false)
  const [summaryDate, setSummaryDate] = useState<Date | null>(null)
  const [earliestDate, setEarliestDate] = useState<Date | null>(null)
  const [summaryData, setSummaryData] = useState<{
    total: number
    despatched: number
    pending: number
    pendingOver10Days: number
  } | null>(null)
  const [summaryDatePickerOpen, setSummaryDatePickerOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.set("search", searchTerm)
      if (originatorFilter !== "All") params.set("originator", originatorFilter)
      if (recipientFilter !== "All") params.set("recipient", recipientFilter)
      if (statusFilter !== "All") params.set("status", statusFilter)
      if (receivedDateFrom) params.set("receivedFrom", format(receivedDateFrom, "yyyy-MM-dd"))
      if (receivedDateTo) params.set("receivedTo", format(receivedDateTo, "yyyy-MM-dd"))
      if (despatchDateFrom) params.set("despatchFrom", format(despatchDateFrom, "yyyy-MM-dd"))
      if (despatchDateTo) params.set("despatchTo", format(despatchDateTo, "yyyy-MM-dd"))

      const response = await fetch(`/api/mail?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch data")
      
      const data = await response.json()
      setRecords(data.records || [])
      setAllAddressees(data.allAddressees || []) // Master list
      const normalizedStatuses: StatusEntry[] =
        data.statusEntries?.map((status: StatusEntry) => ({
          ...status,
          color: HEX_COLOR_REGEX.test(status.color || "") ? status.color : DEFAULT_STATUS_COLOR,
        })) || []
      setStatusEntries(normalizedStatuses.sort((a, b) => a.name.localeCompare(b.name))) // Status entries
      
      // Extract unique addressees from records for filters
      const originators = new Set<string>()
      const recipients = new Set<string>()
      data.records?.forEach((record: MailRecord) => {
        originators.add(record.originator)
        if (record.recipient_name) {
          recipients.add(record.recipient_name)
        }
      })
      
      // Get addressee objects for those that appear in records
      const usedAddressees = data.allAddressees?.filter((addr: { id: number; name: string }) => 
        originators.has(addr.name) || recipients.has(addr.name)
      ) || []
      
      setFilterAddressees(usedAddressees)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load mail records")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [searchTerm, originatorFilter, recipientFilter, statusFilter, receivedDateFrom, receivedDateTo, despatchDateFrom, despatchDateTo])

  // Fetch earliest mail record date
  useEffect(() => {
    const fetchEarliestDate = async () => {
      try {
        const response = await fetch("/api/mail?earliestDate=true")
        if (response.ok) {
          const data = await response.json()
          if (data.earliestDate) {
            const date = new Date(data.earliestDate)
            setEarliestDate(date)
            setSummaryDate(date) // Set as default
          }
        }
      } catch (error) {
        console.error("Error fetching earliest date:", error)
      }
    }
    fetchEarliestDate()
  }, [])

  const handleOpenSummaryModal = async () => {
    if (!summaryDate) return
    try {
      const fromDateStr = format(summaryDate, "yyyy-MM-dd")
      const response = await fetch(`/api/mail?summary=true&fromDate=${fromDateStr}`)
      if (!response.ok) throw new Error("Failed to fetch summary")
      const data = await response.json()
      setSummaryData(data.summary)
      setOpenSummaryModal(true)
    } catch (error: any) {
      console.error("Error fetching summary:", error)
      toast.error(error.message || "Failed to fetch summary")
    }
  }

  useEffect(() => {
    fetchData()
  }, [searchTerm, originatorFilter, recipientFilter, statusFilter, receivedDateFrom, receivedDateTo, despatchDateFrom, despatchDateTo])

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.document_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.originator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (record.recipient_name && record.recipient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      record.comments.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesOriginator = originatorFilter === "All" || record.originator === originatorFilter
    const matchesRecipient = recipientFilter === "All" || record.recipient_name === recipientFilter
    const matchesStatus = statusFilter === "All" || record.status === statusFilter

    return matchesSearch && matchesOriginator && matchesRecipient && matchesStatus
  })

  const statusColorMap = useMemo(() => {
    const map = new Map<string, string>()
    statusEntries.forEach((status) => {
      map.set(status.name, status.color)
    })
    return map
  }, [statusEntries])


  const handleDocumentAdded = async (newRecords: MailRecordInput[]) => {
    try {
      const response = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: newRecords }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || "Failed to add documents"
        toast.error(errorMessage, {
          duration: 5000, // Longer duration for important error messages
        })
        return
      }
      
      toast.success(`${newRecords.length} document(s) added successfully`)
      setOpenModal(false)
      await fetchData() // Refresh data
    } catch (error: any) {
      console.error("Error adding documents:", error)
      toast.error(error.message || "Failed to add documents", {
        duration: 5000,
      })
    }
  }

  const handleSelectRecord = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} record(s)? This action cannot be undone.`)) return

    try {
      const idsArray = Array.from(selectedIds)
      const response = await fetch(`/api/mail?ids=${idsArray.join(",")}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete records")
      
      toast.success(`${selectedIds.size} record(s) deleted successfully`)
      setSelectedIds(new Set())
      await fetchData() // Refresh data
    } catch (error) {
      console.error("Error deleting records:", error)
      toast.error("Failed to delete records")
    }
  }

  const handleQuickStatusUpdate = async (recordId: number, newStatus: string) => {
    try {
      const response = await fetch("/api/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailRecord: { id: recordId, status: newStatus } }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || "Failed to update status")
        return
      }

      toast.success("Status updated successfully")
      await fetchData() // Refresh data
    } catch (error: any) {
      console.error("Error updating status:", error)
      toast.error(error.message || "Failed to update status")
    }
  }

  const handleDeleteRecord = async (id: number) => {
    if (!confirm("Delete this record? This action cannot be undone.")) return

    try {
      const response = await fetch(`/api/mail?ids=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete record")
      
      toast.success("Record deleted successfully")
      await fetchData() // Refresh data
    } catch (error) {
      console.error("Error deleting record:", error)
      toast.error("Failed to delete record")
    }
  }

  const handleEditRecord = async (record: MailRecord) => {
    try {
      const response = await fetch(`/api/mail?recordId=${record.id}`)
      if (!response.ok) throw new Error("Failed to fetch record")
      const data = await response.json()
      setEditingRecord(data.record)
      setOpenEditModal(true)
    } catch (error) {
      console.error("Error fetching record:", error)
      toast.error("Failed to load record for editing")
    }
  }

  const handleAddDirectorate = async () => {
    const name = newDirectorateName.trim()
    if (!name) {
      toast.error("Please enter an addressee name")
      return
    }

    try {
      const response = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directorate: { name } }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || "Failed to create addressee"
        toast.error(errorMessage)
        return
      }

      const data = await response.json()
      const newAddressee = data.directorate
      
      // Immediately add to local state for instant UI update
      setAllAddressees(prev => [...prev, newAddressee].sort((a, b) => a.name.localeCompare(b.name)))
      
      toast.success(`Addressee "${name}" added successfully`)
      setNewDirectorateName("")
      
      // Also refresh from server to ensure consistency
      await fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to add addressee")
    }
  }

  const handleEditDirectorate = async () => {
    if (!editingDirectorate) return
    
    const name = newDirectorateName.trim()
    if (!name) {
      toast.error("Please enter an addressee name")
      return
    }

    try {
      const response = await fetch("/api/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directorate: { id: editingDirectorate.id, name } }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || "Failed to update addressee"
        toast.error(errorMessage)
        return
      }

      const data = await response.json()
      const updatedAddressee = data.directorate
      
      // Immediately update local state for instant UI update
      setAllAddressees(prev => 
        prev.map(addr => addr.id === updatedAddressee.id ? updatedAddressee : addr)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      setFilterAddressees(prev => 
        prev.map(addr => addr.id === updatedAddressee.id ? updatedAddressee : addr)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      
      toast.success(`Addressee updated successfully`)
      setEditingDirectorate(null)
      setNewDirectorateName("")
      
      // Also refresh from server to ensure consistency
      await fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to update addressee")
    }
  }

  const handleDeleteDirectorate = async (id: number, name: string) => {
    if (!confirm(`Delete addressee "${name}"? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/mail?directorateId=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || "Failed to delete addressee"
        
        // Show error with longer duration for important messages
        toast.error(errorMessage, {
          duration: 5000, // 5 seconds for important error messages
        })
        return
      }

      toast.success(`Addressee "${name}" deleted successfully`)
      
      // Immediately remove from local state for instant UI update
      setAllAddressees(prev => prev.filter(addr => addr.id !== id))
      setFilterAddressees(prev => prev.filter(addr => addr.id !== id))
      
      // Also refresh from server to ensure consistency
      await fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete addressee", {
        duration: 5000,
      })
    }
  }

  const openEditDirectorateModal = (directorate: { id: number; name: string }) => {
    setEditingDirectorate(directorate)
    setNewDirectorateName(directorate.name)
    setOpenDirectorateModal(true)
  }

  const openAddModal = () => {
    setEditingDirectorate(null)
    setNewDirectorateName("")
    setOpenDirectorateModal(true)
  }

  const handleAddStatus = async () => {
    const name = newStatusName.trim()
    if (!name) {
      toast.error("Please enter a status name")
      return
    }

    const color = newStatusColor.trim().toLowerCase()
    if (!HEX_COLOR_REGEX.test(color)) {
      toast.error("Please select a valid color (e.g. #2563eb)")
      return
    }

    try {
      const response = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntry: { name, color } }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || "Failed to create status")
        return
      }

      const data = await response.json()
      const newStatus = data.statusEntry
      
      setStatusEntries(prev => [...prev, newStatus].sort((a, b) => a.name.localeCompare(b.name)))
      toast.success(`Status "${name}" added successfully`)
      setNewStatusName("")
      setNewStatusColor(DEFAULT_STATUS_COLOR)
      await fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to add status")
    }
  }

  const handleEditStatus = async () => {
    if (!editingStatus) return
    
    const name = newStatusName.trim()
    if (!name) {
      toast.error("Please enter a status name")
      return
    }

    const color = newStatusColor.trim().toLowerCase()
    if (!HEX_COLOR_REGEX.test(color)) {
      toast.error("Please select a valid color (e.g. #2563eb)")
      return
    }

    try {
      const response = await fetch("/api/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntry: { id: editingStatus.id, name, color } }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || "Failed to update status")
        return
      }

      const data = await response.json()
      const updatedStatus = data.statusEntry
      
      setStatusEntries(prev => 
        prev.map(status => status.id === updatedStatus.id ? updatedStatus : status)
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      
      toast.success(`Status updated successfully`)
      setEditingStatus(null)
      setNewStatusName("")
      setNewStatusColor(DEFAULT_STATUS_COLOR)
      await fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to update status")
    }
  }

  const handleDeleteStatus = async (id: number, name: string) => {
    if (!confirm(`Delete status "${name}"? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/mail?statusId=${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        toast.error(errorData.error || "Failed to delete status", {
          duration: 5000,
        })
        return
      }

      toast.success(`Status "${name}" deleted successfully`)
      setStatusEntries(prev => prev.filter(status => status.id !== id))
      await fetchData()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete status", {
        duration: 5000,
      })
    }
  }

  const handlePrintSnapshot = () => {
    if (filteredRecords.length === 0) {
      toast.info("No records available to print with the current filters")
      return
    }

    const printWindow = window.open("", "_blank", "width=1200,height=900")
    if (!printWindow) {
      toast.error("Unable to open print preview window. Please allow pop-ups.")
      return
    }

    const snapshotTime = new Date().toLocaleString()

    const rowsHtml = filteredRecords
      .map((record, idx) => {
        const statusColor = statusColorMap.get(record.status) || DEFAULT_STATUS_COLOR
        const rowBg = hexToRgba(statusColor, 0.16)
        const textColorStyle = `color: ${statusColor};`
        const receivedDate = record.received_date
          ? new Date(record.received_date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
          : "-"
        const despatchDate = record.despatch_date
          ? new Date(record.despatch_date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "2-digit",
            })
          : "-"
        const pendingDaysColor = record.pending_days > 10 ? "#ef4444" : statusColor

        return `
          <tr style="background:${rowBg};">
            <td style="font-weight:600; text-align:center; color: #0f172a;">${idx + 1}</td>
            <td style="font-weight:600; ${textColorStyle}">${escapeHtml(record.document_title)}</td>
            <td style="font-weight:600; text-align:center; ${textColorStyle}">${escapeHtml(record.originator)}</td>
            <td style="font-weight:600; text-align:center; ${textColorStyle}">${escapeHtml(receivedDate)}</td>
            <td style="font-weight:600; text-align:center; ${textColorStyle}">
              <span style="
                display:inline-flex;
                align-items:center;
                gap:6px;">
                <span style="
                  display:inline-block;
                  width:10px;
                  height:10px;
                  border-radius:999px;
                  background:${statusColor};
                  border:1px solid rgba(15,23,42,0.1);"></span>
                ${escapeHtml(record.status)}
              </span>
            </td>
            <td style="font-weight:600; text-align:center; ${textColorStyle}">${escapeHtml(record.comments || "-")}</td>
            <td style="font-weight:600; text-align:center; ${textColorStyle}">${escapeHtml(despatchDate)}</td>
            <td style="font-weight:600; text-align:center; ${textColorStyle}">${escapeHtml(record.recipient_name || "-")}</td>
            <td style="text-align:right; font-weight:600; color:${pendingDaysColor};">
              ${escapeHtml(record.pending_days)}
            </td>
          </tr>
        `
      })
      .join("")

    const filtersHtml = `
      <div class="filters">
        <span><strong>Search:</strong> ${searchTerm || "—"}</span>
        <span><strong>From:</strong> ${originatorFilter}</span>
        <span><strong>Recipient:</strong> ${recipientFilter}</span>
        <span><strong>Status:</strong> ${statusFilter}</span>
      </div>
    `

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mail Tracking Snapshot</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
              color: #0f172a;
              background: #f8fafc;
              margin: 0;
              padding: 32px 48px 48px;
            }
            h1 {
              margin-bottom: 4px;
              font-size: 28px;
              text-align: center;
            }
            p.timestamp {
              margin-top: 0;
              color: #475569;
              text-align: center;
            }
            .filters {
              display: flex;
              flex-wrap: wrap;
              gap: 16px;
              padding: 12px 16px;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              margin-bottom: 24px;
              font-size: 14px;
              justify-content: center;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              border: 1px solid #e2e8f0;
            }
            thead {
              background: #f1f5f9;
            }
            th, td {
              padding: 12px 16px;
              border-bottom: 1px solid #e2e8f0;
              vertical-align: top;
              font-size: 14px;
            }
            th {
              text-transform: uppercase;
              font-size: 12px;
              letter-spacing: 0.05em;
              color: #475569;
              text-align: left;
            }
            tr:last-child td {
              border-bottom: none;
            }
            @media print {
              body {
                margin: 0;
                padding: 24px;
                background: #ffffff;
              }
              table {
                box-shadow: none;
              }
            }
          </style>
        </head>
        <body>
          <h1>Mail Record</h1>
          <p class="timestamp">Generated ${snapshotTime} • ${filteredRecords.length} record(s)</p>
          ${filtersHtml}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Document</th>
                <th>From</th>
                <th>Received</th>
                <th>Status</th>
                <th>Comments</th>
                <th>Despatch</th>
                <th>To</th>
                <th style="text-align:right;">Pending Days</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const openEditStatusModal = (status: StatusEntry) => {
    setEditingStatus(status)
    setNewStatusName(status.name)
    setNewStatusColor(status.color || DEFAULT_STATUS_COLOR)
    setOpenStatusModal(true)
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 bg-white">
      <div className="max-w-7xl 2xl:max-w-[1440px] mx-auto">
        <div className="mb-6 sm:mb-8 border-b border-gray-200 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Mail Tracking Dashboard</h1>
              <p className="text-sm sm:text-base text-gray-600">Manage and track all organizational mail across directorates</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setOpenModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Documents
              </Button>
              <Button
                onClick={openAddModal}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 font-semibold bg-white"
                title="Manage Addressee List"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                  />
                </svg>
                Manage Addressees
              </Button>
              <Button
                onClick={() => {
                  setEditingStatus(null)
                  setNewStatusName("")
                  setNewStatusColor(DEFAULT_STATUS_COLOR)
                  setOpenStatusModal(true)
                }}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 font-semibold bg-white"
                title="Manage Status Entries"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Manage Status
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <Card className="mb-4 p-3 border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {/* Mail Summary Date Picker */}
            <Popover open={summaryDatePickerOpen} onOpenChange={setSummaryDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="border-gray-300 text-gray-700 hover:bg-gray-100 gap-2 font-semibold bg-white"
                  disabled={!earliestDate}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  {summaryDate ? format(summaryDate, "dd-MMM-yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white border-gray-200">
                <Calendar
                  mode="single"
                  selected={summaryDate || undefined}
                  onSelect={(date) => {
                    setSummaryDate(date || null)
                    setSummaryDatePickerOpen(false)
                  }}
                  disabled={(date) => {
                    if (!earliestDate) return true
                    const earliest = new Date(earliestDate)
                    earliest.setHours(0, 0, 0, 0)
                    return date < earliest || date > new Date()
                  }}
                  className="text-gray-900"
                />
              </PopoverContent>
            </Popover>

            {/* Mail Summary Button */}
            <Button
              onClick={handleOpenSummaryModal}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100 gap-2 font-semibold bg-white"
              disabled={!summaryDate}
              title="View mail summary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              Mail Summary
            </Button>

            {/* Print Preview Button */}
            <Button
              onClick={handlePrintSnapshot}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100 gap-2 font-semibold bg-white"
              title="Print current snapshot"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8V4h10v4m-5 4v4m-7 4h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              Print Preview
            </Button>
          </div>
        </Card>

        {/* Compact Filter Console */}
        <Card className="mb-6 p-3 sm:p-4 border-gray-200 bg-gray-50">
          <div className="space-y-3">
            {/* First Row: Search and Basic Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="relative flex-1 min-w-[180px] sm:min-w-[200px]">
                <svg
                  className="absolute left-3 top-3 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <Input
                  placeholder="Full text search (subject, comments, originator)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white"
                />
              </div>

              <Select value={originatorFilter} onValueChange={setOriginatorFilter}>
                <SelectTrigger className="w-full sm:w-[180px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white">
                  <SelectValue placeholder="Filter by From" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Senders</SelectItem>
                  {filterAddressees.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                <SelectTrigger className="w-full sm:w-[180px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white">
                  <SelectValue placeholder="Filter by Recipient" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Recipients</SelectItem>
                  {filterAddressees.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  {statusEntries.map((status) => (
                    <SelectItem key={status.id} value={status.name}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full border border-gray-200"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Second Row: Date Range Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Received Date Range Filter */}
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Received:</span>
                <Popover
                  open={openDateFilter === "receivedFrom"}
                  onOpenChange={(isOpen) => setOpenDateFilter(isOpen ? "receivedFrom" : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[140px] justify-start text-left font-normal bg-white border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      <svg className="mr-2 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {receivedDateFrom ? format(receivedDateFrom, "dd-MMM") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-gray-200">
                    <Calendar
                      mode="single"
                      selected={receivedDateFrom || undefined}
                      onSelect={(date) => {
                        setReceivedDateFrom(date || null)
                        setOpenDateFilter(null)
                      }}
                      className="text-gray-900"
                    />
                  </PopoverContent>
                </Popover>
                <Popover
                  open={openDateFilter === "receivedTo"}
                  onOpenChange={(isOpen) => setOpenDateFilter(isOpen ? "receivedTo" : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[140px] justify-start text-left font-normal bg-white border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      <svg className="mr-2 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {receivedDateTo ? format(receivedDateTo, "dd-MMM") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-gray-200">
                    <Calendar
                      mode="single"
                      selected={receivedDateTo || undefined}
                      onSelect={(date) => {
                        setReceivedDateTo(date || null)
                        setOpenDateFilter(null)
                      }}
                      disabled={(date) => receivedDateFrom ? date < receivedDateFrom : false}
                      className="text-gray-900"
                    />
                  </PopoverContent>
                </Popover>
                {(receivedDateFrom || receivedDateTo) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReceivedDateFrom(null)
                      setReceivedDateTo(null)
                    }}
                    className="px-2 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                    title="Clear received date filter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Button>
                )}
              </div>

              {/* Despatch Date Range Filter */}
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-600 font-medium whitespace-nowrap">Despatched:</span>
                <Popover
                  open={openDateFilter === "despatchFrom"}
                  onOpenChange={(isOpen) => setOpenDateFilter(isOpen ? "despatchFrom" : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[140px] justify-start text-left font-normal bg-white border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      <svg className="mr-2 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {despatchDateFrom ? format(despatchDateFrom, "dd-MMM") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-gray-200">
                    <Calendar
                      mode="single"
                      selected={despatchDateFrom || undefined}
                      onSelect={(date) => {
                        setDespatchDateFrom(date || null)
                        setOpenDateFilter(null)
                      }}
                      className="text-gray-900"
                    />
                  </PopoverContent>
                </Popover>
                <Popover
                  open={openDateFilter === "despatchTo"}
                  onOpenChange={(isOpen) => setOpenDateFilter(isOpen ? "despatchTo" : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-[140px] justify-start text-left font-normal bg-white border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      <svg className="mr-2 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {despatchDateTo ? format(despatchDateTo, "dd-MMM") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-gray-200">
                    <Calendar
                      mode="single"
                      selected={despatchDateTo || undefined}
                      onSelect={(date) => {
                        setDespatchDateTo(date || null)
                        setOpenDateFilter(null)
                      }}
                      disabled={(date) => despatchDateFrom ? date < despatchDateFrom : false}
                      className="text-gray-900"
                    />
                  </PopoverContent>
                </Popover>
                {(despatchDateFrom || despatchDateTo) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDespatchDateFrom(null)
                      setDespatchDateTo(null)
                    }}
                    className="px-2 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                    title="Clear despatch date filter"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex gap-2 items-center">
                <span className="text-sm text-gray-600 font-medium">
                  {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""} selected
                </span>
                <Button
                  onClick={handleDeleteSelected}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Selected
                </Button>
          </div>
        )}

        <Card className="border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-full inline-block align-middle">
              <Table className="min-w-[1200px] border-separate border-spacing-y-2 border-spacing-x-0">
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50 hover:bg-gray-50">
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="text-gray-900 font-bold text-left min-w-[260px]">Document</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center w-[160px]">From</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center w-[140px]">Received Date</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center w-[190px]">Status</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center">Comments</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center w-[150px]">Despatch Date</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center w-[150px]">To</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center w-[120px]">Pending Days</TableHead>
                  <TableHead className="text-gray-900 font-bold text-center w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const isSelected = selectedIds.has(record.id)
                    const statusColor = statusColorMap.get(record.status)
                    const rowStyle = statusColor
                      ? {
                          borderColor: `${statusColor}55`,
                        }
                      : undefined
                    const textColorStyle = statusColor ? { color: statusColor } : undefined

                    return (
                      <TableRow
                        key={record.id}
                        className={`border border-gray-200/80 transition-all duration-150 shadow-sm bg-white ${
                          isSelected ? "ring-2 ring-blue-300/70 ring-offset-0" : "hover:bg-gray-50"
                        }`}
                        style={rowStyle}
                      >
                      <TableCell className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => handleSelectRecord(record.id)}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-bold pr-6 min-w-[260px]" style={textColorStyle}>{record.document_title}</TableCell>
                      <TableCell className="font-bold text-center w-[160px]" style={textColorStyle}>{record.originator}</TableCell>
                      <TableCell className="font-bold text-center w-[140px]" style={textColorStyle}>
                        {new Date(record.received_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={record.status}
                          onValueChange={(value) => handleQuickStatusUpdate(record.id, value)}
                        >
                          <SelectTrigger 
                            className="h-9 w-[185px] items-center justify-between rounded-md border border-gray-300 bg-white pl-3 pr-9 text-sm font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(0,0,0,0.08)] focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                            style={textColorStyle}
                          >
                            <SelectValue className="font-bold" />
                          </SelectTrigger>
                          <SelectContent>
                            {statusEntries.map((status) => (
                              <SelectItem key={status.id} value={status.name}>
                                <span className="flex items-center gap-2">
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full border border-gray-200"
                                    style={{ backgroundColor: status.color }}
                                  />
                                  {status.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell
                        className="font-bold text-sm text-left align-top max-w-[260px] whitespace-normal break-words"
                        style={textColorStyle}
                      >
                        {record.comments || "-"}
                      </TableCell>
                      <TableCell className="font-bold text-center w-[150px]" style={textColorStyle}>
                        {record.despatch_date
                          ? new Date(record.despatch_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="font-bold text-center w-[150px]" style={textColorStyle}>{record.recipient_name || "-"}</TableCell>
                      <TableCell className="text-center">
                        <span className={record.pending_days > 10 ? "text-red-500 font-bold" : "font-bold"} style={record.pending_days > 10 ? undefined : textColorStyle}>
                          {record.pending_days}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-center">
                          <Button
                            onClick={() => handleEditRecord(record)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 border-gray-300 text-gray-700 hover:bg-gray-50"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Button>
                          <Button
                            onClick={() => handleDeleteRecord(record.id)}
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0 border-red-300 text-red-700 hover:bg-red-50"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </Button>
                        </div>
                      </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            </div>
          </div>

          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
            <span className="text-gray-600">
              Total Records: <span className="text-gray-900 font-semibold">{filteredRecords.length}</span>
            </span>
            <span className="text-gray-600">
              Mail Pending for More than 10 Days:{" "}
              <span className="text-red-500 font-bold">
                {filteredRecords.filter((r) => r.pending_days > 10).length}
              </span>
            </span>
          </div>
        </Card>
      </div>

      {/* Add Document Modal */}
      <AddDocumentModal
        open={openModal}
        onOpenChange={setOpenModal}
        directorates={allAddressees}
        statusEntries={statusEntries}
        onDocumentAdded={handleDocumentAdded}
      />

      {/* Addressee Management Modal */}
      <ManageAddresseesModal
        open={openDirectorateModal}
        onOpenChange={setOpenDirectorateModal}
        addressees={allAddressees}
        editingAddressee={editingDirectorate}
        newAddresseeName={newDirectorateName}
        onNewAddresseeNameChange={setNewDirectorateName}
        onAdd={handleAddDirectorate}
        onEdit={handleEditDirectorate}
        onDelete={handleDeleteDirectorate}
        onEditClick={openEditDirectorateModal}
        onCancelEdit={() => {
                      setEditingDirectorate(null)
                      setNewDirectorateName("")
                    }}
      />

      {/* Status Management Modal */}
      <ManageStatusModal
        open={openStatusModal}
        onOpenChange={(open) => {
          setOpenStatusModal(open)
          if (!open) {
            setEditingStatus(null)
            setNewStatusName("")
            setNewStatusColor(DEFAULT_STATUS_COLOR)
          }
        }}
        statusEntries={statusEntries}
        editingStatus={editingStatus}
        newStatusName={newStatusName}
        onNewStatusNameChange={setNewStatusName}
        newStatusColor={newStatusColor}
        onNewStatusColorChange={setNewStatusColor}
        onAdd={handleAddStatus}
        onEdit={handleEditStatus}
        onDelete={handleDeleteStatus}
        onEditClick={openEditStatusModal}
        onCancelEdit={() => {
          setEditingStatus(null)
          setNewStatusName("")
          setNewStatusColor(DEFAULT_STATUS_COLOR)
        }}
      />

      {/* Edit Document Modal */}
      {editingRecord && (
        <EditDocumentModal
          open={openEditModal}
          onOpenChange={(open) => {
            setOpenEditModal(open)
            if (!open) setEditingRecord(null)
          }}
          directorates={allAddressees}
          statusEntries={statusEntries}
          editingRecord={editingRecord}
          onDocumentUpdated={async (updatedRecord) => {
            try {
              const requestBody: any = {
                mailRecord: {
                  id: editingRecord.id,
                  document_title: updatedRecord.document_title,
                  originator: updatedRecord.originator,
                  received_date: updatedRecord.received_date,
                  status: updatedRecord.status,
                  comments: updatedRecord.comments,
                  despatch_date: updatedRecord.despatch_date,
                },
              }
              
              // Always include recipient_name, even if undefined, so the API knows to clear it
              if ('recipient_name' in updatedRecord) {
                requestBody.mailRecord.recipient_name = updatedRecord.recipient_name || null
              }
              
              const response = await fetch("/api/mail", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
              })

              if (!response.ok) {
                const errorData = await response.json()
                toast.error(errorData.error || "Failed to update document")
                return
              }

              toast.success("Document updated successfully")
              setOpenEditModal(false)
              setEditingRecord(null)
              await fetchData()
            } catch (error: any) {
              console.error("Error updating document:", error)
              toast.error(error.message || "Failed to update document")
            }
          }}
        />
      )}

      {/* Mail Summary Modal */}
      <Dialog open={openSummaryModal} onOpenChange={setOpenSummaryModal}>
        <DialogContent className="max-w-md bg-white border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-xl font-semibold">Mail Summary</DialogTitle>
            {summaryDate && (
              <p className="text-sm text-gray-600 mt-1">
                From {format(summaryDate, "dd-MMM-yyyy")} to {format(new Date(), "dd-MMM-yyyy")}
              </p>
            )}
          </DialogHeader>

          {summaryData && (
            <div className="mt-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Metric</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700">Count</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-3 text-sm text-gray-900">Total</td>
                    <td className="py-3 px-3 text-sm font-bold text-gray-900 text-right">{summaryData.total}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-3 text-sm text-gray-900">Despatched</td>
                    <td className="py-3 px-3 text-sm font-bold text-gray-900 text-right">{summaryData.despatched}</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-3 px-3 text-sm text-gray-900">Pending</td>
                    <td className="py-3 px-3 text-sm font-bold text-gray-900 text-right">{summaryData.pending}</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-3 text-sm text-gray-900">Pending &gt; 10 Days</td>
                    <td className="py-3 px-3 text-sm font-bold text-red-600 text-right">{summaryData.pendingOver10Days}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
