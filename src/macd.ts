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
