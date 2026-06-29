"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Plus,
  Trash2,
  KeyRound,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createUser,
  setUserRole,
  resetPassword,
  deleteUser,
} from "@/app/admin/actions";

type Row = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt: string | null;
  workouts: number;
  completed: number;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

export default function AdminUsers({
  meId,
  users,
}: {
  meId: number;
  users: Row[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "user" as "admin" | "user",
    password: "",
  });
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [newPw, setNewPw] = useState("");

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function submitCreate() {
    setBusy(true);
    const res = await createUser(form);
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      setForm({ email: "", name: "", role: "user", password: "" });
      flash("User created.");
      router.refresh();
    } else flash(res.error ?? "Failed.");
  }

  async function changeRole(u: Row, role: "admin" | "user") {
    const res = await setUserRole(u.id, role);
    if (!res.ok) flash(res.error ?? "Failed.");
    else router.refresh();
  }

  async function doReset() {
    if (!resetFor) return;
    setBusy(true);
    const res = await resetPassword(resetFor.id, newPw);
    setBusy(false);
    if (res.ok) {
      flash(`Password reset for ${resetFor.email}.`);
      setResetFor(null);
      setNewPw("");
    } else flash(res.error ?? "Failed.");
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    const res = await deleteUser(confirmDelete.id);
    setBusy(false);
    if (res.ok) {
      flash("User deleted.");
      setConfirmDelete(null);
      router.refresh();
    } else flash(res.error ?? "Failed.");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Shield size={20} className="text-brand-600" /> Admin · Users
        </h1>
        <button
          onClick={() => setAdding((a) => !a)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={16} /> New user
        </button>
      </div>

      {toast && (
        <p className="mb-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink">{toast}</p>
      )}

      {adding && (
        <div className="mb-4 rounded-2xl border border-brand-500 bg-card p-4 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              autoFocus
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              type="email"
              className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name"
              className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Temporary password"
              className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <select
              value={form.role}
              onChange={(e) =>
                setForm({ ...form, role: e.target.value as "admin" | "user" })
              }
              className="rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              disabled={busy}
              onClick={submitCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Create
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs font-semibold uppercase text-muted">
            <tr>
              <th className="px-4 py-2.5">User</th>
              <th className="px-2 py-2.5">Role</th>
              <th className="px-2 py-2.5">Workouts</th>
              <th className="px-2 py-2.5">Last login</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name || "—"}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td className="px-2 py-3">
                  <select
                    value={u.role}
                    onChange={(e) =>
                      changeRole(u, e.target.value as "admin" | "user")
                    }
                    className={cn(
                      "rounded-lg border border-line px-2 py-1 text-xs font-medium",
                      u.role === "admin" ? "text-brand-600" : "text-ink",
                    )}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-2 py-3 text-muted">
                  {u.completed}/{u.workouts}
                </td>
                <td className="px-2 py-3 text-muted">{fmtDate(u.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/users/${u.id}`}
                      title="Edit coach"
                      className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-brand-600"
                    >
                      <MessageCircle size={15} />
                    </Link>
                    <button
                      onClick={() => {
                        setResetFor(u);
                        setNewPw("");
                      }}
                      title="Reset password"
                      className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
                    >
                      <KeyRound size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmDelete(u)}
                      disabled={u.id === meId}
                      title={u.id === meId ? "You can't delete yourself" : "Delete"}
                      className="rounded-lg p-2 text-muted hover:bg-bad/10 hover:text-bad disabled:opacity-30"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset password dialog */}
      {resetFor && (
        <Dialog title={`Reset password — ${resetFor.email}`} onClose={() => setResetFor(null)}>
          <input
            autoFocus
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setResetFor(null)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium">
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={doReset}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </Dialog>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <Dialog title="Delete user?" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-muted">
            This permanently deletes{" "}
            <span className="font-semibold text-ink">{confirmDelete.email}</span>{" "}
            and all their workouts, coach, and history.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-line px-4 py-2 text-sm font-medium">
              Cancel
            </button>
            <button
              disabled={busy}
              onClick={doDelete}
              className="rounded-lg bg-bad px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
