"use client";

import { useAuth } from "./AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const withAuthGuard = (Component) => {
  return function GuardedComponent(props) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.push("/");
      }
    }, [loading, user]);

    if (loading) return <div>Loading...</div>;
    if (!user) return null;

    return <Component {...props} />;
  };
};
