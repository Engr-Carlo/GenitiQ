"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, Button, DataTable, Badge, LoadingSpinner } from "@/components/ui";
import { Upload, Download, Trash2, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

interface BarcodeReference {
  id: string;
  partNumber: string;
  barcode: string;
  estimatedTime: number;
  deadline: string;
  quantity: number;
  uploadedBy: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export default function BarcodeReferencePage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [references, setReferences] = useState<BarcodeReference[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") redirect("/login");
    if (session?.user.role !== "ADMIN") redirect("/dashboard");
  }, [session, status]);

  useEffect(() => {
    if (session?.user.role === "ADMIN") {
      fetchReferences();
    }
  }, [session]);

  const fetchReferences = async () => {
    try {
      const res = await fetch("/api/admin/barcode-reference");
      const data = await res.json();
      if (res.ok) {
        setReferences(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch references:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/barcode-reference/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      
      if (res.ok) {
        setUploadResult({
          success: true,
          message: data.message,
          results: data.results,
        });
        setFile(null);
        fetchReferences();
      } else {
        setUploadResult({
          success: false,
          message: data.error || "Upload failed",
          errors: data.errors,
        });
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || "Upload failed",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, barcode: string) => {
    if (!confirm(`Delete barcode reference ${barcode}?`)) return;

    try {
      const res = await fetch(`/api/admin/barcode-reference?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchReferences();
      } else {
        alert("Failed to delete reference");
      }
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete reference");
    }
  };

  const downloadTemplate = () => {
    window.location.href = "/api/admin/barcode-reference?download=template";
  };

  const downloadCurrent = () => {
    window.location.href = "/api/admin/barcode-reference?download=current";
  };

  if (loading) return <LoadingSpinner />;

  const columns = [
    {
      key: "partNumber",
      header: "Part Number",
      render: (item: BarcodeReference) => <span className="font-bold">{item.partNumber}</span>,
    },
    {
      key: "barcode",
      header: "Barcode",
      render: (item: BarcodeReference) => (
        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{item.barcode}</span>
      ),
    },
    {
      key: "estimatedTime",
      header: "Est. Time",
      render: (item: BarcodeReference) => <span>{item.estimatedTime} min</span>,
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (item: BarcodeReference) => (
        <span className="text-sm">{new Date(item.deadline).toLocaleDateString()}</span>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      render: (item: BarcodeReference) => <Badge variant="info">{item.quantity}</Badge>,
    },
    {
      key: "uploadedBy",
      header: "Uploaded By",
      render: (item: BarcodeReference) => (
        <div className="text-sm">
          <p className="font-medium">{item.uploadedBy.name}</p>
          <p className="text-gray-400 text-xs">{new Date(item.createdAt).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (item: BarcodeReference) => (
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 size={14} />}
          onClick={() => handleDelete(item.id, item.barcode)}
        >
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wide text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
              <FileText size={22} />
            </div>
            Barcode Reference Management
          </h1>
          <p className="text-gray-500 mt-1 ml-13">
            Upload and manage barcode reference data for part scanning validation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<Download size={16} />} onClick={downloadTemplate}>
            Download Template
          </Button>
          <Button variant="secondary" size="sm" icon={<Download size={16} />} onClick={downloadCurrent}>
            Export Current Data
          </Button>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <h2 className="text-lg font-black mb-4">Upload CSV File</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
            <Button
              variant="primary"
              icon={<Upload size={16} />}
              onClick={handleUpload}
              loading={uploading}
              disabled={!file || uploading}
            >
              Upload
            </Button>
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div
              className={`p-4 rounded-lg border ${
                uploadResult.success
                  ? "bg-success-50 border-success-200"
                  : "bg-danger-50 border-danger-200"
              }`}
            >
              <div className="flex items-start gap-3">
                {uploadResult.success ? (
                  <CheckCircle2 className="text-success-600 flex-shrink-0" size={20} />
                ) : (
                  <AlertCircle className="text-danger-600 flex-shrink-0" size={20} />
                )}
                <div className="flex-1">
                  <p className={`font-bold ${uploadResult.success ? "text-success-900" : "text-danger-900"}`}>
                    {uploadResult.message}
                  </p>
                  {uploadResult.results && (
                    <div className="mt-2 text-sm">
                      <p>Created: {uploadResult.results.created}</p>
                      <p>Updated: {uploadResult.results.updated}</p>
                      {uploadResult.results.errors?.length > 0 && (
                        <p className="text-danger-700">Errors: {uploadResult.results.errors.length}</p>
                      )}
                    </div>
                  )}
                  {uploadResult.errors && (
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {uploadResult.errors.map((err: any, idx: number) => (
                        <p key={idx} className="text-sm text-danger-700">
                          Row {err.row}: {err.error}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CSV Format Guide */}
          <div className="bg-gray-50 p-4 rounded-lg text-sm">
            <p className="font-bold mb-2">CSV Format Requirements:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>Headers: <code className="bg-white px-1">partNumber,barcode,estimatedTime,deadline,quantity</code></li>
              <li>partNumber: Part number (e.g., PN10001)</li>
              <li>barcode: Unique barcode identifier (e.g., BC-10001-A001)</li>
              <li>estimatedTime: Estimated inspection time in minutes (e.g., 4)</li>
              <li>deadline: ISO date format (e.g., 2026-02-25)</li>
              <li>quantity: Quantity for this barcode (e.g., 1)</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* References Table */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black">Current References ({references.length})</h2>
        </div>
        {references.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="font-bold">No barcode references uploaded yet</p>
            <p className="text-sm mt-1">Upload a CSV file to get started</p>
          </div>
        ) : (
          <DataTable columns={columns} data={references} />
        )}
      </Card>
    </div>
  );
}
