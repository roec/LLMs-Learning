# 实时 MACD / DEA / DIFF 展示（React + TypeScript）

该项目使用 React + TypeScript 构建，连接 Binance 交易所的实时 WebSocket K 线数据，并计算展示：

- DIFF
- DEA
- MACD

## 启动方式

```bash
npm install
npm run dev
```

打开：`http://localhost:5173`

## 说明

- 初始数据来自 Binance REST `klines`
- 实时数据来自 Binance WebSocket `kline_1m`
- 指标默认参数：`12, 26, 9`
