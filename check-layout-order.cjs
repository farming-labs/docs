#!/usr/bin/env node

/**
 * Check below-title layout order, TOC highlighting, and AI button
 */

const puppeteer = require('puppeteer');

async function run() {
  console.log('🔍 Checking below-title layout, TOC, and AI button...\n');
  
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
      path: 'layout-order-check.png', 
      fullPage: true 
    });
    console.log('   ✅ Saved: layout-order-check.png\n');
    
    console.log('🔍 Running layout verification...\n');
    
    const results = await page.evaluate(() => {
      const results = {};

      // Check below-title block
      const block = document.querySelector('.fd-below-title-block');
      results.hasBelowTitleBlock = !!block;
      if (block) {
        const lastUpdated = block.querySelector('.fd-last-updated-inline');
        results.hasLastUpdated = !!lastUpdated;
        results.lastUpdatedText = lastUpdated?.textContent?.trim();
        
        const separator = block.querySelector('.fd-title-separator');
        results.hasSeparator = !!separator;
        
        const actionsPortal = block.querySelector('.fd-actions-portal');
        results.hasActionsPortal = !!actionsPortal;
        results.actionsAlignment = actionsPortal?.getAttribute('data-actions-alignment');
        
        const actions = block.querySelector('[data-page-actions]');
        results.hasActionsInPortal = !!actions;
      }

      // Check layout order by looking at DOM order
      const h1 = document.querySelector('#nd-page h1, article h1');
      if (h1) {
        let next = h1.nextElementSibling;
        const order = [];
        for (let i = 0; i < 5 && next; i++) {
          order.push(next.className || next.tagName);
          next = next.nextElementSibling;
        }
        results.elementsAfterH1 = order;
      }

      // Check TOC active state
      const tocActive = document.querySelector('#nd-toc a[data-active="true"]');
      if (tocActive) {
        const cs = getComputedStyle(tocActive);
        results.tocActiveColor = cs.color;
        results.tocActiveBg = cs.backgroundColor;
        results.tocActiveBoxShadow = cs.boxShadow;
        results.tocActiveFontWeight = cs.fontWeight;
        results.tocActiveBorder = cs.border;
        results.tocActiveBorderLeft = cs.borderLeft;
      }

      // Check Ask AI button
      const aiBtn = document.querySelector('[class*="fd-ai-floating"]');
      if (aiBtn) {
        const bs = getComputedStyle(aiBtn);
        results.aiBtnBorder = bs.border;
        results.aiBtnBorderColor = bs.borderColor;
        results.aiBtnBorderWidth = bs.borderWidth;
      }
      
      return results;
    });
    
    console.log('📊 RAW RESULTS:\n');
    console.log(JSON.stringify(results, null, 2));
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 1. Layout order below title
    console.log('1️⃣  LAYOUT ORDER BELOW TITLE:\n');
    
    if (results.hasBelowTitleBlock) {
      console.log('   ✅ Found .fd-below-title-block container');
      console.log(`   - Last updated: ${results.hasLastUpdated ? '✅ Found' : '❌ Missing'}`);
      if (results.hasLastUpdated) {
        console.log(`     Text: "${results.lastUpdatedText}"`);
      }
      console.log(`   - Separator: ${results.hasSeparator ? '✅ Found' : '❌ Missing'}`);
      console.log(`   - Actions portal: ${results.hasActionsPortal ? '✅ Found' : '❌ Missing'}`);
      if (results.hasActionsPortal) {
        console.log(`     Alignment: ${results.actionsAlignment}`);
        console.log(`     Has actions: ${results.hasActionsInPortal ? 'Yes' : 'No'}`);
      }
      
      const hasAll = results.hasLastUpdated && results.hasSeparator && results.hasActionsPortal;
      if (hasAll) {
        console.log('\n   ✅ PASS: All components present in below-title block');
        console.log('   Expected order: h1 → Last updated → Separator → Page Actions');
      } else {
        console.log('\n   ⚠️  Some components missing');
      }
    } else {
      console.log('   ⚠️  .fd-below-title-block not found');
      console.log('\n   Elements after h1 (by DOM order):');
      results.elementsAfterH1?.forEach((el, i) => {
        console.log(`   ${i + 1}. ${el}`);
      });
    }
    
    // 2. TOC highlighting
    console.log('\n2️⃣  TOC ACTIVE ITEM HIGHLIGHTING:\n');
    
    if (results.tocActiveColor) {
      console.log('   Active item styling:');
      console.log(`   - Color: ${results.tocActiveColor}`);
      console.log(`   - Background: ${results.tocActiveBg}`);
      console.log(`   - Box shadow: ${results.tocActiveBoxShadow}`);
      console.log(`   - Font weight: ${results.tocActiveFontWeight}`);
      console.log(`   - Border left: ${results.tocActiveBorderLeft}`);
      
      // Count number of visual indicators
      let indicatorCount = 0;
      if (results.tocActiveBg !== 'rgba(0, 0, 0, 0)' && results.tocActiveBg !== 'transparent') {
        indicatorCount++;
        console.log('\n   📍 Indicator 1: Background color');
      }
      if (results.tocActiveBoxShadow !== 'none') {
        indicatorCount++;
        console.log('   📍 Indicator 2: Box shadow (left border effect)');
      }
      
      if (indicatorCount === 1) {
        console.log('\n   ✅ PASS: Only ONE type of highlighting visible');
      } else if (indicatorCount > 1) {
        console.log(`\n   ⚠️  INFO: ${indicatorCount} types of highlighting detected`);
      } else {
        console.log('\n   ⚠️  No visible highlighting detected');
      }
    } else {
      console.log('   ⚠️  No active TOC item found');
    }
    
    // 3. Ask AI button
    console.log('\n3️⃣  ASK AI BUTTON BORDER:\n');
    
    if (results.aiBtnBorder) {
      console.log(`   Border: ${results.aiBtnBorder}`);
      console.log(`   Border color: ${results.aiBtnBorderColor}`);
      console.log(`   Border width: ${results.aiBtnBorderWidth}`);
      
      const borderWidth = parseFloat(results.aiBtnBorderWidth);
      const hasBorder = borderWidth > 0;
      const isSubtle = borderWidth <= 1 && !results.aiBtnBorderColor.includes('255, 255, 255');
      
      if (hasBorder && isSubtle) {
        console.log('\n   ✅ PASS: Visible but subtle border');
      } else if (hasBorder && !isSubtle) {
        console.log('\n   ⚠️  Border visible but might be too bold');
      } else {
        console.log('\n   ⚠️  No border detected');
      }
    } else {
      console.log('   ⚠️  Ask AI button not found');
    }
    
    console.log('\n✅ Analysis complete!');
    console.log('📸 Screenshot: layout-order-check.png\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
