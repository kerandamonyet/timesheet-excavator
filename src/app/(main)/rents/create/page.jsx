"use client";

import { withAuthGuard } from "@/firebase/withAuthGuard";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  getDocs,
  Timestamp,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/config";
import dayjs from "dayjs";
import {
  Trash2,
  Plus,
  Calendar,
  User,
  Clock,
  DollarSign,
  ArrowLeft,
  Loader,
  AlertCircle,
  Info,
  HardHat,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Swal from "sweetalert2";

// --- Constants ---
const DEFAULT_WORK_HOURS = {
  START_TIME: "08:00",
  END_TIME: "16:00",
  REGULAR_HOURS: 8,
  OVERTIME_HOURS: 0,
};

const LIMITS = {
  MAX_REGULAR_HOURS: 24,
  MAX_OVERTIME_HOURS: 16,
  MIN_RENTER_NAME_LENGTH: 3,
  MIN_PHONE_LENGTH: 9,
  MAX_PHONE_LENGTH: 13,
};

// --- Utility Functions ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const normalizePhoneNumber = (phone) => {
  if (!phone) return phone;
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");
  // Convert 62 prefix to 0
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

// --- Zod Schema Definitions ---
const excavatorSchema = z.object({
  excavatorId: z.string().min(1, "Excavator harus dipilih"),
  excavatorName: z.string(),
  brand: z.string(),
  type: z.string(),
  operatorName: z.string(),
  regularRatePerHour: z.number().min(0, "Tarif reguler tidak boleh negatif"),
  overtimeRatePerHour: z.number().min(0, "Tarif lembur tidak boleh negatif"),
  startTime: z.string(),
  endTime: z.string(),
  regularHours: z
    .number()
    .min(0, "Jam reguler tidak boleh negatif")
    .max(
      LIMITS.MAX_REGULAR_HOURS,
      `Jam reguler maksimal ${LIMITS.MAX_REGULAR_HOURS}`
    ),
  overtimeHours: z
    .number()
    .min(0, "Jam lembur tidak boleh negatif")
    .max(
      LIMITS.MAX_OVERTIME_HOURS,
      `Jam lembur maksimal ${LIMITS.MAX_OVERTIME_HOURS}`
    ),
});

const rentFormSchema = z
  .object({
    renterName: z
      .string()
      .min(
        LIMITS.MIN_RENTER_NAME_LENGTH,
        `Nama penyewa minimal ${LIMITS.MIN_RENTER_NAME_LENGTH} karakter`
      )
      .max(100, "Nama penyewa maksimal 100 karakter"),
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
      .refine(
        (date) => dayjs(date).isAfter(dayjs().subtract(1, "day")),
        "Tanggal mulai tidak boleh di masa lalu"
      ),
    endDate: z.string().min(1, "Tanggal selesai harus diisi"),
    excavators: z
      .array(excavatorSchema)
      .min(1, "Setidaknya satu excavator harus ditambahkan")
      .max(10, "Maksimal 10 excavator per penyewaan"),
  })
  .refine(
    (data) => {
      return (
        dayjs(data.endDate).isAfter(dayjs(data.startDate)) ||
        dayjs(data.endDate).isSame(dayjs(data.startDate))
      );
    },
    {
      message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
      path: ["endDate"],
    }
  );

// --- Custom Hooks ---
const useExcavatorData = () => {
  const [excavatorList, setExcavatorList] = useState([]);
  const [excavatorStock, setExcavatorStock] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchExcavators = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const snapshot = await getDocs(
        query(collection(db, "excavators"), where("status", "==", "Tersedia"))
      );

      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        stock: doc.data().stock || 1,
      }));

      const stockMap = {};
      data.forEach((ex) => {
        stockMap[ex.id] = ex.stock;
      });

      setExcavatorList(data);
      setExcavatorStock(stockMap);
    } catch (err) {
      console.error("Error fetching excavators:", err);
      setError("Gagal memuat daftar excavator");
      Swal.fire(
        "Error",
        "Gagal memuat daftar excavator. Silakan coba lagi.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExcavators();
  }, [fetchExcavators]);

  return {
    excavatorList,
    excavatorStock,
    isLoading,
    error,
    refetch: fetchExcavators,
  };
};

const useAvailabilityCheck = (
  startDate,
  endDate,
  excavatorList,
  excavatorStock
) => {
  const [availabilityStatus, setAvailabilityStatus] = useState({});
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");

  const checkAvailability = useCallback(async () => {
    if (!startDate || !endDate || !excavatorList.length) {
      setAvailabilityStatus({});
      setMessage("");
      return;
    }

    const start = dayjs(startDate);
    const end = dayjs(endDate);

    if (start.isAfter(end)) {
      setMessage("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }

    setIsChecking(true);
    try {
      const startTimestamp = Timestamp.fromDate(start.toDate());
      const endTimestamp = Timestamp.fromDate(end.toDate());

      const q = query(
        collection(db, "rentals"),
        where("rentPeriod.startDate", "<=", endTimestamp),
        where("rentPeriod.endDate", ">=", startTimestamp),
        where("status", "==", "aktif")
      );

      const querySnapshot = await getDocs(q);
      const excavatorRentalCount = {};

      querySnapshot.forEach((doc) => {
        const rental = doc.data();
        rental.excavators?.forEach((ex) => {
          excavatorRentalCount[ex.excavatorId] =
            (excavatorRentalCount[ex.excavatorId] || 0) + 1;
        });
      });

      const status = {};
      excavatorList.forEach((ex) => {
        const availableCount =
          (excavatorStock[ex.id] || 1) - (excavatorRentalCount[ex.id] || 0);
        status[ex.id] = availableCount > 0;
      });

      setAvailabilityStatus(status);
      setMessage("Ketersediaan excavator telah diperbarui.");
    } catch (error) {
      console.error("Error checking availability:", error);
      setMessage("Gagal memeriksa ketersediaan.");
      Swal.fire("Error", "Gagal memeriksa ketersediaan excavator.", "error");
    } finally {
      setIsChecking(false);
    }
  }, [startDate, endDate, excavatorList, excavatorStock]);

  useEffect(() => {
    const timeoutId = setTimeout(checkAvailability, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [checkAvailability]);

  return { availabilityStatus, isChecking, message };
};

// --- Main Component ---
function RentForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    excavatorList,
    excavatorStock,
    isLoading: isLoadingExcavators,
  } = useExcavatorData();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    reset,
    formState: { errors, isValid },
  } = useForm({
    resolver: zodResolver(rentFormSchema),
    mode: "onChange",
    defaultValues: {
      renterName: "",
      renterNoHP: "",
      renterEmail: "",
      startDate: "",
      endDate: "",
      excavators: [
        {
          excavatorId: "",
          excavatorName: "",
          brand: "",
          type: "",
          operatorName: "",
          regularRatePerHour: 0,
          overtimeRatePerHour: 0,
          startTime: DEFAULT_WORK_HOURS.START_TIME,
          endTime: DEFAULT_WORK_HOURS.END_TIME,
          regularHours: DEFAULT_WORK_HOURS.REGULAR_HOURS,
          overtimeHours: DEFAULT_WORK_HOURS.OVERTIME_HOURS,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "excavators",
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const excavators = watch("excavators");

  const { availabilityStatus, isChecking, message } = useAvailabilityCheck(
    startDate,
    endDate,
    excavatorList,
    excavatorStock
  );

  const duration = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (start.isAfter(end)) return 0;
    return end.diff(start, "day") + 1;
  }, [startDate, endDate]);

  const totalCost = useMemo(() => {
    return excavators.reduce((total, ex) => {
      const regularTotal =
        (ex.regularRatePerHour || 0) * (ex.regularHours || 0) * duration;
      const overtimeTotal =
        (ex.overtimeRatePerHour || 0) * (ex.overtimeHours || 0) * duration;
      return total + regularTotal + overtimeTotal;
    }, 0);
  }, [excavators, duration]);

  const handleAddExcavator = useCallback(() => {
    if (fields.length >= 10) {
      Swal.fire(
        "Batas Maksimal",
        "Maksimal 10 excavator per penyewaan.",
        "warning"
      );
      return;
    }

    append({
      excavatorId: "",
      excavatorName: "",
      brand: "",
      type: "",
      operatorName: "",
      regularRatePerHour: 0,
      overtimeRatePerHour: 0,
      startTime: DEFAULT_WORK_HOURS.START_TIME,
      endTime: DEFAULT_WORK_HOURS.END_TIME,
      regularHours: DEFAULT_WORK_HOURS.REGULAR_HOURS,
      overtimeHours: DEFAULT_WORK_HOURS.OVERTIME_HOURS,
    });
  }, [append, fields.length]);

  const handleRemoveExcavator = useCallback(
    (index) => {
      if (fields.length > 1) {
        remove(index);
      }
    },
    [remove, fields.length]
  );

  const handleSelectExcavator = useCallback(
    (idx, excavatorId) => {
      const selected = excavatorList.find((ex) => ex.id === excavatorId);

      if (!selected) {
        // Clear fields if no excavator selected
        const fieldsToUpdate = [
          "excavatorId",
          "excavatorName",
          "brand",
          "type",
          "operatorName",
          "regularRatePerHour",
          "overtimeRatePerHour",
        ];
        fieldsToUpdate.forEach((field) => {
          setValue(
            `excavators.${idx}.${field}`,
            field.includes("Rate") ? 0 : ""
          );
        });
        return;
      }

      // Update form with selected excavator data
      const updates = {
        excavatorId: excavatorId,
        excavatorName: `${selected.brand} ${selected.name}`,
        brand: selected.brand,
        type: selected.type,
        operatorName: selected.operatorName,
        regularRatePerHour: selected.regularRatePerHour || 0,
        overtimeRatePerHour: selected.overtimeRatePerHour || 0,
      };

      Object.entries(updates).forEach(([field, value]) => {
        setValue(`excavators.${idx}.${field}`, value);
      });
    },
    [excavatorList, setValue]
  );

  const validateSubmission = (data) => {
    // Check for unavailable excavators
    const unavailableExcavators = data.excavators
      .filter(
        (ex) => ex.excavatorId && availabilityStatus[ex.excavatorId] === false
      )
      .map((ex) => {
        const selected = excavatorList.find(
          (item) => item.id === ex.excavatorId
        );
        return selected
          ? `${selected.brand} ${selected.name}`
          : ex.excavatorName;
      });

    if (unavailableExcavators.length > 0) {
      throw new Error(
        `Excavator tidak tersedia: ${unavailableExcavators.join(", ")}`
      );
    }

    // Check for duplicate excavators
    const excavatorIds = data.excavators
      .map((ex) => ex.excavatorId)
      .filter(Boolean);
    const uniqueIds = new Set(excavatorIds);
    if (uniqueIds.size !== excavatorIds.length) {
      throw new Error(
        "Tidak dapat menyewa excavator yang sama lebih dari satu kali."
      );
    }

    // Check for empty selections
    if (data.excavators.some((ex) => !ex.excavatorId)) {
      throw new Error("Harap pilih excavator untuk semua item.");
    }
  };

  const createRentalData = (data) => {
    return {
      renterName: data.renterName.trim(),
      renterNoHP: data.renterNoHP,
      renterEmail: data.renterEmail?.trim() || "",
      rentPeriod: {
        startDate: Timestamp.fromDate(new Date(data.startDate)),
        endDate: Timestamp.fromDate(new Date(data.endDate)),
        durationDays: duration,
      },
      excavators: data.excavators.map((ex) => {
        const totalRegularPay =
          ex.regularRatePerHour * ex.regularHours * duration;
        const totalOvertimePay =
          ex.overtimeRatePerHour * ex.overtimeHours * duration;
        return {
          ...ex,
          totalRegularPay,
          totalOvertimePay,
          totalPay: totalRegularPay + totalOvertimePay,
        };
      }),
      totalAmount: totalCost,
      status: "aktif",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  };

  const createInvoiceData = (rentalId, rentalData) => {
    const items = rentalData.excavators.map((ex) => ({
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
      total: ex.totalPay,
    }));

    return {
      rentalId,
      invoiceNumber: `INV-${dayjs().format("YYYYMMDD-HHmmss")}`,
      renterName: rentalData.renterName,
      renterNoHP: rentalData.renterNoHP,
      renterEmail: rentalData.renterEmail,
      dateIssued: Timestamp.now(),
      items,
      totalRegularPay: items.reduce((sum, i) => sum + i.totalRegularPay, 0),
      totalOvertimePay: items.reduce((sum, i) => sum + i.totalOvertimePay, 0),
      totalAmount: rentalData.totalAmount,
      isPaid: false,
      status: "pending",
      createdAt: Timestamp.now(),
    };
  };

  const onSubmit = async (data) => {
    if (duration <= 0) {
      Swal.fire("Kesalahan Input", "Durasi penyewaan tidak valid.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      validateSubmission(data);

      const batch = writeBatch(db);

      // Create rental document
      const rentalRef = collection(db, "rentals");
      const rentalData = createRentalData(data);
      const newRentalRef = await addDoc(rentalRef, rentalData);

      // Create invoice document
      const invoiceRef = collection(db, "invoices");
      const invoiceData = createInvoiceData(newRentalRef.id, rentalData);
      await addDoc(invoiceRef, invoiceData);

      await Swal.fire({
        title: "Berhasil!",
        text: "Penyewaan berhasil disimpan! Invoice telah dibuat.",
        icon: "success",
        timer: 3000,
        showConfirmButton: false,
      });

      // Reset form and redirect
      reset();
      setTimeout(() => router.push("/rents"), 1000);
    } catch (error) {
      console.error("Error creating rental:", error);

      const errorMessage =
        error.message.includes("Excavator tidak tersedia") ||
        error.message.includes("Tidak dapat menyewa") ||
        error.message.includes("Harap pilih")
          ? error.message
          : "Terjadi kesalahan saat menyimpan data. Silakan coba lagi.";

      Swal.fire("Error", errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  // Loading state
  if (isLoadingExcavators) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="animate-spin w-12 h-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Memuat data excavator...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => router.push("/rents")}
            className="inline-flex items-center text-sm sm:text-base font-medium text-blue-600 hover:text-blue-800 transition-colors px-4 py-2 border border-transparent sm:border-gray-300 sm:bg-white sm:rounded-lg shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Daftar Sewa
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          {/* Title Section */}
          <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white text-center">
              Form Penyewaan Excavator
            </h1>
            <p className="text-blue-200 text-center mt-2">
              Sistem manajemen ketersediaan excavator
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-8">
            {/* Renter Information Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-800 mb-6 pb-2 border-b border-gray-200 flex items-center">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Informasi Penyewa
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label
                    htmlFor="renterName"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Nama Penyewa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="renterName"
                    {...register("renterName")}
                    className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="Masukkan nama penyewa"
                  />
                  {errors.renterName && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.renterName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="renterNoHP"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    No. Handphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="renterNoHP"
                    {...register("renterNoHP")}
                    className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="08xxxxxxxxx"
                  />
                  {errors.renterNoHP && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.renterNoHP.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="renterEmail"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="renterEmail"
                    {...register("renterEmail")}
                    className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    placeholder="nama@email.com"
                  />
                  {errors.renterEmail && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.renterEmail.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="startDate"
                    className="block text-sm font-medium text-gray-700 mb-2 flex items-center"
                  >
                    <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                    Tanggal Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    {...register("startDate")}
                    className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    min={dayjs().format("YYYY-MM-DD")}
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.startDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="endDate"
                    className="block text-sm font-medium text-gray-700 mb-2 flex items-center"
                  >
                    <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                    Tanggal Selesai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    {...register("endDate")}
                    className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                    min={startDate || dayjs().format("YYYY-MM-DD")}
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
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-sm text-blue-800 font-medium">
                    <span className="font-bold">Durasi Sewa:</span> {duration}{" "}
                    hari
                    <span className="block mt-1 text-gray-600 text-xs">
                      Periode: {dayjs(startDate).format("DD MMM YYYY")} -{" "}
                      {dayjs(endDate).format("DD MMM YYYY")}
                    </span>
                  </p>

                  {isChecking ? (
                    <div className="mt-2 flex items-center text-blue-700 text-sm">
                      <Loader className="animate-spin w-4 h-4 mr-2" />
                      Memeriksa ketersediaan excavator...
                    </div>
                  ) : (
                    message && (
                      <div className="mt-2 text-sm">
                        <p
                          className={
                            duration <= 0 ? "text-red-700" : "text-green-700"
                          }
                        >
                          {message}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Excavator List Section */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Daftar Excavator
                </h2>
                <button
                  type="button"
                  onClick={handleAddExcavator}
                  disabled={isChecking || fields.length >= 10}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Excavator
                </button>
              </div>

              {errors.excavators && (
                <p className="mt-1 mb-4 text-sm text-red-600">
                  {errors.excavators.message}
                </p>
              )}

              <div className="space-y-6">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className={`border rounded-xl p-6 transition-colors ${
                      excavators[idx]?.excavatorId &&
                      availabilityStatus[excavators[idx].excavatorId] === false
                        ? "bg-red-50 border-red-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">
                        Excavator {idx + 1}
                      </h3>
                      {fields.length > 1 && (
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
                      {/* Excavator Selection */}
                      <div className="md:col-span-2">
                        <label
                          htmlFor={`excavators.${idx}.excavatorId`}
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Pilih Excavator{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            id={`excavators.${idx}.excavatorId`}
                            {...register(`excavators.${idx}.excavatorId`, {
                              onChange: (e) =>
                                handleSelectExcavator(idx, e.target.value),
                            })}
                            className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors appearance-none"
                            disabled={isChecking}
                          >
                            <option value="">Pilih excavator...</option>
                            {excavatorList.map((ev) => {
                              const isCurrentlySelected =
                                excavators[idx]?.excavatorId === ev.id;
                              const isUnavailable =
                                availabilityStatus[ev.id] === false &&
                                !isCurrentlySelected;

                              return (
                                <option
                                  key={ev.id}
                                  value={ev.id}
                                  disabled={isUnavailable}
                                  className={
                                    isUnavailable ? "text-red-500" : ""
                                  }
                                >
                                  {ev.brand} {ev.name} ({ev.type}) -{" "}
                                  {ev.operatorName}
                                  {isUnavailable && " (Tidak Tersedia)"}
                                </option>
                              );
                            })}
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
                        {errors.excavators?.[idx]?.excavatorId && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.excavators[idx].excavatorId.message}
                          </p>
                        )}

                        {/* Availability Status */}
                        {excavators[idx]?.excavatorId &&
                          availabilityStatus[excavators[idx].excavatorId] !==
                            undefined && (
                            <div className="mt-2 flex items-center">
                              <AvailabilityBadge
                                available={
                                  availabilityStatus[
                                    excavators[idx].excavatorId
                                  ]
                                }
                                stock={
                                  excavatorStock[excavators[idx].excavatorId] ||
                                  1
                                }
                              />
                              {!availabilityStatus[
                                excavators[idx].excavatorId
                              ] && (
                                <span className="ml-2 text-sm text-red-600 flex items-center">
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  Tidak tersedia pada periode ini
                                </span>
                              )}
                            </div>
                          )}
                      </div>

                      {/* Rate Information */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <DollarSign className="w-4 h-4 mr-1 text-gray-600" />
                            Tarif Reguler
                          </label>
                          <div className="px-4 py-3 bg-white border border-gray-200 rounded-lg">
                            <p className="text-gray-800 font-medium">
                              {formatCurrency(
                                excavators[idx]?.regularRatePerHour || 0
                              )}
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
                              {formatCurrency(
                                excavators[idx]?.overtimeRatePerHour || 0
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Working Hours */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label
                            htmlFor={`excavators.${idx}.regularHours`}
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Jam Reguler / Hari{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            id={`excavators.${idx}.regularHours`}
                            {...register(`excavators.${idx}.regularHours`, {
                              valueAsNumber: true,
                            })}
                            className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                            min="0"
                            max={LIMITS.MAX_REGULAR_HOURS}
                            step="0.5"
                          />
                          {errors.excavators?.[idx]?.regularHours && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors.excavators[idx].regularHours.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor={`excavators.${idx}.overtimeHours`}
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Jam Lembur / Hari
                          </label>
                          <input
                            type="number"
                            id={`excavators.${idx}.overtimeHours`}
                            {...register(`excavators.${idx}.overtimeHours`, {
                              valueAsNumber: true,
                            })}
                            className="w-full text-black px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                            min="0"
                            max={LIMITS.MAX_OVERTIME_HOURS}
                            step="0.5"
                          />
                          {errors.excavators?.[idx]?.overtimeHours && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors.excavators[idx].overtimeHours.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Excavator Details */}
                    {excavators[idx]?.excavatorId && (
                      <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-blue-700 font-medium mb-1">
                              Brand
                            </p>
                            <p className="text-sm font-semibold text-blue-900">
                              {excavators[idx].brand}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-700 font-medium mb-1">
                              Tipe
                            </p>
                            <p className="text-sm font-semibold text-blue-900">
                              {excavators[idx].type}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-blue-700 font-medium mb-1 flex items-center">
                              <HardHat className="w-4 h-4 mr-1" />
                              Operator
                            </p>
                            <p className="text-sm font-semibold text-blue-900">
                              {excavators[idx].operatorName}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-blue-100">
                          <p className="text-sm text-blue-800 font-medium mb-1">
                            Estimasi Biaya per Hari:
                          </p>
                          <p className="text-lg font-bold text-blue-900">
                            {formatCurrency(
                              (excavators[idx].regularRatePerHour || 0) *
                                (excavators[idx].regularHours || 0) +
                                (excavators[idx].overtimeRatePerHour || 0) *
                                  (excavators[idx].overtimeHours || 0)
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Summary */}
            {startDate &&
              endDate &&
              duration > 0 &&
              excavators.some((ex) => (ex.regularRatePerHour || 0) > 0) && (
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
                        {formatCurrency(totalCost)}
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

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isChecking ||
                  duration <= 0 ||
                  !isValid ||
                  excavators.some(
                    (ex) =>
                      ex.excavatorId &&
                      availabilityStatus[ex.excavatorId] === false
                  )
                }
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-4 px-6 rounded-lg font-bold transition-colors flex items-center justify-center shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="animate-spin mr-2 w-5 h-5" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Penyewaan"
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="px-6 py-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                Reset Form
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>© 2025 | Sistem Penyewaan Alat Berat.</p>
        </div>
      </div>
    </div>
  );
}

export default withAuthGuard(RentForm);
