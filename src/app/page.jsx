"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import firebaseApp from "./firebase/config";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import { useRouter } from "next/navigation";

const MySwal = withReactContent(Swal);

const loginSchema = z.object({
  email: z.string().email({ message: "Email tidak valid" }),
  password: z.string().min(6, { message: "Minimal 6 karakter" }),
});

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [firebaseError, setFirebaseError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const auth = getAuth(firebaseApp);

  const router = useRouter();

  const onSubmit = async (data) => {
    setIsLoading(true);
    setFirebaseError("");

    try {
      const result = await signInWithEmailAndPassword(
        auth,
        data.email,
        data.password
      );

      await MySwal.fire({
        icon: "success",
        title: `Selamat Datang, ${result.user.email}`,
        text: "Login berhasil!",
        timer: 2000,
        showConfirmButton: false,
      });

      router.push("/dashboard");
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = "Terjadi kesalahan saat login";
      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Format email tidak valid";
          break;
        case "auth/user-disabled":
          errorMessage = "Akun ini dinonaktifkan";
          break;
        case "auth/user-not-found":
          errorMessage = "Email tidak terdaftar";
          break;
        case "auth/wrong-password":
          errorMessage = "Password salah";
          break;
        case "auth/too-many-requests":
          errorMessage = "Terlalu banyak percobaan gagal. Coba lagi nanti";
          break;
        default:
          errorMessage = error.message || "Login gagal";
      }

      await MySwal.fire({
        icon: "error",
        title: "Login Gagal",
        text: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-pink-400/20 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-xl border border-white/30 rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Selamat Datang
            </h1>
            <p className="text-indigo-700 font-medium mt-2">
              Silakan masuk ke akun Anda
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-indigo-800">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-indigo-600" />
                </div>
                <input
                  {...register("email")}
                  type="email"
                  placeholder="nama@email.com"
                  className="w-full pl-10 pr-4 py-3 text-indigo-900 font-medium border-2 border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 transition-all duration-200 bg-white/90 backdrop-blur-sm placeholder:text-indigo-300 hover:border-indigo-200 focus:shadow-lg focus:shadow-indigo-100"
                />
              </div>
              {errors.email && (
                <p className="text-red-600 text-sm flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-indigo-800">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-indigo-600" />
                </div>
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  className="w-full pl-10 pr-12 py-3 text-indigo-900 font-medium border-2 border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-300 transition-all duration-200 bg-white/90 backdrop-blur-sm placeholder:text-indigo-300 hover:border-indigo-200 focus:shadow-lg focus:shadow-indigo-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-indigo-600 hover:text-indigo-800 transition-colors"
                  aria-label={
                    showPassword ? "Sembunyikan password" : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-600 text-sm flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors transform hover:scale-[1.03]"
              >
                Lupa password?
              </button>
            </div>

            {/* Firebase Error Message */}
            {firebaseError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
                {firebaseError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-bold hover:from-indigo-600 hover:to-purple-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-indigo-300/50 hover:shadow-indigo-400/50"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Memproses...
                </div>
              ) : (
                <span className="drop-shadow-sm">Masuk Sekarang</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-indigo-100">
            <div className="text-center">
              <p className="text-sm text-indigo-700">
                Perlu bantuan?{" "}
                <button className="font-bold text-indigo-800 hover:text-indigo-900 transition-colors">
                  Hubungi Admin
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
