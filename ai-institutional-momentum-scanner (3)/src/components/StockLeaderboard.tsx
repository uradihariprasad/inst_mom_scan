"use client";

import type { ScannedStock } from "@/lib/types";
import StockCard from "./StockCard";

interface StockLeaderboardProps {
  stocks: ScannedStock[];
  onSelectStock: (stock: ScannedStock) => void;
}

export default function StockLeaderboard({
  stocks,
  onSelectStock,
}: StockLeaderboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {stocks.map((stock, index) => (
        <StockCard
          key={stock.symbol}
          stock={stock}
          rank={index + 1}
          onClick={() => onSelectStock(stock)}
        />
      ))}
    </div>
  );
}
