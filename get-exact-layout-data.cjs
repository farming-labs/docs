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
    
    // Wait 3 seconds for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const result = await page.evaluate(() => {
      const results = {};

      // Check if nd-page exists
      const ndPage = document.getElementById('nd-page');
      results.ndPageExists = !!ndPage;

      // Check for below-title-block
      const block = document.querySelector('.fd-below-title-block');
      results.hasBelowTitleBlock = !!block;
      if (block) {
        results.blockChildren = Array.from(block.children).map(c => ({
          tag: c.tagName, 
          className: c.className,
          text: c.textContent?.trim().substring(0, 50)
        }));
      }

      // Find h1 and check what comes after it
      const article = document.querySelector('article');
      if (article) {
        const h1 = article.querySelector('h1');
        if (h1) {
          results.h1Found = true;
          results.h1Text = h1.textContent?.trim();
          
          let next = h1.nextElementSibling;
          results.afterH1 = [];
          for (let i = 0; i < 8 && next; i++) {
            results.afterH1.push({
              tag: next.tagName,
              className: next.className?.substring(0, 50),
              text: next.textContent?.trim().substring(0, 40),
            });
            next = next.nextElementSibling;
          }
        }
      }

      // Check if page actions are visible somewhere
      const pageActions = document.querySelector('[data-page-actions]');
      results.hasPageActions = !!pageActions;
      if (pageActions) {
        results.pageActionsParentClass = pageActions.parentElement?.className;
        results.pageActionsGrandparentClass = pageActions.parentElement?.parentElement?.className;
      }

      // Check for last-updated-inline
      const lastUpdated = document.querySelector('.fd-last-updated-inline');
      results.hasLastUpdatedInline = !!lastUpdated;
      if (lastUpdated) {
        results.lastUpdatedText = lastUpdated.textContent;
        results.lastUpdatedParentClass = lastUpdated.parentElement?.className;
      }

      // Check AI button
      const aiBtn = document.querySelector('.fd-ai-floating-btn');
      if (aiBtn) {
        const bs = getComputedStyle(aiBtn);
        results.aiBtnBorder = bs.border;
        results.aiBtnBorderColor = bs.borderColor;
      }

      // Check if dark mode
      results.isDark = document.documentElement.classList.contains('dark');

      return JSON.stringify(results, null, 2);
    });
    
    console.log(result);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
