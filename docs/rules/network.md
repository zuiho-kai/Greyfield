# 硬规则 — 网络与抓取

- **网络代理**：所有外网请求走 `http://127.0.0.1:7890`
- **网页抓取降级链**：WebFetch → agent-browser → Scrapling → Playwright
  - **禁止链外工具**（DEV-58）：curl/wget/requests 不得用于抓取网页内容
  - **禁止编造**（DEV-59）：全链路失败 = 没有数据，如实告知用户
