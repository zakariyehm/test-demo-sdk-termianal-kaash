"use client";

import { PRODUCTS, type Product } from "@/data/products";
import { useMemo, useState } from "react";

type CartLine = {
  product: Product;
  qty: number;
};

type PaymentMethod = "cash" | "kaash" | null;

type KaashPhase =
  | "idle"
  | "initializing"
  | "ready"
  | "waitingForTap"
  | "cardDetected"
  | "paymentProcessing"
  | "approved"
  | "declined"
  | "timeout"
  | "error";

type Receipt = {
  method: "cash" | "kaash";
  total: number;
  reference?: string;
  transactionId?: string;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function PosCheckout() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [kaashPhase, setKaashPhase] = useState<KaashPhase>("idle");
  const [kaashMessage, setKaashMessage] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.price * line.qty, 0),
    [cart],
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.qty, 0),
    [cart],
  );

  function addToCart(product: Product) {
    setReceipt(null);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) =>
          line.product.id === product.id
            ? { ...line, qty: line.qty + 1 }
            : line,
        );
      }
      return [...current, { product, qty: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setReceipt(null);
    setCart((current) =>
      current
        .map((line) =>
          line.product.id === productId
            ? { ...line, qty: line.qty + delta }
            : line,
        )
        .filter((line) => line.qty > 0),
    );
  }

  function clearCart() {
    setCart([]);
    setReceipt(null);
    setPaymentMethod(null);
    setKaashPhase("idle");
    setKaashMessage("");
  }

  async function payWithCash() {
    if (total <= 0 || isPaying) return;

    setPaymentMethod("cash");
    setIsPaying(true);
    setKaashPhase("idle");
    setKaashMessage("");

    await new Promise((resolve) => setTimeout(resolve, 600));

    setReceipt({
      method: "cash",
      total,
      transactionId: `CASH-${Date.now()}`,
    });
    setIsPaying(false);
  }

  async function payWithKaash() {
    if (total <= 0 || isPaying) return;

    setPaymentMethod("kaash");
    setIsPaying(true);
    setReceipt(null);
    setKaashPhase("initializing");
    setKaashMessage("Initializing terminal...");

    try {
      const response = await fetch("/api/kaash/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(total.toFixed(2)),
          currency: "USD",
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Could not start Kaash payment");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const lines = chunk.split("\n");
          const eventLine = lines.find((line) => line.startsWith("event:"));
          const dataLine = lines.find((line) => line.startsWith("data:"));
          if (!eventLine || !dataLine) continue;

          const event = eventLine.replace("event: ", "").trim();
          const data = JSON.parse(dataLine.replace("data: ", ""));

          if (event === "status") {
            if (data.phase === "initializing") {
              setKaashPhase("initializing");
              setKaashMessage("Checking reader, API, and merchant key...");
            }
            if (data.phase === "ready") {
              setKaashPhase("ready");
              setKaashMessage("Terminal ready. Starting payment...");
            }
          }

          if (event === "waitingForTap") {
            setKaashPhase("waitingForTap");
            setKaashMessage("Tap phone on NFC reader");
          }

          if (event === "cardDetected") {
            setKaashPhase("cardDetected");
            setKaashMessage("Phone detected. Reading wallet...");
          }

          if (event === "paymentProcessing") {
            setKaashPhase("paymentProcessing");
            setKaashMessage("Processing payment...");
          }

          if (event === "approved") {
            setKaashPhase("approved");
            setKaashMessage("Payment approved");
          }

          if (event === "declined") {
            setKaashPhase("declined");
            setKaashMessage(data.message ?? "Payment declined");
          }

          if (event === "timeout") {
            setKaashPhase("timeout");
            setKaashMessage("Tap timed out. Try again.");
          }

          if (event === "error") {
            setKaashPhase("error");
            setKaashMessage(data.message ?? "Payment failed");
          }

          if (event === "complete") {
            if (data.status === "APPROVED") {
              setReceipt({
                method: "kaash",
                total,
                reference: data.reference,
                transactionId: data.transactionId ?? data.reference,
              });
              setKaashPhase("approved");
              setKaashMessage(`Paid: ${data.reference}`);
            } else {
              setKaashPhase("declined");
              setKaashMessage(data.message ?? "Payment not approved");
            }
          }
        }
      }
    } catch (error) {
      setKaashPhase("error");
      setKaashMessage(
        error instanceof Error ? error.message : "Kaash payment failed",
      );
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <p className="text-sm font-medium text-emerald-700">Kaash POS Demo</p>
            <h1 className="text-2xl font-bold">Supermarket Checkout</h1>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm">
            {itemCount} items · {formatMoney(total)}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Products</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {PRODUCTS.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
              >
                <p className="font-semibold">{product.title}</p>
                <p className="mt-2 text-lg font-bold text-emerald-700">
                  {formatMoney(product.price)}
                </p>
                <p className="mt-3 text-sm text-slate-500">Tap to add</p>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cart</h2>
              <button
                type="button"
                onClick={clearCart}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Clear
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="py-8 text-center text-slate-500">
                Dooro alaab si aad u bilowdo
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => (
                  <div
                    key={line.product.id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{line.product.title}</p>
                      <p className="text-sm text-slate-500">
                        {formatMoney(line.product.price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(line.product.id, -1)}
                        className="h-8 w-8 rounded-lg border border-slate-300"
                      >
                        -
                      </button>
                      <span className="w-6 text-center">{line.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(line.product.id, 1)}
                        className="h-8 w-8 rounded-lg border border-slate-300"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Payment</h2>
            <div className="grid gap-3">
              <button
                type="button"
                disabled={total <= 0 || isPaying}
                onClick={payWithCash}
                className="rounded-xl bg-slate-900 px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Cash Payment
              </button>
              <button
                type="button"
                disabled={total <= 0 || isPaying}
                onClick={payWithKaash}
                className="rounded-xl bg-emerald-600 px-4 py-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                Kaash Wallet · Tap to Pay
              </button>
            </div>

            {paymentMethod === "kaash" && kaashPhase !== "idle" && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-800">Kaash status</p>
                <p className="mt-1 font-semibold capitalize">{kaashPhase}</p>
                <p className="mt-2 text-sm text-emerald-900">{kaashMessage}</p>
              </div>
            )}
          </div>

          {receipt && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-emerald-900">Receipt</h2>
              <p className="mt-2 text-sm text-emerald-800">
                Method: {receipt.method === "cash" ? "Cash" : "Kaash Wallet"}
              </p>
              <p className="text-sm text-emerald-800">
                Total: {formatMoney(receipt.total)}
              </p>
              {receipt.reference && (
                <p className="text-sm text-emerald-800">
                  Reference: {receipt.reference}
                </p>
              )}
              {receipt.transactionId && (
                <p className="text-sm text-emerald-800">
                  Transaction: {receipt.transactionId}
                </p>
              )}
              <button
                type="button"
                onClick={clearCart}
                className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
              >
                New sale
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
