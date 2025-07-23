// components/EditRentalForm.jsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Timestamp,
  updateDoc,
  doc,
  writeBatch,
  query,
  where,
  collection,
  getDocs,
} from "firebase/firestore";
import { db } from "@/firebase/config";
import {
  Calendar,
  Loader,
  X,
  AlertCircle,
  User,
  Mail,
  Phone,
  Save,
  Clock,
  DollarSign,
  HardHat,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import Swal from "sweetalert2";

// --- Constants ---
const LIMITS = {
  MIN_RENTER_NAME_LENGTH: 3,
  MAX_RENTER_NAME_LENGTH: 100,
  MIN_PHONE_LENGTH: 9,
  MAX_PHONE_LENGTH: 13,
};

// --- Utility Functions ---
const normalizePhoneNumber = (phone) => {
  if (!phone) return phone;
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("62")) {
    return "0" + cleaned.substring(2);
  }
  return cleaned;
};

const validatePhoneNumber = (phone) => {
  const normalized = normalizePhoneNumber(phone);
  return (
    normalized.length >= LIMITS.MIN_PHONE_LENGTH &&
    normalized.length <= LIMITS.MAX_PHONE_LENGTH &&
    normalized.startsWith("0")
  );
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return dayjs(date).format("YYYY-MM-DD");
};

// --- Additional Constants ---
const WORK_LIMITS = {
  MAX_REGULAR_HOURS: 24,
  MAX_OVERTIME_HOURS: 16,
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

// --- Zod Schema ---
const excavatorWorkSchema = z.object({
  excavatorId: z.string(),
  excavatorName: z.string(),
  brand: z.string(),
  type: z.string(),
  operatorName: z.string(),
  regularRatePerHour: z.number().min(0),
  overtimeRatePerHour: z.number().min(0),
  regularHours: z
    .number()
    .min(0, "Jam reguler tidak boleh negatif")
    .max(
      WORK_LIMITS.MAX_REGULAR_HOURS,
      `Jam reguler maksimal ${WORK_LIMITS.MAX_REGULAR_HOURS}`
    ),
  overtimeHours: z
    .number()
    .min(0, "Jam lembur tidak boleh negatif")
    .max(
      WORK_LIMITS.MAX_OVERTIME_HOURS,
      `Jam lembur maksimal ${WORK_LIMITS.MAX_OVERTIME_HOURS}`
    ),
});

const editRentalSchema = z
  .object({
    renterName: z
      .string()
      .min(
        LIMITS.MIN_RENTER_NAME_LENGTH,
        `Nama penyewa minimal ${LIMITS.MIN_RENTER_NAME_LENGTH} karakter`
      )
      .max(
        LIMITS.MAX_RENTER_NAME_LENGTH,
        `Nama penyewa maksimal ${LIMITS.MAX_RENTER_NAME_LENGTH} karakter`
      )
      .trim(),
    renterNoHP: z
      .string()
      .refine(validatePhoneNumber, "Format nomor telepon tidak valid")
      .transform(normalizePhoneNumber),
    renterEmail: z
      .string()
      .email("Format email tidak valid")
      .optional()
      .or(z.literal("")),
    startDate: z
      .string()
      .min(1, "Tanggal mulai harus diisi")
      .refine((date) => dayjs(date).isValid(), "Format tanggal tidak valid"),
    endDate: z
      .string()
      .min(1, "Tanggal selesai harus diisi")
      .refine((date) => dayjs(date).isValid(), "Format tanggal tidak valid"),
    excavators: z.array(excavatorWorkSchema).min(1, "Minimal satu excavator"),
  })
  .refine(
    (data) => {
      const start = dayjs(data.startDate);
      const end = dayjs(data.endDate);
      return end.isAfter(start) || end.isSame(start);
    },
    {
      message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
      path: ["endDate"],
    }
  );

// --- Main Component ---
const EditRentalForm = ({ rental, onClose, onSave }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [hasConflict, setHasConflict] = useState(false);

  // Form setup with validation
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isValid, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(editRentalSchema),
    mode: "onChange",
    defaultValues: {
      renterName: rental?.renterName || "",
      renterNoHP: rental?.renterNoHP || "",
      renterEmail: rental?.renterEmail || "",
      startDate: formatDate(rental?.rentPeriod?.startDate),
      endDate: formatDate(rental?.rentPeriod?.endDate),
      excavators:
        rental?.excavators?.map((ex) => ({
          excavatorId: ex.excavatorId || "",
          excavatorName: ex.excavatorName || "",
          brand: ex.brand || "",
          type: ex.type || "",
          operatorName: ex.operatorName || "",
          regularRatePerHour: ex.regularRatePerHour || 0,
          overtimeRatePerHour: ex.overtimeRatePerHour || 0,
          regularHours: ex.regularHours || 8,
          overtimeHours: ex.overtimeHours || 0,
        })) || [],
    },
  });

  // useFieldArray for managing excavators
  const { fields, append, remove } = useFieldArray({
    control,
    name: "excavators",
  });

  const watchedValues = watch();
  const { startDate, endDate, excavators } = watchedValues;

  // Calculate duration and total cost
  const duration = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (start.isAfter(end)) return 0;
    return end.diff(start, "day") + 1;
  }, [startDate, endDate]);

  const totalCost = useMemo(() => {
    if (!excavators || !Array.isArray(excavators) || duration <= 0) return 0;
    return excavators.reduce((total, ex) => {
      const regularTotal =
        (ex.regularRatePerHour || 0) * (ex.regularHours || 0) * duration;
      const overtimeTotal =
        (ex.overtimeRatePerHour || 0) * (ex.overtimeHours || 0) * duration;
      return total + regularTotal + overtimeTotal;
    }, 0);
  }, [excavators, duration]);

  // Calculate original duration for comparison
  const originalDuration = useMemo(() => {
    if (!rental?.rentPeriod) return 0;
    return (
      dayjs(rental.rentPeriod.endDate.toDate()).diff(
        dayjs(rental.rentPeriod.startDate.toDate()),
        "day"
      ) + 1
    );
  }, [rental?.rentPeriod]);

  const originalTotalCost = useMemo(() => {
    if (
      !rental?.excavators ||
      !Array.isArray(rental.excavators) ||
      originalDuration <= 0
    )
      return 0;
    return rental.excavators.reduce((total, ex) => {
      const regularTotal =
        (ex.regularRatePerHour || 0) *
        (ex.regularHours || 0) *
        originalDuration;
      const overtimeTotal =
        (ex.overtimeRatePerHour || 0) *
        (ex.overtimeHours || 0) *
        originalDuration;
      return total + regularTotal + overtimeTotal;
    }, 0);
  }, [rental?.excavators, originalDuration]);

  // Check for rental conflicts
  const checkAvailability = useCallback(async () => {
    if (!startDate || !endDate || duration <= 0 || !rental?.id) {
      setHasConflict(false);
      setAvailabilityMessage("");
      return;
    }

    setIsCheckingAvailability(true);
    try {
      const startTimestamp = Timestamp.fromDate(new Date(startDate));
      const endTimestamp = Timestamp.fromDate(new Date(endDate));

      // Check for overlapping rentals (excluding current rental)
      const q = query(
        collection(db, "rentals"),
        where("rentPeriod.startDate", "<=", endTimestamp),
        where("rentPeriod.endDate", ">=", startTimestamp),
        where("status", "==", "aktif")
      );

      const querySnapshot = await getDocs(q);
      const conflictingRentals = [];

      querySnapshot.forEach((doc) => {
        const rentalData = doc.data();

        // Skip current rental
        if (doc.id === rental.id) return;

        // Check if any excavator conflicts
        const currentExcavatorIds =
          rental.excavators?.map((ex) => ex.excavatorId) || [];
        const hasExcavatorConflict = rentalData.excavators?.some((ex) =>
          currentExcavatorIds.includes(ex.excavatorId)
        );

        if (hasExcavatorConflict) {
          conflictingRentals.push({
            id: doc.id,
            renterName: rentalData.renterName,
            startDate: rentalData.rentPeriod.startDate.toDate(),
            endDate: rentalData.rentPeriod.endDate.toDate(),
          });
        }
      });

      if (conflictingRentals.length > 0) {
        setHasConflict(true);
        const conflictList = conflictingRentals
          .map(
            (rental) =>
              `${rental.renterName} (${dayjs(rental.startDate).format(
                "DD/MM/YYYY"
              )} - ${dayjs(rental.endDate).format("DD/MM/YYYY")})`
          )
          .join(", ");
        setAvailabilityMessage(`Konflik dengan penyewaan: ${conflictList}`);
      } else {
        setHasConflict(false);
        setAvailabilityMessage("Tidak ada konflik penjadwalan.");
      }
    } catch (error) {
      console.error("Error checking availability:", error);
      setAvailabilityMessage("Gagal memeriksa ketersediaan.");
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [startDate, endDate, duration, rental?.id, rental?.excavators]);

  // Check availability with debounce
  useEffect(() => {
    const timeoutId = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timeoutId);
  }, [checkAvailability]);

  // Handle form submission
  const onSubmit = async (data) => {
    if (hasConflict) {
      const result = await Swal.fire({
        title: "Konflik Penjadwalan",
        text: "Terdapat konflik dengan penyewaan lain. Apakah Anda yakin ingin melanjutkan?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Ya, Lanjutkan",
        cancelButtonText: "Batal",
      });

      if (!result.isConfirmed) return;
    }

    setIsSubmitting(true);

    try {
      const batch = writeBatch(db);
      const rentalRef = doc(db, "rentals", rental.id);

      // Calculate new total cost based on new parameters
      const newExcavators = data.excavators.map((ex) => {
        const totalRegularPay =
          (ex.regularRatePerHour || 0) * (ex.regularHours || 0) * duration;
        const totalOvertimePay =
          (ex.overtimeRatePerHour || 0) * (ex.overtimeHours || 0) * duration;
        return {
          ...ex,
          totalRegularPay,
          totalOvertimePay,
          totalPay: totalRegularPay + totalOvertimePay,
        };
      });

      const newTotalAmount = newExcavators.reduce(
        (sum, ex) => sum + (ex.totalPay || 0),
        0
      );

      // Update rental document
      const updatedRental = {
        renterName: data.renterName.trim(),
        renterNoHP: data.renterNoHP,
        renterEmail: data.renterEmail?.trim() || "",
        rentPeriod: {
          startDate: Timestamp.fromDate(new Date(data.startDate)),
          endDate: Timestamp.fromDate(new Date(data.endDate)),
          durationDays: duration,
        },
        excavators: newExcavators,
        totalAmount: newTotalAmount,
        updatedAt: Timestamp.now(),
      };

      batch.update(rentalRef, updatedRental);

      // Update related invoice if exists
      const invoiceQuery = query(
        collection(db, "invoices"),
        where("rentalId", "==", rental.id)
      );

      const invoiceSnapshot = await getDocs(invoiceQuery);

      if (!invoiceSnapshot.empty) {
        const invoiceDoc = invoiceSnapshot.docs[0];
        const invoiceRef = doc(db, "invoices", invoiceDoc.id);

        const updatedInvoiceItems = newExcavators.map((ex) => ({
          excavatorName: ex.excavatorName,
          brand: ex.brand,
          type: ex.type,
          operatorName: ex.operatorName,
          regularRatePerHour: ex.regularRatePerHour || 0,
          overtimeRatePerHour: ex.overtimeRatePerHour || 0,
          regularHours: ex.regularHours || 0,
          overtimeHours: ex.overtimeHours || 0,
          durationDays: duration,
          totalRegularPay: ex.totalRegularPay || 0,
          totalOvertimePay: ex.totalOvertimePay || 0,
          total: ex.totalPay || 0,
        }));

        batch.update(invoiceRef, {
          renterName: data.renterName.trim(),
          renterNoHP: data.renterNoHP,
          renterEmail: data.renterEmail?.trim() || "",
          items: updatedInvoiceItems,
          totalRegularPay: updatedInvoiceItems.reduce(
            (sum, i) => sum + i.totalRegularPay,
            0
          ),
          totalOvertimePay: updatedInvoiceItems.reduce(
            (sum, i) => sum + i.totalOvertimePay,
            0
          ),
          totalAmount: newTotalAmount,
          updatedAt: Timestamp.now(),
        });
      }

      await batch.commit();

      await Swal.fire({
        title: "Berhasil!",
        text: "Data penyewaan berhasil diperbarui.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      onSave?.(updatedRental);
      onClose?.();
    } catch (error) {
      console.error("Error updating rental:", error);
      Swal.fire({
        title: "Error",
        text: "Gagal menyimpan perubahan. Silakan coba lagi.",
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
    if (isDirty) {
      Swal.fire({
        title: "Perubahan Belum Disimpan",
        text: "Apakah Anda yakin ingin keluar tanpa menyimpan perubahan?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Ya, Keluar",
        cancelButtonText: "Batal",
      }).then((result) => {
        if (result.isConfirmed) {
          onClose?.();
        }
      });
    } else {
      onClose?.();
    }
  }, [isDirty, onClose]);

  const handleReset = useCallback(() => {
    reset({
      renterName: rental?.renterName || "",
      renterNoHP: rental?.renterNoHP || "",
      renterEmail: rental?.renterEmail || "",
      startDate: formatDate(rental?.rentPeriod?.startDate),
      endDate: formatDate(rental?.rentPeriod?.endDate),
      excavators:
        rental?.excavators?.map((ex) => ({
          excavatorId: ex.excavatorId || "",
          excavatorName: ex.excavatorName || "",
          brand: ex.brand || "",
          type: ex.type || "",
          operatorName: ex.operatorName || "",
          regularRatePerHour: ex.regularRatePerHour || 0,
          overtimeRatePerHour: ex.overtimeRatePerHour || 0,
          regularHours: ex.regularHours || 8,
          overtimeHours: ex.overtimeHours || 0,
        })) || [],
    });
    setHasConflict(false);
    setAvailabilityMessage("");
  }, [reset, rental]);

  if (!rental) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              Edit Data Penyewaan
            </h2>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6">
          {/* Renter Information */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center border-b pb-2">
              <User className="w-5 h-5 mr-2 text-blue-600" />
              Informasi Penyewa
            </h3>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Penyewa *
                </label>
                <input
                  type="text"
                  {...register("renterName")}
                  className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  placeholder="Masukkan nama penyewa"
                  disabled={isSubmitting}
                />
                {errors.renterName && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.renterName.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Phone className="w-4 h-4 mr-1" />
                    No. Handphone *
                  </label>
                  <input
                    type="tel"
                    {...register("renterNoHP")}
                    className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="08xxxxxxxxx"
                    disabled={isSubmitting}
                  />
                  {errors.renterNoHP && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.renterNoHP.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    {...register("renterEmail")}
                    className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="nama@email.com"
                    disabled={isSubmitting}
                  />
                  {errors.renterEmail && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.renterEmail.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rental Period */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center border-b pb-2">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              Periode Penyewaan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Mulai *
                </label>
                <input
                  type="date"
                  {...register("startDate")}
                  className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  disabled={isSubmitting}
                />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.startDate.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tanggal Selesai *
                </label>
                <input
                  type="date"
                  {...register("endDate")}
                  className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                  min={startDate}
                  disabled={isSubmitting}
                />
                {errors.endDate && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            {/* Duration Display */}
            {startDate && endDate && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-blue-800 font-medium">
                      <span className="font-bold">Durasi Baru:</span> {duration}{" "}
                      hari
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Periode: {dayjs(startDate).format("DD MMM YYYY")} -{" "}
                      {dayjs(endDate).format("DD MMM YYYY")}
                    </p>
                  </div>
                  {originalDuration !== duration && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        Durasi Asli: {originalDuration} hari
                      </p>
                      <p
                        className={`text-xs font-medium ${
                          duration > originalDuration
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {duration > originalDuration ? "+" : ""}
                        {duration - originalDuration} hari
                      </p>
                    </div>
                  )}
                </div>

                {/* Availability Check */}
                {isCheckingAvailability ? (
                  <div className="mt-2 flex items-center text-blue-700 text-sm">
                    <Loader className="animate-spin w-4 h-4 mr-2" />
                    Memeriksa konflik penjadwalan...
                  </div>
                ) : (
                  availabilityMessage && (
                    <div
                      className={`mt-2 text-sm flex items-center ${
                        hasConflict ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {hasConflict && <AlertCircle className="w-4 h-4 mr-1" />}
                      {availabilityMessage}
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Cost Impact Warning */}
          {(originalDuration !== duration ||
            Math.abs(totalCost - originalTotalCost) > 0) &&
            duration > 0 && (
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">
                      Perubahan Akan Mempengaruhi Total Biaya
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Total biaya akan dihitung ulang berdasarkan durasi dan jam
                      kerja baru. Invoice terkait juga akan diperbarui secara
                      otomatis.
                    </p>
                    <div className="mt-2 text-sm">
                      <p className="text-yellow-800">
                        <span className="font-medium">Biaya Asli:</span>{" "}
                        {formatCurrency(originalTotalCost)}
                      </p>
                      <p className="text-yellow-800">
                        <span className="font-medium">Biaya Baru:</span>{" "}
                        {formatCurrency(totalCost)}
                      </p>
                      <p
                        className={`font-medium ${
                          totalCost > originalTotalCost
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        <span className="font-medium">Selisih:</span>{" "}
                        {formatCurrency(totalCost - originalTotalCost)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Excavator Details */}
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center border-b pb-2">
              <Clock className="w-5 h-5 mr-2 text-blue-600" />
              Detail Excavator & Jam Kerja
            </h3>

            <div className="space-y-4">
              {fields.map((field, idx) => (
                <div
                  key={field.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                >
                  {/* Excavator Info Header */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-blue-700">
                          Brand:
                        </span>
                        <span className="ml-1 text-blue-900">
                          {excavators?.[idx]?.brand || ""}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Tipe:</span>
                        <span className="ml-1 text-blue-900">
                          {excavators?.[idx]?.type || ""}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <HardHat className="w-4 h-4 text-blue-700 mr-1" />
                        <span className="font-medium text-blue-700">
                          Operator:
                        </span>
                        <span className="ml-1 text-blue-900">
                          {excavators?.[idx]?.operatorName || ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Work Hours and Rates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Regular Work */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Jam Kerja Reguler
                      </h4>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Tarif per Jam
                        </label>
                        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
                          <span className="text-gray-800 font-medium">
                            {formatCurrency(
                              excavators?.[idx]?.regularRatePerHour || 0
                            )}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Jam per Hari *
                        </label>
                        <input
                          type="number"
                          {...register(`excavators.${idx}.regularHours`, {
                            valueAsNumber: true,
                          })}
                          className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                          min="0"
                          max={WORK_LIMITS.MAX_REGULAR_HOURS}
                          step="0.5"
                          disabled={isSubmitting}
                        />
                        {errors.excavators?.[idx]?.regularHours && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.excavators[idx].regularHours.message}
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-gray-600">
                        <p>
                          <span className="font-medium">Subtotal Reguler:</span>{" "}
                          {formatCurrency(
                            (excavators?.[idx]?.regularRatePerHour || 0) *
                              (excavators?.[idx]?.regularHours || 0) *
                              duration
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Overtime Work */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Jam Kerja Lembur
                      </h4>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Tarif per Jam
                        </label>
                        <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
                          <span className="text-gray-800 font-medium">
                            {formatCurrency(
                              excavators?.[idx]?.overtimeRatePerHour || 0
                            )}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Jam per Hari
                        </label>
                        <input
                          type="number"
                          {...register(`excavators.${idx}.overtimeHours`, {
                            valueAsNumber: true,
                          })}
                          className="w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                          min="0"
                          max={WORK_LIMITS.MAX_OVERTIME_HOURS}
                          step="0.5"
                          disabled={isSubmitting}
                        />
                        {errors.excavators?.[idx]?.overtimeHours && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.excavators[idx].overtimeHours.message}
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-gray-600">
                        <p>
                          <span className="font-medium">Subtotal Lembur:</span>{" "}
                          {formatCurrency(
                            (excavators?.[idx]?.overtimeRatePerHour || 0) *
                              (excavators?.[idx]?.overtimeHours || 0) *
                              duration
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Excavator Total */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">
                        Total untuk Excavator {idx + 1}:
                      </span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(
                          ((excavators?.[idx]?.regularRatePerHour || 0) *
                            (excavators?.[idx]?.regularHours || 0) +
                            (excavators?.[idx]?.overtimeRatePerHour || 0) *
                              (excavators?.[idx]?.overtimeHours || 0)) *
                            duration
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Cost Summary */}
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-green-700 font-medium">
                  Total Keseluruhan
                </p>
                <p className="text-xs text-green-600">
                  {excavators?.length || 0} excavator × {duration} hari
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(totalCost)}
                </p>
                {Math.abs(totalCost - originalTotalCost) > 0 && (
                  <p
                    className={`text-sm font-medium ${
                      totalCost > originalTotalCost
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {totalCost > originalTotalCost ? "+" : ""}
                    {formatCurrency(totalCost - originalTotalCost)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={handleReset}
              disabled={isSubmitting || !isDirty}
              className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isValid || isCheckingAvailability}
              className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader className="animate-spin w-4 h-4 mr-2" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Simpan Perubahan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRentalForm;
