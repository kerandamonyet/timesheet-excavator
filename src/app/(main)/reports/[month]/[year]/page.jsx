// File: app/reports/[month]/[year]/page.jsx
"use client";

import { withAuthGuard } from "@/firebase/withAuthGuard";
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/firebase/config";
import { collection, getDocs, query, where } from "firebase/firestore";
import dayjs from "dayjs";
import "dayjs/locale/id";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; // Impor fungsi autoTable secara langsung

dayjs.locale("id");

function MonthlyReportDetail() {
  const params = useParams();
  const router = useRouter();
  const { month, year } = params;

  const [reportData, setReportData] = useState({
    excavators: [],
    summary: {
      totalExcavators: 0,
      totalWorkingDays: 0,
      totalHours: 0,
      totalPay: 0,
      averageHoursPerDay: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [selectedExcavator, setSelectedExcavator] = useState(null);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatTime = useCallback((timeString) => {
    return timeString ? dayjs(`2000-01-01 ${timeString}`).format("HH:mm") : "-";
  }, []);

  useEffect(() => {
    const fetchMonthlyData = async () => {
      if (!month || !year) return;

      try {
        setLoading(true);

        const startDate = dayjs(`${year}-${month}-01`).startOf("month");
        const endDate = dayjs(`${year}-${month}-01`).endOf("month");

        const q = query(
          collection(db, "timesheets"),
          where("date", ">=", startDate.format("YYYY-MM-DD")),
          where("date", "<=", endDate.format("YYYY-MM-DD"))
        );

        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const excavatorMap = new Map();
        let totalHoursAcrossAll = 0;
        let totalPayAcrossAll = 0;

        docs.forEach((record) => {
          const excavatorId = record.excavatorId;
          const excavatorName = record.excavatorName || "Unknown";

          if (!excavatorMap.has(excavatorId)) {
            excavatorMap.set(excavatorId, {
              id: excavatorId,
              name: excavatorName,
              records: [],
              workingDays: 0,
              totalHours: 0,
              totalPay: 0,
              averageHours: 0,
            });
          }

          const excavator = excavatorMap.get(excavatorId);
          excavator.records.push(record);
          excavator.workingDays++;

          // Calculate hours from provided fields
          const workHours = record.workHours || 0;
          const overtimeHours = record.overtimeHours || 0;
          const totalHours = workHours + overtimeHours;

          excavator.totalHours += totalHours;
          totalHoursAcrossAll += totalHours;

          // Calculate pay
          const totalPay = record.totalPay || 0;
          excavator.totalPay += totalPay;
          totalPayAcrossAll += totalPay;
        });

        // Calculate averages and sort records by date
        const excavators = Array.from(excavatorMap.values())
          .map((excavator) => {
            excavator.averageHours =
              excavator.workingDays > 0
                ? excavator.totalHours / excavator.workingDays
                : 0;
            excavator.records.sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
            return excavator;
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        setReportData({
          excavators,
          summary: {
            totalExcavators: excavators.length,
            totalWorkingDays: docs.length,
            totalHours: Math.round(totalHoursAcrossAll * 100) / 100,
            totalPay: totalPayAcrossAll,
            averageHoursPerDay:
              docs.length > 0
                ? Math.round((totalHoursAcrossAll / docs.length) * 100) / 100
                : 0,
          },
        });
      } catch (error) {
        console.error("Error fetching monthly data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyData();
  }, [month, year]);

  const monthName = dayjs(`${year}-${month}-01`).format("MMMM YYYY");

  const exportToCSV = useCallback(() => {
    const csvContent = [
      [
        "Nama Excavator",
        "Hari Kerja",
        "Total Jam",
        "Rata-rata Jam/Hari",
        "Total Pembayaran",
      ],
      ...reportData.excavators.map((excavator) => [
        excavator.name,
        excavator.workingDays,
        Math.round(excavator.totalHours * 100) / 100,
        Math.round(excavator.averageHours * 100) / 100,
        excavator.totalPay,
      ]),
    ];

    const csvString = csvContent.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laporan_Excavator_${monthName.replace(/ /g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [reportData.excavators, monthName]);

  // Fungsi export PDF yang diperbaiki
  const exportToPDF = useCallback(() => {
    const doc = new jsPDF();

    // Judul dokumen
    doc.setFontSize(16);
    doc.text(`Laporan Detail Excavator ${monthName}`, 14, 15);

    // Tabel ringkasan excavator
    const summaryHeaders = [
      "Nama Excavator",
      "Hari Operasi",
      "Total Jam",
      "Rata² Jam/Hari",
      "Total Pembayaran",
    ];

    const summaryData = reportData.excavators.map((excavator) => [
      excavator.name,
      excavator.workingDays,
      Math.round(excavator.totalHours * 100) / 100,
      Math.round(excavator.averageHours * 100) / 100,
      formatCurrency(excavator.totalPay),
    ]);

    // Gunakan fungsi autoTable secara langsung
    autoTable(doc, {
      head: [summaryHeaders],
      body: summaryData,
      startY: 25,
      theme: "grid",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
      },
    });

    // Tabel detail untuk setiap excavator
    reportData.excavators.forEach((excavator) => {
      doc.addPage();

      // Subjudul excavator
      doc.setFontSize(14);
      doc.text(`Detail Operasi: ${excavator.name}`, 14, 15);

      const detailHeaders = [
        "Tanggal",
        "Mulai",
        "Selesai",
        "Jam Reguler",
        "Jam Lembur",
        "Total Jam",
        "Gaji Reguler",
        "Gaji Lembur",
        "Total Pembayaran",
      ];

      const detailData = excavator.records.map((record) => {
        const workHours = record.workHours || 0;
        const overtimeHours = record.overtimeHours || 0;
        const totalHours = workHours + overtimeHours;

        return [
          dayjs(record.date).format("DD MMM YYYY"),
          formatTime(record.startTime),
          formatTime(record.endTime),
          workHours,
          overtimeHours,
          totalHours,
          formatCurrency(record.totalRegularPay || 0),
          formatCurrency(record.totalOvertimePay || 0),
          formatCurrency(record.totalPay || 0),
        ];
      });

      autoTable(doc, {
        head: [detailHeaders],
        body: detailData,
        startY: 20,
        theme: "grid",
        headStyles: {
          fillColor: [52, 152, 219],
          textColor: 255,
          fontStyle: "bold",
        },
      });
    });

    // Simpan PDF
    doc.save(`Laporan_Excavator_${monthName.replace(/ /g, "_")}.pdf`);
  }, [reportData.excavators, monthName, formatCurrency, formatTime]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat laporan detail...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 no-print">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Kembali ke Laporan
        </button>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-indigo-700 mb-2">
            Laporan Detail Excavator {monthName}
          </h1>
          <p className="text-gray-600">
            Detail penggunaan excavator bulan {monthName.toLowerCase()}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Excavator</p>
              <p className="text-2xl font-bold text-gray-800">
                {reportData.summary.totalExcavators}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <svg
                className="w-6 h-6 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Jam Operasi</p>
              <p className="text-2xl font-bold text-gray-800">
                {reportData.summary.totalHours}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Hari Operasi</p>
              <p className="text-2xl font-bold text-gray-800">
                {reportData.summary.totalWorkingDays}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-3 rounded-lg">
              <svg
                className="w-6 h-6 text-indigo-600"
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
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Pembayaran</p>
              <p className="text-xl font-bold text-gray-800">
                {formatCurrency(reportData.summary.totalPay)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Excavator List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Detail Excavator
          </h2>
        </div>

        {reportData.excavators.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">
              Tidak ada data excavator untuk bulan ini
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nama Excavator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hari Operasi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Jam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rata² Jam/Hari
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Pembayaran
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider no-print">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.excavators.map((excavator, index) => (
                  <React.Fragment key={index}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="bg-indigo-100 w-8 h-8 rounded-full flex items-center justify-center mr-3">
                            <span className="text-indigo-600 font-medium text-sm">
                              {excavator.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {excavator.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {excavator.workingDays} hari
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Math.round(excavator.totalHours * 100) / 100} jam
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {Math.round(excavator.averageHours * 100) / 100} jam
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(excavator.totalPay)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 no-print">
                        <button
                          onClick={() =>
                            setSelectedExcavator(
                              selectedExcavator === excavator ? null : excavator
                            )
                          }
                          className="text-indigo-600 hover:text-indigo-900 font-medium"
                        >
                          {selectedExcavator === excavator ? "Tutup" : "Detail"}
                        </button>
                      </td>
                    </tr>
                    {selectedExcavator === excavator && (
                      <tr>
                        <td colSpan="6" className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">
                              Rincian Operasi {excavator.name}
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="min-w-full">
                                <thead>
                                  <tr className="bg-white">
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Tanggal
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Mulai
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Selesai
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Jam Reguler
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Jam Lembur
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Total Jam
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Gaji Reguler
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Gaji Lembur
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Total Pembayaran
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {excavator.records.map((record, idx) => {
                                    const workHours = record.workHours || 0;
                                    const overtimeHours =
                                      record.overtimeHours || 0;
                                    const totalHours =
                                      workHours + overtimeHours;

                                    return (
                                      <tr key={idx} className="bg-white">
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {dayjs(record.date).format(
                                            "DD MMM YYYY"
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {formatTime(record.startTime)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {formatTime(record.endTime)}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {workHours} jam
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {overtimeHours} jam
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {totalHours} jam
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {formatCurrency(
                                            record.totalRegularPay || 0
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {formatCurrency(
                                            record.totalOvertimePay || 0
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-900">
                                          {formatCurrency(record.totalPay || 0)}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Section - Tambahkan tombol PDF */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6 no-print">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Ekspor Laporan
        </h3>
        <div className="flex flex-wrap gap-4">
          {/* Tombol Export CSV */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Ekspor CSV
          </button>

          {/* Tombol Export PDF (Baru) */}
          <button
            onClick={exportToPDF}
            className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                clipRule="evenodd"
              />
            </svg>
            Ekspor PDF
          </button>

          {/* Tombol Print (sudah ada) */}
          <button
            onClick={() => {
              window.print();
            }}
            className="inline-flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                clipRule="evenodd"
              />
            </svg>
            Print
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          body {
            -webkit-print-color-adjust: exact;
          }

          .bg-gray-50 {
            background-color: #f9fafb !important;
          }
        }
      `}</style>
    </div>
  );
}

export default withAuthGuard(MonthlyReportDetail);
