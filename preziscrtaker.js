/**
 * preziscrtaker.js
 * 
 * This script uses Puppeteer to automate the process of taking screenshots of a Prezi presentation.
 * Unlike preziscraper.js, which uses puppeteer-core and requires a specific Chrome executable path,
 * this script utilizes the bundled version of Puppeteer, simplifying the setup process.
 * 
 * Key Features:
 * - Accepts command-line arguments for Prezi URL, output directory, and viewport dimensions.
 * - Automatically handles cookie acceptance and navigation to the presentation.
 * - Takes screenshots of each slide, cropping them to a fixed resolution of 1280x720 using the Sharp library.
 * - Saves the screenshots in the specified output directory.
 * 
 * This script is designed to provide a more user-friendly experience for capturing Prezi presentations
 * without the need for additional configuration.
 */

const puppeteer = require('puppeteer');
const argv = require('minimist')(process.argv.slice(2));
const fs = require('fs');
const sharp = require('sharp'); // npm install sharp

// Command-line arguments
const prezi = argv.url || null;
const out = argv.out || 'img';

if (!prezi) {
  throw new Error("PREZI NOT FOUND. Please provide --url argument.");
}

if (!fs.existsSync(out)) {
  fs.mkdirSync(out);
}

// Default viewport sizes
const height = argv.height || 842;
const width = argv.width || 595;

// Prezi selectors
const cookieAcceptBtn = '#onetrust-accept-btn-handler';
const presentDiv = '.viewer-common-info-overlay-button-small-filled';
const fullscr = '.webgl-viewer-navbar-fullscreen-enter-icon';
const nxt = '.webgl-viewer-navbar-next-icon';
const breaker = '.viewer-common-info-overlay-button-label';

(async () => {
  console.log("Launching Puppeteer with bundled Chromium...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  // (Optional) Set a user agent
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
  );

  console.log("Navigating to Prezi...");
  await page.goto(prezi, { timeout: 3000000 });

  // 1. Accept cookies if prompted
  try {
    await page.waitForSelector(cookieAcceptBtn, { timeout: 5000 });
    await page.click(cookieAcceptBtn);
    console.log("Clicked 'Accept All Cookies'.");
  } catch (e) {
    console.log("No cookie prompt found or timed out waiting for it. Continuing...");
  }

  // 2. Click the "Present" div if present
  try {
    await page.waitForSelector(presentDiv, { timeout: 10000 });
    await page.click(presentDiv);
    console.log("Clicked the Present button (div).");
  } catch (e) {
    console.log("No Present button found or timed out waiting for it. Continuing...");
  }

  // 3. Wait for the Prezi viewer to load (fullscreen icon)
  try {
    console.log("Waiting for the Prezi viewer to load...");
    await page.waitForSelector(fullscr, { timeout: 30000 });
  } catch (e) {
    console.error("Timed out waiting for the fullscreen button. The viewer may not have loaded properly.");
    await browser.close();
    process.exit(1);
  }

  console.log("Prezi viewer loaded. Taking screenshots...");

  // Enter fullscreen
  await page.click(fullscr);

  let n = 0;

  // Take the first screenshot (after a brief delay)
  await new Promise(r => setTimeout(r, 500)); // 0.5s extra delay
  await captureCroppedScreenshot(page, `${out}/prezi-${n}.png`);

  // Move mouse out of the way
  await page.mouse.move(100, 100);

  // Click "next" to go to the next slide
  await page.waitForSelector(nxt);
  await page.click(nxt);

  // 4. Loop through slides
  while (true) {
    n++;
    // 1.2s existing pause + 0.5s extra = ~1.7s total
    await new Promise(r => setTimeout(r, 1800));

    // If "breaker" overlay is visible, we're at the end
    if (await page.$(breaker) !== null) {
      console.log("Reached the end of the presentation.");
      break;
    }

    // Take cropped screenshot
    await captureCroppedScreenshot(page, `${out}/prezi-${n}.png`);

    // Move mouse to hide any hover UI
    await page.mouse.move(100, 100);

    // Click "next" if it's still there
    const nextEl = await page.$(nxt);
    if (!nextEl) {
      console.log("No 'next' button found—likely at the end.");
      break;
    }
    await page.click(nxt);
  }

  await browser.close();
  console.log("Screenshots saved. Browser closed.");
})();

/**
 * Captures a screenshot as a buffer, crops/resizes to 1280x720,
 * then writes the final PNG to disk.
 */
async function captureCroppedScreenshot(page, outputPath) {
  // Take a screenshot as a buffer in memory
  const screenshotBuffer = await page.screenshot({ encoding: 'binary' });

  // Process it with Sharp to ensure exactly 1280x720
  // If the aspect ratio differs, 'cover' will trim edges
  await sharp(screenshotBuffer)
    .resize(1280, 720, {
      fit: 'cover'
    })
    .toFile(outputPath);
}
