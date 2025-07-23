"use client";

import { withAuthGuard } from "@/firebase/withAuthGuard";
import { useState, useEffect, useCallback } from "react";
import {
  addDoc,
  collection,
  getDocs,
  Timestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import dayjs from "dayjs";
import {
  Trash2,
  Plus,
  Calendar,
  User,
  Clock,
  DollarSign,
  Check,
  Loader,
  AlertCircle,
  Info,
  HardHat,
} from "lucide-react";

function RentForm() {
  const [renterName, setRenterName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [excavatorList, setExcavatorList] = useState([]);
  const [excavators, setExcavators] = useState([
    {
      excavatorId: "",
      excavatorName: "",
      brand: "",
      type: "",
      operatorName: "",
      regularRatePerHour: 0,
      overtimeRatePerHour: 0,
      startTime: "08:00",
      endTime: "16:00",
      regularHours: 8,
      overtimeHours: 0,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duration, setDuration] = useState(0);
  const [availabilityStatus, setAvailabilityStatus] = useState({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [excavatorStock, setExcavatorStock] = useState({});

  useEffect(() => {
    const fetchExcavators = async () => {
      try {
        setIsCheckingAvailability(true);
        const snapshot = await getDocs(collection(db, "excavators"));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          stock: doc.data().stock || 1,
        }));

        const stockMap = {};
        data.forEach((ex) => {
          stockMap[ex.id] = ex.stock;
        });
        setExcavatorStock(stockMap);

        setExcavatorList(data);
        setIsCheckingAvailability(false);
      } catch (error) {
        console.error("Error fetching excavators:", error);
        setIsCheckingAvailability(false);
      }
    };
    fetchExcavators();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      const start = dayjs(startDate);
      const end = dayjs(endDate);

      if (start.isAfter(end)) {
        setDuration(0);
        setAvailabilityMessage(
          "Tanggal selesai tidak boleh sebelum tanggal mulai"
        );
        return;
      }

      const days = end.diff(start, "day") + 1;
      setDuration(days > 0 ? days : 0);
      setAvailabilityMessage("");
    } else {
      setDuration(0);
    }
  }, [startDate, endDate]);

  const checkAvailability = useCallback(async () => {
    if (!startDate || !endDate || duration <= 0 || !excavatorList.length) {
      setAvailabilityStatus({});
      return;
    }

    setIsCheckingAvailability(true);
    try {
      const start = Timestamp.fromDate(new Date(startDate));
      const end = Timestamp.fromDate(new Date(endDate));

      const q = query(
        collection(db, "rentals"),
        where("rentPeriod.startDate", "<=", end),
        where("rentPeriod.endDate", ">=", start)
      );

      const querySnapshot = await getDocs(q);

      const excavatorRentalCount = {};

      querySnapshot.forEach((doc) => {
        const rental = doc.data();
        rental.excavators.forEach((ex) => {
          if (!excavatorRentalCount[ex.excavatorId]) {
            excavatorRentalCount[ex.excavatorId] = 0;
          }
          excavatorRentalCount[ex.excavatorId] += 1;
        });
      });

      const status = {};
      excavatorList.forEach((ex) => {
        const availableCount =
          (excavatorStock[ex.id] || 1) - (excavatorRentalCount[ex.id] || 0);
        status[ex.id] = availableCount > 0;
      });

      setAvailabilityStatus(status);
      setAvailabilityMessage("Ketersediaan excavator telah diperbarui");
    } catch (error) {
      console.error("Error checking availability:", error);
      setAvailabilityMessage("Gagal memeriksa ketersediaan");
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [startDate, endDate, duration, excavatorList, excavatorStock]);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const handleAddExcavator = () => {
    setExcavators([
      ...excavators,
      {
        excavatorId: "",
        excavatorName: "",
        brand: "",
        type: "",
        operatorName: "",
        regularRatePerHour: 0,
        overtimeRatePerHour: 0,
        startTime: "08:00",
        endTime: "16:00",
        regularHours: 8,
        overtimeHours: 0,
      },
    ]);
  };

  const handleRemoveExcavator = (index) => {
    if (excavators.length > 1) {
      setExcavators(excavators.filter((_, i) => i !== index));
    }
  };

  const calculateTotalCost = () => {
    return excavators.reduce((total, ex) => {
      const regularTotal = ex.regularRatePerHour * ex.regularHours * duration;
      const overtimeTotal =
        ex.overtimeRatePerHour * ex.overtimeHours * duration;
      return total + regularTotal + overtimeTotal;
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (duration <= 0) {
      alert(
        "Tanggal tidak valid. Pastikan tanggal selesai setelah tanggal mulai"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const unavailableExcavators = [];

      excavators.forEach((ex) => {
        if (ex.excavatorId && availabilityStatus[ex.excavatorId] === false) {
          unavailableExcavators.push(ex.excavatorName);
        }
      });

      if (unavailableExcavators.length > 0) {
        const names = unavailableExcavators.join(", ");
        alert(`Excavator berikut tidak tersedia: ${names}`);
        setIsSubmitting(false);
        return;
      }

      const excavatorIds = excavators.map((ex) => ex.excavatorId);
      const uniqueIds = new Set(excavatorIds);
      if (uniqueIds.size !== excavatorIds.length) {
        alert("Tidak dapat menyewa excavator yang sama lebih dari satu kali");
        setIsSubmitting(false);
        return;
      }

      if (excavators.some((ex) => !ex.excavatorId)) {
        alert("Harap pilih excavator untuk semua item");
        setIsSubmitting(false);
        return;
      }

      const rental = {
        renterName,
        rentPeriod: {
          startDate: Timestamp.fromDate(new Date(startDate)),
          endDate: Timestamp.fromDate(new Date(endDate)),
          durationDays: duration,
        },
        excavators: excavators.map((ex) => {
          const totalRegularPay =
            ex.regularRatePerHour * ex.regularHours * duration;
          const totalOvertimePay =
            ex.overtimeRatePerHour * ex.overtimeHours * duration;
          return {
            ...ex,
            totalRegularPay,
            totalOvertimePay,
          };
        }),
        createdAt: Timestamp.now(),
      };

      const rentalRef = await addDoc(collection(db, "rentals"), rental);

      const items = rental.excavators.map((ex) => ({
        excavatorName: ex.excavatorName,
        brand: ex.brand,
        type: ex.type,
        operatorName: ex.operatorName,
        regularRatePerHour: ex.regularRatePerHour,
        overtimeRatePerHour: ex.overtimeRatePerHour,
        regularHours: ex.regularHours,
        overtimeHours: ex.overtimeHours,
        durationDays: duration,
        totalRegularPay: ex.totalRegularPay,
        totalOvertimePay: ex.totalOvertimePay,
        total: ex.totalRegularPay + ex.totalOvertimePay,
      }));

      const invoice = {
        rentalId: rentalRef.id,
        invoiceNumber: `INV-${dayjs().format("YYYYMMDD-HHmmss")}`,
        renterName,
        dateIssued: Timestamp.now(),
        items,
        totalRegularPay: items.reduce((sum, i) => sum + i.totalRegularPay, 0),
        totalOvertimePay: items.reduce((sum, i) => sum + i.totalOvertimePay, 0),
        totalAmount: items.reduce((sum, i) => sum + i.total, 0),
        isPaid: false,
      };

      await addDoc(collection(db, "invoices"), invoice);
      setSuccess(true);

      setTimeout(() => {
        setRenterName("");
        setStartDate("");
        setEndDate("");
        setExcavators([
          {
            excavatorId: "",
            excavatorName: "",
            brand: "",
            type: "",
            operatorName: "",
            regularRatePerHour: 0,
            overtimeRatePerHour: 0,
            startTime: "08:00",
            endTime: "16:00",
            regularHours: 8,
            overtimeHours: 0,
          },
        ]);
        setAvailabilityStatus({});
        setSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Error creating rental:", error);
      alert("Terjadi kesalahan saat menyimpan data");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectExcavator = (idx, excavatorId) => {
    const selected = excavatorList.find((ex) => ex.id === excavatorId);
    if (!selected) return;

    const updated = [...excavators];
    updated[idx] = {
      ...updated[idx],
      excavatorId,
      excavatorName: `${selected.brand} ${selected.name}`,
      brand: selected.brand,
      type: selected.type,
      operatorName: selected.operatorName,
      regularRatePerHour: selected.regularRatePerHour,
      overtimeRatePerHour: selected.overtimeRatePerHour,
    };

    setExcavators(updated);
  };

  const AvailabilityBadge = ({ available, stock }) => (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
          available ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {available ? "Tersedia" : "Tidak Tersedia"}
      </span>
      {stock > 1 && (
        <span className="text-xs text-gray-600">Stok: {stock}</span>
      )}
    </div>
  );

  const formatDate = (dateString) => {
    return dayjs(dateString).format("DD MMM YYYY");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white text-center">
              Form Penyewaan Excavator
            </h1>
            <p className="text-blue-200 text-center mt-2">
              Sistem manajemen ketersediaan excavator
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded-lg flex items-center">
                <Check className="w-6 h-6 mr-2 text-green-600" />
                <span className="font-medium">
                  Penyewaan berhasil disimpan! Invoice telah dibuat.
                </span>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Informasi Penyewa
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Penyewa
                  </label>
                  <input
                    type="text"
                    value={renterName}
                    onChange={(e) => setRenterName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="Masukkan nama penyewa"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    required
                    min={dayjs().format("YYYY-MM-DD")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    required
                    min={startDate || dayjs().format("YYYY-MM-DD")}
                  />
                </div>
              </div>

              {startDate && endDate && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium">
                    <span className="font-bold">Durasi Sewa:</span> {duration}{" "}
                    hari
                    <span className="block mt-1 text-gray-600 text-xs">
                      Periode: {formatDate(startDate)} - {formatDate(endDate)}
                    </span>
                  </p>

                  {isCheckingAvailability ? (
                    <div className="mt-2 flex items-center text-blue-700 text-sm">
                      <Loader className="animate-spin w-4 h-4 mr-2" />
                      Memeriksa ketersediaan excavator...
                    </div>
                  ) : (
                    <div className="mt-2 text-sm">
                      {availabilityMessage && (
                        <p
                          className={
                            duration <= 0 ? "text-red-700" : "text-green-700"
                          }
                        >
                          {availabilityMessage}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Daftar Excavator
                </h2>
                <button
                  type="button"
                  onClick={handleAddExcavator}
                  disabled={isCheckingAvailability}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Excavator
                </button>
              </div>

              <div className="space-y-6">
                {excavators.map((ex, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-xl p-6 ${
                      ex.excavatorId &&
                      availabilityStatus[ex.excavatorId] === false
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Excavator {idx + 1}
                      </h3>
                      {excavators.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveExcavator(idx)}
                          className="text-red-600 hover:text-red-800 transition-colors flex items-center text-sm"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Hapus
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Pilih Excavator
                        </label>
                        <div className="relative">
                          <select
                            value={ex.excavatorId}
                            onChange={(e) =>
                              handleSelectExcavator(idx, e.target.value)
                            }
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors appearance-none"
                            required
                            disabled={isCheckingAvailability}
                          >
                            <option value="">Pilih excavator...</option>
                            {excavatorList.map((ev) => (
                              <option
                                key={ev.id}
                                value={ev.id}
                                disabled={availabilityStatus[ev.id] === false}
                                className={
                                  availabilityStatus[ev.id] === false
                                    ? "text-red-500"
                                    : ""
                                }
                              >
                                {ev.brand} {ev.name} ({ev.type}) -{" "}
                                {ev.operatorName}
                                {availabilityStatus[ev.id] === false &&
                                  " (Tidak Tersedia)"}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg
                              className="fill-current h-4 w-4"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                            </svg>
                          </div>
                        </div>

                        {ex.excavatorId &&
                          availabilityStatus[ex.excavatorId] !== undefined && (
                            <div className="mt-2 flex items-center">
                              <AvailabilityBadge
                                available={availabilityStatus[ex.excavatorId]}
                                stock={excavatorStock[ex.excavatorId] || 1}
                              />
                              {!availabilityStatus[ex.excavatorId] && (
                                <span className="ml-2 text-sm text-red-600 flex items-center">
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  Tidak tersedia pada periode ini
                                </span>
                              )}
                            </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <DollarSign className="w-4 h-4 mr-1 text-gray-600" />
                            Tarif Reguler
                          </label>
                          <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg">
                            <p className="text-gray-800 font-medium">
                              Rp {ex.regularRatePerHour.toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <DollarSign className="w-4 h-4 mr-1 text-gray-600" />
                            Tarif Lembur
                          </label>
                          <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg">
                            <p className="text-gray-800 font-medium">
                              Rp{" "}
                              {ex.overtimeRatePerHour.toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Jam Reguler / Hari
                        </label>
                        <input
                          type="number"
                          value={ex.regularHours}
                          onChange={(e) => {
                            const updated = [...excavators];
                            updated[idx].regularHours = Number(e.target.value);
                            setExcavators(updated);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                          min="0"
                          max="24"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Jam Lembur / Hari
                        </label>
                        <input
                          type="number"
                          value={ex.overtimeHours}
                          onChange={(e) => {
                            const updated = [...excavators];
                            updated[idx].overtimeHours = Number(e.target.value);
                            setExcavators(updated);
                          }}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                          min="0"
                          max="16"
                          required
                        />
                      </div>
                    </div>

                    {ex.excavatorId && (
                      <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-blue-700 font-medium mb-1">
                              Brand
                            </p>
                            <p className="text-sm font-semibold text-blue-900">
                              {ex.brand}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-700 font-medium mb-1">
                              Tipe
                            </p>
                            <p className="text-sm font-semibold text-blue-900">
                              {ex.type}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-700 font-medium mb-1 flex items-center">
                              <HardHat className="w-4 h-4 mr-1" />
                              Operator
                            </p>
                            <p className="text-sm font-semibold text-blue-900">
                              {ex.operatorName}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-blue-100">
                          <p className="text-sm text-blue-800 font-medium mb-1">
                            Estimasi Biaya per Hari:
                          </p>
                          <p className="text-lg font-bold text-blue-900">
                            Rp{" "}
                            {(
                              ex.regularRatePerHour * ex.regularHours +
                              ex.overtimeRatePerHour * ex.overtimeHours
                            ).toLocaleString("id-ID")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {startDate &&
              endDate &&
              duration > 0 &&
              excavators.some((ex) => ex.regularRatePerHour > 0) && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200">
                    Ringkasan Biaya Penyewaan
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-5 text-center border border-gray-200">
                      <p className="text-sm text-gray-700 mb-1">Durasi Sewa</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {duration} hari
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-5 text-center border border-gray-200">
                      <p className="text-sm text-gray-700 mb-1">
                        Jumlah Excavator
                      </p>
                      <p className="text-2xl font-bold text-gray-900">
                        {excavators.length}
                      </p>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-5 text-center border border-blue-200">
                      <p className="text-sm text-blue-700 mb-1">Total Biaya</p>
                      <p className="text-2xl font-bold text-blue-900">
                        Rp {calculateTotalCost().toLocaleString("id-ID")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 flex items-start">
                      <Info className="w-5 h-5 mr-2 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span>
                        Pastikan semua excavator tersedia sebelum menyimpan.
                        Excavator yang tidak tersedia akan ditandai dengan latar
                        belakang merah.
                        <br />
                        <span className="font-semibold">Catatan:</span> Setiap
                        excavator memiliki stok terbatas. Sistem akan memeriksa
                        ketersediaan berdasarkan stok yang tersedia.
                      </span>
                    </p>
                  </div>
                </div>
              )}

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={
                  isSubmitting || isCheckingAvailability || duration <= 0
                }
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-4 px-6 rounded-lg font-bold transition-colors flex items-center justify-center shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="animate-spin mr-2" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Penyewaan"
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRenterName("");
                  setStartDate("");
                  setEndDate("");
                  setExcavators([
                    {
                      excavatorId: "",
                      excavatorName: "",
                      brand: "",
                      type: "",
                      operatorName: "",
                      regularRatePerHour: 0,
                      overtimeRatePerHour: 0,
                      startTime: "08:00",
                      endTime: "16:00",
                      regularHours: 8,
                      overtimeHours: 0,
                    },
                  ]);
                  setAvailabilityStatus({});
                }}
                className="px-6 py-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Reset Form
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>© 2024 PT Excavator Indonesia. Sistem Penyewaan Alat Berat.</p>
        </div>
      </div>
    </div>
  );
}

export default withAuthGuard(RentForm);
