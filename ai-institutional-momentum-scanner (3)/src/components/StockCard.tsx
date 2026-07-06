"use client";

import type { ScannedStock, MomentumClassification, StrikeLevelSR } from "@/lib/types";
import MomentumMeter from "./MomentumMeter";

interface StockCardProps {
  stock: ScannedStock;
  rank: number;
  onClick: () => void;
}

const classificationLabels: Record<MomentumClassification, string> = {
  long_buildup: "Long Build-up",
  short_buildup: "Short Build-up",
  long_unwinding: "Long Unwinding",
  short_covering: "Short Covering",
  neutral: "Neutral",
};

const classificationColors: Record<MomentumClassification, string> = {
  long_buildup: "bg-accent-green/10 text-accent-green border-accent-green/20",
  short_buildup: "bg-accent-red/10 text-accent-red border-accent-red/20",
  long_unwinding: "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/20",
  short_covering: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  neutral: "bg-text-muted/10 text-text-muted border-text-muted/20",
};

function formatNumber(n: number): string {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return (n / 100000).toFixed(2) + " L";
  if (n >= 1000) return (n / 1000).toFixed(1) + " K";
  return n.toLocaleString();
}

function getStatusIcon(status: string): string {
  if (status === "strengthening") return "↑";
  if (status === "weakening") return "↓";
  return "—";
}

function getStatusColor(status: string, isSupport: boolean): string {
  if (status === "strengthening") return isSupport ? "text-accent-green" : "text-accent-red";
  if (status === "weakening") return isSupport ? "text-accent-red" : "text-accent-green";
  return "text-text-muted";
}

export default function StockCard({ stock, rank, onClick }: StockCardProps) {
  const isPositive = stock.priceChangePercent >= 0;
  const hasOptionChain = stock.optionChainAnalysis !== null;
  const hasSR = stock.supportResistance !== null;
  const hasExpectedMomentum = stock.expectedMomentum !== null;

  const sr = stock.supportResistance;
  const immSupport = sr?.immediateSupport;
  const immResistance = sr?.immediateResistance;

  return (
    <div
      onClick={onClick}
      className="bg-bg-card hover:bg-bg-card-hover border border-border hover:border-border-bright rounded-xl p-4 cursor-pointer transition-all group"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted bg-bg-secondary rounded-md px-1.5 py-0.5">
            #{rank}
          </span>
          <h3 className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors">
            {stock.symbol}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-text-primary">
            ₹{stock.currentPrice.toFixed(2)}
          </p>
          <p className={`text-xs font-medium ${isPositive ? "text-accent-green" : "text-accent-red"}`}>
            {isPositive ? "+" : ""}{stock.priceChangePercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Classification Badge */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${classificationColors[stock.momentumClassification]}`}>
          {classificationLabels[stock.momentumClassification]}
        </span>
        {sr?.breakoutPotential && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green">
            Breakout Signal
          </span>
        )}
        {sr?.breakdownPotential && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-red/20 text-accent-red">
            Breakdown Signal
          </span>
        )}
      </div>

      {/* Strike-Level Support & Resistance */}
      {hasSR && sr && (
        <div className="mb-3">
          <div className="text-xs text-text-muted mb-1.5 flex items-center gap-1">
            <span>Strike Levels</span>
            <span className="text-text-muted/50">@ ₹{sr.currentPrice.toFixed(0)}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {/* Support Levels */}
            <div className="bg-accent-green/5 border border-accent-green/10 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-text-muted uppercase">Support</span>
                {immSupport && (
                  <span className={`text-[10px] ${getStatusColor(immSupport.status, true)}`}>
                    {getStatusIcon(immSupport.status)}
                  </span>
                )}
              </div>
              {immSupport ? (
                <>
                  <p className="text-accent-green font-bold text-sm">₹{immSupport.strike}</p>
                  <div className="flex items-center justify-between text-[10px] text-text-muted mt-0.5">
                    <span>OI: {formatNumber(immSupport.oi)}</span>
                    <span>{immSupport.distancePercent.toFixed(1)}%↓</span>
                  </div>
                  {sr.supportLevels.length > 1 && (
                    <p className="text-[10px] text-text-muted mt-1">
                      Next: ₹{sr.supportLevels[1]?.strike}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-text-muted">No support</p>
              )}
            </div>

            {/* Resistance Levels */}
            <div className="bg-accent-red/5 border border-accent-red/10 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-text-muted uppercase">Resistance</span>
                {immResistance && (
                  <span className={`text-[10px] ${getStatusColor(immResistance.status, false)}`}>
                    {getStatusIcon(immResistance.status)}
                  </span>
                )}
              </div>
              {immResistance ? (
                <>
                  <p className="text-accent-red font-bold text-sm">₹{immResistance.strike}</p>
                  <div className="flex items-center justify-between text-[10px] text-text-muted mt-0.5">
                    <span>OI: {formatNumber(immResistance.oi)}</span>
                    <span>{immResistance.distancePercent.toFixed(1)}%↑</span>
                  </div>
                  {sr.resistanceLevels.length > 1 && (
                    <p className="text-[10px] text-text-muted mt-1">
                      Next: ₹{sr.resistanceLevels[1]?.strike}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-text-muted">No resistance</p>
              )}
            </div>
          </div>

          {/* Expected Range */}
          {sr.expectedFloor && sr.expectedCeiling && (
            <div className="mt-2 bg-bg-secondary rounded-lg p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted">Expected Range</span>
                <span className="font-medium">
                  <span className="text-accent-green">₹{sr.expectedFloor.toFixed(0)}</span>
                  <span className="text-text-muted mx-1">→</span>
                  <span className="text-accent-red">₹{sr.expectedCeiling.toFixed(0)}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expected Momentum */}
      {hasExpectedMomentum && stock.expectedMomentum && (
        <div className="bg-bg-secondary rounded-lg p-2 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-text-muted">Expected Move</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              stock.expectedMomentum.targetDirection === "bullish"
                ? "bg-accent-green/10 text-accent-green"
                : stock.expectedMomentum.targetDirection === "bearish"
                  ? "bg-accent-red/10 text-accent-red"
                  : "bg-text-muted/10 text-text-muted"
            }`}>
              {stock.expectedMomentum.targetDirection === "bullish" ? "↑" : 
               stock.expectedMomentum.targetDirection === "bearish" ? "↓" : "—"} 
              {stock.expectedMomentum.targetDirection === "bullish" 
                ? `${stock.expectedMomentum.upsideProbability}%`
                : stock.expectedMomentum.targetDirection === "bearish"
                  ? `${stock.expectedMomentum.downsideProbability}%`
                  : "Neutral"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-accent-green">
                ↑₹{stock.expectedMomentum.immediateResistance.toFixed(0)}
                <span className="text-text-muted ml-1">(+{stock.expectedMomentum.expectedUpsidePercent.toFixed(1)}%)</span>
              </p>
            </div>
            <div>
              <p className="text-accent-red">
                ↓₹{stock.expectedMomentum.immediateSupport.toFixed(0)}
                <span className="text-text-muted ml-1">(-{stock.expectedMomentum.expectedDownsidePercent.toFixed(1)}%)</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Volume & OI */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="bg-bg-secondary rounded-lg p-2">
          <p className="text-text-muted mb-0.5">Volume</p>
          <p className="text-text-primary font-medium">{formatNumber(stock.volumeAnalysis.currentVolume)}</p>
          <p className="text-text-muted">Score: {stock.volumeAnalysis.volumeScore}</p>
        </div>
        <div className="bg-bg-secondary rounded-lg p-2">
          <p className="text-text-muted mb-0.5">Open Interest</p>
          <p className="text-text-primary font-medium">{formatNumber(stock.oiAnalysis.currentOI)}</p>
          <p className={stock.oiAnalysis.changeInOI >= 0 ? "text-accent-green" : "text-accent-red"}>
            {stock.oiAnalysis.changeInOI >= 0 ? "+" : ""}{formatNumber(stock.oiAnalysis.changeInOI)}
          </p>
        </div>
      </div>

      {/* Momentum Meter */}
      <MomentumMeter
        score={stock.institutionalScore.totalScore}
        strength={stock.momentumStrength}
        direction={stock.momentumDirection}
        compact
      />
    </div>
  );
}
