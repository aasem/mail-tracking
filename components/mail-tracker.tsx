"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddDocumentModal } from "./add-document-modal"
import { toast } from "sonner"

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

export function MailTracker() {
  const [records, setRecords] = useState<MailRecord[]>([])
  const [allAddressees, setAllAddressees] = useState<Array<{ id: number; name: string }>>([]) // Master list
  const [filterAddressees, setFilterAddressees] = useState<Array<{ id: number; name: string }>>([]) // Only those with mail
  const [statusEntries, setStatusEntries] = useState<Array<{ id: number; name: string }>>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [originatorFilter, setOriginatorFilter] = useState("All")
  const [recipientFilter, setRecipientFilter] = useState("All")
  const [openModal, setOpenModal] = useState(false)
  const [openDirectorateModal, setOpenDirectorateModal] = useState(false)
  const [openStatusModal, setOpenStatusModal] = useState(false)
  const [openEditModal, setOpenEditModal] = useState(false)
  const [editingDirectorate, setEditingDirectorate] = useState<{ id: number; name: string } | null>(null)
  const [editingStatus, setEditingStatus] = useState<{ id: number; name: string } | null>(null)
  const [editingRecord, setEditingRecord] = useState<MailRecord | null>(null)
  const [newDirectorateName, setNewDirectorateName] = useState("")
  const [newStatusName, setNewStatusName] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.set("search", searchTerm)
      if (originatorFilter !== "All") params.set("originator", originatorFilter)
      if (recipientFilter !== "All") params.set("recipient", recipientFilter)

      const response = await fetch(`/api/mail?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch data")
      
      const data = await response.json()
      setRecords(data.records || [])
      setAllAddressees(data.allAddressees || []) // Master list
      setStatusEntries(data.statusEntries || []) // Status entries
      
      // Extract unique addressees from records for filters
      const originators = new Set<string>()
      const recipients = new Set<string>()
      data.records?.forEach((record: MailRecord) => {
        originators.add(record.originator)
        recipients.add(record.recipient_name)
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
  }, [searchTerm, originatorFilter, recipientFilter])

  const filteredRecords = records.filter((record) => {
    const matchesSearch =
      record.document_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.originator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.recipient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.comments.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesOriginator = originatorFilter === "All" || record.originator === originatorFilter
    const matchesRecipient = recipientFilter === "All" || record.recipient_name === recipientFilter

    return matchesSearch && matchesOriginator && matchesRecipient
  })

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "despatched":
        return "bg-green-50 text-green-700 border-green-200"
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200"
      case "in home":
        return "bg-blue-50 text-blue-700 border-blue-200"
      default:
        return "bg-gray-50 text-gray-700 border-gray-200"
    }
  }

  const handleDocumentAdded = async (newRecords: Array<{
    document_title: string
    originator: string
    received_date: string
    status: string
    comments: string
    despatch_date: string | null
    recipient_name: string
    pending_days: number
  }>) => {
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

    try {
      const response = await fetch("/api/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntry: { name } }),
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

    try {
      const response = await fetch("/api/mail", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusEntry: { id: editingStatus.id, name } }),
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

  const openEditStatusModal = (status: { id: number; name: string }) => {
    setEditingStatus(status)
    setNewStatusName(status.name)
    setOpenStatusModal(true)
  }

  return (
    <div className="min-h-screen p-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 border-b border-gray-200 pb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Mail Tracking Dashboard</h1>
          <p className="text-gray-600">Manage and track all organizational mail across directorates</p>
        </div>

        {/* Compact Filter Console */}
        <Card className="mb-6 p-4 border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
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
                placeholder="Search documents, originator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white"
              />
            </div>

            <Select value={originatorFilter} onValueChange={setOriginatorFilter}>
              <SelectTrigger className="w-[180px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white">
                <SelectValue placeholder="Filter by Originator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Originators</SelectItem>
                {filterAddressees.map((d) => (
                  <SelectItem key={d.id} value={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={recipientFilter} onValueChange={setRecipientFilter}>
              <SelectTrigger className="w-[180px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-white">
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

            <div className="flex gap-2">
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
          <div className="overflow-x-auto">
            <Table>
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
                  <TableHead className="text-gray-900 font-semibold">Document</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Originator</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Received Date</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Status</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Comments</TableHead>
                  <TableHead className="text-gray-900 font-semibold">Despatch Date</TableHead>
                  <TableHead className="text-gray-900 font-semibold">To</TableHead>
                  <TableHead className="text-gray-900 font-semibold text-right">Pending Days</TableHead>
                  <TableHead className="text-gray-900 font-semibold text-center w-32">Actions</TableHead>
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
                  filteredRecords.map((record) => (
                    <TableRow
                      key={record.id}
                      className={`border-gray-200 transition-colors ${
                        selectedIds.has(record.id) ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <TableCell className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => handleSelectRecord(record.id)}
                          className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">{record.document_title}</TableCell>
                      <TableCell className="text-gray-700">{record.originator}</TableCell>
                      <TableCell className="text-gray-700">
                        {new Date(record.received_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.status}
                          onValueChange={(value) => handleQuickStatusUpdate(record.id, value)}
                        >
                          <SelectTrigger className="h-7 w-[140px] border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusEntries.map((status) => (
                              <SelectItem key={status.id} value={status.name}>
                                {status.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-gray-700 text-sm">{record.comments || "-"}</TableCell>
                      <TableCell className="text-gray-700">
                        {record.despatch_date
                          ? new Date(record.despatch_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-gray-700">{record.recipient_name}</TableCell>
                      <TableCell className="text-right">
                        <span className={record.pending_days > 15 ? "text-red-600 font-semibold" : "text-gray-700"}>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-between items-center">
            <span className="text-gray-600">
              Total Records: <span className="text-gray-900 font-semibold">{filteredRecords.length}</span>
            </span>
            <span className="text-gray-600">
              Pending {"> "}15 days:{" "}
              <span className="text-red-600 font-semibold">
                {filteredRecords.filter((r) => r.pending_days > 15).length}
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
      <Dialog open={openDirectorateModal} onOpenChange={setOpenDirectorateModal}>
        <DialogContent className="max-w-2xl bg-white border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-xl font-semibold">
              {editingDirectorate ? "Edit Addressee" : "Manage Addressee List"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add/Edit Form */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">
                {editingDirectorate ? "Edit Addressee" : "Add New Addressee"}
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter addressee name"
                  value={newDirectorateName}
                  onChange={(e) => setNewDirectorateName(e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      editingDirectorate ? handleEditDirectorate() : handleAddDirectorate()
                    }
                  }}
                />
                <Button
                  onClick={editingDirectorate ? handleEditDirectorate : handleAddDirectorate}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {editingDirectorate ? "Update" : "Add"}
                </Button>
                {editingDirectorate && (
                  <Button
                    onClick={() => {
                      setEditingDirectorate(null)
                      setNewDirectorateName("")
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Addressee List */}
            <div className="border border-gray-200 rounded-lg">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Master Addressee List</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {allAddressees.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No addressees found</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {allAddressees.map((directorate) => (
                      <div
                        key={directorate.id}
                        className="px-4 py-3 flex justify-between items-center hover:bg-gray-50"
                      >
                        <span className="text-gray-900 font-medium">{directorate.name}</span>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => openEditDirectorateModal(directorate)}
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
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
                            onClick={() => handleDeleteDirectorate(directorate.id, directorate.name)}
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-700 hover:bg-red-50"
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Management Modal */}
      <Dialog open={openStatusModal} onOpenChange={setOpenStatusModal}>
        <DialogContent className="max-w-2xl bg-white border-gray-200 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 text-xl font-semibold">
              {editingStatus ? "Edit Status" : "Manage Status Entries"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add/Edit Form */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">
                {editingStatus ? "Edit Status" : "Add New Status"}
              </h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter status name"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      editingStatus ? handleEditStatus() : handleAddStatus()
                    }
                  }}
                />
                <Button
                  onClick={editingStatus ? handleEditStatus : handleAddStatus}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {editingStatus ? "Update" : "Add"}
                </Button>
                {editingStatus && (
                  <Button
                    onClick={() => {
                      setEditingStatus(null)
                      setNewStatusName("")
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>

            {/* Status List */}
            <div className="border border-gray-200 rounded-lg">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Status List</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {statusEntries.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No status entries found</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {statusEntries.map((status) => (
                      <div
                        key={status.id}
                        className="px-4 py-3 flex justify-between items-center hover:bg-gray-50"
                      >
                        <span className="text-gray-900 font-medium">{status.name}</span>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => openEditStatusModal(status)}
                            variant="outline"
                            size="sm"
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
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
                            onClick={() => handleDeleteStatus(status.id, status.name)}
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-700 hover:bg-red-50"
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Document Modal */}
      {editingRecord && (
        <AddDocumentModal
          open={openEditModal}
          onOpenChange={(open) => {
            setOpenEditModal(open)
            if (!open) setEditingRecord(null)
          }}
          directorates={allAddressees}
          statusEntries={statusEntries}
          editingRecord={editingRecord}
          onDocumentAdded={async (updatedRecords) => {
            try {
              const record = updatedRecords[0]
              const response = await fetch("/api/mail", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  mailRecord: {
                    id: editingRecord.id,
                    document_title: record.document_title,
                    originator: record.originator,
                    received_date: record.received_date,
                    status: record.status,
                    comments: record.comments,
                    despatch_date: record.despatch_date,
                    recipient_name: record.recipient_name,
                    pending_days: record.pending_days,
                  },
                }),
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
    </div>
  )
}
