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
    
    // Try multiple pages to find code blocks
    const pagesToTry = [
      'http://localhost:3002/docs/cli',
      'http://localhost:3002/docs/themes',
      'http://localhost:3002/docs/configuration',
      'http://localhost:3002/docs'
    ];
    
    for (const url of pagesToTry) {
      console.log(`\nTrying: ${url}...`);
      
      try {
        await page.goto(url, { 
          waitUntil: 'networkidle2',
          timeout: 10000 
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check for code blocks
        const hasCodeBlocks = await page.evaluate(() => {
          const codeBlocks = document.querySelectorAll('pre code, pre, [class*="codeblock"]');
          return codeBlocks.length > 0;
        });
        
        if (hasCodeBlocks) {
          console.log(`✓ Found code blocks on ${url}`);
          
          await page.screenshot({ 
            path: `page-with-code-${pagesToTry.indexOf(url)}.png`, 
            fullPage: true 
          });
          
          // Analyze for diagonal stripes
          const stripeData = await page.evaluate(() => {
            const allPres = Array.from(document.querySelectorAll('pre'));
            
            return allPres.map((pre, idx) => {
              // Check for title attributes or sibling elements
              const dataTitle = pre.getAttribute('data-title');
              const dataLang = pre.getAttribute('data-language');
              const prevSibling = pre.previousElementSibling;
              const hasTitle = dataTitle || (prevSibling && prevSibling.textContent.length < 50);
              
              // Check the pre element's background
              const preStyle = getComputedStyle(pre);
              
              // Check if there's a ::before or title element
              let titleBarInfo = null;
              const firstChild = pre.firstElementChild;
              if (firstChild && firstChild.tagName !== 'CODE') {
                const style = getComputedStyle(firstChild);
                titleBarInfo = {
                  element: firstChild.tagName,
                  background: style.background.substring(0, 200),
                  backgroundImage: style.backgroundImage
                };
              }
              
              return {
                index: idx,
                hasDataTitle: !!dataTitle,
                dataTitle: dataTitle,
                dataLang: dataLang,
                preBackground: preStyle.background.substring(0, 200),
                preBackgroundImage: preStyle.backgroundImage,
                titleBarInfo: titleBarInfo,
                codeSnippet: pre.textContent.substring(0, 50)
              };
            });
          });
          
          console.log(`\nFound ${stripeData.length} code blocks:`);
          stripeData.forEach((block, i) => {
            console.log(`\n  Block ${i + 1}:`);
            console.log(`    Has data-title: ${block.hasDataTitle}`);
            if (block.dataTitle) {
              console.log(`    Title: "${block.dataTitle}"`);
            }
            console.log(`    Language: ${block.dataLang || 'none'}`);
            console.log(`    Pre background: ${block.preBackground}`);
            if (block.preBackgroundImage !== 'none') {
              console.log(`    Pre background-image: ${block.preBackgroundImage}`);
            }
            if (block.titleBarInfo) {
              console.log(`    Title bar element: ${block.titleBarInfo.element}`);
              console.log(`    Title bar background: ${block.titleBarInfo.background}`);
            }
          });
          
          break; // Found code blocks, stop searching
        } else {
          console.log(`  No code blocks found`);
        }
        
      } catch (err) {
        console.log(`  Error loading page: ${err.message}`);
      }
    }
    
    console.log('\n✅ Search complete!');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
