"use client";

import { useEffect, useCallback } from "react";
import type { ScannedStock, MomentumClassification, StrikeLevelSR } from "@/lib/types";
import MomentumMeter from "./MomentumMeter";

interface StockDetailModalProps {
  stock: ScannedStock;
  sessionId: string;
  onClose: () => void;
}

const classificationLabels: Record<MomentumClassification, string> = {
  long_buildup: "Long Build-up",
  short_buildup: "Short Build-up",
  long_unwinding: "Long Unwinding",
  short_covering: "Short Covering",
  neutral: "Neutral",
};

const classificationDescriptions: Record<MomentumClassification, string> = {
  long_buildup: "Price ↑ + OI ↑ → Bullish institutional accumulation",
  short_buildup: "Price ↓ + OI ↑ → Bearish institutional positioning",
  long_unwinding: "Price ↓ + OI ↓ → Weak bullish exit / profit booking",
  short_covering: "Price ↑ + OI ↓ → Bears exiting positions",
  neutral: "No clear directional bias",
};

function formatNumber(n: number): string {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return (n / 100000).toFixed(2) + " L";
  if (n >= 1000) return (n / 1000).toFixed(1) + " K";
  return n.toLocaleString();
}

function StrikeLevelRow({ level, type }: { level: StrikeLevelSR; type: "support" | "resistance" }) {
  const isSupport = type === "support";
  const baseColor = isSupport ? "accent-green" : "accent-red";
  
  return (
    <div className={`flex items-center justify-between py-2 px-3 bg-${baseColor}/5 rounded-lg`}>
      <div className="flex items-center gap-3">
        <span className={`text-${baseColor} font-bold`}>₹{level.strike}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          level.strength === "very_strong" ? `bg-${baseColor}/20 text-${baseColor}` :
          level.strength === "strong" ? `bg-${baseColor}/15 text-${baseColor}` :
          "bg-text-muted/10 text-text-muted"
        }`}>
          {level.strength}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs">
        <div className="text-right">
          <p className="text-text-muted">OI</p>
          <p className="text-text-primary font-medium">{formatNumber(level.oi)}</p>
        </div>
        <div className="text-right">
          <p className="text-text-muted">Chg OI</p>
          <p className={level.changeOI > 0 ? "text-accent-green" : level.changeOI < 0 ? "text-accent-red" : "text-text-muted"}>
            {level.changeOI > 0 ? "+" : ""}{formatNumber(level.changeOI)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-text-muted">Dist</p>
          <p className="text-text-secondary">{level.distancePercent.toFixed(1)}%</p>
        </div>
        <div className="text-right w-20">
          <p className="text-text-muted">Status</p>
          <p className={`font-medium ${
            level.status === "strengthening" ? (isSupport ? "text-accent-green" : "text-accent-red") :
            level.status === "weakening" ? (isSupport ? "text-accent-red" : "text-accent-green") :
            "text-text-muted"
          }`}>
            {level.status === "strengthening" ? "↑ Strong" : 
             level.status === "weakening" ? "↓ Weak" : "— Stable"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StockDetailModal({
  stock,
  sessionId: _sessionId,
  onClose,
}: StockDetailModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isPositive = stock.priceChangePercent >= 0;
  const hasOptionChain = stock.optionChainAnalysis !== null;
  const sr = stock.supportResistance;
  const hasSR = sr !== null;
  const hasExpectedMomentum = stock.expectedMomentum !== null;

  const scoreBreakdown = [
    { label: "Volume Strength", value: stock.institutionalScore.volumeStrength },
    { label: "Option Chain", value: stock.institutionalScore.optionChainStrength },
    { label: "OI Strength", value: stock.institutionalScore.oiStrength },
    { label: "Price Momentum", value: stock.institutionalScore.priceMomentum },
    { label: "Support Strength", value: stock.institutionalScore.supportStrength },
    { label: "Resistance Weakness", value: stock.institutionalScore.resistanceWeakness },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-bg-secondary border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-bg-secondary border-b border-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{stock.symbol}</h2>
            <p className="text-sm text-text-muted">Strike-Level Analysis</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-lg font-bold text-text-primary">₹{stock.currentPrice.toFixed(2)}</p>
              <p className={`text-sm font-medium ${isPositive ? "text-accent-green" : "text-accent-red"}`}>
                {isPositive ? "+" : ""}{stock.priceChange.toFixed(2)} ({isPositive ? "+" : ""}{stock.priceChangePercent.toFixed(2)}%)
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-bg-card hover:bg-bg-card-hover border border-border flex items-center justify-center text-text-muted hover:text-text-primary">✕</button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* OHLC */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Open", value: stock.open },
              { label: "High", value: stock.high },
              { label: "Low", value: stock.low },
              { label: "Close", value: stock.close },
            ].map((item) => (
              <div key={item.label} className="bg-bg-card rounded-lg p-3 text-center">
                <p className="text-xs text-text-muted mb-1">{item.label}</p>
                <p className="text-sm font-bold text-text-primary">₹{item.value.toFixed(2)}</p>
              </div>
            ))}
          </div>

          {/* Strike-Level Support & Resistance - Main Feature */}
          {hasSR && sr && (
            <div className="bg-bg-card rounded-xl border-2 border-accent-cyan/30 overflow-hidden">
              <div className="bg-accent-cyan/10 px-4 py-3 border-b border-accent-cyan/20">
                <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse"></span>
                  Strike-Level Support & Resistance
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Current Price: ₹{sr.currentPrice.toFixed(2)} | ATM Strike: ₹{sr.atmStrike}
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* Visual Price Position */}
                <div className="bg-bg-secondary rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-text-muted">Price Position</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                      sr.pricePosition === "above_resistance" ? "bg-accent-green/20 text-accent-green" :
                      sr.pricePosition === "below_support" ? "bg-accent-red/20 text-accent-red" :
                      sr.pricePosition === "near_resistance" ? "bg-accent-yellow/20 text-accent-yellow" :
                      sr.pricePosition === "near_support" ? "bg-accent-cyan/20 text-accent-cyan" :
                      "bg-text-muted/20 text-text-muted"
                    }`}>
                      {sr.pricePosition === "above_resistance" ? "ABOVE RESISTANCE (Breakout)" :
                       sr.pricePosition === "below_support" ? "BELOW SUPPORT (Breakdown)" :
                       sr.pricePosition === "near_resistance" ? "NEAR RESISTANCE" :
                       sr.pricePosition === "near_support" ? "NEAR SUPPORT" :
                       "BETWEEN S/R"}
                    </span>
                  </div>
                  
                  {/* Expected Range Bar */}
                  <div className="relative h-10 bg-bg-primary rounded-lg mt-3 overflow-hidden">
                    <div className="absolute inset-y-0 left-0 w-1/3 bg-accent-green/10 flex items-center justify-center border-r border-accent-green/30">
                      <span className="text-xs text-accent-green">Support Zone</span>
                    </div>
                    <div className="absolute inset-y-0 right-0 w-1/3 bg-accent-red/10 flex items-center justify-center border-l border-accent-red/30">
                      <span className="text-xs text-accent-red">Resistance Zone</span>
                    </div>
                    <div className="absolute inset-y-0 left-1/3 right-1/3 flex items-center justify-center">
                      <span className="text-xs text-text-muted">Trading Range</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-accent-green">Floor: ₹{sr.expectedFloor.toFixed(0)}</span>
                    <span className="text-text-primary font-bold">CMP: ₹{sr.currentPrice.toFixed(2)}</span>
                    <span className="text-accent-red">Ceiling: ₹{sr.expectedCeiling.toFixed(0)}</span>
                  </div>
                </div>

                {/* Breakout/Breakdown Signals */}
                {(sr.breakoutPotential || sr.breakdownPotential) && (
                  <div className={`p-3 rounded-lg ${
                    sr.breakoutPotential ? "bg-accent-green/10 border border-accent-green/30" :
                    "bg-accent-red/10 border border-accent-red/30"
                  }`}>
                    <p className={`text-sm font-bold ${sr.breakoutPotential ? "text-accent-green" : "text-accent-red"}`}>
                      {sr.breakoutPotential ? "🚀 BREAKOUT POTENTIAL DETECTED" : "⚠️ BREAKDOWN POTENTIAL DETECTED"}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      {sr.breakoutPotential 
                        ? "Resistance is weakening - price may break above" 
                        : "Support is weakening - price may break below"}
                    </p>
                  </div>
                )}

                {/* Support Levels Table */}
                <div>
                  <h4 className="text-sm font-semibold text-accent-green mb-2 flex items-center gap-2">
                    <span>↓ Support Levels (Put OI)</span>
                    <span className="text-xs text-text-muted font-normal">Price falls to these levels</span>
                  </h4>
                  <div className="space-y-1.5">
                    {sr.supportLevels.length > 0 ? (
                      sr.supportLevels.map((level, idx) => (
                        <StrikeLevelRow key={level.strike} level={level} type="support" />
                      ))
                    ) : (
                      <p className="text-sm text-text-muted py-2">No significant support levels found</p>
                    )}
                  </div>
                </div>

                {/* Resistance Levels Table */}
                <div>
                  <h4 className="text-sm font-semibold text-accent-red mb-2 flex items-center gap-2">
                    <span>↑ Resistance Levels (Call OI)</span>
                    <span className="text-xs text-text-muted font-normal">Price rises to these levels</span>
                  </h4>
                  <div className="space-y-1.5">
                    {sr.resistanceLevels.length > 0 ? (
                      sr.resistanceLevels.map((level, idx) => (
                        <StrikeLevelRow key={level.strike} level={level} type="resistance" />
                      ))
                    ) : (
                      <p className="text-sm text-text-muted py-2">No significant resistance levels found</p>
                    )}
                  </div>
                </div>

                {/* Immediate vs Strongest */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-3">
                    <p className="text-xs text-text-muted mb-1">Immediate Support</p>
                    {sr.immediateSupport ? (
                      <>
                        <p className="text-lg font-bold text-accent-green">₹{sr.immediateSupport.strike}</p>
                        <p className="text-xs text-text-muted">
                          OI: {formatNumber(sr.immediateSupport.oi)} | {sr.immediateSupport.distancePercent.toFixed(1)}% away
                        </p>
                        <p className={`text-xs mt-1 ${
                          sr.immediateSupport.status === "strengthening" ? "text-accent-green" :
                          sr.immediateSupport.status === "weakening" ? "text-accent-red" : "text-text-muted"
                        }`}>
                          Status: {sr.immediateSupport.status}
                        </p>
                      </>
                    ) : <p className="text-sm text-text-muted">None</p>}
                  </div>
                  <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-3">
                    <p className="text-xs text-text-muted mb-1">Immediate Resistance</p>
                    {sr.immediateResistance ? (
                      <>
                        <p className="text-lg font-bold text-accent-red">₹{sr.immediateResistance.strike}</p>
                        <p className="text-xs text-text-muted">
                          OI: {formatNumber(sr.immediateResistance.oi)} | {sr.immediateResistance.distancePercent.toFixed(1)}% away
                        </p>
                        <p className={`text-xs mt-1 ${
                          sr.immediateResistance.status === "strengthening" ? "text-accent-red" :
                          sr.immediateResistance.status === "weakening" ? "text-accent-green" : "text-text-muted"
                        }`}>
                          Status: {sr.immediateResistance.status}
                        </p>
                      </>
                    ) : <p className="text-sm text-text-muted">None</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expected Momentum */}
          {hasExpectedMomentum && stock.expectedMomentum && (
            <div className="bg-bg-card rounded-xl p-4 border border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Expected Price Movement</h3>
              
              <div className="flex items-center justify-center gap-6 p-4 bg-bg-secondary rounded-xl mb-4">
                <div className={`text-center p-4 rounded-xl flex-1 ${
                  stock.expectedMomentum.targetDirection === "bullish" ? "bg-accent-green/10 border border-accent-green/30" :
                  stock.expectedMomentum.targetDirection === "bearish" ? "bg-accent-red/10 border border-accent-red/30" :
                  "bg-text-muted/10 border border-text-muted/30"
                }`}>
                  <p className="text-xs text-text-muted mb-1">Expected Direction</p>
                  <p className={`text-2xl font-bold ${
                    stock.expectedMomentum.targetDirection === "bullish" ? "text-accent-green" :
                    stock.expectedMomentum.targetDirection === "bearish" ? "text-accent-red" : "text-text-muted"
                  }`}>
                    {stock.expectedMomentum.targetDirection === "bullish" ? "↑ BULLISH" : 
                     stock.expectedMomentum.targetDirection === "bearish" ? "↓ BEARISH" : "— NEUTRAL"}
                  </p>
                  <p className="text-sm text-text-secondary mt-1">Target: ₹{stock.expectedMomentum.targetPrice}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-muted">Upside Probability</span>
                    <span className="text-xs font-bold text-accent-green">{stock.expectedMomentum.upsideProbability}%</span>
                  </div>
                  <div className="w-full h-3 bg-bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-accent-green rounded-full" style={{ width: `${stock.expectedMomentum.upsideProbability}%` }} />
                  </div>
                  <p className="text-xs text-accent-green mt-1">
                    Target: ₹{stock.expectedMomentum.immediateResistance} (+{stock.expectedMomentum.expectedUpsidePercent.toFixed(1)}%)
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-muted">Downside Probability</span>
                    <span className="text-xs font-bold text-accent-red">{stock.expectedMomentum.downsideProbability}%</span>
                  </div>
                  <div className="w-full h-3 bg-bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-accent-red rounded-full" style={{ width: `${stock.expectedMomentum.downsideProbability}%` }} />
                  </div>
                  <p className="text-xs text-accent-red mt-1">
                    Target: ₹{stock.expectedMomentum.immediateSupport} (-{stock.expectedMomentum.expectedDownsidePercent.toFixed(1)}%)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="Risk:Reward" value={`1:${stock.expectedMomentum.riskRewardRatio}`} highlight={stock.expectedMomentum.riskRewardRatio >= 2} />
                <MetricBox label="Max Pain" value={`₹${stock.expectedMomentum.maxPainStrike}`} />
                <MetricBox label="Pivot Strike" value={`₹${stock.expectedMomentum.pivotStrike}`} />
              </div>
            </div>
          )}

          {/* No Option Chain Warning */}
          {!hasOptionChain && (
            <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-xl p-4 text-center">
              <p className="text-accent-yellow font-medium">⚠️ Option chain data not available</p>
              <p className="text-xs text-text-muted mt-1">Strike-level analysis requires option chain data</p>
            </div>
          )}

          {/* Momentum Classification */}
          <div className="bg-bg-card rounded-xl p-4 border border-border">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Momentum Classification</h3>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                stock.momentumClassification === "long_buildup" ? "bg-accent-green/10 text-accent-green" :
                stock.momentumClassification === "short_buildup" ? "bg-accent-red/10 text-accent-red" :
                stock.momentumClassification === "long_unwinding" ? "bg-accent-yellow/10 text-accent-yellow" :
                stock.momentumClassification === "short_covering" ? "bg-accent-purple/10 text-accent-purple" :
                "bg-text-muted/10 text-text-muted"
              }`}>
                {classificationLabels[stock.momentumClassification]}
              </span>
            </div>
            <p className="text-xs text-text-secondary">{classificationDescriptions[stock.momentumClassification]}</p>
          </div>

          {/* Score Breakdown */}
          <div className="bg-bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Institutional Score</h3>
              <span className="text-2xl font-bold text-accent-blue">{stock.institutionalScore.totalScore}</span>
            </div>
            <div className="space-y-3">
              {scoreBreakdown.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-secondary">{item.label}</span>
                    <span className="text-xs font-medium text-text-primary">{item.value}/100</span>
                  </div>
                  <div className="w-full h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      item.value >= 70 ? "bg-accent-green" :
                      item.value >= 50 ? "bg-accent-yellow" :
                      item.value >= 30 ? "bg-accent-yellow/70" : "bg-accent-red"
                    }`} style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Momentum Meter */}
          <MomentumMeter score={stock.institutionalScore.totalScore} strength={stock.momentumStrength} direction={stock.momentumDirection} />

          {/* Volume & OI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-bg-card rounded-xl p-4 border border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Volume</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricBox label="Current" value={formatNumber(stock.volumeAnalysis.currentVolume)} />
                <MetricBox label="Relative" value={`${stock.volumeAnalysis.relativeVolume}x`} highlight={stock.volumeAnalysis.relativeVolume > 1.5} />
                <MetricBox label="Score" value={`${stock.volumeAnalysis.volumeScore}/100`} />
                <MetricBox label="Spike" value={stock.volumeAnalysis.volumeSpike ? "Yes" : "No"} highlight={stock.volumeAnalysis.volumeSpike} />
              </div>
            </div>
            <div className="bg-bg-card rounded-xl p-4 border border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Open Interest</h3>
              <div className="grid grid-cols-2 gap-3">
                <MetricBox label="Current" value={formatNumber(stock.oiAnalysis.currentOI)} />
                <MetricBox label="Change" value={formatNumber(stock.oiAnalysis.changeInOI)} positive={stock.oiAnalysis.changeInOI > 0} negative={stock.oiAnalysis.changeInOI < 0} />
                <MetricBox label="Trend" value={stock.oiAnalysis.oiTrend} />
                <MetricBox label="Position" value={stock.oiAnalysis.positionStrength} highlight={stock.oiAnalysis.positionStrength === "strengthening"} />
              </div>
            </div>
          </div>

          {/* Option Chain Summary */}
          {hasOptionChain && stock.optionChainAnalysis && (
            <div className="bg-bg-card rounded-xl p-4 border border-border">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Option Chain Summary</h3>
              <div className="grid grid-cols-4 gap-3">
                <MetricBox label="Max Call OI" value={`₹${stock.optionChainAnalysis.highestCallOI.strike}`} subValue={formatNumber(stock.optionChainAnalysis.highestCallOI.oi)} />
                <MetricBox label="Max Put OI" value={`₹${stock.optionChainAnalysis.highestPutOI.strike}`} subValue={formatNumber(stock.optionChainAnalysis.highestPutOI.oi)} />
                <MetricBox label="Total Call OI" value={formatNumber(stock.optionChainAnalysis.totalCallOI)} />
                <MetricBox label="Total Put OI" value={formatNumber(stock.optionChainAnalysis.totalPutOI)} />
                <MetricBox label="PCR" value={stock.optionChainAnalysis.overallPCR.toFixed(2)} highlight={stock.optionChainAnalysis.overallPCR > 1} />
                <MetricBox label="Call Chg OI" value={formatNumber(stock.optionChainAnalysis.totalCallChangeOI)} positive={stock.optionChainAnalysis.totalCallChangeOI > 0} negative={stock.optionChainAnalysis.totalCallChangeOI < 0} />
                <MetricBox label="Put Chg OI" value={formatNumber(stock.optionChainAnalysis.totalPutChangeOI)} positive={stock.optionChainAnalysis.totalPutChangeOI > 0} negative={stock.optionChainAnalysis.totalPutChangeOI < 0} />
                <MetricBox label="# Strikes" value={`${stock.optionChainAnalysis.strikes.length}`} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, subValue, highlight, positive, negative }: {
  label: string; value: string; subValue?: string; highlight?: boolean; positive?: boolean; negative?: boolean;
}) {
  return (
    <div className="bg-bg-secondary rounded-lg p-2.5">
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${
        highlight ? "text-accent-blue" : positive ? "text-accent-green" : negative ? "text-accent-red" : "text-text-primary"
      }`}>{value}</p>
      {subValue && <p className="text-xs text-text-muted mt-0.5">{subValue}</p>}
    </div>
  );
}
