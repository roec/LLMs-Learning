import { useEffect, useMemo, useState } from 'react';
import { Candle, calculateCrossStats, calculateMACD, MacdPoint } from './macd';

const SYMBOL = 'btcusdt';
const INTERVAL = '1m';
const HISTORY_LIMIT = 300;

const fetchInitialCandles = async (): Promise<Candle[]> => {
  const url = `https://api.binance.com/api/v3/klines?symbol=${SYMBOL.toUpperCase()}&interval=${INTERVAL}&limit=${HISTORY_LIMIT}`;
  const resp = await fetch(url);

  if (!resp.ok) {
    throw new Error(`初始化K线获取失败: ${resp.status}`);
  }

  const raw = (await resp.json()) as Array<[
    number,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    number,
    string,
    string,
    string
  ]>;

  return raw.map((item) => ({
    time: item[0],
    close: Number(item[4])
  }));
};

const upsertCandle = (candles: Candle[], next: Candle): Candle[] => {
  const copied = [...candles];
  const last = copied[copied.length - 1];

  if (!last) {
    return [next];
  }

  if (last.time === next.time) {
    copied[copied.length - 1] = next;
  } else if (next.time > last.time) {
    copied.push(next);
  }

  if (copied.length > HISTORY_LIMIT) {
    return copied.slice(copied.length - HISTORY_LIMIT);
  }

  return copied;
};

const createLinePath = (
  points: MacdPoint[],
  selector: (point: MacdPoint) => number,
  width: number,
  height: number,
  min: number,
  max: number
): string => {
  const denominator = max - min || 1;
  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((selector(point) - min) / denominator) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const App = () => {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState('连接中...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        const initial = await fetchInitialCandles();
        if (!cancelled) {
          setCandles(initial);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '初始化数据失败');
      }

      socket = new WebSocket(`wss://stream.binance.com:9443/ws/${SYMBOL}@kline_${INTERVAL}`);

      socket.onopen = () => {
        setStatus('已连接 Binance WebSocket');
      };

      socket.onclose = () => {
        setStatus('连接已关闭，尝试刷新页面重连');
      };

      socket.onerror = () => {
        setError('WebSocket 出错');
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data) as {
          k: {
            t: number;
            c: string;
          };
        };
        const nextCandle: Candle = {
          time: payload.k.t,
          close: Number(payload.k.c)
        };

        setCandles((prev) => upsertCandle(prev, nextCandle));
      };
    };

    void connect();

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, []);

  const macdData = useMemo(() => calculateMACD(candles), [candles]);
  const crossStats = useMemo(() => calculateCrossStats(macdData), [macdData]);
  const latest = macdData[macdData.length - 1];

  const chartData = macdData.slice(-80);
  const extrema = chartData.reduce(
    (acc, point) => {
      const values = [point.diff, point.dea, point.macd];
      return {
        min: Math.min(acc.min, ...values),
        max: Math.max(acc.max, ...values)
      };
    },
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  );

  const min = Number.isFinite(extrema.min) ? extrema.min : -1;
  const max = Number.isFinite(extrema.max) ? extrema.max : 1;
  const width = 900;
  const height = 280;

  return (
    <main className="container">
      <h1>BTCUSDT 实时 MACD / DEA / DIFF 监控</h1>
      <p className="status">状态：{status}</p>
      {error ? <p className="error">错误：{error}</p> : null}

      <section className="cards">
        <article>
          <h2>DIFF</h2>
          <p>{latest ? latest.diff.toFixed(4) : '--'}</p>
        </article>
        <article>
          <h2>DEA</h2>
          <p>{latest ? latest.dea.toFixed(4) : '--'}</p>
        </article>
        <article>
          <h2>MACD</h2>
          <p>{latest ? latest.macd.toFixed(4) : '--'}</p>
        </article>
      </section>

      <section className="cross-stats">
        <h2>交叉统计（最近 {HISTORY_LIMIT} 根K线）</h2>
        <div className="cross-grid">
          <article>
            <h3>金叉（零上）</h3>
            <p>{crossStats.goldenAboveZero}</p>
          </article>
          <article>
            <h3>金叉（零下）</h3>
            <p>{crossStats.goldenBelowZero}</p>
          </article>
          <article>
            <h3>死叉（零上）</h3>
            <p>{crossStats.deathAboveZero}</p>
          </article>
          <article>
            <h3>死叉（零下）</h3>
            <p>{crossStats.deathBelowZero}</p>
          </article>
        </div>
      </section>

      <section className="chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="MACD chart">
          <line
            x1="0"
            y1={height - ((0 - min) / (max - min || 1)) * height}
            x2={width}
            y2={height - ((0 - min) / (max - min || 1)) * height}
            stroke="#9ca3af"
            strokeDasharray="4 4"
          />
          <path
            d={createLinePath(chartData, (p) => p.diff, width, height, min, max)}
            stroke="#1d4ed8"
            strokeWidth="2"
            fill="none"
          />
          <path
            d={createLinePath(chartData, (p) => p.dea, width, height, min, max)}
            stroke="#dc2626"
            strokeWidth="2"
            fill="none"
          />
          <path
            d={createLinePath(chartData, (p) => p.macd, width, height, min, max)}
            stroke="#16a34a"
            strokeWidth="2"
            fill="none"
          />
        </svg>
        <div className="legend">
          <span>
            <i style={{ background: '#1d4ed8' }} />DIFF
          </span>
          <span>
            <i style={{ background: '#dc2626' }} />DEA
          </span>
          <span>
            <i style={{ background: '#16a34a' }} />MACD
          </span>
        </div>
      </section>
    </main>
  );
};

export default App;
