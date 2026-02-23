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
    
    console.log('Navigating to http://localhost:3000/docs/themes/darksharp...');
    await page.goto('http://localhost:3000/docs/themes/darksharp', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('Taking initial screenshot...');
    await page.screenshot({ 
      path: 'darksharp-page-top.png', 
      fullPage: false 
    });
    console.log('Screenshot saved: darksharp-page-top.png\n');
    
    // Scroll to find code blocks
    console.log('Scrolling to find code blocks...');
    await page.evaluate(() => {
      window.scrollBy(0, 400);
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await page.screenshot({ 
      path: 'darksharp-with-code.png', 
      fullPage: false 
    });
    console.log('Screenshot saved: darksharp-with-code.png\n');
    
    // Analyze code block title bars
    const codeBlockData = await page.evaluate(() => {
      const data = {};
      
      // Find all figcaption elements (these are title bars for code blocks)
      const figcaptions = Array.from(document.querySelectorAll('figcaption'));
      
      data.titleBars = figcaptions.map(caption => {
        const style = getComputedStyle(caption);
        const rect = caption.getBoundingClientRect();
        
        // Get the pseudo-element styles if possible
        let beforeStyle = null;
        try {
          beforeStyle = getComputedStyle(caption, '::before');
        } catch (e) {}
        
        return {
          text: caption.textContent?.trim(),
          background: style.background,
          backgroundImage: style.backgroundImage,
          backgroundSize: style.backgroundSize,
          opacity: style.opacity,
          hasRepeatingGradient: style.backgroundImage.includes('repeating-linear-gradient'),
          hasDiagonalPattern: style.backgroundImage.includes('deg') || style.backgroundImage.includes('45deg'),
          position: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          className: caption.className,
          beforeBackground: beforeStyle ? beforeStyle.backgroundImage : null
        };
      });
      
      // Also check for pre elements with data-title
      const titledPres = Array.from(document.querySelectorAll('pre[data-title]'));
      data.titledPreCount = titledPres.length;
      
      return data;
    });
    
    console.log('CODE BLOCK TITLE BAR ANALYSIS:');
    console.log('===============================\n');
    console.log('Title bars found: ' + codeBlockData.titleBars.length);
    console.log('Pre elements with data-title: ' + codeBlockData.titledPreCount);
    console.log('');
    
    if (codeBlockData.titleBars.length > 0) {
      codeBlockData.titleBars.forEach((bar, i) => {
        console.log(`Title Bar ${i + 1}:`);
        console.log(`  Text: "${bar.text}"`);
        console.log(`  Position: ${bar.position}px from top`);
        console.log(`  Size: ${bar.width}×${bar.height}px`);
        console.log(`  Has repeating gradient: ${bar.hasRepeatingGradient ? 'YES ✓' : 'NO ✗'}`);
        console.log(`  Has diagonal pattern: ${bar.hasDiagonalPattern ? 'YES ✓' : 'NO ✗'}`);
        console.log(`  Background: ${bar.background.substring(0, 200)}`);
        if (bar.backgroundImage && bar.backgroundImage !== 'none') {
          console.log(`  Background Image: ${bar.backgroundImage.substring(0, 300)}`);
        }
        if (bar.backgroundSize) {
          console.log(`  Background Size: ${bar.backgroundSize}`);
        }
        console.log('');
      });
      
      // Take a close-up of the first code block
      console.log('Taking close-up of first code block title bar...');
      
      const closeupClip = await page.evaluate(() => {
        const firstCaption = document.querySelector('figcaption');
        if (firstCaption) {
          const figure = firstCaption.closest('figure');
          if (figure) {
            const rect = figure.getBoundingClientRect();
            return {
              x: Math.max(0, rect.x - 5),
              y: Math.max(0, rect.y - 5),
              width: Math.min(rect.width + 10, 900),
              height: Math.min(350, rect.height + 10)
            };
          }
        }
        return null;
      });
      
      if (closeupClip) {
        await page.screenshot({ 
          path: 'code-block-title-closeup.png',
          clip: closeupClip
        });
        console.log('Close-up saved: code-block-title-closeup.png\n');
      }
      
      // Take an even closer crop of just the title bar
      const titleBarClip = await page.evaluate(() => {
        const firstCaption = document.querySelector('figcaption');
        if (firstCaption) {
          const rect = firstCaption.getBoundingClientRect();
          return {
            x: Math.max(0, rect.x),
            y: Math.max(0, rect.y),
            width: Math.min(rect.width, 800),
            height: rect.height + 5
          };
        }
        return null;
      });
      
      if (titleBarClip) {
        await page.screenshot({ 
          path: 'title-bar-only.png',
          clip: titleBarClip
        });
        console.log('Title bar only saved: title-bar-only.png\n');
      }
      
    } else {
      console.log('No figcaption elements (title bars) found.');
      console.log('Taking full page screenshot for analysis...');
      
      await page.screenshot({ 
        path: 'full-page-darksharp.png',
        fullPage: true
      });
      console.log('Full page screenshot saved: full-page-darksharp.png');
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
