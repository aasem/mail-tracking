"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  pending_days: number
}

export type MailRecordInput = {
  document_title: string
  originator: string
  received_date: string
  status: string
  comments: string
  despatch_date: string | null
  recipient_name: string
  pending_days: number
}

interface AddDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  directorates: Directorate[]
  onDocumentAdded: (records: MailRecordInput[]) => Promise<void>
}

const defaultRecord: Omit<DocumentRecord, "id"> = {
  document_title: "",
  originator: "",
  received_date: null,
  status: "Pending",
  comments: "",
  despatch_date: null,
  recipient_name: "",
  pending_days: 0,
}

export function AddDocumentModal({ open, onOpenChange, directorates, onDocumentAdded }: AddDocumentModalProps) {
  const [records, setRecords] = useState<(DocumentRecord & { tempId: string })[]>([
    { ...defaultRecord, id: "1", tempId: "1" },
  ])
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null)

  const addRecord = () => {
    const newId = Math.max(...records.map((r) => Number.parseInt(r.tempId)), 0) + 1
    setRecords([...records, { ...defaultRecord, id: newId.toString(), tempId: newId.toString() }])
  }

  const removeRecord = (tempId: string) => {
    if (records.length > 1) {
      setRecords(records.filter((r) => r.tempId !== tempId))
    }
  }

  const updateRecord = (tempId: string, field: keyof Omit<DocumentRecord, "id">, value: any) => {
    setRecords(records.map((r) => (r.tempId === tempId ? { ...r, [field]: value } : r)))
  }

  const handleSubmit = async () => {
    const hasEmpty = records.some((r) => !r.document_title || !r.originator || !r.received_date || !r.recipient_name)
    if (hasEmpty) {
      toast.error("Please fill in all required fields")
      return
    }

    const formattedRecords = records.map((r) => ({
      document_title: r.document_title,
      originator: r.originator,
      received_date: r.received_date ? format(r.received_date, "yyyy-MM-dd") : "",
      status: r.status,
      comments: r.comments,
      despatch_date: r.despatch_date ? format(r.despatch_date, "yyyy-MM-dd") : null,
      recipient_name: r.recipient_name,
      pending_days: r.pending_days,
    }))

    await onDocumentAdded(formattedRecords)
    setRecords([{ ...defaultRecord, id: "1", tempId: "1" }])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white border-gray-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl font-semibold">Add Documents</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-140px)]">
          <div className="space-y-6 pr-4">
            {records.map((record, idx) => (
              <div
                key={record.tempId}
                className="border border-gray-200 rounded-lg p-5 bg-gray-50 space-y-4 hover:bg-gray-100/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Document {idx + 1}</h3>
                  {records.length > 1 && (
                    <button
                      onClick={() => removeRecord(record.tempId)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Document Title */}
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Document Title *</Label>
                    <Input
                      placeholder="e.g., Budget Report"
                      value={record.document_title}
                      onChange={(e) => updateRecord(record.tempId, "document_title", e.target.value)}
                      className="mt-2 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Originator - Dropdown */}
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Originator (From) *</Label>
                    <Select
                      value={record.originator}
                      onValueChange={(value) => updateRecord(record.tempId, "originator", value)}
                    >
                      <SelectTrigger className="mt-2 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue placeholder="Select originator" />
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
                      open={openDatePicker === `received-${record.tempId}`}
                      onOpenChange={(isOpen) => setOpenDatePicker(isOpen ? `received-${record.tempId}` : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="mt-2 w-full justify-start text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                        >
                          <svg
                            className="mr-2 h-4 w-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
                            updateRecord(record.tempId, "received_date", date)
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
                    <Select
                      value={record.status}
                      onValueChange={(value) => updateRecord(record.tempId, "status", value)}
                    >
                      <SelectTrigger className="mt-2 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-gray-200">
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
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Comments */}
                  <div className="col-span-2">
                    <Label className="text-gray-700 text-sm font-medium">Comments</Label>
                    <Input
                      placeholder="Any additional notes..."
                      value={record.comments}
                      onChange={(e) => updateRecord(record.tempId, "comments", e.target.value)}
                      className="mt-2 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Despatch Date - Calendar Picker */}
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Despatch Date</Label>
                    <Popover
                      open={openDatePicker === `despatch-${record.tempId}`}
                      onOpenChange={(isOpen) => setOpenDatePicker(isOpen ? `despatch-${record.tempId}` : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="mt-2 w-full justify-start text-left font-normal bg-white border-gray-300 text-gray-900 hover:bg-gray-50"
                        >
                          <svg
                            className="mr-2 h-4 w-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
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
                            updateRecord(record.tempId, "despatch_date", date)
                            setOpenDatePicker(null)
                          }}
                          className="text-gray-900"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Recipient - Dropdown */}
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Despatch To *</Label>
                    <Select
                      value={record.recipient_name}
                      onValueChange={(value) => updateRecord(record.tempId, "recipient_name", value)}
                    >
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

                  {/* Pending Days */}
                  <div>
                    <Label className="text-gray-700 text-sm font-medium">Pending Days</Label>
                    <Input
                      type="number"
                      min="0"
                      value={record.pending_days}
                      onChange={(e) =>
                        updateRecord(record.tempId, "pending_days", Number.parseInt(e.target.value) || 0)
                      }
                      className="mt-2 bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-between gap-2 pt-4 border-t border-gray-200">
          <Button
            onClick={addRecord}
            variant="outline"
            className="border-gray-300 text-gray-700 hover:bg-gray-50 gap-2 bg-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Another
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
              {`Save ${records.length} Document(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
