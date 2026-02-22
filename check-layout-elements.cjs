#!/usr/bin/env node

/**
 * Check TOC, Page Actions, Last Updated, and AI Button styling
 */

const puppeteer = require('puppeteer');

async function run() {
  console.log('🔍 Checking TOC, Page Actions, Last Updated, and AI Button...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('📍 Navigating to http://localhost:3000/docs');
    await page.goto('http://localhost:3000/docs', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📸 Taking screenshot');
    await page.screenshot({ 
      path: 'layout-check-final.png', 
      fullPage: true 
    });
    console.log('   ✅ Saved: layout-check-final.png\n');
    
    console.log('🔍 Running layout checks...\n');
    
    const results = await page.evaluate(() => {
      const results = {};

      // Check TOC
      const tocs = document.querySelectorAll('#nd-toc');
      results.tocCount = tocs.length;
      const tocH3 = document.querySelector('#nd-toc h3');
      results.tocHeadingText = tocH3?.textContent?.trim();
      const tocStyle = document.querySelector('#nd-toc [data-toc-style], #nd-toc .toc-thumb');
      results.hasTocThumb = !!document.querySelector('.toc-thumb');

      // Check page actions alignment
      const actionsWrapper = document.querySelector('[data-actions-alignment]');
      results.actionsAlignment = actionsWrapper?.getAttribute('data-actions-alignment');
      const actionsContainer = document.querySelector('[data-page-actions]');
      if (actionsContainer) {
        const cs = getComputedStyle(actionsContainer);
        results.actionsJustifyContent = cs.justifyContent;
        results.actionsDisplay = cs.display;
        results.actionsFlexDirection = cs.flexDirection;
      }

      // Check last updated
      const lastUpdatedInline = document.querySelector('.fd-last-updated-inline');
      results.hasInlineLastUpdated = !!lastUpdatedInline;
      results.inlineLastUpdatedText = lastUpdatedInline?.textContent?.trim();
      const lastUpdatedFooter = document.querySelector('.fd-last-updated');
      results.hasFooterLastUpdated = !!lastUpdatedFooter;
      results.footerLastUpdatedText = lastUpdatedFooter?.textContent?.trim();

      // Check Ask AI button
      const aiBtn = document.querySelector('.fd-ai-floating-btn, button[class*="Ask"]');
      if (aiBtn) {
        const bs = getComputedStyle(aiBtn);
        results.aiBtnBorder = bs.border;
        results.aiBtnBorderWidth = bs.borderWidth;
        results.aiBtnBorderColor = bs.borderColor;
        results.aiBtnBoxShadow = bs.boxShadow;
        results.aiBtnClasses = aiBtn.className;
      }
      
      // Additional checks
      results.allTocElements = document.querySelectorAll('[class*="toc"], [data-toc]').length;
      results.pageActionsLocation = actionsContainer ? 'found' : 'not found';
      
      return results;
    });
    
    console.log('📊 DETAILED RESULTS:\n');
    console.log(JSON.stringify(results, null, 2));
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. TOC Analysis
    console.log('1️⃣  TABLE OF CONTENTS (TOC) CHECK:\n');
    console.log(`   TOC count: ${results.tocCount}`);
    if (results.tocCount === 1) {
      console.log('   ✅ PASS: Only ONE TOC found');
    } else if (results.tocCount > 1) {
      console.log(`   ❌ FAIL: ${results.tocCount} TOCs found (should be 1)`);
    } else {
      console.log('   ⚠️  WARNING: No TOC found');
    }
    
    console.log(`\n   TOC heading: "${results.tocHeadingText}"`);
    console.log(`   Has animated thumb: ${results.hasTocThumb ? 'Yes' : 'No'}`);
    
    if (results.hasTocThumb) {
      console.log('   ⚠️  INFO: Animated thumb bar (directional style) is present');
    } else {
      console.log('   ✅ INFO: Using default straight-line style');
    }
    
    console.log(`\n   Total TOC-related elements: ${results.allTocElements}`);
    
    // 2. Page Actions Alignment
    console.log('\n2️⃣  PAGE ACTIONS ALIGNMENT CHECK:\n');
    if (results.pageActionsLocation === 'found') {
      console.log(`   Actions alignment attribute: ${results.actionsAlignment || 'not set'}`);
      console.log(`   CSS justify-content: ${results.actionsJustifyContent}`);
      console.log(`   CSS display: ${results.actionsDisplay}`);
      
      if (results.actionsJustifyContent === 'flex-end' || results.actionsAlignment === 'right') {
        console.log('   ✅ PASS: Actions aligned to the RIGHT');
      } else if (results.actionsJustifyContent === 'flex-start') {
        console.log('   ❌ FAIL: Actions aligned to the LEFT');
      } else {
        console.log(`   ⚠️  UNCLEAR: justify-content is "${results.actionsJustifyContent}"`);
      }
    } else {
      console.log('   ⚠️  Page actions container not found');
    }
    
    // 3. Last Updated
    console.log('\n3️⃣  LAST UPDATED CHECK:\n');
    console.log(`   Inline last updated (near title): ${results.hasInlineLastUpdated ? 'Found' : 'Not found'}`);
    if (results.hasInlineLastUpdated) {
      console.log(`   ✅ Text: "${results.inlineLastUpdatedText}"`);
    }
    
    console.log(`   Footer last updated: ${results.hasFooterLastUpdated ? 'Found' : 'Not found'}`);
    if (results.hasFooterLastUpdated) {
      console.log(`   Text: "${results.footerLastUpdatedText}"`);
    }
    
    if (results.hasInlineLastUpdated) {
      console.log('   ✅ PASS: "Last updated" appears near the top');
    } else if (results.hasFooterLastUpdated) {
      console.log('   ⚠️  INFO: Last updated only in footer, not near title');
    } else {
      console.log('   ⚠️  INFO: No "Last updated" text found');
    }
    
    // 4. Ask AI Button
    console.log('\n4️⃣  ASK AI BUTTON STYLING CHECK:\n');
    if (results.aiBtnBorder) {
      console.log(`   Border: ${results.aiBtnBorder}`);
      console.log(`   Border width: ${results.aiBtnBorderWidth}`);
      console.log(`   Border color: ${results.aiBtnBorderColor}`);
      console.log(`   Box shadow: ${results.aiBtnBoxShadow}`);
      
      // Check if border is subtle
      const borderWidth = parseFloat(results.aiBtnBorderWidth);
      if (borderWidth <= 1) {
        console.log('   ✅ PASS: Border is subtle (≤ 1px)');
      } else {
        console.log(`   ⚠️  INFO: Border width is ${borderWidth}px`);
      }
      
      // Check if color is subtle (not pure white)
      if (results.aiBtnBorderColor.includes('255, 255, 255') || 
          results.aiBtnBorderColor === 'rgb(255, 255, 255)') {
        console.log('   ⚠️  INFO: Border is pure white (might be bold)');
      } else {
        console.log('   ✅ INFO: Border color is subtle (not pure white)');
      }
    } else {
      console.log('   ⚠️  Ask AI button not found');
    }
    
    console.log('\n✅ Analysis complete!');
    console.log('📸 Screenshot: layout-check-final.png\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
