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
    
    await page.goto('http://localhost:3000/docs', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    // Wait 3 seconds
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const result = await page.evaluate(() => {
      const r = {};

      // Check AI button border-radius and border
      const ai = document.querySelector('.fd-ai-floating-btn');
      if (ai) {
        const s = getComputedStyle(ai);
        r.aiBtnBorderRadius = s.borderRadius;
        r.aiBtnBorder = s.border;
      }

      r.isDark = document.documentElement.classList.contains('dark');

      // Check page loads correctly (no import errors)
      r.hasH1 = !!document.querySelector('article h1, #nd-page h1');
      r.hasSidebar = !!document.querySelector('aside');
      r.hasToc = !!document.querySelector('#nd-toc');

      // Check below-title block still works
      const block = document.querySelector('.fd-below-title-block');
      r.hasBelowTitleBlock = !!block;
      if (block) {
        r.blockChildren = Array.from(block.children).map(c => ({
          tag: c.tagName,
          cls: c.className
        }));
      }

      return JSON.stringify(r, null, 2);
    });
    
    console.log(result);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
