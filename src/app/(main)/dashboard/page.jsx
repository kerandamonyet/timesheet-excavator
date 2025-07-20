"use client";

import { Hammer, CalendarClock, Wallet } from "lucide-react";
import React from "react";
import MainMenu from "../../../components/MainMenu";

const DashboardPage = () => {
  // Simulasi data statis — Anda bisa ambil dari Firestore nanti
  const totalExcavators = 6;
  const totalHours = 132;
  const estimatedSalary = 38500000;

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
                {totalExcavators}
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
                {totalHours} jam
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
                Rp {estimatedSalary.toLocaleString("id-ID")}
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

export default DashboardPage;
