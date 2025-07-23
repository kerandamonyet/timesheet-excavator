"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/firebase/config";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import {
  Calendar,
  User,
  Wrench,
  FileText,
  CreditCard,
  Clock,
  DollarSign,
  Loader,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Building,
  HardHat,
  Timer,
  Plus,
  Phone,
  Mail,
  Edit,
  Trash2,
} from "lucide-react";

import EditRentalForm from "@/components/EditRentalForm";
import Swal from "sweetalert2";

const RentalPage = () => {
  const [rentals, setRentals] = useState([]);
  const [invoices, setInvoices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [showDetails, setShowDetails] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRental, setEditingRental] = useState(null);

  const router = useRouter();

  const fetchRentalData = async () => {
    try {
      setLoading(true);
      const rentalsCollectionRef = collection(db, "rentals");
      const rentalsSnapshot = await getDocs(rentalsCollectionRef);
      const rentalsList = rentalsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRentals(rentalsList);

      const invoicesData = {};
      for (const rental of rentalsList) {
        const invoicesRef = collection(db, "invoices");
        const invoiceQuerySnapshot = await getDocs(invoicesRef);
        const invoiceDoc = invoiceQuerySnapshot.docs.find(
          (invDoc) => invDoc.data().rentalId === rental.id
        );

        if (invoiceDoc) {
          invoicesData[rental.id] = {
            id: invoiceDoc.id,
            ...invoiceDoc.data(),
          };
        }
      }
      setInvoices(invoicesData);
    } catch (err) {
      console.error("Error fetching data: ", err);
      setError("Gagal memuat data sewa. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentalData();
  }, []);

  const toggleExpanded = (rentalId) => {
    setExpandedCard(expandedCard === rentalId ? null : rentalId);
  };

  const toggleDetails = (rentalId, section) => {
    setShowDetails((prev) => ({
      ...prev,
      [`${rentalId}-${section}`]: !prev[`${rentalId}-${section}`],
    }));
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp.seconds * 1000).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      completed: { color: "bg-blue-100 text-blue-800", icon: CheckCircle },
      cancelled: { color: "bg-red-100 text-red-800", icon: XCircle },
      pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
    };
    const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        <Icon className="w-3 h-3 mr-1" />
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending"}
      </span>
    );
  };

  const getPaymentStatusBadge = (isPaid) => (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isPaid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {isPaid ? (
        <CheckCircle className="w-3 h-3 mr-1" />
      ) : (
        <XCircle className="w-3 h-3 mr-1" />
      )}
      {isPaid ? "Lunas" : "Belum Lunas"}
    </span>
  );

  const filteredRentals = rentals.filter((rental) =>
    rental.renterName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Perbaikan fungsi handleDelete
  const handleDelete = async (rental) => {
    const result = await Swal.fire({
      title: `Hapus Data Sewa?`,
      html: `
        <div class="text-left">
          <p><strong>Penyewa:</strong> ${rental.renterName}</p>
          <p><strong>ID:</strong> ${rental.id?.slice(-8) || "N/A"}</p>
          <p class="text-red-600 mt-3">Data yang dihapus tidak dapat dikembalikan!</p>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Ya, Hapus!",
      cancelButtonText: "Batal",
      focusCancel: true,
    });

    if (result.isConfirmed) {
      try {
        // Show loading state
        Swal.fire({
          title: "Menghapus...",
          text: "Sedang menghapus data sewa",
          icon: "info",
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // Delete related invoice first if exists
        if (invoices[rental.id]) {
          await deleteDoc(doc(db, "invoices", invoices[rental.id].id));
        }

        // Delete the rental
        await deleteDoc(doc(db, "rentals", rental.id));

        // Update local state
        setRentals((prevRentals) =>
          prevRentals.filter((r) => r.id !== rental.id)
        );

        // Update invoices state
        setInvoices((prevInvoices) => {
          const newInvoices = { ...prevInvoices };
          delete newInvoices[rental.id];
          return newInvoices;
        });

        // Close expanded card if it was the deleted one
        if (expandedCard === rental.id) {
          setExpandedCard(null);
        }

        // Success message
        Swal.fire({
          icon: "success",
          title: "Terhapus!",
          text: `Data sewa ${rental.renterName} berhasil dihapus`,
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (error) {
        console.error("Error deleting rental:", error);
        Swal.fire({
          icon: "error",
          title: "Gagal Menghapus",
          text: "Terjadi kesalahan saat menghapus data sewa. Silakan coba lagi.",
          confirmButtonText: "OK",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Terjadi Kesalahan
          </h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                <Wrench className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 mr-3" />
                Daftar Sewa Alat Berat
              </h1>
              <p className="text-gray-600 mt-2">
                Total {filteredRentals.length} sewa ditemukan
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Cari nama penyewa..."
                className="w-full text-black sm:w-64 px-4 py-2 border rounded-lg shadow-sm text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                onClick={() => router.push("/rents/create")}
                className="inline-flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4 mr-1" /> Tambah
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {filteredRentals.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Wrench className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {rentals.length === 0 ? "Belum Ada Data Sewa" : "Tidak Ada Hasil"}
            </h3>
            <p className="text-gray-600">
              {rentals.length === 0
                ? "Belum ada data sewa alat berat yang tersedia."
                : `Tidak ditemukan data sewa dengan kata kunci "${searchTerm}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {filteredRentals.map((rental) => (
              <div
                key={rental.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Header Card */}
                <div className="p-4 sm:p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      {/* Renter Name and Status Row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-bold text-gray-900 truncate mb-1">
                              {rental.renterName}
                            </h2>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(rental.status)}
                              <span className="text-sm text-gray-500">
                                ID: {rental.id?.slice(-8) || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                              Telepon
                            </p>
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {rental.renterNoHP}
                            </p>
                          </div>
                        </div>

                        {rental.renterEmail && (
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                                Email
                              </p>
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {rental.renterEmail}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Rental Period Information */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg flex-1">
                          <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">
                              Periode Sewa
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDate(rental.rentPeriod.startDate)} -{" "}
                              {formatDate(rental.rentPeriod.endDate)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg sm:w-auto">
                          <Clock className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-green-600 uppercase tracking-wide font-medium">
                              Durasi
                            </p>
                            <p className="text-sm font-bold text-gray-900">
                              {rental.rentPeriod.durationDays} hari
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleExpanded(rental.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-700 transition-all duration-200 shadow-sm"
                      >
                        {expandedCard === rental.id ? (
                          <>
                            <EyeOff className="w-4 h-4" />
                            <span className="hidden sm:inline">Tutup</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            <span className="hidden sm:inline">Detail</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setEditingRental(rental)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <Edit className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      <button
                        onClick={() => handleDelete(rental)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedCard === rental.id && (
                  <div className="p-4 sm:p-6 space-y-6">
                    {/* Excavator Section */}
                    <div className="border border-gray-200 rounded-lg">
                      <button
                        onClick={() => toggleDetails(rental.id, "excavators")}
                        className="w-full text-black flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center">
                          <Wrench className="w-5 h-5 text-blue-600 mr-3" />
                          <h3 className="text-lg font-semibold text-gray-900">
                            Detail Alat ({rental.excavators?.length || 0})
                          </h3>
                        </div>
                        {showDetails[`${rental.id}-excavators`] ? (
                          <EyeOff className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {showDetails[`${rental.id}-excavators`] && (
                        <div className="border-t border-gray-100 p-4">
                          {rental.excavators && rental.excavators.length > 0 ? (
                            <div className="space-y-4">
                              {rental.excavators.map((excavator, index) => (
                                <div
                                  key={index}
                                  className="bg-gray-50 rounded-lg p-4 space-y-3"
                                >
                                  {/* Mobile Layout */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex items-center mb-2">
                                        <Building className="w-4 h-4 text-gray-500 mr-2" />
                                        <span className="font-medium text-gray-900">
                                          {excavator.excavatorName}
                                        </span>
                                      </div>
                                      <div className="text-sm text-gray-600 space-y-1">
                                        <div>Brand: {excavator.brand}</div>
                                        <div>Tipe: {excavator.type}</div>
                                        <div className="flex items-center">
                                          <HardHat className="w-3 h-3 mr-1" />
                                          Operator: {excavator.operatorName}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-2">
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <div className="text-gray-500 flex items-center">
                                            <Clock className="w-3 h-3 mr-1" />
                                            Jam Reguler
                                          </div>
                                          <div className="font-medium">
                                            {excavator.regularHours} jam
                                          </div>
                                          <div className="text-gray-600">
                                            {formatCurrency(
                                              excavator.regularRatePerHour
                                            )}
                                            /jam
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-gray-500 flex items-center">
                                            <Timer className="w-3 h-3 mr-1" />
                                            Jam Lembur
                                          </div>
                                          <div className="font-medium">
                                            {excavator.overtimeHours} jam
                                          </div>
                                          <div className="text-gray-600">
                                            {formatCurrency(
                                              excavator.overtimeRatePerHour
                                            )}
                                            /jam
                                          </div>
                                        </div>
                                      </div>

                                      <div className="border-t border-gray-200 pt-2">
                                        <div className="flex justify-between items-center">
                                          <span className="text-sm text-gray-600">
                                            Total:
                                          </span>
                                          <span className="font-bold text-blue-600">
                                            {formatCurrency(
                                              excavator.totalRegularPay +
                                                excavator.totalOvertimePay
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Wrench className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                              <p>Tidak ada alat yang disewa</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Invoice Section */}
                    {invoices[rental.id] && (
                      <div className="border border-gray-200 rounded-lg">
                        <button
                          onClick={() => toggleDetails(rental.id, "invoice")}
                          className="w-full text-black flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center">
                            <FileText className="w-5 h-5 text-green-600 mr-3" />
                            <div className="text-left">
                              <h3 className="text-lg font-semibold text-gray-900">
                                Invoice
                              </h3>
                              <p className="text-sm text-gray-600">
                                {invoices[rental.id].invoiceNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {getPaymentStatusBadge(invoices[rental.id].isPaid)}
                            {showDetails[`${rental.id}-invoice`] ? (
                              <EyeOff className="w-5 h-5 text-gray-400" />
                            ) : (
                              <Eye className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {showDetails[`${rental.id}-invoice`] && (
                          <div className="border-t border-gray-100 p-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-600">
                                  Tanggal Terbit
                                </div>
                                <div className="font-medium text-black">
                                  {formatDate(invoices[rental.id].dateIssued)}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-600">
                                  Status Pembayaran
                                </div>
                                <div className="mt-1">
                                  {getPaymentStatusBadge(
                                    invoices[rental.id].isPaid
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="font-medium text-gray-900">
                                Item Invoice:
                              </h4>
                              {invoices[rental.id].items.map((item, index) => (
                                <div
                                  key={index}
                                  className="bg-gray-50 rounded-lg p-3"
                                >
                                  <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">
                                        {item.excavatorName}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {item.type} • Operator:{" "}
                                        {item.operatorName}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        Durasi: {item.durationDays} hari
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="font-bold text-gray-900">
                                        {formatCurrency(item.total)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="border-t border-gray-200 pt-4">
                              <div className="flex justify-between items-center">
                                <span className="text-lg font-semibold text-gray-900">
                                  Total Pembayaran:
                                </span>
                                <span className="text-xl font-bold text-blue-600">
                                  {formatCurrency(
                                    invoices[rental.id].totalAmount
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {!invoices[rental.id] && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="text-center py-4">
                          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                          <h3 className="font-medium text-gray-900 mb-1">
                            Belum Ada Invoice
                          </h3>
                          <p className="text-sm text-gray-600">
                            Invoice untuk sewa ini belum dibuat.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {editingRental && (
        <EditRentalForm
          rental={editingRental}
          onClose={() => setEditingRental(null)}
          onSave={() => {
            setEditingRental(null);
            fetchRentalData(); // Gunakan fetchRentalData() yang sudah ada
          }}
        />
      )}
    </div>
  );
};

export default RentalPage;
