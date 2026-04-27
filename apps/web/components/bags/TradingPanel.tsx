"use client";

import * as React from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { ArrowRightLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@repo/ui";
import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { formatAddress } from "@repo/lib";
import { solscanTxUrl } from "@/lib/solana/explorer";

type QuoteResponse = {
  contextSlot: number;
  inAmount: string;
  inputMint: string;
  minOutAmount: string;
  otherAmountThreshold: string;
  outAmount: string;
  outputMint: string;
  priceImpactPct: string;
  routePlan: Array<{ venue: string }>;
  slippageBps: number;
  requestId: string;
  simulatedComputeUnits: number | null;
};

type ProjectQuotePayload = {
  tokenMint: string;
  side: "buy" | "sell";
  quote: QuoteResponse;
  inputDecimals: number;
  outputDecimals: number;
};

type SwapPayload = {
  transactionBase64: string;
  computeUnitLimit: number;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
};

type ApiErrorPayload = {
  message?: string;
  error?: string;
};

const DEFAULT_AMOUNT_SOL = "0.10";
const DEFAULT_SLIPPAGE_BPS = 100;

export function TradingPanel({
  projectId,
  symbol,
  tokenMint,
}: {
  projectId: string;
  symbol: string;
  tokenMint: string;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [amount, setAmount] = React.useState(DEFAULT_AMOUNT_SOL);
  const [quote, setQuote] = React.useState<ProjectQuotePayload | null>(null);
  const [signature, setSignature] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [quotePending, startQuoteTransition] = React.useTransition();
  const [swapPending, startSwapTransition] = React.useTransition();

  const amountLamports = React.useMemo(() => solToLamports(amount), [amount]);
  const canQuote = amountLamports != null && amountLamports > 0;
  const outputLabel = quote
    ? formatAtomicAmount(quote.quote.outAmount, quote.outputDecimals, symbol)
    : null;
  const minOutputLabel = quote
    ? formatAtomicAmount(quote.quote.minOutAmount, quote.outputDecimals, symbol)
    : null;

  function fetchQuote() {
    if (!canQuote || amountLamports == null) {
      setError("Enter a valid SOL amount.");
      return;
    }
    setError(null);
    setSignature(null);
    startQuoteTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/trading/quote`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            side: "buy",
            amount: amountLamports,
            slippageBps: DEFAULT_SLIPPAGE_BPS,
          }),
        });
        const payload = (await res.json().catch(() => null)) as
          | ProjectQuotePayload
          | ApiErrorPayload
          | null;
        if (!res.ok) {
          throw new Error(
            errorMessage(
              payload as ApiErrorPayload | null,
              `Quote failed (${res.status})`,
            ),
          );
        }
        setQuote(payload as ProjectQuotePayload);
      } catch (e) {
        setQuote(null);
        setError(e instanceof Error ? e.message : "Quote failed.");
      }
    });
  }

  function buildAndSendSwap() {
    if (!quote) {
      setError("Refresh the quote first.");
      return;
    }
    if (!connected || !publicKey) {
      setError("Connect a wallet to sign the swap.");
      return;
    }
    setError(null);
    setSignature(null);
    startSwapTransition(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/trading/swap`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            quoteResponse: quote.quote,
            userPublicKey: publicKey.toBase58(),
          }),
        });
        const payload = (await res.json().catch(() => null)) as
          | SwapPayload
          | ApiErrorPayload
          | null;
        if (!res.ok) {
          throw new Error(
            errorMessage(
              payload as ApiErrorPayload | null,
              `Swap transaction failed (${res.status})`,
            ),
          );
        }
        const swap = payload as SwapPayload;
        const tx = VersionedTransaction.deserialize(
          base64ToBytes(swap.transactionBase64),
        );
        const sig = await sendTransaction(tx, connection, {
          maxRetries: 3,
        });
        setSignature(sig);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Swap failed.");
      }
    });
  }

  return (
    <Card depth="raised" padding="default">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Trade</CardTitle>
            <CardDescription>
              Bags quote and wallet-signed swap for this repo token.
            </CardDescription>
          </div>
          <Badge variant="default" size="sm">
            no KYC
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="mt-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="min-w-0">
            <span className="mb-1 block text-label-sm text-fg-secondary">
              Pay
            </span>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
                setSignature(null);
              }}
              leadingIcon={<ArrowRightLeft className="size-4" />}
              trailingIcon={
                <span className="text-mono-sm text-fg-muted">SOL</span>
              }
              aria-invalid={!canQuote}
            />
          </label>
          <div className="flex items-end">
            <Button
              type="button"
              variant="secondary"
              onClick={fetchQuote}
              disabled={quotePending || !canQuote}
            >
              {quotePending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Quote
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface-elevated/50 p-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <TradeStat
              label="Receive"
              value={outputLabel ?? "--"}
              title={quote?.quote.outAmount}
            />
            <TradeStat
              label="Minimum"
              value={minOutputLabel ?? "--"}
              title={quote?.quote.minOutAmount}
            />
            <TradeStat
              label="Impact"
              value={quote ? `${quote.quote.priceImpactPct}%` : "--"}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span
              className="text-mono-sm text-fg-muted"
              title={quote?.quote.requestId}
            >
              {quote
                ? `slot ${quote.quote.contextSlot.toLocaleString("en-US")}`
                : formatAddress(tokenMint, 6, 6)}
            </span>
            <span className="text-mono-sm text-fg-muted">
              slippage {(DEFAULT_SLIPPAGE_BPS / 100).toFixed(2)}%
            </span>
          </div>
        </div>

        {connected ? (
          <Button
            type="button"
            variant="primary"
            onClick={buildAndSendSwap}
            disabled={!quote || swapPending}
          >
            {swapPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRightLeft className="size-4" />
            )}
            Swap with Bags
          </Button>
        ) : (
          <WalletConnectButton />
        )}

        {signature ? (
          <a
            href={solscanTxUrl(signature)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-mono-sm text-success underline-offset-4 hover:underline"
          >
            {formatAddress(signature, 8, 6)}
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
        {error ? <p className="text-body-sm text-danger">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

function TradeStat({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-caption text-fg-muted">{label}</div>
      <div className="mt-1 truncate text-mono-md text-fg" title={title}>
        {value}
      </div>
    </div>
  );
}

function solToLamports(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    return null;
  }
  const [wholeRaw = "0", fractionRaw = ""] = trimmed.split(".");
  const whole = BigInt(wholeRaw === "" ? "0" : wholeRaw);
  const fraction = BigInt(fractionRaw.padEnd(9, "0").slice(0, 9) || "0");
  const lamports = whole * 1_000_000_000n + fraction;
  if (lamports > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(lamports);
}

function formatAtomicAmount(
  amountRaw: string,
  decimals: number,
  symbol: string,
): string {
  const amount = BigInt(amountRaw);
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = amount % scale;
  const fractionText = fraction
    .toString()
    .padStart(decimals, "0")
    .slice(0, 4)
    .replace(/0+$/, "");
  return `${whole.toLocaleString("en-US")}${
    fractionText ? `.${fractionText}` : ""
  } ${symbol}`;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function errorMessage(payload: ApiErrorPayload | null, fallback: string) {
  return payload?.message ?? payload?.error ?? fallback;
}
