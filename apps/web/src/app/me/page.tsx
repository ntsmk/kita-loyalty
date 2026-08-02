"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";

import {
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";

import {
  doc,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";

export default function MePage() {
  const [uid, setUid] = useState<string>("");
  const [points, setPoints] = useState<number>(0);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const goal = 10;
  const remaining = useMemo(() => Math.max(goal - points, 0), [points]);

  // Firebase Anonymous Auth
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      setUid(user.uid);
      return;
    }

    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Anonymous sign-in failed:", error);
      setErrorMessage(
        "We could not open your loyalty card. Please try again."
      );
      setIsLoading(false);
    }
  });

  return unsubscribe;
}, []);

  // uid ができたらQR生成
useEffect(() => {
  if (!uid) return;

  QRCode.toDataURL(uid, {
    width: 240,
    margin: 1,
  })
    .then((dataUrl) => {
      setQrDataUrl(dataUrl);
    })
    .catch((error) => {
      console.error("QR generation failed:", error);

      setErrorMessage(
        "We could not generate your QR code."
      );

      setIsLoading(false);
    });
}, [uid]);

//Firestore購読用
useEffect(() => {
  if (!uid) return;

  const customerRef = doc(db, "customers", uid);

  const unsubscribe = onSnapshot(
    customerRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        setPoints(0);
        return;
      }

      const data = snapshot.data();
      setPoints(typeof data.points === "number" ? data.points : 0);
    },
    (error) => {
      console.error("Failed to listen to customer points:", error);
      setErrorMessage("We could not load your points. Please try again.");
    }
  );

  return unsubscribe;
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

  if (errorMessage) {
  return (
    <main className="grid min-h-screen place-items-center bg-gray-50 p-4">
      <section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow">
        <h1 className="text-xl font-bold text-gray-900">
          Something went wrong
        </h1>

        <p className="mt-2 text-sm text-gray-600">
          {errorMessage}
        </p>

        <button
          type="button"
          className="mt-5 w-full rounded-lg bg-black px-4 py-3 text-white"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </section>
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
            {/* 後で消すかも */}
            Customer ID: {uid}
          </div>

          <div className="mt-4 flex justify-center bg-white rounded-xl p-3">
            {qrDataUrl ? (
             <Image
                src={qrDataUrl}
                alt="Your Kita loyalty card QR code"
                width={224}
                height={224}
                unoptimized
                className="h-56 w-56"
              />
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

      </div>
    </main>
  );
}