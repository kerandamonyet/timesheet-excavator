"use client";

import { withAuthGuard } from "@/firebase/withAuthGuard";
import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  Plus,
  Trash2,
  Loader,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Pencil,
  Save,
} from "lucide-react";
import Swal from "sweetalert2";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// --- Zod Schema for Validation ---
// Definisikan opsi status yang valid
const STATUS_OPTIONS = ["Tersedia", "Perbaikan"];

const excavatorSchema = z.object({
  id: z.string().optional(), // Tambahkan ID untuk kebutuhan edit
  name: z.string().min(1, "Nama excavator wajib diisi."),
  brand: z.string().min(1, "Merek wajib diisi."),
  type: z.string().optional(),
  operatorName: z.string().optional(),
  regularRatePerHour: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Tarif regular tidak boleh negatif.").default(0)
  ),
  overtimeRatePerHour: z.preprocess(
    (val) => Number(val),
    z.number().min(0, "Tarif lembur tidak boleh negatif.").default(0)
  ),
  // Gunakan z.enum untuk memvalidasi status dengan opsi yang telah ditentukan
  status: z.enum(STATUS_OPTIONS, {
    errorMap: () => ({ message: "Status wajib diisi dan harus valid." }),
  }),
});

function ExcavatorPage() {
  const [excavators, setExcavators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });

  // --- React Hook Form for Create Form ---
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreateForm,
    formState: { errors: createErrors },
  } = useForm({
    resolver: zodResolver(excavatorSchema),
    defaultValues: {
      name: "",
      brand: "",
      type: "",
      operatorName: "",
      regularRatePerHour: 0,
      overtimeRatePerHour: 0,
      status: "Tersedia", // Set default status
    },
  });

  // --- React Hook Form for Edit Form ---
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEditForm,
    setValue: setEditValue, // To set values when opening the edit modal
    formState: { errors: editErrors },
  } = useForm({
    resolver: zodResolver(excavatorSchema),
    defaultValues: {
      name: "",
      brand: "",
      type: "",
      operatorName: "",
      regularRatePerHour: 0,
      overtimeRatePerHour: 0,
      status: "",
    },
  });

  const fetchExcavators = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, "excavators"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setExcavators(data);
    } catch (error) {
      console.error("Error fetching excavators:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal Memuat Data",
        text: "Terjadi kesalahan saat memuat data excavator",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExcavators();
  }, []);

  // Handle create form submit using React Hook Form
  const onSubmitCreate = async (data) => {
    try {
      await addDoc(collection(db, "excavators"), data);

      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: "Excavator berhasil ditambahkan",
        timer: 1500,
        showConfirmButton: false,
      });

      resetCreateForm();
      setIsCreateModalOpen(false);
      fetchExcavators();
    } catch (error) {
      console.error("Error adding excavator:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: "Terjadi kesalahan saat menambahkan excavator",
      });
    }
  };

  // Handle edit form submit using React Hook Form
  const onSubmitEdit = async (data) => {
    try {
      const excavatorRef = doc(db, "excavators", data.id);
      await updateDoc(excavatorRef, {
        name: data.name,
        brand: data.brand,
        type: data.type,
        operatorName: data.operatorName,
        regularRatePerHour: Number(data.regularRatePerHour),
        overtimeRatePerHour: Number(data.overtimeRatePerHour),
        status: data.status,
      });

      Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: "Excavator berhasil diperbarui",
        timer: 1500,
        showConfirmButton: false,
      });

      setIsEditModalOpen(false);
      fetchExcavators();
    } catch (error) {
      console.error("Error updating excavator:", error);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: "Terjadi kesalahan saat memperbarui excavator",
      });
    }
  };

  const handleDelete = async (id, name) => {
    Swal.fire({
      title: `Hapus ${name}?`,
      text: "Data yang dihapus tidak dapat dikembalikan",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDoc(doc(db, "excavators", id));
          fetchExcavators();
          Swal.fire({
            icon: "success",
            title: "Terhapus!",
            text: "Excavator berhasil dihapus",
            timer: 1500,
            showConfirmButton: false,
          });
        } catch (error) {
          console.error("Error deleting excavator:", error);
          Swal.fire({
            icon: "error",
            title: "Gagal",
            text: "Terjadi kesalahan saat menghapus excavator",
          });
        }
      }
    });
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedExcavators = [...excavators].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === "asc" ? 1 : -1;
    }
    return 0;
  });

  const filteredExcavators = sortedExcavators.filter(
    (ex) =>
      ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ex.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ex.type && ex.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ex.operatorName &&
        ex.operatorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ex.status && ex.status.toLowerCase().includes(searchTerm.toLowerCase())) // Tambahkan filter untuk status
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Open create modal
  const openCreateModal = () => {
    setIsCreateModalOpen(true);
    resetCreateForm(); // Reset form when opening
  };

  // Close create modal
  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    resetCreateForm();
  };

  // Open edit modal and populate form using setValue from React Hook Form
  const openEditModal = (excavator) => {
    setEditValue("id", excavator.id); // Hidden input for ID
    setEditValue("name", excavator.name);
    setEditValue("brand", excavator.brand);
    setEditValue("type", excavator.type || "");
    setEditValue("operatorName", excavator.operatorName || "");
    setEditValue("regularRatePerHour", excavator.regularRatePerHour);
    setEditValue("overtimeRatePerHour", excavator.overtimeRatePerHour);
    setEditValue("status", excavator.status);
    setIsEditModalOpen(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    resetEditForm(); // Reset edit form on close
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Tersedia":
        return "bg-green-100 text-green-800";
      case "Perbaikan":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-indigo-800">
            Manajemen Excavator
          </h1>
          <p className="text-gray-700 mt-1">
            Kelola data excavator dan operator
          </p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Cari excavator..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              <Search className="w-5 h-5" />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden md:inline">Tambah</span>
          </button>
        </div>
      </div>

      {/* Modal for Create Form */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="border-b px-6 py-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-indigo-800">
                  Tambah Excavator Baru
                </h2>
                <button
                  onClick={closeCreateModal}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmitCreate(onSubmitCreate)}
              className="p-6 grid grid-cols-1 gap-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Nama Excavator <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="Contoh: CAT 320D"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    createErrors.name ? "border-red-500" : "border-gray-300"
                  }`}
                  {...registerCreate("name")}
                />
                {createErrors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {createErrors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Merek <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="Contoh: Caterpillar"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    createErrors.brand ? "border-red-500" : "border-gray-300"
                  }`}
                  {...registerCreate("brand")}
                />
                {createErrors.brand && (
                  <p className="text-red-500 text-sm mt-1">
                    {createErrors.brand.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Tipe <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="Contoh: Mini Excavator"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
                  {...registerCreate("type")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Nama Operator <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="Nama operator"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
                  {...registerCreate("operatorName")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Tarif Regular /Jam <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="500000"
                  type="number"
                  min="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    createErrors.regularRatePerHour
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  {...registerCreate("regularRatePerHour")}
                />
                {createErrors.regularRatePerHour && (
                  <p className="text-red-500 text-sm mt-1">
                    {createErrors.regularRatePerHour.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Tarif Lembur /Jam <span className="text-red-500">*</span>
                </label>
                <input
                  placeholder="750000"
                  type="number"
                  min="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    createErrors.overtimeRatePerHour
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  {...registerCreate("overtimeRatePerHour")}
                />
                {createErrors.overtimeRatePerHour && (
                  <p className="text-red-500 text-sm mt-1">
                    {createErrors.overtimeRatePerHour.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    createErrors.status ? "border-red-500" : "border-gray-300"
                  }`}
                  {...registerCreate("status")}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {createErrors.status && (
                  <p className="text-red-500 text-sm mt-1">
                    {createErrors.status.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-800 font-medium hover:bg-gray-50 shadow-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 shadow-md"
                >
                  <Plus className="w-4 h-4" /> Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Edit Form */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="border-b px-6 py-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-indigo-800">
                  Edit Excavator
                </h2>
                <button
                  onClick={closeEditModal}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmitEdit(onSubmitEdit)}
              className="p-6 grid grid-cols-1 gap-4"
            >
              <input type="hidden" {...registerEdit("id")} />

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Nama Excavator *
                </label>
                <input
                  placeholder="Contoh: CAT 320D"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    editErrors.name ? "border-red-500" : "border-gray-300"
                  }`}
                  {...registerEdit("name")}
                />
                {editErrors.name && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Merek *
                </label>
                <input
                  placeholder="Contoh: Caterpillar"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    editErrors.brand ? "border-red-500" : "border-gray-300"
                  }`}
                  {...registerEdit("brand")}
                />
                {editErrors.brand && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.brand.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Tipe
                </label>
                <input
                  placeholder="Contoh: Mini Excavator"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
                  {...registerEdit("type")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Nama Operator
                </label>
                <input
                  placeholder="Nama operator"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
                  {...registerEdit("operatorName")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Tarif Regular /Jam
                </label>
                <input
                  placeholder="500000"
                  type="number"
                  min="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    editErrors.regularRatePerHour
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  {...registerEdit("regularRatePerHour")}
                />
                {editErrors.regularRatePerHour && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.regularRatePerHour.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Tarif Lembur /Jam
                </label>
                <input
                  placeholder="750000"
                  type="number"
                  min="0"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    editErrors.overtimeRatePerHour
                      ? "border-red-500"
                      : "border-gray-300"
                  }`}
                  {...registerEdit("overtimeRatePerHour")}
                />
                {editErrors.overtimeRatePerHour && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.overtimeRatePerHour.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  Status *
                </label>
                <select
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 ${
                    editErrors.status ? "border-red-500" : "border-gray-300"
                  }`}
                  {...registerEdit("status")}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {editErrors.status && (
                  <p className="text-red-500 text-sm mt-1">
                    {editErrors.status.message}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-800 font-medium hover:bg-gray-50 shadow-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 shadow-md"
                >
                  <Save className="w-4 h-4" /> Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excavator List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
            Daftar Excavator
            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
              {excavators.length} excavator
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-700">Memuat data...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Nama
                      {sortConfig.key === "name" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("brand")}
                  >
                    <div className="flex items-center gap-1">
                      Merek
                      {sortConfig.key === "brand" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("operatorName")}
                  >
                    <div className="flex items-center gap-1">
                      Operator
                      {sortConfig.key === "operatorName" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:text-gray-900"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortConfig.key === "status" &&
                        (sortConfig.direction === "asc" ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                  >
                    Tarif
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExcavators.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6" // Ubah colspan menjadi 6 karena ada kolom status baru
                      className="px-6 py-12 text-center text-gray-600"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-16 w-16 text-gray-400 mb-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <p className="font-medium text-gray-800">
                          Belum ada data excavator
                        </p>
                        <p className="mt-1 text-gray-600">
                          Tambahkan excavator pertama Anda
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredExcavators.map((ex) => (
                    <tr
                      key={ex.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {ex.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {ex.type || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{ex.brand}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {ex.operatorName || "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(
                            ex.status
                          )}`}
                        >
                          {ex.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          <div>
                            Regular: {formatCurrency(ex.regularRatePerHour)}
                          </div>
                          <div>
                            Lembur: {formatCurrency(ex.overtimeRatePerHour)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(ex)}
                            className="text-indigo-600 hover:text-indigo-800 p-1 rounded-full hover:bg-indigo-50"
                            title="Edit excavator"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(ex.id, ex.name)}
                            className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50"
                            title="Hapus excavator"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Floating Add Button (Mobile) */}
      <button
        onClick={openCreateModal}
        className="md:hidden fixed bottom-20 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-colors z-10"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Scroll Indicator for Mobile Tables */}
      <div className="md:hidden text-xs text-gray-500 mt-2 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 mr-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16l-4-4m0 0l4-4m-4 4h18"
          />
        </svg>
        Geser untuk melihat lebih banyak
      </div>
    </div>
  );
}

export default withAuthGuard(ExcavatorPage);
