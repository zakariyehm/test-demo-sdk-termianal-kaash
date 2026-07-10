import { getKaash } from "@/lib/kaash-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PayBody = {
  amount: number;
  currency?: string;
  transactionId?: string;
};

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  let body: PayBody;

  try {
    body = (await request.json()) as PayBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const currency = body.currency ?? "USD";
  const transactionId =
    body.transactionId ?? `POS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };

      try {
        const kaash = getKaash();

        send("status", { phase: "initializing" });
        await kaash.initialize();
        send("status", { phase: "ready", transactionId });

        const result = await kaash.pay({
          amount: body.amount,
          currency,
          transactionId,
          onReaderConnected: () => send("readerConnected", {}),
          onWaitingForTap: () => send("waitingForTap", {}),
          onCardDetected: () => send("cardDetected", {}),
          onPaymentProcessing: () => send("paymentProcessing", {}),
          onReaderDisconnected: () => send("readerDisconnected", {}),
          onApproved: (payment) => send("approved", payment),
          onDeclined: (error) => send("declined", { message: error.message }),
          onTimeout: () => send("timeout", {}),
        });

        send("complete", result);
      } catch (error) {
        send("error", {
          message: error instanceof Error ? error.message : "Payment failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
