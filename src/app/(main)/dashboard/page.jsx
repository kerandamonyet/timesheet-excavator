"use client";

import { withAuthGuard } from "@/firebase/withAuthGuard";
import { Hammer, CalendarClock, Wallet } from "lucide-react";
import React, { useEffect, useState } from "react";
import MainMenu from "../../../components/MainMenu";
import { db } from "@/firebase/config";
import { collection, getDocs, query, where } from "firebase/firestore";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

const DashboardPage = () => {
  const [stats, setStats] = useState({
    totalExcavators: 0,
    totalHours: 0,
    estimatedSalary: 0,
    loading: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Ambil jumlah total excavator
        const excavatorsSnapshot = await getDocs(collection(db, "excavators"));
        const totalExcavators = excavatorsSnapshot.size;

        // 2. Hitung jam kerja dan gaji bulan ini
        const currentMonth = dayjs().format("MM");
        const currentYear = dayjs().format("YYYY");

        const startDate = dayjs(`${currentYear}-${currentMonth}-01`).format(
          "YYYY-MM-DD"
        );
        const endDate = dayjs(`${currentYear}-${currentMonth}-01`)
          .endOf("month")
          .format("YYYY-MM-DD");

        const q = query(
          collection(db, "timesheets"),
          where("date", ">=", startDate),
          where("date", "<=", endDate)
        );

        const timesheetsSnapshot = await getDocs(q);

        let totalHours = 0;
        let estimatedSalary = 0;

        timesheetsSnapshot.forEach((doc) => {
          const data = doc.data();
          const workHours = data.workHours || 0;
          const overtimeHours = data.overtimeHours || 0;
          const totalPay = data.totalPay || 0;

          totalHours += workHours + overtimeHours;
          estimatedSalary += totalPay;
        });

        setStats({
          totalExcavators,
          totalHours: Math.round(totalHours * 100) / 100,
          estimatedSalary,
          loading: false,
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setStats((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (stats.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-indigo-700">
            Dashboard Admin
          </h1>
          <p className="text-sm text-gray-600">Memuat data...</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow p-4 border border-gray-100 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="bg-gray-200 rounded-full w-12 h-12"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-6 bg-gray-300 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <MainMenu />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-indigo-700">
            Dashboard Admin
          </h1>
          <p className="text-sm text-gray-600">
            Pantauan alat dan aktivitas kerja
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Total Excavators */}
          <div className="flex items-center gap-4 bg-white rounded-xl shadow p-4 border border-indigo-100">
            <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full">
              <Hammer className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Alat</p>
              <h2 className="text-xl font-semibold text-indigo-800">
                {stats.totalExcavators}
              </h2>
            </div>
          </div>

          {/* Total Work Hours */}
          <div className="flex items-center gap-4 bg-white rounded-xl shadow p-4 border border-purple-100">
            <div className="bg-purple-100 text-purple-600 p-3 rounded-full">
              <CalendarClock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Jam Bulan Ini</p>
              <h2 className="text-xl font-semibold text-purple-800">
                {stats.totalHours} jam
              </h2>
            </div>
          </div>

          {/* Estimated Salary */}
          <div className="flex items-center gap-4 bg-white rounded-xl shadow p-4 border border-pink-100 sm:col-span-2">
            <div className="bg-pink-100 text-pink-600 p-3 rounded-full">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Estimasi Gaji Bulanan</p>
              <h2 className="text-xl font-semibold text-pink-800">
                {formatCurrency(stats.estimatedSalary)}
              </h2>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-2">Ingin menambahkan data?</p>
          <a
            href="/excavators"
            className="inline-block px-6 py-2 text-white bg-indigo-600 rounded-lg shadow hover:bg-indigo-700 transition"
          >
            Kelola Alat
          </a>
        </div>
      </div>

      <MainMenu />
    </>
  );
};

export default withAuthGuard(DashboardPage);
