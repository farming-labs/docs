#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function run() {
  const browser = await puppeteer.launch({ 
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('Navigating to http://localhost:3000/docs...');
    await page.goto('http://localhost:3000/docs', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    console.log('Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Taking screenshot...');
    await page.screenshot({ 
      path: 'final-verification.png', 
      fullPage: true 
    });
    console.log('Screenshot saved: final-verification.png\n');
    
    console.log('Running JavaScript evaluation...\n');
    
    const result = await page.evaluate(() => {
      const r = {};

      // 1. Layout order: h1 → description → last-updated → separator → actions
      const h1 = document.querySelector('article h1, #nd-page h1');
      if (h1) {
        let el = h1.nextElementSibling;
        r.orderAfterH1 = [];
        for (let i = 0; i < 6 && el; i++) {
          r.orderAfterH1.push({
            cls: el.className?.substring(0, 40),
            tag: el.tagName,
            txt: el.textContent?.trim().substring(0, 40)
          });
          el = el.nextElementSibling;
        }
      }

      // 2. TOC active: only ONE indicator
      const tocActive = document.querySelector('#nd-toc a[data-active="true"]');
      if (tocActive) {
        const s = getComputedStyle(tocActive);
        r.tocActive = {
          color: s.color,
          bg: s.backgroundColor,
          boxShadow: s.boxShadow,
          fontWeight: s.fontWeight
        };
      }

      // 3. AI button border
      const ai = document.querySelector('.fd-ai-floating-btn');
      if (ai) {
        const s = getComputedStyle(ai);
        r.aiBorder = s.border;
        r.aiBorderColor = s.borderColor;
      }

      r.isDark = document.documentElement.classList.contains('dark');

      return JSON.stringify(r, null, 2);
    });
    
    console.log('EXACT JSON OUTPUT:');
    console.log('==================\n');
    console.log(result);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
