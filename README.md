# NFT Portfolio Lite

A light, fast, **read-only** view of your OpenSea portfolio — every NFT and token across all your wallets, in two tables.

OpenSea's own portfolio page ships megabytes of app code, a heatmap and animations to show you a list. This reads the same numbers and draws them plainly:

- **Collections table** — held count, wallets, value (top offer), floor and top offer, sortable. Click a row to see the pieces you hold.
- **Tokens table** — value, quantity, price and 24h change; a token held on several networks opens onto each network.
- **Total / NFT / Token** at a glance, with the change since the last refresh (green up, red down).
- **24-hour price history** — what moved your balance, and when.
- **NFTs added by hand** — for pieces OpenSea shows under none of your wallets, such as staked ones.

> **Your wallet ADDRESS is all it needs.** This app never asks for a private key or a seed phrase and cannot move anything. If something that looks like this app asks for a key, it is not this app — use only this repository.

---

## Start it in your browser (GitHub Codespaces — nothing to install)

1. On this repository's page, click **Code** → **Codespaces** → **Create codespace on main**.
2. When the terminal appears, type:
   ```
   npm start
   ```
3. Click the link that pops up (or open the **Ports** tab and click the globe next to port 4180).
4. Paste your wallet address(es), give them a short name if you like, and save.

The link Codespaces gives you is **private**: only you, signed in to your GitHub account, can open it. Keep it that way — don't make the port public.

Codespaces is free for personal GitHub accounts up to 60 hours a month, far more than this needs. Stop the codespace when you're done (**Code** → **Codespaces** → **⋯** → **Stop**).

## Or run it on your own computer

Needs [Node.js](https://nodejs.org) 18 or newer. No other dependencies.

```
git clone https://github.com/ekremkozz/NFT-Portfolio.git
cd NFT-Portfolio
npm start
```

Then open http://localhost:4180.

---

## Adding NFTs by hand (optional)

Staked NFTs sit in the staking contract, so OpenSea lists them under none of your wallets. Click **+**, paste the item's OpenSea link (or a collection link and how many you hold), and it is counted with the rest, marked *Manual*.

This one feature needs an **OpenSea API key** ([get one here](https://docs.opensea.io/reference/api-keys)) — everything else works without it. The safest place for it in a codespace is a **Codespaces secret**, which is encrypted by GitHub and never written into the code:

1. GitHub → **Settings** → **Codespaces** → **New secret**
2. Name: `OPENSEA_API_KEY`, value: your key, repository: this one.
3. Restart the codespace.

You can also paste it under the ⚙ settings; it is then stored in `data/` on that machine only and never sent back to the page. An OpenSea API key can only *read* data — it cannot touch your wallets.

## Where your data lives

Everything the app keeps — your wallet list, NFTs added by hand, the last 24 hours of price changes — is in the `data/` folder of wherever it runs. It is ignored by git and never leaves that machine except as requests to OpenSea for your addresses' public data.

---

## Comparing it with OpenSea's page yourself

[`tools/page-meter.user.js`](tools/page-meter.user.js) is a small [Tampermonkey](https://www.tampermonkey.net/) script that shows the same measurements on both pages: how busy the page keeps the browser, its memory, how many elements it holds and what it downloaded. Install it, open both pages with the same wallet, and compare them at the same moments — while loading, at rest, and after opening a detail. For CPU, the browser's own task manager (Shift+Esc in Chrome and Brave) is the authority; the script explains in its header what it can and cannot see.

## Important

**Not affiliated with OpenSea.** It reads the same data OpenSea's own website reads. Those are not a published API: OpenSea can change them at any time, and when it does this app may show empty tables until it is updated. Values are OpenSea's figures (top offers and floors), not financial advice.

## Support

If this saves you time, there is a support mint — *link coming soon*. It is a thank-you, not an investment: it grants nothing and promises nothing.

## License

[MIT](LICENSE)

---

## Türkçe hızlı başlangıç

1. Bu sayfada **Code** → **Codespaces** → **Create codespace on main**'e tıkla.
2. Terminal açılınca `npm start` yaz.
3. Çıkan bağlantıya tıkla (ya da **Ports** sekmesinde 4180'in yanındaki küreye).
4. Cüzdan **adresini** (0x…) yapıştır, kaydet.

Bu uygulama **asla** private key ya da seed phrase istemez. İsteyen bir şey görürsen o bu uygulama değildir.
