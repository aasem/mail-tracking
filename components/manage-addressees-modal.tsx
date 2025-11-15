"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Addressee {
  id: number
  name: string
}

interface ManageAddresseesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  addressees: Addressee[]
  editingAddressee: Addressee | null
  newAddresseeName: string
  onNewAddresseeNameChange: (name: string) => void
  onAdd: () => Promise<void>
  onEdit: () => Promise<void>
  onDelete: (id: number, name: string) => Promise<void>
  onEditClick: (addressee: Addressee) => void
  onCancelEdit: () => void
}

export function ManageAddresseesModal({
  open,
  onOpenChange,
  addressees,
  editingAddressee,
  newAddresseeName,
  onNewAddresseeNameChange,
  onAdd,
  onEdit,
  onDelete,
  onEditClick,
  onCancelEdit,
}: ManageAddresseesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border-gray-200 shadow-lg">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-xl font-semibold">
            {editingAddressee ? "Edit Addressee" : "Manage Addressee List"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add/Edit Form */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3">
              {editingAddressee ? "Edit Addressee" : "Add New Addressee"}
            </h3>
            <div className="flex gap-2">
              <Input
                placeholder="Enter addressee name"
                value={newAddresseeName}
                onChange={(e) => onNewAddresseeNameChange(e.target.value)}
                className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    editingAddressee ? onEdit() : onAdd()
                  }
                }}
              />
              <Button
                onClick={editingAddressee ? onEdit : onAdd}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingAddressee ? "Update" : "Add"}
              </Button>
              {editingAddressee && (
                <Button onClick={onCancelEdit} variant="outline">
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
              {addressees.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No addressees found</div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {addressees.map((addressee) => (
                    <div
                      key={addressee.id}
                      className="px-4 py-3 flex justify-between items-center hover:bg-gray-50"
                    >
                      <span className="text-gray-900 font-medium">{addressee.name}</span>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => onEditClick(addressee)}
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
                          onClick={() => onDelete(addressee.id, addressee.name)}
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

