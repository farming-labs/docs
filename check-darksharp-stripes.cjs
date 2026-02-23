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
    
    console.log('Navigating to http://localhost:3002/docs...');
    await page.goto('http://localhost:3002/docs', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Taking screenshot of main docs page...');
    await page.screenshot({ 
      path: 'darksharp-docs-main.png', 
      fullPage: true 
    });
    console.log('Screenshot saved: darksharp-docs-main.png\n');
    
    // Check for code blocks with titles
    const codeBlockData = await page.evaluate(() => {
      // Look for code blocks with titles
      const codeBlocks = Array.from(document.querySelectorAll('pre, [class*="codeblock"], figure'));
      
      const titledBlocks = codeBlocks.filter(block => {
        // Check if it has a title/filename element
        const title = block.querySelector('[class*="title"], [class*="filename"], figcaption');
        return !!title;
      });
      
      return {
        totalCodeBlocks: codeBlocks.length,
        titledCodeBlocks: titledBlocks.length,
        titles: titledBlocks.slice(0, 5).map(block => {
          const titleEl = block.querySelector('[class*="title"], [class*="filename"], figcaption');
          return titleEl ? titleEl.textContent?.trim() : null;
        })
      };
    });
    
    console.log('CODE BLOCK ANALYSIS (Main Page):');
    console.log('=================================');
    console.log('Total code blocks: ' + codeBlockData.totalCodeBlocks);
    console.log('Code blocks with titles: ' + codeBlockData.titledCodeBlocks);
    if (codeBlockData.titles.length > 0) {
      console.log('Example titles found:');
      codeBlockData.titles.forEach((title, i) => {
        console.log('  ' + (i + 1) + '. ' + title);
      });
    }
    console.log('');
    
    if (codeBlockData.titledCodeBlocks === 0) {
      console.log('No titled code blocks found on main page.');
      console.log('Navigating to http://localhost:3002/docs/themes/darksharp...\n');
      
      await page.goto('http://localhost:3002/docs/themes/darksharp', { 
        waitUntil: 'networkidle2',
        timeout: 15000 
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Taking screenshot of darksharp theme page...');
      await page.screenshot({ 
        path: 'darksharp-theme-page.png', 
        fullPage: true 
      });
      console.log('Screenshot saved: darksharp-theme-page.png\n');
    }
    
    // Analyze code block title bars for diagonal stripes
    const stripeData = await page.evaluate(() => {
      const data = {};
      
      // Find all elements that could be code block titles
      const titleElements = Array.from(document.querySelectorAll(
        '[class*="title"], [class*="filename"], figcaption, [data-title], [data-language] + *'
      )).filter(el => {
        // Check if parent is a code block
        const parent = el.closest('pre, figure, [class*="codeblock"]');
        return !!parent;
      });
      
      data.titledBlocks = titleElements.map(title => {
        const style = getComputedStyle(title);
        const rect = title.getBoundingClientRect();
        
        return {
          text: title.textContent?.trim().substring(0, 50),
          background: style.background.substring(0, 200),
          backgroundImage: style.backgroundImage,
          hasStripes: style.backgroundImage.includes('linear-gradient') && 
                     (style.backgroundImage.includes('deg') || 
                      style.backgroundImage.includes('repeating')),
          className: title.className.substring(0, 80),
          position: `${Math.round(rect.top)}px from top`,
          width: Math.round(rect.width)
        };
      });
      
      // Also check for pre elements with data-title
      const preTitles = Array.from(document.querySelectorAll('pre[data-title]'));
      data.preTitleCount = preTitles.length;
      
      return data;
    });
    
    console.log('TITLE BAR STRIPE ANALYSIS:');
    console.log('==========================');
    console.log('Titled code blocks found: ' + stripeData.titledBlocks.length);
    console.log('Pre elements with data-title: ' + stripeData.preTitleCount);
    console.log('');
    
    if (stripeData.titledBlocks.length > 0) {
      console.log('Title bar details:');
      stripeData.titledBlocks.forEach((block, i) => {
        console.log('\nBlock ' + (i + 1) + ':');
        console.log('  Text: "' + block.text + '"');
        console.log('  Has diagonal stripes: ' + (block.hasStripes ? 'YES ✓' : 'NO ✗'));
        console.log('  Background: ' + block.background);
        if (block.backgroundImage && block.backgroundImage !== 'none') {
          console.log('  Background Image: ' + block.backgroundImage.substring(0, 150));
        }
        console.log('  Class: ' + block.className);
      });
    } else {
      console.log('No titled code blocks found for analysis.');
    }
    
    // Take a close-up screenshot of the first titled code block if found
    if (stripeData.titledBlocks.length > 0) {
      console.log('\nTaking close-up screenshot of first titled code block...');
      
      const codeBlockClip = await page.evaluate(() => {
        const titleEl = Array.from(document.querySelectorAll(
          '[class*="title"], [class*="filename"], figcaption'
        )).find(el => {
          const parent = el.closest('pre, figure, [class*="codeblock"]');
          return !!parent;
        });
        
        if (titleEl) {
          const parent = titleEl.closest('pre, figure, [class*="codeblock"]');
          if (parent) {
            const rect = parent.getBoundingClientRect();
            return {
              x: Math.max(0, rect.x - 10),
              y: Math.max(0, rect.y - 10),
              width: Math.min(rect.width + 20, 800),
              height: Math.min(rect.height + 20, 400)
            };
          }
        }
        return null;
      });
      
      if (codeBlockClip) {
        await page.screenshot({ 
          path: 'code-block-closeup.png',
          clip: codeBlockClip
        });
        console.log('Close-up saved: code-block-closeup.png');
      }
    }
    
    console.log('\n✅ Analysis complete!');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
