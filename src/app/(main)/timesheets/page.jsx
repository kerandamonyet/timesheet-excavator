"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/firebase/config";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Clock,
  CalendarDays,
  HardHat,
  AlertTriangle,
} from "lucide-react";

// Komponen Modal
const Modal = ({ show, onClose, children, size = "md" }) => {
  if (!show) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div
        className={`bg-white rounded-xl shadow-lg w-full ${sizeClasses[size]} animate-fade-in`}
      >
        {children}
      </div>
    </div>
  );
};

// Komponen TimesheetForm
const TimesheetForm = ({
  onSubmit,
  title,
  form,
  setForm,
  error,
  excavators,
  onClose,
}) => (
  <>
    <div className="flex justify-between items-center p-4 border-b">
      <h2 className="text-xl font-bold text-gray-800">{title}</h2>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-700 transition-colors"
      >
        <X size={24} />
      </button>
    </div>
    <div className="p-6 text-gray-800">
      <form onSubmit={onSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <HardHat size={16} /> Pilih Excavator
          </label>
          <select
            required
            className="input w-full text-gray-800"
            value={form.excavatorId}
            onChange={(e) => setForm({ ...form, excavatorId: e.target.value })}
          >
            <option value="" className="text-gray-500">
              Pilih Excavator
            </option>
            {excavators.map((ex) => (
              <option key={ex.id} value={ex.id} className="text-gray-800">
                {ex.brand} {ex.name} ({ex.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
            <CalendarDays size={16} /> Tanggal
          </label>
          <input
            required
            type="date"
            className="input w-full text-gray-800"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Clock size={16} /> Jam Mulai
            </label>
            <input
              required
              type="time"
              className="input w-full text-gray-800"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
              <Clock size={16} /> Jam Selesai
            </label>
            <input
              required
              type="time"
              className="input w-full text-gray-800"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 flex items-center justify-center gap-2 text-white"
          >
            <Plus className="w-4 h-4" /> Simpan
          </button>
        </div>
      </form>
    </div>
  </>
);

// Komponen DeleteConfirmation
const DeleteConfirmation = ({ onClose, onDelete, currentTimesheet }) => (
  <>
    <div className="flex justify-between items-center p-4 border-b">
      <h2 className="text-xl font-bold text-gray-800">Hapus Absensi</h2>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-gray-700 transition-colors"
      >
        <X size={24} />
      </button>
    </div>
    <div className="p-6 text-gray-800">
      <div className="flex flex-col items-center text-center">
        <div className="bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle className="text-red-600" size={32} />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          Anda yakin ingin menghapus data ini?
        </h3>

        <div className="bg-gray-50 rounded-lg p-4 w-full text-left mb-6">
          <p className="font-semibold text-gray-800">
            {currentTimesheet?.excavatorName}
          </p>
          <p className="text-gray-600 text-sm">
            Tanggal: {currentTimesheet?.date}
          </p>
          <p className="text-gray-600 text-sm">
            Jam: {currentTimesheet?.startTime} - {currentTimesheet?.endTime}
          </p>
          <p className="text-red-600 font-bold mt-2">
            Total: Rp{currentTimesheet?.totalPay?.toLocaleString()}
          </p>
        </div>

        <p className="text-gray-600 mb-6">
          Data yang dihapus tidak dapat dikembalikan. Pastikan Anda tidak salah
          memilih data.
        </p>

        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="btn-secondary flex-1">
            Batalkan
          </button>
          <button
            onClick={onDelete}
            className="btn-danger flex-1 flex items-center justify-center gap-2"
          >
            <Trash2 size={18} /> Hapus
          </button>
        </div>
      </div>
    </div>
  </>
);

// Komponen EmptyState
const EmptyState = ({ onCreate }) => (
  <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed border-gray-200">
    <div className="mx-auto bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
      <Clock size={32} className="text-indigo-600" />
    </div>
    <h3 className="text-lg font-medium text-gray-800 mb-2">
      Belum ada data absensi
    </h3>
    <p className="text-gray-600 mb-4">
      Mulai dengan menambahkan data absensi baru
    </p>
    <button
      onClick={onCreate}
      className="btn-primary flex items-center gap-2 mx-auto"
    >
      <Plus size={18} /> Tambah Absensi
    </button>
  </div>
);

// Fungsi utilitas
const calculateHours = (start, end) => {
  const startDate = new Date(`1970-01-01T${start}:00`);
  const endDate = new Date(`1970-01-01T${end}:00`);
  const diff = (endDate - startDate) / (1000 * 60 * 60);
  const workHours = diff > 8 ? 8 : diff;
  const overtimeHours = diff > 8 ? diff - 8 : 0;
  return { workHours, overtimeHours, totalWorks: diff };
};

const formatDate = (dateString) => {
  const options = { day: "2-digit", month: "long", year: "numeric" };
  return new Date(dateString).toLocaleDateString("id-ID", options);
};

export default function TimesheetPage() {
  const [excavators, setExcavators] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentTimesheet, setCurrentTimesheet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    excavatorId: "",
    date: "",
    startTime: "",
    endTime: "",
  });

  // Menggunakan useCallback untuk fungsi yang dipanggil di useEffect
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [excavatorsSnapshot, timesheetsSnapshot] = await Promise.all([
        getDocs(collection(db, "excavators")),
        getDocs(query(collection(db, "timesheets"), orderBy("date", "desc"))),
      ]);

      setExcavators(
        excavatorsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setTimesheets(
        timesheetsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
      setLoading(false);
    } catch (err) {
      setError("Gagal memuat data. Silakan coba lagi.");
      setLoading(false);
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fungsi generik untuk menangani create dan update
  const handleSubmit = async (e, isEdit = false) => {
    e.preventDefault();

    try {
      const ex = excavators.find((e) => e.id === form.excavatorId);
      if (!ex) {
        setError("Excavator tidak ditemukan");
        return;
      }

      const { workHours, overtimeHours, totalWorks } = calculateHours(
        form.startTime,
        form.endTime
      );

      const totalRegularPay = workHours * ex.regularRatePerHour;
      const totalOvertimePay = overtimeHours * ex.overtimeRatePerHour;
      const totalPay = totalRegularPay + totalOvertimePay;

      const timesheetData = {
        excavatorId: ex.id,
        excavatorName: `${ex.brand} ${ex.name}`,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        workHours,
        overtimeHours,
        totalWorks,
        totalRegularPay,
        totalOvertimePay,
        totalPay,
        updatedAt: Timestamp.now(),
      };

      if (isEdit && currentTimesheet) {
        await updateDoc(
          doc(db, "timesheets", currentTimesheet.id),
          timesheetData
        );
      } else {
        await addDoc(collection(db, "timesheets"), {
          ...timesheetData,
          createdAt: Timestamp.now(),
        });
      }

      resetForm();
      setShowCreateModal(false);
      setShowEditModal(false);
      fetchData();
      setError("");
    } catch (err) {
      setError(
        `Gagal ${isEdit ? "mengupdate" : "menyimpan"} data. Silakan coba lagi.`
      );
      console.error(err);
    }
  };

  const handleDelete = async () => {
    try {
      if (!currentTimesheet) return;

      await deleteDoc(doc(db, "timesheets", currentTimesheet.id));
      setShowDeleteModal(false);
      fetchData();
    } catch (err) {
      setError("Gagal menghapus data. Silakan coba lagi.");
      console.error(err);
    }
  };

  const resetForm = () => {
    setForm({
      excavatorId: "",
      date: "",
      startTime: "",
      endTime: "",
    });
    setError("");
  };

  const openEditModal = (timesheet) => {
    setCurrentTimesheet(timesheet);
    setForm({
      excavatorId: timesheet.excavatorId,
      date: timesheet.date,
      startTime: timesheet.startTime,
      endTime: timesheet.endTime,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (timesheet) => {
    setCurrentTimesheet(timesheet);
    setShowDeleteModal(true);
  };

  const closeCreateModal = () => {
    resetForm();
    setShowCreateModal(false);
  };

  const closeEditModal = () => {
    resetForm();
    setShowEditModal(false);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2">
            <HardHat className="text-indigo-600" /> Timesheet Excavator
          </h1>
          <p className="text-gray-600 mt-1">
            Kelola data absensi dan timesheet excavator
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="btn-primary flex items-center gap-2 px-4 py-2.5"
        >
          <Plus size={18} /> Tambah Absensi
        </button>
      </div>

      {/* Modal Create */}
      <Modal show={showCreateModal} size="md">
        <TimesheetForm
          onSubmit={(e) => handleSubmit(e, false)}
          title="Tambah Absensi Baru"
          form={form}
          setForm={setForm}
          error={error}
          excavators={excavators}
          onClose={closeCreateModal}
        />
      </Modal>

      {/* Modal Edit */}
      <Modal show={showEditModal} size="md">
        <TimesheetForm
          onSubmit={(e) => handleSubmit(e, true)}
          title="Edit Absensi"
          form={form}
          setForm={setForm}
          error={error}
          excavators={excavators}
          onClose={closeEditModal}
        />
      </Modal>

      {/* Modal Delete */}
      <Modal show={showDeleteModal} size="sm">
        <DeleteConfirmation
          onClose={closeDeleteModal}
          onDelete={handleDelete}
          currentTimesheet={currentTimesheet}
        />
      </Modal>

      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex justify-between items-center pb-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            Riwayat Absensi
          </h2>
          <span className="text-sm text-gray-500">
            {timesheets.length} entri
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-gray-600">Memuat data...</p>
          </div>
        ) : timesheets.length === 0 ? (
          <EmptyState onCreate={() => setShowCreateModal(true)} />
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left text-gray-700 font-medium text-sm uppercase tracking-wider">
                    Excavator
                  </th>
                  <th className="py-3 px-4 text-left text-gray-700 font-medium text-sm uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="py-3 px-4 text-left text-gray-700 font-medium text-sm uppercase tracking-wider">
                    Jam Kerja
                  </th>
                  <th className="py-3 px-4 text-left text-gray-700 font-medium text-sm uppercase tracking-wider">
                    Total Jam
                  </th>
                  <th className="py-3 px-4 text-left text-gray-700 font-medium text-sm uppercase tracking-wider">
                    Upah (Rp)
                  </th>
                  <th className="py-3 px-4 text-right text-gray-700 font-medium text-sm uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {timesheets.map((ts) => (
                  <tr
                    key={ts.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <p className="font-semibold text-gray-800">
                        {ts.excavatorName}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-gray-700">
                      {formatDate(ts.date)}
                    </td>
                    <td className="py-4 px-4 text-gray-700">
                      <div className="flex items-center gap-1">
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {ts.startTime}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                          {ts.endTime}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700">
                      <div className="flex flex-col">
                        <span>
                          <span className="font-medium">{ts.workHours}</span>{" "}
                          jam kerja
                        </span>
                        <span>
                          <span className="text-amber-600 font-medium">
                            {ts.overtimeHours}
                          </span>{" "}
                          jam lembur
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <span className="text-green-600 font-medium">
                            {ts.totalRegularPay?.toLocaleString()}
                          </span>
                          <span className="text-gray-400 text-xs">reguler</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-amber-600 font-medium">
                            {ts.totalOvertimePay?.toLocaleString()}
                          </span>
                          <span className="text-gray-400 text-xs">lembur</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="font-bold text-gray-800">
                            Total:
                          </span>
                          <span className="text-indigo-700 font-bold">
                            {ts.totalPay?.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(ts)}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium p-2 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(ts)}
                          className="text-red-600 hover:text-red-800 flex items-center gap-1 font-medium p-2 rounded-lg hover:bg-red-50 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        .input {
          display: block;
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          background-color: #fff;
          transition: border-color 0.2s;
          font-size: 0.9rem;
        }
        .input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .btn-primary {
          background-color: #4f46e5;
          color: white;
          border: none;
          border-radius: 0.5rem;
          padding: 0.75rem 1.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-primary:hover {
          background-color: #4338ca;
        }
        .btn-secondary {
          background-color: #f1f5f9;
          color: #334155;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.75rem 1.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-secondary:hover {
          background-color: #e2e8f0;
        }
        .btn-danger {
          background-color: #ef4444;
          color: white;
          border: none;
          border-radius: 0.5rem;
          padding: 0.75rem 1.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .btn-danger:hover {
          background-color: #dc2626;
        }
      `}</style>
    </div>
  );
}
