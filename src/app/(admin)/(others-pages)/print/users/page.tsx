"use client";

import { useEffect, useMemo, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";

type PrintUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  _count: { orders: number };
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

function roleBadgeColor(role: string) {
  if (role === "ADMIN") return "primary" as const;
  if (role === "PARTICIPANT") return "info" as const;
  return "light" as const;
}

export default function PrintUsersPage() {
  const [users, setUsers] = useState<PrintUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/print/users", { cache: "no-store" });
      const json = (await res.json()) as ApiResponse<PrintUser[]>;
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Failed to fetch users");
      }
      setUsers(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const totalUsers = users.length;
  const adminCount = useMemo(() => users.filter((user) => user.role === "ADMIN").length, [users]);
  const totalOrders = useMemo(() => users.reduce((sum, user) => sum + (user._count?.orders || 0), 0), [users]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Print Users</h1>
        <p className="mt-1 text-sm text-gray-500">Lihat user terdaftar dan distribusi order print per user.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Total Users</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalUsers}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Admin Accounts</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{adminCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-sm text-gray-500">Total Print Orders</p>
          <p className="mt-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{totalOrders}</p>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">User Directory</h2>
          <Button variant="outline" size="sm" onClick={() => void loadUsers()}>Refresh</Button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-500">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-b border-gray-200 text-left dark:border-gray-800">
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Name</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Email</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Role</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Print Orders</TableCell>
                  <TableCell isHeader className="py-3 pr-4 font-medium text-gray-600 dark:text-gray-300">Joined</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-b border-gray-100 dark:border-gray-800/80">
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{user.name || "-"}</TableCell>
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{user.email}</TableCell>
                    <TableCell className="py-3 pr-4"><Badge color={roleBadgeColor(user.role)}>{user.role}</Badge></TableCell>
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{user._count?.orders || 0}</TableCell>
                    <TableCell className="py-3 pr-4 text-gray-700 dark:text-gray-200">{new Date(user.createdAt).toLocaleDateString("id-ID")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
