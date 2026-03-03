"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

function getOrCreateDummyUid() {
  const KEY = "kita_dummy_uid";
  const existing =
    typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
  if (existing) return existing;

  const uid = "demo-" + Math.random().toString(36).slice(2, 10);
  if (typeof window !== "undefined") localStorage.setItem(KEY, uid);
  return uid;
}

export default function MePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [uid, setUid] = useState<string>("");
  const [points, setPoints] = useState<number>(3); // ダミー。あとでFirestoreに置き換える
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const goal = 10;
  const remaining = useMemo(() => Math.max(goal - points, 0), [points]);

  // 初回だけ uid を用意 + 擬似ローディング解除
  useEffect(() => {
    const u = getOrCreateDummyUid();
    setUid(u);
    const t = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // uid ができたらQR生成
  useEffect(() => {
    if (!uid) return;

    QRCode.toDataURL(uid, { width: 240, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [uid]);

  if (isLoading) {
    return (
      <main className="min-h-screen grid place-items-center bg-gray-50">
        <div className="animate-pulse text-gray-500 text-lg">
          Loading your card...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-xs sm:max-w-sm space-y-4">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Kita Loyalty Card</h1>
          <p className="text-sm text-gray-600">
            Please show this QR code to the staff at checkout.
          </p>
        </header>

        <section className="rounded-2xl bg-gradient-to-br from-black to-gray-800 p-6 text-white shadow-xl">
          <div className="text-xs opacity-70 break-all text-center">
            uid: {uid}
          </div>

          <div className="mt-4 flex justify-center bg-white rounded-xl p-3">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="my-qr" className="h-56 w-56" />
            ) : (
              <div className="h-56 w-56 grid place-items-center bg-gray-200 rounded-lg text-black">
                Generating...
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <div className="text-sm opacity-70">Current Points</div>
            <div className="text-4xl font-bold">{points}</div>
            <div className="mt-1 text-sm">
              {remaining === 0
                ? "🎉 Reward Available!"
                : `Only ${remaining} more drinks for a free one!`}
            </div>
          </div>
        </section>

        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 text-center">
          📱 Add this page to your home screen for quick access.
        </div>

        {/* ダミーボタン（後で消す） */}
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-lg bg-black px-3 py-2 text-white"
            onClick={() => setPoints((p) => Math.min(p + 1, 99))}
          >
            +1 (demo)
          </button>
          <button
            className="flex-1 rounded-lg border px-3 py-2"
            onClick={() => setPoints((p) => Math.max(p - 1, 0))}
          >
            -1 (demo)
          </button>
        </div>
      </div>
    </main>
  );
}