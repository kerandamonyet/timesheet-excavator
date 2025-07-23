"use client";

import { withAuthGuard } from "@/firebase/withAuthGuard";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { db } from "@/firebase/config";
import { collection, getDocs } from "firebase/firestore";
import dayjs from "dayjs";
import "dayjs/locale/id";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.locale("id");
dayjs.extend(customParseFormat);

const ReportMonthCard = ({ monthData, formatCurrency }) => (
  <Link
    href={`/reports/${monthData.month}/${monthData.year}`}
    className="block bg-white rounded-xl shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 overflow-hidden group relative"
  >
    <div className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">
            {monthData.name}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {monthData.totalEntries} entri timesheet
          </p>
        </div>
        <div className="bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1 text-sm font-medium group-hover:bg-indigo-100">
          Detail
          <svg
            className="inline ml-1 w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-blue-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
            <span className="text-xs text-blue-600 font-medium">Karyawan</span>
          </div>
          <p className="text-lg font-bold text-blue-700">
            {monthData.employeeCount}
          </p>
        </div>

        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-green-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs text-green-600 font-medium">
              Total Jam
            </span>
          </div>
          <p className="text-lg font-bold text-green-700">
            {monthData.totalHours}
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <svg
            className="w-4 h-4 text-indigo-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs text-indigo-600 font-medium">
            Total Gaji
          </span>
        </div>
        <p className="text-lg font-bold text-indigo-700">
          {formatCurrency(monthData.totalSalary)}
        </p>
      </div>

      {monthData.employees && monthData.employees.length > 0 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500 mb-2">Karyawan:</p>
          <div className="flex flex-wrap gap-1">
            {monthData.employees.slice(0, 3).map((employee, idx) => (
              <span
                key={idx}
                className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full"
              >
                {employee}
              </span>
            ))}
            {monthData.employees.length > 3 && (
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                +{monthData.employees.length - 3} lainnya
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  </Link>
);

function ReportsPage() {
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  }, []);

  const fetchMonths = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const snapshot = await getDocs(collection(db, "timesheets"));
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const monthMap = new Map();

      docs.forEach((doc) => {
        if (!doc.date) return;

        const date = dayjs(doc.date, "YYYY-MM-DD");
        if (!date.isValid()) return;

        const key = date.format("YYYY-MM");
        const monthName = date.format("MMMM YYYY");

        if (!monthMap.has(key)) {
          monthMap.set(key, {
            month: date.month() + 1,
            year: date.year(),
            name: monthName,
            excavators: new Map(), // Menggunakan Map untuk menyimpan excavatorId -> excavatorName
            totalEntries: 0,
            totalHours: 0,
            totalSalary: 0,
          });
        }

        const monthData = monthMap.get(key);

        // Simpan data excavator sebagai representasi operator
        if (doc.excavatorId && doc.excavatorName) {
          monthData.excavators.set(doc.excavatorId, doc.excavatorName);
        }

        monthData.totalEntries++;

        if (typeof doc.workHours === "number") {
          monthData.totalHours += doc.workHours;
        }
        if (typeof doc.overtimeHours === "number") {
          monthData.totalHours += doc.overtimeHours;
        }

        if (typeof doc.totalPay === "number") {
          monthData.totalSalary += doc.totalPay;
        }
      });

      const monthsArray = Array.from(monthMap.values())
        .map((month) => {
          // Konversi Map excavator ke array nama
          const excavatorNames = Array.from(month.excavators.values());

          return {
            ...month,
            employeeCount: month.excavators.size, // Jumlah excavator unik
            employees: excavatorNames, // Daftar nama excavator
            totalHours: Math.round(month.totalHours),
          };
        })
        .sort((a, b) => {
          return dayjs(`${b.year}-${b.month}`).diff(
            dayjs(`${a.year}-${a.month}`)
          );
        });

      setAvailableMonths(monthsArray);
    } catch (err) {
      console.error("Error fetching months:", err);
      setError("Gagal memuat data laporan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center">
        <div
          className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto mb-4"
          aria-label="Memuat data"
        ></div>
        <p className="text-gray-600">Memuat laporan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center">
        <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-medium text-gray-800 mb-2">
          Terjadi Kesalahan
        </h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={fetchMonths}
          className="btn-primary inline-flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-indigo-700 mb-2">
          Laporan Absensi & Gaji Bulanan
        </h1>
        <p className="text-gray-600">
          Pilih bulan untuk melihat detail laporan karyawan
        </p>
      </div>

      {availableMonths.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="mx-auto bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-800 mb-2">
            Belum ada laporan
          </h3>
          <p className="text-gray-600 mb-6">
            Data laporan akan muncul setelah ada timesheet yang dicatat
          </p>
          <Link
            href="/timesheet"
            className="btn-primary inline-flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                clipRule="evenodd"
              />
            </svg>
            Buat Timesheet
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableMonths.map((monthData) => (
            <ReportMonthCard
              key={`${monthData.year}-${monthData.month}`}
              monthData={monthData}
              formatCurrency={formatCurrency}
            />
          ))}
        </div>
      )}

      <style jsx global>{`
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
      `}</style>
    </div>
  );
}

export default withAuthGuard(ReportsPage);
