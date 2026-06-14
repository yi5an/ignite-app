# Notion OAuth Exchange Example

Notion 的 OAuth `code -> access_token` 交换步骤需要 `client_secret`。
所以这一步不能安全地放在移动端 App 里，建议放到你自己的服务端。

App 侧会把授权回调里的 `code` POST 到：

`EXPO_PUBLIC_NOTION_OAUTH_EXCHANGE_URL`

请求体：

```json
{
  "code": "temporary-code-from-notion",
  "redirect_uri": "ignite://oauth/notion"
}
```

你自己的服务端需要返回：

```json
{
  "access_token": "secret_xxx",
  "refresh_token": "nrt_xxx",
  "workspace_name": "My Workspace",
  "workspace_id": "xxxx"
}
```

下面是一个最小 Node/Express 风格示例：

```ts
app.post('/api/notion/oauth/exchange', async (req, res) => {
  const { code, redirect_uri } = req.body;

  const basic = Buffer.from(
    `${process.env.NOTION_OAUTH_CLIENT_ID}:${process.env.NOTION_OAUTH_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2026-03-11',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return res.status(response.status).json(payload);
  }

  res.json({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    workspace_name: payload.workspace_name,
    workspace_id: payload.workspace_id,
    bot_id: payload.bot_id,
  });
});
```

App 侧建议配这几个环境变量：

```bash
EXPO_PUBLIC_NOTION_OAUTH_CLIENT_ID=your_public_integration_client_id
EXPO_PUBLIC_NOTION_OAUTH_REDIRECT_URI=ignite://oauth/notion
EXPO_PUBLIC_NOTION_OAUTH_EXCHANGE_URL=https://your-domain.com/api/notion/oauth/exchange
```

如果你先在本机开发，Android 模拟器建议直接用：

```bash
EXPO_PUBLIC_NOTION_OAUTH_EXCHANGE_URL=http://10.0.2.2:8787/api/notion/oauth/exchange
```

仓库里已经附带了一个最小本地交换服务：

```bash
npm run notion:oauth-server
```

它默认监听：

```bash
http://localhost:8787/api/notion/oauth/exchange
```
