import { Connection, PublicKey } from "@solana/web3.js";

// RPCs to rotate through for reliability
const RPCS = [
  "https://mainnet.helius-rpc.com/?api-key=",
  "https://mainnet.helius-rpc.com/?api-key=",
  "https://rpc.publicnode.com/solana"
];

// SPL Token Program — where all mint instructions come from but you can also put your own program that you want like the pump.fun or raydium but this is for all of the new tokens
const PROGRAMS = [
  new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
];

const INIT_MINT_RE = /initialize.*mint/i;

let rpc = 0;
let fastConn = new Connection(RPCS[rpc], "processed");   // Fast logs
let txConn = new Connection(RPCS[rpc], "confirmed");     // Safe TX fetches

function rotate(reason: string) {
  console.warn(`\n[!] RPC ${rpc} failed (${reason}) — switching`);
  rpc = (rpc + 1) % RPCS.length;
  fastConn = new Connection(RPCS[rpc], "processed");
  txConn = new Connection(RPCS[rpc], "confirmed");
  listen();
}

async function handleLog(signature: string, logs: string[]) {
  if (!logs.some(l => INIT_MINT_RE.test(l))) return;

  const time = new Date().toLocaleTimeString();
  console.log(`\n⚡ [${time}] Mint Detected → https://solscan.io/tx/${signature}`);

  try {
    const tx = await txConn.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    const ixList = tx?.transaction?.message?.instructions ?? [];

    for (const ix of ixList) {
      if (
        "parsed" in ix &&
        ix.program === "spl-token" &&
        ix.parsed?.type?.toLowerCase().includes("initialize")
      ) {
      }
        if ("accounts" in ix) {
        const acc = (ix as any).accounts?.[0];
        if (acc && PublicKey.isOnCurve(acc)) {
          console.log(`   🧾CA: ${acc}`);
        }
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error("   ❌ Failed to fetch transaction:", e.message);
    } else {
      console.error("   ❌ Failed to fetch transaction:", e);
    }
  }
}

function listen() {
  console.log(`📡 Listening via ${RPCS[rpc]}`);

  try {
    for (const program of PROGRAMS) {
      fastConn.onLogs(program, ({ logs, signature }) => {
        handleLog(signature, logs);
      });
    }
  } catch (e: any) {
    rotate(e.message || "WebSocket error");
  }

  // Heartbeat to detect RPC stall
  setInterval(async () => {
    try {
      await fastConn.getBlockHeight();
    } catch {
      rotate("heartbeat timeout");
    }
  }, 4000);
}

listen();
