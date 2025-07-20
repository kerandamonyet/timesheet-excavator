"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  ClipboardList,
  FileBarChart2,
  LogOut,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/config";

import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

const menu = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Excavator", href: "/excavators", icon: Settings },
  { name: "Absensi", href: "/timesheets", icon: ClipboardList },
  { name: "Laporan", href: "/reports", icon: FileBarChart2 },
];

const MainMenu = () => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const result = await MySwal.fire({
      title: "Yakin ingin keluar?",
      text: "Anda akan keluar dari sesi admin.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#aaa",
      confirmButtonText: "Keluar",
      cancelButtonText: "Batal",
    });

    if (result.isConfirmed) {
      try {
        await signOut(auth);
        await MySwal.fire({
          icon: "success",
          title: "Berhasil keluar",
          timer: 1500,
          showConfirmButton: false,
        });
        router.push("/");
      } catch (err) {
        MySwal.fire("Oops", "Gagal logout: " + err.message, "error");
      }
    }
  };

  return (
    <>
      {/* Mobile - Bottom Navbar */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-md z-50 md:hidden transition-all duration-200">
        <ul className="flex justify-around items-center py-2">
          {menu.map(({ name, href, icon: Icon }) => (
            <li key={name}>
              <Link href={href}>
                <div
                  className={`flex flex-col items-center text-xs transition-all duration-200 hover:scale-105 ${
                    pathname.startsWith(href)
                      ? "text-indigo-600 font-medium"
                      : "text-gray-500"
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 mb-1 transition-colors duration-200 ${
                      pathname.startsWith(href)
                        ? "text-indigo-600"
                        : "text-gray-400"
                    }`}
                  />
                  <span>{name}</span>
                </div>
              </Link>
            </li>
          ))}

          {/* Logout Button */}
          <li>
            <button
              onClick={handleLogout}
              className="flex flex-col items-center text-xs transition-all duration-200 transform hover:scale-105 hover:text-red-600"
            >
              <LogOut className="w-6 h-6 mb-1 transition-colors duration-200 text-gray-400 group-hover:text-red-600" />
              <span className="text-red-500 font-medium">Logout</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:fixed md:inset-y-0 md:left-0 md:w-60 md:flex md:flex-col md:bg-white md:border-r md:shadow transition-all duration-200">
        <div className="flex items-center justify-center h-16 border-b text-xl font-bold text-indigo-600">
          Admin Panel
        </div>
        <ul className="flex-1 p-4 space-y-2">
          {menu.map(({ name, href, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <li key={name}>
                <Link href={href}>
                  <div
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-[1.02] hover:bg-indigo-50 ${
                      isActive
                        ? "bg-indigo-100 text-indigo-700"
                        : "text-gray-700"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors duration-200 ${
                        isActive ? "text-indigo-700" : "text-gray-500"
                      }`}
                    />
                    {name}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Logout Desktop */}
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-all duration-200 transform hover:scale-[1.03]"
          >
            <LogOut className="w-5 h-5 transition-colors duration-200 group-hover:text-red-700" />
            Keluar
          </button>
        </div>
      </aside>
    </>
  );
};

export default MainMenu;
