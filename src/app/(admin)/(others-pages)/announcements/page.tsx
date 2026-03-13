"use client";
import React, { useEffect, useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { useDialog } from "@/context/DialogContext";
import {
    type AnnouncementItem,
    createAnnouncement,
    deleteAnnouncement,
    getAllAnnouncements,
    updateAnnouncement,
} from "@/actions/notification";

export default function AnnouncementPage() {
    const { showAlert } = useDialog();
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);

    const loadAnnouncements = async () => {
        setIsLoadingList(true);
        const data = await getAllAnnouncements();
        setAnnouncements(data);
        setIsLoadingList(false);
    };

    useEffect(() => {
        void loadAnnouncements();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedTitle = title.trim();
        const trimmedMessage = message.trim();

        if (!trimmedTitle || !trimmedMessage) {
            await showAlert("Title dan message wajib diisi", "warning");
            return;
        }

        setLoading(true);
        const res = editingId
            ? await updateAnnouncement(editingId, trimmedTitle, trimmedMessage)
            : await createAnnouncement(trimmedTitle, trimmedMessage);
        setLoading(false);

        if (res.success) {
            await showAlert(
                editingId ? "Announcement berhasil diupdate!" : "Announcement berhasil dibuat!",
                "success",
            );
            setTitle("");
            setMessage("");
            setEditingId(null);
            await loadAnnouncements();
        } else {
            await showAlert(res.error ?? "Terjadi kesalahan", "error");
        }
    };

    const handleEdit = (item: AnnouncementItem) => {
        setEditingId(item.id);
        setTitle(item.title);
        setMessage(item.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleDelete = async (id: string) => {
        const confirmed = window.confirm("Hapus announcement ini?");
        if (!confirmed) return;

        const res = await deleteAnnouncement(id);
        if (res.success) {
            if (editingId === id) {
                setEditingId(null);
                setTitle("");
                setMessage("");
            }
            await showAlert("Announcement berhasil dihapus", "success");
            await loadAnnouncements();
            return;
        }
        await showAlert(res.error ?? "Gagal menghapus announcement", "error");
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle("");
        setMessage("");
    };

    return (
        <div className="grid gap-6 lg:grid-cols-5">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-2">
                <h2 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
                    {editingId ? "Edit Announcement" : "Create Announcement"}
                </h2>
                <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
                    {editingId
                        ? "Perbarui isi announcement yang sudah dipost."
                        : "Buat announcement baru untuk ditampilkan ke semua pengguna."}
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div>
                        <Label>Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Topic e.g. Maintenance" />
                    </div>
                    <div>
                        <Label>Message</Label>
                        <textarea 
                            className="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-base text-gray-800 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-800 dark:bg-transparent dark:text-white"
                            rows={6}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Details of the announcement..."
                            required
                        />
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="rounded bg-brand-500 px-6 py-2.5 font-medium text-gray-100 hover:bg-opacity-90 disabled:opacity-50"
                        >
                            {loading ? "Saving..." : editingId ? "Update Announcement" : "Post Announcement"}
                        </button>
                        {editingId && (
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded border border-gray-300 px-6 py-2.5 font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:col-span-3">
                <h2 className="mb-6 text-xl font-semibold text-gray-800 dark:text-white">
                    Announcement List
                </h2>

                {isLoadingList ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data announcement...</p>
                ) : announcements.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada announcement.</p>
                ) : (
                    <div className="space-y-4">
                        {announcements.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
                            >
                                <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {new Date(item.createdAt).toLocaleString("id-ID")}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleEdit(item)}
                                            className="rounded border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-900/20"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item.id)}
                                            className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-900/20"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">{item.message}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
