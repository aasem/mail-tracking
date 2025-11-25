"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { toast } from "sonner"

interface Directorate {
  id: number
  name: string
}

interface DocumentRecord {
  id: string
  document_title: string
  originator: string
  received_date: Date | null
  status: string
  comments: string
  despatch_date: Date | null
  recipient_name: string
}

export type MailRecordInput = {
  document_title: string
  originator: string
  received_date: string
  status: string
  comments: string
  despatch_date: string | null
  recipient_name: string
}

type StatusOption = {
  id: number
  name: string
  color?: string
}

interface EditDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  directorates: Directorate[]
  statusEntries?: StatusOption[]
  editingRecord: any
  onDocumentUpdated: (record: MailRecordInput) => Promise<void>
}

export function EditDocumentModal({
  open,
  onOpenChange,
  directorates,
  statusEntries = [],
  editingRecord,
  onDocumentUpdated,
}: EditDocumentModalProps) {
  const [record, setRecord] = useState<DocumentRecord>({
    id: "",
    document_title: "",
    originator: "",
    received_date: null,
    status: "Pending",
    comments: "",
    despatch_date: null,
    recipient_name: "",
  })
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null)

  // Initialize with editing record
  useEffect(() => {
    if (editingRecord && open) {
      const receivedDate = editingRecord.received_date ? new Date(editingRecord.received_date) : null
      const despatchDate = editingRecord.despatch_date ? new Date(editingRecord.despatch_date) : null
      setRecord({
        id: editingRecord.id.toString(),
        document_title: editingRecord.document_title,
        originator: editingRecord.originator,
        received_date: receivedDate,
        status: editingRecord.status,
        comments: editingRecord.comments || "",
        despatch_date: despatchDate,
        recipient_name: editingRecord.recipient_name,
      })
    }
  }, [editingRecord, open])

  const updateField = (field: keyof Omit<DocumentRecord, "id">, value: any) => {
    setRecord((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!record.document_title || !record.originator || !record.received_date || !record.recipient_name) {
      toast.error("Please fill in all required fields")
      return
    }

    const formattedRecord: MailRecordInput = {
      document_title: record.document_title,
      originator: record.originator,
      received_date: record.received_date ? format(record.received_date, "yyyy-MM-dd") : "",
      status: record.status,
      comments: record.comments,
      despatch_date: record.despatch_date ? format(record.despatch_date, "yyyy-MM-dd") : null,
      recipient_name: record.recipient_name,
    }

    await onDocumentUpdated(formattedRecord)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white border-gray-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl font-semibold">Edit Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Document Title */}
              <div>
                <Label className="text-gray-700 text-sm font-medium">Document Title *</Label>
                <Input
                  placeholder="e.g., Budget Report"
                  value={record.document_title}
                  onChange={(e) => updateField("document_title", e.target.value)}
                  className="mt-2 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* From - Dropdown */}
              <div>
                <Label className="text-gray-700 text-sm font-medium">From *</Label>
                <Select value={record.originator} onValueChange={(value) => updateField("originator", value)}>
                  <SelectTrigger className="mt-2 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select sender" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    {directorates.map((d) => (
                      <SelectItem key={d.id} value={d.name} className="text-gray-900">
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Received Date - Calendar Picker */}
              <div>
                <Label className="text-gray-700 text-sm font-medium">Received Date *</Label>
                <Popover
                  open={openDatePicker === "received"}
                  onOpenChange={(isOpen) => setOpenDatePicker(isOpen ? "received" : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="mt-2 w-full justify-start text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                    >
                      <svg className="mr-2 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {record.received_date ? format(record.received_date, "dd-MMM-yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white border-gray-200">
                    <Calendar
                      mode="single"
                      selected={record.received_date || undefined}
                      onSelect={(date) => {
                        updateField("received_date", date)
                        setOpenDatePicker(null)
                      }}
                      disabled={(date) => date > new Date()}
                      className="text-gray-900"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Status */}
              <div>
                <Label className="text-gray-700 text-sm font-medium">Status</Label>
                <Select value={record.status} onValueChange={(value) => updateField("status", value)}>
                  <SelectTrigger className="mt-2 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    {statusEntries.length > 0 ? (
                      statusEntries.map((status) => (
                        <SelectItem key={status.id} value={status.name} className="text-gray-900">
                          <span className="flex items-center gap-2">
                            {status.color && (
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full border border-gray-200"
                                style={{ backgroundColor: status.color }}
                              />
                            )}
                            {status.name}
                          </span>
                        </SelectItem>
                      ))
                    ) : (
                      <>
                        <SelectItem value="Pending" className="text-gray-900">
                          Pending
                        </SelectItem>
                        <SelectItem value="Despatched" className="text-gray-900">
                          Despatched
                        </SelectItem>
                        <SelectItem value="in Home" className="text-gray-900">
                          In Home
                        </SelectItem>
                        <SelectItem value="with DUCK" className="text-gray-900">
                          With DUCK
                        </SelectItem>
                        <SelectItem value="with office boy" className="text-gray-900">
                          With Office Boy
                        </SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Comments */}
              <div className="col-span-2">
                <Label className="text-gray-700 text-sm font-medium">Comments</Label>
                <Input
                  placeholder="Any additional notes..."
                  value={record.comments}
                  onChange={(e) => updateField("comments", e.target.value)}
                  className="mt-2 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Despatch Date - Calendar Picker */}
              <div>
                <Label className="text-gray-700 text-sm font-medium">Despatch Date</Label>
                <div className="mt-2 flex gap-2">
                  <Popover
                    open={openDatePicker === "despatch"}
                    onOpenChange={(isOpen) => setOpenDatePicker(isOpen ? "despatch" : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="flex-1 justify-start text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                      >
                        <svg className="mr-2 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {record.despatch_date ? format(record.despatch_date, "dd-MMM-yyyy") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-white border-gray-200">
                      <Calendar
                        mode="single"
                        selected={record.despatch_date || undefined}
                        onSelect={(date) => {
                          updateField("despatch_date", date)
                          setOpenDatePicker(null)
                        }}
                        disabled={(date) => {
                          if (!record.received_date) return true
                          const receivedDate = new Date(record.received_date)
                          receivedDate.setHours(0, 0, 0, 0)
                          return date < receivedDate
                        }}
                        className="text-gray-900"
                      />
                    </PopoverContent>
                  </Popover>
                  {record.despatch_date && (
                    <Button
                      variant="outline"
                      onClick={() => updateField("despatch_date", null)}
                      className="px-3 border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                      title="Clear despatch date"
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

              {/* Recipient - Dropdown */}
              <div>
                <Label className="text-gray-700 text-sm font-medium">Despatch To *</Label>
                <Select value={record.recipient_name} onValueChange={(value) => updateField("recipient_name", value)}>
                  <SelectTrigger className="mt-2 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-200">
                    {directorates.map((d) => (
                      <SelectItem key={d.id} value={d.name} className="text-gray-900">
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Update Document
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

