import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userSessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { 
  getFullMarketQuotes, 
  getOptionChain, 
  getOptionContracts, 
  getNearestExpiry 
} from "@/lib/upstox-api";
import type { UpstoxFullQuote, UpstoxOptionChainEntry } from "@/lib/upstox-api";
import { NSE_FO_STOCKS } from "@/lib/nse-fo-stocks";
import { processStock, filterAndRankStocks } from "@/lib/analysis-engine";
import type { ScannedStock, AlertItem } from "@/lib/types";

// Cache for expiry dates (they don't change intraday)
const expiryCache: Map<string, { expiry: string; cachedAt: number }> = new Map();
const EXPIRY_CACHE_TTL = 3600000; // 1 hour

// Track option chain fetch errors
const ocErrorCache: Map<string, { error: string; failedAt: number }> = new Map();
const OC_ERROR_TTL = 300000; // 5 minutes - retry after this

/**
 * GET /api/scanner?sessionId=xxx
 * Run full scan of all NSE F&O stocks with complete option chain analysis
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 401 }
      );
    }

    // Get access token
    const sessions = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId))
      .limit(1);

    if (sessions.length === 0 || !sessions[0].isActive || !sessions[0].accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = sessions[0].accessToken;

    // Determine market status
    const marketStatus = getMarketStatus();

    // Fetch market quotes in batches (max 500 per call)
    const allStocks = NSE_FO_STOCKS;
    const chunkSize = 100;
    const allQuotes: Record<string, Record<string, unknown>> = {};
    let quoteErrors: string[] = [];

    for (let i = 0; i < allStocks.length; i += chunkSize) {
      const chunk = allStocks.slice(i, i + chunkSize);
      const keys = chunk.map((s) => s.instrumentKey);
      const quotes = await getFullMarketQuotes(keys, accessToken);
      if (quotes) {
        Object.assign(allQuotes, quotes);
      } else {
        quoteErrors.push(`Batch ${Math.floor(i/chunkSize) + 1} failed`);
      }
      if (i + chunkSize < allStocks.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    if (Object.keys(allQuotes).length === 0) {
      return NextResponse.json({
        bullishStocks: [],
        bearishStocks: [],
        allStocks: [],
        marketStatus,
        lastScanTime: new Date().toISOString(),
        totalScanned: 0,
        totalFiltered: 0,
        isScanning: false,
        scanError: `Could not fetch market data. ${quoteErrors.join(", ")}. Check if market is open and token is valid.`,
        alerts: [],
      });
    }

    // Map stocks with their quotes
    const stocksWithQuotes: Array<{
      stock: (typeof allStocks)[0];
      quote: UpstoxFullQuote;
    }> = [];

    for (const stock of allStocks) {
      // Try multiple key formats (Upstox returns keys with : instead of |)
      const possibleKeys = [
        stock.instrumentKey,
        stock.instrumentKey.replace("|", ":"),
        `NSE_EQ:${stock.symbol}`,
      ];

      let quoteData: UpstoxFullQuote | null = null;
      for (const key of possibleKeys) {
        if (allQuotes[key]) {
          quoteData = allQuotes[key] as unknown as UpstoxFullQuote;
          break;
        }
      }

      // Also try partial match on ISIN
      if (!quoteData) {
        const isin = stock.instrumentKey.split("|")[1];
        if (isin) {
          const allKeys = Object.keys(allQuotes);
          for (const qk of allKeys) {
            if (qk.includes(isin)) {
              quoteData = allQuotes[qk] as unknown as UpstoxFullQuote;
              break;
            }
          }
        }
      }

      if (quoteData && quoteData.last_price > 0) {
        stocksWithQuotes.push({ stock, quote: quoteData });
      }
    }

    console.log(`[Scanner] Found quotes for ${stocksWithQuotes.length} stocks`);

    // Fetch option chains for ALL stocks with rate limiting
    const processedStocks: ScannedStock[] = [];
    const alerts: AlertItem[] = [];
    const ocStats = { success: 0, failed: 0, skipped: 0 };
    
    // Process in batches for option chain fetching
    const OC_BATCH_SIZE = 5; // Smaller batches for reliability
    const OC_DELAY = 300; // 300ms between batches

    for (let i = 0; i < stocksWithQuotes.length; i += OC_BATCH_SIZE) {
      const batch = stocksWithQuotes.slice(i, i + OC_BATCH_SIZE);
      
      const batchPromises = batch.map(async ({ stock, quote }) => {
        let optionChainData: UpstoxOptionChainEntry[] | null = null;
        
        // Check if we recently failed for this stock
        const cachedError = ocErrorCache.get(stock.instrumentKey);
        if (cachedError && Date.now() - cachedError.failedAt < OC_ERROR_TTL) {
          ocStats.skipped++;
          return processStock(stock.symbol, stock.instrumentKey, quote, null);
        }

        try {
          // Get cached or fetch expiry
          let expiryDate = getCachedExpiry(stock.instrumentKey);
          
          if (!expiryDate) {
            const contractsResult = await getOptionContracts(stock.instrumentKey, accessToken);
            
            if (contractsResult.error) {
              console.log(`[Scanner] Option contracts error for ${stock.symbol}: ${contractsResult.error}`);
              ocErrorCache.set(stock.instrumentKey, { error: contractsResult.error, failedAt: Date.now() });
              ocStats.failed++;
              return processStock(stock.symbol, stock.instrumentKey, quote, null);
            }
            
            if (contractsResult.contracts && contractsResult.contracts.length > 0) {
              expiryDate = getNearestExpiry(contractsResult.contracts);
              if (expiryDate) {
                setCachedExpiry(stock.instrumentKey, expiryDate);
                console.log(`[Scanner] Found expiry for ${stock.symbol}: ${expiryDate}`);
              }
            }
          }

          if (expiryDate) {
            const chainResult = await getOptionChain(
              stock.instrumentKey,
              expiryDate,
              accessToken
            );
            
            if (chainResult.error) {
              console.log(`[Scanner] Option chain error for ${stock.symbol}: ${chainResult.error}`);
              ocErrorCache.set(stock.instrumentKey, { error: chainResult.error, failedAt: Date.now() });
              ocStats.failed++;
            } else if (chainResult.chain && chainResult.chain.length > 0) {
              optionChainData = chainResult.chain;
              ocStats.success++;
              console.log(`[Scanner] Got option chain for ${stock.symbol}: ${chainResult.chain.length} strikes`);
            } else {
              ocStats.failed++;
            }
          } else {
            console.log(`[Scanner] No expiry found for ${stock.symbol}`);
            ocStats.failed++;
          }
        } catch (err) {
          console.error(`[Scanner] Option chain exception for ${stock.symbol}:`, err);
          ocStats.failed++;
        }

        return processStock(
          stock.symbol,
          stock.instrumentKey,
          quote,
          optionChainData
        );
      });

      const batchResults = await Promise.all(batchPromises);
      processedStocks.push(...batchResults);

      // Rate limiting delay between batches
      if (i + OC_BATCH_SIZE < stocksWithQuotes.length) {
        await new Promise((r) => setTimeout(r, OC_DELAY));
      }
    }

    console.log(`[Scanner] OC Stats - Success: ${ocStats.success}, Failed: ${ocStats.failed}, Skipped: ${ocStats.skipped}`);

    // Filter and rank
    const { bullish, bearish, all } = filterAndRankStocks(processedStocks);

    // Generate alerts for significant events
    for (const stock of [...bullish.slice(0, 5), ...bearish.slice(0, 5)]) {
      if (stock.institutionalScore.totalScore >= 70) {
        alerts.push({
          id: `${stock.symbol}-${Date.now()}`,
          symbol: stock.symbol,
          type:
            stock.momentumDirection === "bullish"
              ? "bullish_momentum"
              : "bearish_momentum",
          message: `${stock.symbol} showing ${stock.momentumStrength} ${stock.momentumDirection} momentum (Score: ${stock.institutionalScore.totalScore})`,
          score: stock.institutionalScore.totalScore,
          timestamp: new Date().toISOString(),
        });
      }

      // Support/Resistance alerts using new strike-level structure
      if (stock.supportResistance) {
        const sr = stock.supportResistance;
        const immSupport = sr.immediateSupport;
        const immResistance = sr.immediateResistance;
        
        if (immSupport && immSupport.status === "strengthening" && immSupport.distancePercent < 2) {
          alerts.push({
            id: `${stock.symbol}-support-${Date.now()}`,
            symbol: stock.symbol,
            type: "support_strengthening",
            message: `${stock.symbol} near strong support at ₹${immSupport.strike} (OI: ${immSupport.oi})`,
            score: stock.institutionalScore.totalScore,
            timestamp: new Date().toISOString(),
          });
        }
        if (immResistance && immResistance.status === "weakening" && immResistance.distancePercent < 2) {
          alerts.push({
            id: `${stock.symbol}-resistance-${Date.now()}`,
            symbol: stock.symbol,
            type: "resistance_weakening",
            message: `${stock.symbol} near weakening resistance at ₹${immResistance.strike}`,
            score: stock.institutionalScore.totalScore,
            timestamp: new Date().toISOString(),
          });
        }
        if (sr.breakoutPotential) {
          alerts.push({
            id: `${stock.symbol}-breakout-${Date.now()}`,
            symbol: stock.symbol,
            type: "resistance_weakening",
            message: `${stock.symbol} showing breakout potential - resistance weakening`,
            score: stock.institutionalScore.totalScore,
            timestamp: new Date().toISOString(),
          });
        }
        if (sr.breakdownPotential) {
          alerts.push({
            id: `${stock.symbol}-breakdown-${Date.now()}`,
            symbol: stock.symbol,
            type: "support_weakening",
            message: `${stock.symbol} showing breakdown potential - support weakening`,
            score: stock.institutionalScore.totalScore,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    const scanError = ocStats.success === 0 && ocStats.failed > 0 
      ? `Option chain data unavailable. Fetched ${ocStats.failed} stocks without OC data. Check if F&O contracts are available.`
      : null;

    return NextResponse.json({
      bullishStocks: bullish.slice(0, 30),
      bearishStocks: bearish.slice(0, 30),
      allStocks: all.slice(0, 100),
      marketStatus,
      lastScanTime: new Date().toISOString(),
      totalScanned: stocksWithQuotes.length,
      totalFiltered: all.length,
      isScanning: false,
      scanError,
      alerts,
      ocStats, // Include OC stats for debugging
    });
  } catch (error) {
    console.error("Scanner error:", error);
    return NextResponse.json(
      {
        error: "Scanner failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function getMarketStatus(): "open" | "closed" | "pre_open" | "post_close" {
  const now = new Date();
  // IST is UTC+5:30
  const istOffset = 5.5 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istMinutes = utcMinutes + istOffset;
  const istHours = Math.floor(istMinutes / 60) % 24;
  const istMins = istMinutes % 60;

  const day = now.getUTCDay();
  if (day === 0 || day === 6) return "closed";

  const timeInMinutes = istHours * 60 + istMins;

  if (timeInMinutes >= 9 * 60 && timeInMinutes < 9 * 60 + 15) return "pre_open";
  if (timeInMinutes >= 9 * 60 + 15 && timeInMinutes <= 15 * 60 + 30)
    return "open";
  if (timeInMinutes > 15 * 60 + 30 && timeInMinutes <= 16 * 60)
    return "post_close";
  return "closed";
}

function getCachedExpiry(instrumentKey: string): string | null {
  const cached = expiryCache.get(instrumentKey);
  if (cached && Date.now() - cached.cachedAt < EXPIRY_CACHE_TTL) {
    return cached.expiry;
  }
  return null;
}

function setCachedExpiry(instrumentKey: string, expiry: string) {
  expiryCache.set(instrumentKey, { expiry, cachedAt: Date.now() });
}
