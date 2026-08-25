const puppeteer = require('../backend/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

async function testNode() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    userDataDir: path.join(__dirname, 'tmp_chrome_data'),
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--window-size=1080,1920',
      '--default-background-color=00000000'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
body {
  margin: 0; padding: 0; width: 1080px; height: 1920px;
  background: transparent; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.caption-box {
  position: absolute; top: 74%; left: 50%; transform: translate(-50%, -50%);
  width: 972px; text-align: center; font-family: 'Montserrat', sans-serif;
  font-size: 118.45px; font-weight: 900; line-height: 1.02; text-transform: uppercase; letter-spacing: -1.74px;
}
.word {
  display: inline-block; margin: 0 13.93px; color: #FFFFFF;
  -webkit-text-stroke: 10.45px #000000; paint-order: stroke fill;
  text-shadow: 0px 13.93px 27.87px rgba(0, 0, 0, 0.85);
}
.word.active { color: #FFE600; transform: scale(1.08); }
</style>
</head>
<body>
  <div class="caption-box">
    <div><span class="word active">WHITENING</span></div>
    <div><span class="word">STRIPS</span> <span class="word">ONLY</span></div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);

  const outPath = path.resolve(__dirname, 'test_puppeteer_shell.png');
  await page.screenshot({ path: outPath, omitBackground: true });
  console.log('Successfully captured screenshot to:', outPath);

  await browser.close();
}

testNode().catch(console.error);
