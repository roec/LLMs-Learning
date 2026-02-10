export interface Candle {
  time: number;
  close: number;
}

export interface MacdPoint {
  time: number;
  diff: number;
  dea: number;
  macd: number;
}

export interface CrossStats {
  goldenAboveZero: number;
  goldenBelowZero: number;
  deathAboveZero: number;
  deathBelowZero: number;
}

const calculateEMA = (values: number[], period: number): number[] => {
  const k = 2 / (period + 1);
  const ema: number[] = [];

  values.forEach((value, index) => {
    if (index === 0) {
      ema.push(value);
      return;
    }
    ema.push(value * k + ema[index - 1] * (1 - k));
  });

  return ema;
};

export const calculateMACD = (
  candles: Candle[],
  shortPeriod = 12,
  longPeriod = 26,
  signalPeriod = 9
): MacdPoint[] => {
  if (candles.length === 0) {
    return [];
  }

  const closePrices = candles.map((c) => c.close);
  const emaShort = calculateEMA(closePrices, shortPeriod);
  const emaLong = calculateEMA(closePrices, longPeriod);
  const diffSeries = emaShort.map((short, i) => short - emaLong[i]);
  const deaSeries = calculateEMA(diffSeries, signalPeriod);

  return candles.map((candle, i) => {
    const diff = diffSeries[i];
    const dea = deaSeries[i];
    return {
      time: candle.time,
      diff,
      dea,
      macd: (diff - dea) * 2
    };
  });
};

export const calculateCrossStats = (points: MacdPoint[]): CrossStats => {
  const stats: CrossStats = {
    goldenAboveZero: 0,
    goldenBelowZero: 0,
    deathAboveZero: 0,
    deathBelowZero: 0
  };

  if (points.length < 2) {
    return stats;
  }

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];

    const isGoldenCross = prev.diff <= prev.dea && curr.diff > curr.dea;
    const isDeathCross = prev.diff >= prev.dea && curr.diff < curr.dea;

    if (!isGoldenCross && !isDeathCross) {
      continue;
    }

    const zoneValue = curr.diff;
    const isAboveZero = zoneValue >= 0;

    if (isGoldenCross) {
      if (isAboveZero) {
        stats.goldenAboveZero += 1;
      } else {
        stats.goldenBelowZero += 1;
      }
    }

    if (isDeathCross) {
      if (isAboveZero) {
        stats.deathAboveZero += 1;
      } else {
        stats.deathBelowZero += 1;
      }
    }
  }

  return stats;
};
