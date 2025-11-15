"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface StatusEntry {
  id: number
  name: string
}

interface ManageStatusModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  statusEntries: StatusEntry[]
  editingStatus: StatusEntry | null
  newStatusName: string
  onNewStatusNameChange: (name: string) => void
  onAdd: () => Promise<void>
  onEdit: () => Promise<void>
  onDelete: (id: number, name: string) => Promise<void>
  onEditClick: (status: StatusEntry) => void
  onCancelEdit: () => void
}

export function ManageStatusModal({
  open,
  onOpenChange,
  statusEntries,
  editingStatus,
  newStatusName,
  onNewStatusNameChange,
  onAdd,
  onEdit,
  onDelete,
  onEditClick,
  onCancelEdit,
}: ManageStatusModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                onChange={(e) => onNewStatusNameChange(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    editingStatus ? onEdit() : onAdd()
                  }
                }}
              />
              <Button
                onClick={editingStatus ? onEdit : onAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingStatus ? "Update" : "Add"}
              </Button>
              {editingStatus && (
                <Button onClick={onCancelEdit} variant="outline">
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
                          onClick={() => onEditClick(status)}
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
                          onClick={() => onDelete(status.id, status.name)}
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
  )
}

