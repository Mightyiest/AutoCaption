const puppeteer = require('../backend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getBrowserPath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function run() {
  const browserPath = getBrowserPath();
  console.log('Using browser:', browserPath);

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1080,1920',
      '--default-background-color=00000000',
      '--hide-scrollbars'
    ]
  });

  const page = await browser.newPage();

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Bangers&family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Montserrat:wght@700;800;900&family=Outfit:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@600;700;800&family=Russo+One&display=swap');
body {
  margin: 0;
  padding: 0;
  width: 1080px;
  height: 1920px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.caption-box {
  position: absolute;
  top: 74%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 972px; /* 90% */
  text-align: center;
  font-family: 'Montserrat', sans-serif;
  font-size: 118.45px;
  font-weight: 900;
  line-height: 1.02;
  text-transform: uppercase;
  letter-spacing: -1.74px;
}
.word {
  display: inline-block;
  margin: 0 13.93px;
  color: #FFFFFF;
  -webkit-text-stroke: 10.45px #000000;
  paint-order: stroke fill;
  text-shadow: 0px 13.93px 27.87px rgba(0, 0, 0, 0.85);
  transition: transform 120ms ease;
}
.word.active {
  color: #FFE600;
  transform: scale(1.08);
}
</style>
</head>
<body>
  <div id="caption-root" class="caption-box"></div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);

  const segments = [
    {
      id: 1,
      lines: [["WHITENING"], ["STRIPS", "ONLY"]],
      activeWord: "WHITENING"
    },
    {
      id: 2,
      lines: [["WHITENING"], ["STRIPS", "ONLY"]],
      activeWord: "STRIPS"
    },
    {
      id: 3,
      lines: [["WHITENING"], ["STRIPS", "ONLY"]],
      activeWord: "ONLY"
    }
  ];

  console.time('render_all_states');
  for (const seg of segments) {
    await page.evaluate((data) => {
      const root = document.getElementById('caption-root');
      root.innerHTML = '';
      data.lines.forEach((lineWords) => {
        const lineDiv = document.createElement('div');
        lineWords.forEach((w) => {
          const span = document.createElement('span');
          span.className = 'word' + (w === data.activeWord ? ' active' : '');
          span.textContent = w;
          lineDiv.appendChild(span);
        });
        root.appendChild(lineDiv);
      });
    }, seg);

    const outPath = path.resolve(__dirname, `test_dom_state_${seg.id}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log('Saved state:', outPath);
  }
  console.timeEnd('render_all_states');

  await browser.close();
}

run().catch(console.error);
